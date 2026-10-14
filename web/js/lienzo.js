// lienzo.js — Gráfico interactivo de f(x) sobre papel milimetrado (canvas).
//
// Los puntos de la curva los calcula Python (/api/muestrear); acá solo se
// transforman coordenadas y se dibuja. Permite arrastrar, hacer zoom con la
// rueda y dibujar capas extra (secantes, puntos) encima de la curva.

import { llamar } from "./api.js";
import { colores, corto } from "./formato.js";

const SUAVIZADO = (t) => 1 - Math.pow(1 - t, 3);   // easeOutCubic

export class Lienzo {
  constructor(contenedor) {
    this.contenedor = contenedor;
    this.canvas = contenedor.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.coordenadas = contenedor.querySelector(".grafico-coordenadas");

    this.vista = { xmin: -5, xmax: 5, ymin: -5, ymax: 5 };
    this.funcion = null;
    this.curva = [];
    this.rangoCurva = null;          // [desde, hasta, puntos] de la última muestra
    this.capas = [];                 // funciones (ctx, lienzo) que dibujan encima
    this.alInteractuar = null;       // aviso cuando el usuario mueve la vista
    this.alAjustar = null;           // qué hace el botón ⤢
    this.ancho = 0;
    this.alto = 0;
    this._pedido = 0;
    this._dibujoPendiente = false;
    this._animacion = null;
    this._ultimaMuestra = 0;
    this._temporizador = null;

    new ResizeObserver(() => this._redimensionar()).observe(contenedor);
    this._eventos();
  }

  // ---------------------------------------------------------------- vista ---

  aX(x) { return ((x - this.vista.xmin) / (this.vista.xmax - this.vista.xmin)) * this.ancho; }
  aY(y) { return ((this.vista.ymax - y) / (this.vista.ymax - this.vista.ymin)) * this.alto; }
  deX(px) { return this.vista.xmin + (px / this.ancho) * (this.vista.xmax - this.vista.xmin); }
  deY(py) { return this.vista.ymax - (py / this.alto) * (this.vista.ymax - this.vista.ymin); }

  fijarVista(v) {
    this.vista = { ...v };
    this.solicitarDibujo();
    this._programarMuestra();
  }

  /** Lleva la vista a `destino` con una transición suave. */
  animarVista(destino, duracion = 650) {
    if (this._animacion) cancelAnimationFrame(this._animacion.id);
    if (duracion <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.fijarVista(destino);
      return;
    }
    const origen = { ...this.vista };
    const inicio = performance.now();
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / duracion);
      const k = SUAVIZADO(t);
      // Interpolación en escala logarítmica del ancho: el zoom se siente parejo
      const interpolar = (a, b) => a + (b - a) * k;
      const cx = interpolar((origen.xmin + origen.xmax) / 2, (destino.xmin + destino.xmax) / 2);
      const cy = interpolar((origen.ymin + origen.ymax) / 2, (destino.ymin + destino.ymax) / 2);
      const w = Math.exp(interpolar(Math.log(origen.xmax - origen.xmin), Math.log(destino.xmax - destino.xmin)));
      const h = Math.exp(interpolar(Math.log(origen.ymax - origen.ymin), Math.log(destino.ymax - destino.ymin)));
      this.vista = { xmin: cx - w / 2, xmax: cx + w / 2, ymin: cy - h / 2, ymax: cy + h / 2 };
      this.solicitarDibujo();
      this._programarMuestra(true);
      if (t < 1) this._animacion = { id: requestAnimationFrame(paso) };
      else { this._animacion = null; this._programarMuestra(); }
    };
    this._animacion = { id: requestAnimationFrame(paso) };
  }

  /** Vista que contiene los puntos dados, con margen. */
  static encuadrar(xs, ys, margen = 0.18) {
    let xmin = Math.min(...xs), xmax = Math.max(...xs);
    let ymin = Math.min(...ys), ymax = Math.max(...ys);
    const minimoX = 1e-9 * Math.max(1, Math.abs(xmin), Math.abs(xmax));
    if (xmax - xmin < minimoX) { const c = (xmin + xmax) / 2; xmin = c - minimoX; xmax = c + minimoX; }
    const minimoY = 1e-12 + (ymax - ymin) * 0;
    if (ymax - ymin < minimoY) { ymin -= 1; ymax += 1; }
    const mx = (xmax - xmin) * margen, my = (ymax - ymin) * margen;
    return { xmin: xmin - mx, xmax: xmax + mx, ymin: ymin - my, ymax: ymax + my };
  }

  /** Ajusta el eje y a la curva visible (recortando valores extremos). */
  ajustarY() {
    const ys = this.curva
      .filter(([x, y]) => y !== null && x >= this.vista.xmin && x <= this.vista.xmax)
      .map(([, y]) => y)
      .sort((a, b) => a - b);
    if (!ys.length) return;
    let ymin = ys[Math.floor(ys.length * 0.04)];
    let ymax = ys[Math.ceil(ys.length * 0.96) - 1];
    ymin = Math.min(ymin, 0);
    ymax = Math.max(ymax, 0);
    if (ymax - ymin < 1e-12) { ymin -= 1; ymax += 1; }
    const m = (ymax - ymin) * 0.12;
    this.fijarVista({ ...this.vista, ymin: ymin - m, ymax: ymax + m });
  }

  // ---------------------------------------------------------------- curva ---

  async fijarFuncion(texto, { ajustar = false } = {}) {
    this.funcion = texto || null;
    this.rangoCurva = null;
    if (!this.funcion) {
      this.curva = [];
      this.solicitarDibujo();
      return;
    }
    await this._muestrear();
    if (ajustar) this.ajustarY();
  }

  /** Curva ya calculada (por ejemplo, la que vino junto con el resultado). */
  fijarCurva(texto, curva) {
    this.funcion = texto;
    this.curva = curva;
    if (curva.length) this.rangoCurva = [curva[0][0], curva[curva.length - 1][0], curva.length];
    this.solicitarDibujo();
  }

  _programarMuestra(enMovimiento = false) {
    if (!this.funcion) return;
    clearTimeout(this._temporizador);
    // Durante una animación se pide como máximo cada 140 ms; si no, al terminar
    const ahora = performance.now();
    if (enMovimiento && ahora - this._ultimaMuestra > 140) {
      this._muestrear();
      return;
    }
    this._temporizador = setTimeout(() => this._muestrear(), enMovimiento ? 140 : 90);
  }

  _necesitaMuestra() {
    if (!this.rangoCurva) return true;
    const [desde, hasta, puntos] = this.rangoCurva;
    const { xmin, xmax } = this.vista;
    if (xmin < desde || xmax > hasta) return true;
    const resolucionActual = (hasta - desde) / puntos;
    const resolucionNecesaria = (xmax - xmin) / Math.max(200, this.ancho);
    return resolucionActual > resolucionNecesaria * 1.6;
  }

  async _muestrear() {
    if (!this.funcion || !this._necesitaMuestra()) return;
    this._ultimaMuestra = performance.now();
    const ancho = this.vista.xmax - this.vista.xmin;
    const desde = this.vista.xmin - ancho * 0.3;
    const hasta = this.vista.xmax + ancho * 0.3;
    const puntos = Math.min(2400, Math.max(400, Math.round(this.ancho * 1.6 * 1.6)));
    const numero = ++this._pedido;
    const r = await llamar("muestrear", { funcion: this.funcion, desde, hasta, puntos });
    if (numero !== this._pedido || !r.ok) return;   // llegó una respuesta vieja
    this.curva = r.curva;
    this.rangoCurva = [desde, hasta, puntos];
    this.solicitarDibujo();
  }

  // ---------------------------------------------------------------- dibujo ---

  solicitarDibujo() {
    if (this._dibujoPendiente) return;
    this._dibujoPendiente = true;
    requestAnimationFrame(() => {
      this._dibujoPendiente = false;
      this.dibujar();
    });
  }

  _redimensionar() {
    const r = this.contenedor.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const anchoAnterior = this.ancho;
    this.ancho = r.width;
    this.alto = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dibujar();
    if (!anchoAnterior) this._programarMuestra();
  }

  dibujar() {
    if (!this.ancho) return;
    const ctx = this.ctx;
    const c = colores();
    this.c = c;
    ctx.clearRect(0, 0, this.ancho, this.alto);
    ctx.fillStyle = c.papel;
    ctx.fillRect(0, 0, this.ancho, this.alto);
    this._dibujarCuadricula(ctx, c);
    this._dibujarCurva(ctx, c);
    for (const capa of this.capas) {
      ctx.save();
      capa(ctx, this);
      ctx.restore();
    }
  }

  /** Paso "lindo" (1, 2 o 5 × 10ᵏ) para que haya ~`objetivo` px entre líneas. */
  static pasoRedondo(rango, pixeles, objetivo = 90) {
    const crudo = (rango / pixeles) * objetivo;
    const potencia = Math.pow(10, Math.floor(Math.log10(crudo)));
    const fraccion = crudo / potencia;
    const base = fraccion < 1.5 ? 1 : fraccion < 3.5 ? 2 : fraccion < 7.5 ? 5 : 10;
    return base * potencia;
  }

  _dibujarCuadricula(ctx, c) {
    const { xmin, xmax, ymin, ymax } = this.vista;
    const pasoX = Lienzo.pasoRedondo(xmax - xmin, this.ancho);
    const pasoY = Lienzo.pasoRedondo(ymax - ymin, this.alto);

    // Líneas finas (milímetros): 5 por cada línea principal
    ctx.lineWidth = 1;
    ctx.strokeStyle = c.cuadricula;
    ctx.beginPath();
    for (let x = Math.ceil(xmin / (pasoX / 5)) * (pasoX / 5); x <= xmax; x += pasoX / 5) {
      const px = Math.round(this.aX(x)) + 0.5;
      ctx.moveTo(px, 0); ctx.lineTo(px, this.alto);
    }
    for (let y = Math.ceil(ymin / (pasoY / 5)) * (pasoY / 5); y <= ymax; y += pasoY / 5) {
      const py = Math.round(this.aY(y)) + 0.5;
      ctx.moveTo(0, py); ctx.lineTo(this.ancho, py);
    }
    ctx.stroke();

    // Líneas principales
    ctx.strokeStyle = c.cuadriculaFuerte;
    ctx.beginPath();
    for (let x = Math.ceil(xmin / pasoX) * pasoX; x <= xmax; x += pasoX) {
      const px = Math.round(this.aX(x)) + 0.5;
      ctx.moveTo(px, 0); ctx.lineTo(px, this.alto);
    }
    for (let y = Math.ceil(ymin / pasoY) * pasoY; y <= ymax; y += pasoY) {
      const py = Math.round(this.aY(y)) + 0.5;
      ctx.moveTo(0, py); ctx.lineTo(this.ancho, py);
    }
    ctx.stroke();

    // Ejes (si están fuera de la vista, las marcas se pegan al borde)
    const ejeY = Math.min(Math.max(this.aY(0), 0), this.alto);
    const ejeX = Math.min(Math.max(this.aX(0), 0), this.ancho);
    ctx.strokeStyle = c.grafito;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    if (ymin <= 0 && ymax >= 0) { ctx.moveTo(0, Math.round(ejeY) + 0.5); ctx.lineTo(this.ancho, Math.round(ejeY) + 0.5); }
    if (xmin <= 0 && xmax >= 0) { ctx.moveTo(Math.round(ejeX) + 0.5, 0); ctx.lineTo(Math.round(ejeX) + 0.5, this.alto); }
    ctx.stroke();

    // Números de la escala
    ctx.font = `11px ${c.fuenteUI}`;
    ctx.fillStyle = c.grafitoSuave;
    const decimalesX = Math.max(0, -Math.floor(Math.log10(pasoX)));
    const decimalesY = Math.max(0, -Math.floor(Math.log10(pasoY)));
    const formato = (v, d) => {
      if (Math.abs(v) < 1e-12 * Math.max(1, pasoX)) return "0";
      const a = Math.abs(v);
      if (a >= 1e6 || (a < 1e-4 && a > 0)) return corto(v, 3);
      return v.toFixed(Math.min(d, 10)).replace("-", "−");
    };
    const yEtiquetas = Math.min(Math.max(ejeY + 15, 15), this.alto - 6);
    ctx.textAlign = "center";
    for (let x = Math.ceil(xmin / pasoX) * pasoX; x <= xmax; x += pasoX) {
      if (Math.abs(x) < pasoX / 2 && xmin <= 0 && xmax >= 0) continue;
      ctx.fillText(formato(x, decimalesX), this.aX(x), yEtiquetas);
    }
    const xEtiquetas = ejeX < 50 ? ejeX + 6 : ejeX - 6;
    ctx.textAlign = ejeX < 50 ? "left" : "right";
    for (let y = Math.ceil(ymin / pasoY) * pasoY; y <= ymax; y += pasoY) {
      if (Math.abs(y) < pasoY / 2) continue;
      ctx.fillText(formato(y, decimalesY), xEtiquetas, this.aY(y) + 4);
    }
  }

  _dibujarCurva(ctx, c) {
    if (!this.curva.length) return;
    const alturaVista = this.vista.ymax - this.vista.ymin;
    const limite = (py) => Math.max(-4000, Math.min(this.alto + 4000, py));
    ctx.strokeStyle = c.tinta;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    let anterior = null;
    for (const [x, y] of this.curva) {
      if (y === null) { anterior = null; continue; }
      // Un salto enorme entre dos muestras indica una asíntota: no se une
      if (anterior !== null && Math.abs(y - anterior) > alturaVista * 3 && Math.sign(y) !== Math.sign(anterior)) {
        anterior = null;
      }
      const px = this.aX(x), py = limite(this.aY(y));
      if (anterior === null) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      anterior = y;
    }
    ctx.stroke();
  }

  /** Valor aproximado de f(x) interpolando las muestras (para el puntero). */
  valorEn(x) {
    const p = this.curva;
    if (p.length < 2 || x < p[0][0] || x > p[p.length - 1][0]) return null;
    let a = 0, b = p.length - 1;
    while (b - a > 1) { const m = (a + b) >> 1; if (p[m][0] <= x) a = m; else b = m; }
    const [x0, y0] = p[a], [x1, y1] = p[b];
    if (y0 === null || y1 === null) return null;
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }

  // ---------------------------------------------------------------- eventos ---

  _eventos() {
    let arrastre = null;
    const el = this.canvas;

    el.addEventListener("pointerdown", (e) => {
      arrastre = { x: e.clientX, y: e.clientY, vista: { ...this.vista } };
      el.setPointerCapture(e.pointerId);
      this.contenedor.classList.add("arrastrando");
    });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      if (arrastre) {
        const dx = ((e.clientX - arrastre.x) / this.ancho) * (arrastre.vista.xmax - arrastre.vista.xmin);
        const dy = ((e.clientY - arrastre.y) / this.alto) * (arrastre.vista.ymax - arrastre.vista.ymin);
        this.fijarVista({
          xmin: arrastre.vista.xmin - dx, xmax: arrastre.vista.xmax - dx,
          ymin: arrastre.vista.ymin + dy, ymax: arrastre.vista.ymax + dy,
        });
        this.alInteractuar?.();
      }
      this._mostrarCoordenadas(px);
    });
    const soltar = () => { arrastre = null; this.contenedor.classList.remove("arrastrando"); };
    el.addEventListener("pointerup", soltar);
    el.addEventListener("pointercancel", soltar);
    el.addEventListener("pointerleave", () => { if (this.coordenadas) this.coordenadas.textContent = ""; });

    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const factor = Math.pow(1.0018, e.deltaY);
      this.zoom(factor, e.clientX - r.left, e.clientY - r.top);
      this.alInteractuar?.();
    }, { passive: false });

    el.addEventListener("dblclick", () => this.alAjustar?.());

    this.contenedor.querySelectorAll("[data-zoom]").forEach((b) => {
      b.addEventListener("click", () => {
        const accion = b.dataset.zoom;
        if (accion === "ajustar") { this.alAjustar?.(); return; }
        this.zoom(accion === "acercar" ? 0.7 : 1 / 0.7, this.ancho / 2, this.alto / 2, true);
        this.alInteractuar?.();
      });
    });
  }

  /** Zoom con centro en el píxel (px, py). factor < 1 acerca. */
  zoom(factor, px, py, animado = false) {
    const x = this.deX(px), y = this.deY(py);
    const v = this.vista;
    const destino = {
      xmin: x - (x - v.xmin) * factor, xmax: x + (v.xmax - x) * factor,
      ymin: y - (y - v.ymin) * factor, ymax: y + (v.ymax - y) * factor,
    };
    const ancho = destino.xmax - destino.xmin;
    if (ancho < 1e-12 * Math.max(1, Math.abs(x)) || ancho > 1e9) return;
    if (animado) this.animarVista(destino, 250);
    else this.fijarVista(destino);
  }

  _mostrarCoordenadas(px) {
    if (!this.coordenadas || !this.curva.length) return;
    const x = this.deX(px);
    const y = this.valorEn(x);
    this.coordenadas.textContent = `x = ${corto(x, 6)}   f(x) ≈ ${y === null ? "no definida" : corto(y, 6)}`;
  }
}
