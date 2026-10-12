// pasos.js — Animación paso a paso del método de la secante.
//
// Cada iteración se divide en 5 subpasos:
//   0. Ubicar los dos últimos puntos sobre la curva
//   1. Trazar la recta secante que pasa por ellos
//   2. Encontrar dónde la secante corta al eje x  ->  xₙ₊₁
//   3. Evaluar f(xₙ₊₁)  (subir/bajar hasta la curva)
//   4. Calcular el error y decidir si seguir o parar
//
// Todos los números vienen calculados desde Python; acá solo se dibujan.

import { Lienzo } from "./lienzo.js";
import { num, numHTML, escapar } from "./formato.js";

const DURACIONES = [1100, 1500, 1200, 1100, 1500];     // ms por subpaso a velocidad 1×
const SUBPASOS = 5;
const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class PasoAPaso {
  constructor(lienzo, el) {
    this.lienzo = lienzo;
    this.el = el;     // { explicacion, lineaTiempo, reproducir, anterior, siguiente, inicio, fin, velocidad }
    this.datos = null;
    this.iteraciones = [];
    this.i = 0;
    this.s = 0;
    this.t = 0;
    this.reproduciendo = false;
    this.velocidad = 1;
    this.seguir = true;            // la cámara acompaña a la iteración actual
    this.decimales = 8;
    this._ultimo = 0;

    lienzo.capas.push((ctx, L) => this._dibujar(ctx, L));
    lienzo.alInteractuar = () => { this.seguir = false; };
    lienzo.alAjustar = () => { this.seguir = true; this._encuadrar(true); };

    el.reproducir.addEventListener("click", () => this.alternar());
    el.anterior.addEventListener("click", () => this.retroceder());
    el.siguiente.addEventListener("click", () => this.avanzar());
    el.inicio.addEventListener("click", () => this.irA(0, 0));
    el.fin.addEventListener("click", () => this.irA(this.iteraciones.length - 1, SUBPASOS - 1, 1));
    el.velocidad.addEventListener("change", () => { this.velocidad = parseFloat(el.velocidad.value); });
  }

  // ------------------------------------------------------------ control ---

  cargar(datos, decimales) {
    this.datos = datos;
    this.decimales = decimales;
    this.iteraciones = datos.resultado.iteraciones;
    this.pausar();
    this.seguir = true;
    this.lienzo.fijarCurva(datos.funcion.texto, datos.curva);
    this._crearLineaTiempo();
    this.irA(0, 0, 0, false);
  }

  /** Va a la iteración i, subpaso s, progreso t. */
  irA(i, s = 0, t = 0, animarCamara = true) {
    if (!this.iteraciones.length) {
      this._renderExplicacion();
      this.lienzo.fijarVista(Lienzo.encuadrar([this.datos.resultado.x0, this.datos.resultado.x1], [0, this.datos.resultado.f_x0 ?? 0, this.datos.resultado.f_x1 ?? 0], 0.6));
      return;
    }
    const cambioIteracion = i !== this.i || !this._explicacionLista;
    this.i = Math.max(0, Math.min(i, this.iteraciones.length - 1));
    this.s = Math.max(0, Math.min(s, SUBPASOS - 1));
    this.t = t;
    if (cambioIteracion) this._renderExplicacion();
    this._actualizarSubpasos();
    if (this.seguir) this._encuadrar(animarCamara);
    this.lienzo.solicitarDibujo();
  }

  irAIteracion(i) {
    this.pausar();
    this.seguir = true;
    this.irA(i, 0, 0);
  }

  alternar() { this.reproduciendo ? this.pausar() : this.reproducir(); }

  reproducir() {
    if (!this.iteraciones.length) return;
    if (this._alFinal()) this.irA(0, 0, 0);
    this.reproduciendo = true;
    this.el.reproducir.classList.add("reproduciendo");
    this.el.reproducir.setAttribute("aria-label", "Pausar");
    this._ultimo = performance.now();
    const cuadro = (ahora) => {
      if (!this.reproduciendo) return;
      const dt = Math.min(64, ahora - this._ultimo);
      this._ultimo = ahora;
      this._avanzarTiempo(dt);
      requestAnimationFrame(cuadro);
    };
    requestAnimationFrame(cuadro);
  }

  pausar() {
    this.reproduciendo = false;
    this.el.reproducir.classList.remove("reproduciendo");
    this.el.reproducir.setAttribute("aria-label", "Reproducir");
  }

  avanzar() {
    this.pausar();
    if (this.t < 1) { this.t = 1; this._actualizarSubpasos(); this.lienzo.solicitarDibujo(); return; }
    if (this.s < SUBPASOS - 1) this.irA(this.i, this.s + 1, 1);
    else if (this.i < this.iteraciones.length - 1) this.irA(this.i + 1, 0, 1);
  }

  retroceder() {
    this.pausar();
    if (this.s > 0) this.irA(this.i, this.s - 1, 1);
    else if (this.i > 0) this.irA(this.i - 1, SUBPASOS - 1, 1);
    else this.irA(0, 0, 0);
  }

  _alFinal() {
    return this.i === this.iteraciones.length - 1 && this.s === SUBPASOS - 1 && this.t >= 1;
  }

  _avanzarTiempo(dt) {
    this.t += (dt * this.velocidad) / DURACIONES[this.s];
    if (this.t >= 1) {
      if (this.s < SUBPASOS - 1) {
        this.s += 1;
        this.t = 0;
        this._actualizarSubpasos();
      } else if (this.i < this.iteraciones.length - 1) {
        this.irA(this.i + 1, 0, 0);
      } else {
        this.t = 1;
        this.pausar();
        this._actualizarSubpasos();
      }
    }
    this._actualizarProgreso();
    this.lienzo.solicitarDibujo();
  }

  /** Cámara: encuadra los tres puntos de la iteración actual y el eje x. */
  _encuadrar(animado) {
    const it = this.iteraciones[this.i];
    if (!it) return;
    const xs = [it.x_anterior, it.x_actual, it.x_siguiente];
    const ys = [it.f_anterior, it.f_actual, it.f_siguiente, 0];
    const destino = Lienzo.encuadrar(xs, ys, 0.28);
    if (animado) this.lienzo.animarVista(destino, 750);
    else this.lienzo.fijarVista(destino);
  }

  // ------------------------------------------------------------ interfaz ---

  _crearLineaTiempo() {
    const cont = this.el.lineaTiempo;
    cont.innerHTML = "";
    this.iteraciones.forEach((it, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = it.n;
      b.title = `Iteración ${it.n}`;
      b.innerHTML = `${it.n}<span class="progreso"></span>`;
      b.addEventListener("click", () => this.irAIteracion(i));
      cont.appendChild(b);
    });
  }

  _actualizarProgreso() {
    const botones = this.el.lineaTiempo.children;
    for (let k = 0; k < botones.length; k++) {
      botones[k].classList.toggle("hecho", k < this.i);
      botones[k].classList.toggle("actual", k === this.i);
      const barra = botones[k].querySelector(".progreso");
      const avance = k < this.i ? 1 : k > this.i ? 0 : (this.s + Math.min(this.t, 1)) / SUBPASOS;
      barra.style.width = `${avance * 100}%`;
    }
    const actual = botones[this.i];
    if (actual && this._botonVisible !== this.i) {
      this._botonVisible = this.i;
      actual.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  _actualizarSubpasos() {
    const items = this.el.explicacion.querySelectorAll(".subpaso");
    items.forEach((li, k) => {
      li.classList.toggle("hecho", k < this.s || (k === this.s && this.t >= 1 && k === SUBPASOS - 1));
      li.classList.toggle("actual", k === this.s);
    });
    const decision = this.el.explicacion.querySelector(".final-iteracion");
    if (decision) decision.hidden = !(this.s === SUBPASOS - 1);
    this._actualizarProgreso();
  }

  _renderExplicacion() {
    this._explicacionLista = true;
    const d = this.decimales;
    const r = this.datos.resultado;
    const exp = this.el.explicacion;

    if (!this.iteraciones.length) {
      exp.innerHTML = `
        <div class="explicacion-cabecera"><h2>Sin iteraciones</h2></div>
        <p>${escapar(r.mensaje)}</p>`;
      return;
    }

    const it = this.iteraciones[this.i];
    const n = it.n;
    const sub = (k) => `<sub>${k}</sub>`;
    const iA = `${n - 1}`, iN = `${n}`, iS = `${n + 1}`;
    const xA = `<i>x</i>${sub(iA)}`, xN = `<i>x</i>${sub(iN)}`, xS = `<i>x</i>${sub(iS)}`;
    const v = (x) => `<span class="valor-a">${numHTML(x, d)}</span>`;
    const par = (x) => (x < 0 ? `(${numHTML(x, d)})` : numHTML(x, d));
    const frac = (a, b) => `<span class="m-frac"><span class="m-num-frac">${a}</span><span class="m-den">${b}</span></span>`;

    const ultimo = this.i === this.iteraciones.length - 1;
    let decision;
    const criterio = r.criterio;
    const tol = r.tolerancia;
    const errorUsado = criterio === "relativo" ? it.error_relativo : criterio === "residuo" ? Math.abs(it.f_siguiente) : it.error_absoluto;
    const nombreError = criterio === "relativo" ? "ε<sub>a</sub>" : criterio === "residuo" ? `|f(${xS})|` : "E<sub>a</sub>";
    const unidad = criterio === "relativo" ? " %" : "";
    if (ultimo && r.exitoso) {
      decision = r.estado === "raiz_exacta"
        ? `<div class="decision parar">f(${xS}) = 0 exactamente: ¡raíz exacta!</div>`
        : `<div class="decision parar">${nombreError} = ${numHTML(errorUsado, d)}${unidad} &lt; ${tol}${unidad} → se cumple la tolerancia. La raíz es ≈ ${numHTML(it.x_siguiente, d + 2)}</div>`;
    } else if (ultimo) {
      decision = `<div class="decision error">${escapar(r.mensaje)}</div>`;
    } else {
      decision = `<div class="decision seguir">${nombreError} = ${numHTML(errorUsado, d)}${unidad} ≥ ${tol}${unidad} → no alcanza la tolerancia, se sigue iterando con ${xN} y ${xS}.</div>`;
    }

    exp.innerHTML = `
      <div class="explicacion-cabecera">
        <h2>Iteración ${n}</h2>
        <span>de ${this.iteraciones.length}</span>
      </div>
      <ol class="subpasos">
        <li class="subpaso">
          <div class="subpaso-titulo">Tomar los dos últimos puntos</div>
          <div class="subpaso-cuerpo"><div>
            <p>Se usan ${xA} y ${xN} y sus valores en la función.</p>
            <div class="formula-paso">${xA} = ${v(it.x_anterior)} <span class="igual">→</span> f(${xA}) = ${v(it.f_anterior)}</div>
            <div class="formula-paso">${xN} = ${v(it.x_actual)} <span class="igual">→</span> f(${xN}) = ${v(it.f_actual)}</div>
          </div></div>
        </li>
        <li class="subpaso">
          <div class="subpaso-titulo">Trazar la recta secante</div>
          <div class="subpaso-cuerpo"><div>
            <p>La recta que une ambos puntos tiene pendiente:</p>
            <div class="formula-paso">m = ${frac(`f(${xN}) − f(${xA})`, `${xN} − ${xA}`)}
              <span class="igual">=</span> ${frac(`${par(it.f_actual)} − ${par(it.f_anterior)}`, `${par(it.x_actual)} − ${par(it.x_anterior)}`)}
              <span class="igual">=</span> <span class="resultado-paso">${numHTML(it.pendiente, d)}</span></div>
          </div></div>
        </li>
        <li class="subpaso">
          <div class="subpaso-titulo">Cortar el eje x</div>
          <div class="subpaso-cuerpo"><div>
            <p>Donde la secante vale 0 está la nueva aproximación:</p>
            <div class="formula-paso">${xS} = ${xN} − ${frac(`f(${xN}) · (${xN} − ${xA})`, `f(${xN}) − f(${xA})`)}</div>
            <div class="formula-paso"><span class="igual">=</span> ${numHTML(it.x_actual, d)} − ${frac(`${par(it.f_actual)} · (${par(it.x_actual)} − ${par(it.x_anterior)})`, `${par(it.f_actual)} − ${par(it.f_anterior)}`)}</div>
            <div class="formula-paso"><span class="igual">=</span> <span class="resultado-paso">${numHTML(it.x_siguiente, d)}</span></div>
          </div></div>
        </li>
        <li class="subpaso">
          <div class="subpaso-titulo">Evaluar la función en el nuevo punto</div>
          <div class="subpaso-cuerpo"><div>
            <div class="formula-paso">f(${xS}) = f(${numHTML(it.x_siguiente, d)}) = <span class="resultado-paso">${numHTML(it.f_siguiente, d)}</span></div>
            <p>${Math.abs(it.f_siguiente) < Math.abs(it.f_actual) ? "Es más chico en valor absoluto que f(" + xN + "): nos acercamos a la raíz." : "Todavía no es más chico que f(" + xN + "), pero el método puede seguir acercándose."}</p>
          </div></div>
        </li>
        <li class="subpaso">
          <div class="subpaso-titulo">Calcular el error y decidir</div>
          <div class="subpaso-cuerpo"><div>
            <div class="formula-paso">E<sub>a</sub> = |${xS} − ${xN}| = <span class="resultado-paso">${numHTML(it.error_absoluto, d)}</span></div>
            <div class="formula-paso">ε<sub>a</sub> = ${frac(`|${xS} − ${xN}|`, `|${xS}|`)} · 100 = <span class="resultado-paso">${it.error_relativo === null ? "—" : numHTML(it.error_relativo, d)} %</span></div>
            <div class="final-iteracion" hidden>${decision}</div>
          </div></div>
        </li>
      </ol>
      <div class="leyenda">
        <span><i class="l-curva"></i> f(x)</span>
        <span><i class="l-secante"></i> secante</span>
        <span><i class="l-punto"></i> nueva aproximación</span>
      </div>`;

    exp.querySelectorAll(".subpaso").forEach((li, k) => {
      li.addEventListener("click", () => { this.pausar(); this.irA(this.i, k, 1); });
    });
  }

  // ------------------------------------------------------------ dibujo ---

  _dibujar(ctx, L) {
    if (!this.datos) return;
    const c = L.c;
    if (!this.iteraciones.length) {
      const r = this.datos.resultado;
      this._punto(ctx, L, r.x0, r.f_x0 ?? 0, c.tinta, 5);
      this._punto(ctx, L, r.x1, r.f_x1 ?? 0, c.tinta, 5);
      return;
    }

    // 1) Iteraciones anteriores, tenues
    for (let k = 0; k < this.i; k++) {
      const it = this.iteraciones[k];
      ctx.globalAlpha = 0.22;
      this._secante(ctx, L, it, 1, c.lapiz, 1.2);
      ctx.globalAlpha = 0.5;
      this._marcaEje(ctx, L, it.x_siguiente, c.grafitoTenue, 3);
      ctx.globalAlpha = 1;
    }

    const it = this.iteraciones[this.i];
    const s = this.s;
    const t = suave(Math.min(1, this.t));
    const P0 = [it.x_anterior, it.f_anterior];
    const P1 = [it.x_actual, it.f_actual];

    // Subpaso 0: puntos y sus proyecciones
    const aparicion = s === 0 ? t : 1;
    ctx.globalAlpha = aparicion;
    this._proyeccion(ctx, L, P0[0], P0[1], c.grafitoSuave);
    this._proyeccion(ctx, L, P1[0], P1[1], c.grafitoSuave);
    this._punto(ctx, L, P0[0], P0[1], c.tinta, 5.5 * (0.4 + 0.6 * aparicion));
    this._punto(ctx, L, P1[0], P1[1], c.tinta, 5.5 * (0.4 + 0.6 * aparicion));
    this._etiquetaX(ctx, L, P0[0], `${it.n - 1}`, c.grafito, P0[1]);
    this._etiquetaX(ctx, L, P1[0], `${it.n}`, c.grafito, P1[1]);
    ctx.globalAlpha = 1;

    // Subpaso 1: la secante se dibuja de a poco
    if (s >= 1) this._secante(ctx, L, it, s === 1 ? t : 1, c.lapiz, 2.2, true);

    // Subpaso 2: corte con el eje x
    if (s >= 2) {
      const k = s === 2 ? t : 1;
      if (s === 2) {
        ctx.strokeStyle = c.lapiz;
        ctx.globalAlpha = 1 - k;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(L.aX(it.x_siguiente), L.aY(0), 6 + 22 * k, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      this._marcaEje(ctx, L, it.x_siguiente, c.lapiz, 5.5 * Math.max(0.3, k));
      ctx.globalAlpha = k;
      this._etiquetaX(ctx, L, it.x_siguiente, `${it.n + 1}`, c.lapiz, -it.f_actual || 1);
      ctx.globalAlpha = 1;
    }

    // Subpaso 3: de xₙ₊₁ hasta la curva
    if (s >= 3) {
      const k = s === 3 ? t : 1;
      const yFin = it.f_siguiente * k;
      ctx.strokeStyle = c.ocre;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(L.aX(it.x_siguiente), L.aY(0));
      ctx.lineTo(L.aX(it.x_siguiente), L.aY(yFin));
      ctx.stroke();
      ctx.setLineDash([]);
      if (k > 0.95) this._punto(ctx, L, it.x_siguiente, it.f_siguiente, c.ocre, 6);
    }

    // Subpaso 4: cota del error (como en un plano técnico)
    if (s >= 4) {
      const k = s === 4 ? t : 1;
      this._cota(ctx, L, it.x_actual, it.x_siguiente, k, c);
    }
  }

  _punto(ctx, L, x, y, color, radio) {
    ctx.fillStyle = color;
    ctx.strokeStyle = L.c.papel;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(L.aX(x), L.aY(y), Math.max(radio, 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  _marcaEje(ctx, L, x, color, radio) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(L.aX(x), L.aY(0), radio, 0, Math.PI * 2);
    ctx.fill();
  }

  _proyeccion(ctx, L, x, y, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(L.aX(x), L.aY(0));
    ctx.lineTo(L.aX(x), L.aY(y));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Etiqueta "xₙ" debajo (o encima) del eje, del lado opuesto al punto. */
  _etiquetaX(ctx, L, x, indice, color, yPunto) {
    const px = L.aX(x);
    let py = L.aY(0) + (yPunto > 0 ? 22 : -12);
    py = Math.max(16, Math.min(L.alto - 8, py));
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.font = `italic 17px ${L.c.fuenteMat}`;
    const anchoX = ctx.measureText("x").width;
    ctx.font = `12px ${L.c.fuenteMat}`;
    const anchoI = ctx.measureText(indice).width;
    const inicio = px - (anchoX + anchoI) / 2;
    // Fondo para que se lea sobre la cuadrícula
    ctx.globalCompositeOperation = "source-over";
    const alfa = ctx.globalAlpha;
    ctx.fillStyle = L.c.papel;
    ctx.globalAlpha = alfa * 0.85;
    ctx.fillRect(inicio - 3, py - 15, anchoX + anchoI + 6, 21);
    ctx.globalAlpha = alfa;
    ctx.fillStyle = color;
    ctx.font = `italic 17px ${L.c.fuenteMat}`;
    ctx.fillText("x", inicio, py);
    ctx.font = `12px ${L.c.fuenteMat}`;
    ctx.fillText(indice, inicio + anchoX, py + 4);
  }

  /**
   * Recta secante desde P(n−1), pasando por P(n), hasta el eje x (y un poco más).
   * `avance` (0..1) permite dibujarla de a poco.
   */
  _secante(ctx, L, it, avance, color, grosor, destacada = false) {
    const xa = it.x_anterior, ya = it.f_anterior;
    const xb = it.x_actual, yb = it.f_actual;
    const xc = it.x_siguiente;
    // Parámetro sobre la recta: punto = A + u·(B − A). En C (corte) u = (xc − xa)/(xb − xa)
    const uC = (xc - xa) / (xb - xa);
    const uMin = Math.min(0, 1, uC), uMax = Math.max(0, 1, uC);
    const extra = (uMax - uMin) * 0.12;
    const desde = uMin - extra, hasta = uMax + extra;
    const fin = desde + (hasta - desde) * avance;
    const punto = (u) => [L.aX(xa + u * (xb - xa)), L.aY(ya + u * (yb - ya))];
    const [x1, y1] = punto(desde), [x2, y2] = punto(fin);
    ctx.strokeStyle = color;
    ctx.lineWidth = grosor;
    ctx.setLineDash(destacada ? [9, 5] : [5, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Punta de lápiz mientras se dibuja
    if (destacada && avance < 1) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x2, y2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Línea de cota |←— Eₐ —→| entre xₙ y xₙ₊₁, debajo del eje. */
  _cota(ctx, L, xa, xb, avance, c) {
    const pa = L.aX(xa), pb = L.aX(xb);
    const izq = Math.min(pa, pb), der = Math.max(pa, pb);
    const medio = (izq + der) / 2;
    const semi = ((der - izq) / 2) * avance;
    const y = Math.min(L.alto - 34, L.aY(0) + 44);
    ctx.strokeStyle = c.lapiz;
    ctx.fillStyle = c.lapiz;
    ctx.lineWidth = 1.3;
    ctx.globalAlpha = Math.min(1, avance * 2);
    ctx.beginPath();
    ctx.moveTo(pa, L.aY(0) + 6); ctx.lineTo(pa, y + 8);
    ctx.moveTo(pb, L.aY(0) + 6); ctx.lineTo(pb, y + 8);
    ctx.moveTo(medio - semi, y); ctx.lineTo(medio + semi, y);
    ctx.stroke();
    if (der - izq > 14 && avance > 0.9) {
      for (const [px, dir] of [[izq, 1], [der, -1]]) {
        ctx.beginPath();
        ctx.moveTo(px, y);
        ctx.lineTo(px + 7 * dir, y - 3.5);
        ctx.lineTo(px + 7 * dir, y + 3.5);
        ctx.closePath();
        ctx.fill();
      }
    }
    if (avance > 0.6) {
      const texto = `Eₐ = ${num(Math.abs(xb - xa), Math.min(this.decimales, 8))}`;
      ctx.font = `italic 14px ${c.fuenteMat}`;
      ctx.textAlign = "center";
      const w = ctx.measureText(texto).width;
      const alfa = ctx.globalAlpha;
      ctx.fillStyle = c.papel;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(medio - w / 2 - 4, y + 6, w + 8, 19);
      ctx.globalAlpha = alfa;
      ctx.fillStyle = c.lapiz;
      ctx.fillText(texto, medio, y + 20);
    }
    ctx.globalAlpha = 1;
  }
}
