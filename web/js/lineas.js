// lineas.js — Gráficos de líneas simples (error por iteración, orden, comparación).

import { colores, corto } from "./formato.js";

const graficos = new Map();   // canvas -> configuración (para redibujar al cambiar tamaño/tema)

const observador = new ResizeObserver((entradas) => {
  for (const e of entradas) {
    const canvas = e.target.querySelector("canvas");
    if (graficos.has(canvas)) dibujar(canvas, graficos.get(canvas));
  }
});

/**
 * config = {
 *   series: [{ nombre, color, puntos: [[x, y], ...], punteada }],
 *   logY: bool, referencia: { y, etiqueta }, etiquetaX, etiquetaY
 * }
 */
export function graficoLineas(canvas, config) {
  if (!graficos.has(canvas)) observador.observe(canvas.parentElement);
  graficos.set(canvas, config);
  dibujar(canvas, config);
}

export function redibujarTodos() {
  for (const [canvas, config] of graficos) dibujar(canvas, config);
}

function dibujar(canvas, config) {
  const caja = canvas.parentElement.getBoundingClientRect();
  if (!caja.width || !caja.height) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(caja.width * dpr);
  canvas.height = Math.round(caja.height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const c = colores();
  const W = caja.width, H = caja.height;
  const m = { izq: 58, der: 14, arr: 30, aba: 34 };
  const w = W - m.izq - m.der, h = H - m.arr - m.aba;

  ctx.clearRect(0, 0, W, H);

  const transformar = (y) => (config.logY ? Math.log10(y) : y);
  const todos = config.series.flatMap((s) => s.puntos)
    .filter(([, y]) => y !== null && Number.isFinite(y) && (!config.logY || y > 0));
  if (!todos.length) {
    ctx.fillStyle = c.grafitoTenue;
    ctx.font = `14px ${c.fuenteUI}`;
    ctx.textAlign = "center";
    ctx.fillText("No hay suficientes datos para graficar.", W / 2, H / 2);
    return;
  }

  let xmin = Math.min(...todos.map((p) => p[0])), xmax = Math.max(...todos.map((p) => p[0]));
  if (xmin === xmax) { xmin -= 1; xmax += 1; }
  let ys = todos.map((p) => transformar(p[1]));
  if (config.referencia) ys.push(transformar(config.referencia.y));
  let ymin = Math.min(...ys), ymax = Math.max(...ys);
  if (config.logY) { ymin = Math.floor(ymin); ymax = Math.ceil(ymax); }
  if (config.limitesY) { ymin = Math.max(ymin, config.limitesY[0]); ymax = Math.min(ymax, config.limitesY[1]); }
  if (ymax - ymin < 1e-12) { ymin -= 1; ymax += 1; }
  if (!config.logY) { const pad = (ymax - ymin) * 0.1; ymin -= pad; ymax += pad; }

  const X = (x) => m.izq + ((x - xmin) / (xmax - xmin)) * w;
  const Y = (y) => m.arr + ((ymax - transformar(y)) / (ymax - ymin)) * h;
  const Yt = (t) => m.arr + ((ymax - t) / (ymax - ymin)) * h;

  // Cuadrícula horizontal
  ctx.font = `11px ${c.fuenteUI}`;
  ctx.lineWidth = 1;
  ctx.textAlign = "right";
  const marcas = [];
  if (config.logY) {
    const salto = Math.max(1, Math.ceil((ymax - ymin) / 8));
    for (let k = Math.ceil(ymin); k <= ymax; k += salto) marcas.push([k, `10${superindice(k)}`]);
  } else {
    const paso = pasoLindo((ymax - ymin) / 5);
    for (let v = Math.ceil(ymin / paso) * paso; v <= ymax + 1e-12; v += paso) marcas.push([v, corto(v, 3)]);
  }
  for (const [t, texto] of marcas) {
    const py = Math.round(Yt(t)) + 0.5;
    ctx.strokeStyle = c.cuadricula;
    ctx.beginPath(); ctx.moveTo(m.izq, py); ctx.lineTo(W - m.der, py); ctx.stroke();
    ctx.fillStyle = c.grafitoSuave;
    ctx.fillText(texto, m.izq - 8, py + 4);
  }

  // Eje x: iteraciones enteras
  ctx.textAlign = "center";
  const pasoX = Math.max(1, Math.ceil((xmax - xmin) / 12));
  for (let x = Math.ceil(xmin); x <= xmax; x += pasoX) {
    const px = Math.round(X(x)) + 0.5;
    ctx.strokeStyle = c.cuadricula;
    ctx.beginPath(); ctx.moveTo(px, m.arr); ctx.lineTo(px, m.arr + h); ctx.stroke();
    ctx.fillStyle = c.grafitoSuave;
    ctx.fillText(String(x), px, m.arr + h + 16);
  }
  if (config.etiquetaX) {
    ctx.textAlign = "right";
    ctx.fillStyle = c.grafitoTenue;
    ctx.fillText(config.etiquetaX, W - m.der, H - 4);
  }
  ctx.strokeStyle = c.cuadriculaFuerte;
  ctx.strokeRect(m.izq + 0.5, m.arr + 0.5, w, h);

  // Línea de referencia (por ejemplo φ = 1.618)
  if (config.referencia) {
    const py = Y(config.referencia.y);
    ctx.strokeStyle = c.verde;
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(m.izq, py); ctx.lineTo(W - m.der, py); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = c.verde;
    ctx.textAlign = "left";
    ctx.font = `italic 13px ${c.fuenteMat}`;
    ctx.fillText(config.referencia.etiqueta, m.izq + 8, py - 6);
  }

  // Series
  ctx.save();
  ctx.beginPath();
  ctx.rect(m.izq, m.arr, w, h);
  ctx.clip();
  for (const s of config.series) {
    const color = c[s.color] || s.color;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.2;
    ctx.setLineDash(s.punteada ? [6, 4] : []);
    ctx.beginPath();
    let empezado = false;
    for (const [x, y] of s.puntos) {
      if (y === null || !Number.isFinite(y) || (config.logY && y <= 0)) { empezado = false; continue; }
      if (!empezado) { ctx.moveTo(X(x), Y(y)); empezado = true; } else ctx.lineTo(X(x), Y(y));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [x, y] of s.puntos) {
      if (y === null || !Number.isFinite(y) || (config.logY && y <= 0)) continue;
      ctx.beginPath(); ctx.arc(X(x), Y(y), 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();

  // Leyenda
  if (config.series.length > 1) {
    ctx.font = `12px ${c.fuenteUI}`;
    ctx.textAlign = "left";
    let px = m.izq;
    for (const s of config.series) {
      const color = c[s.color] || s.color;
      ctx.fillStyle = color;
      ctx.fillRect(px, 12, 14, 3);
      ctx.fillStyle = c.grafitoSuave;
      ctx.fillText(s.nombre, px + 19, 17);
      px += ctx.measureText(s.nombre).width + 38;
    }
  }
}

function pasoLindo(crudo) {
  const p = Math.pow(10, Math.floor(Math.log10(crudo)));
  const f = crudo / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}

function superindice(n) {
  const mapa = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  return String(n).split("").map((ch) => mapa[ch] ?? ch).join("");
}
