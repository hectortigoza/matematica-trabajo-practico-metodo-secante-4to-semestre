// formato.js — Presentación de números (solo visual; los cálculos los hace Python).

const MENOS = "−";

/**
 * Número redondeado a `dec` decimales como máximo, sin ceros de más al final:
 * 2 → "2", −4 → "−4", 2.333333333 → "2.33333333", 0.5 → "0.5".
 * Si es muy chico o muy grande se usa notación científica.
 */
export function num(v, dec = 8) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (!Number.isFinite(v)) return v > 0 ? "∞" : MENOS + "∞";
  const a = Math.abs(v);
  let s;
  if (v !== 0 && (a < Math.pow(10, -(dec - 2)) || a >= 1e9)) {
    // 3.13620000e-7 -> 3.1362e-7
    s = v.toExponential(Math.max(dec - 4, 3)).replace(/\.?0+e/, "e");
  } else {
    s = v.toFixed(dec);
    if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
    if (s === "-0") s = "0";
  }
  return s.replace("-", MENOS);
}

/** Igual que num() pero la notación científica se muestra como 1.23·10⁻⁷ (HTML). */
export function numHTML(v, dec = 8) {
  const s = num(v, dec);
  const m = s.match(/^(.+)e([+−-]?)(\d+)$/);
  if (!m) return s;
  const signo = m[2] === "+" || m[2] === "" ? "" : MENOS;
  return `${m[1]}·10<sup>${signo}${parseInt(m[3], 10)}</sup>`;
}

/** Como numHTML pero sin ceros finales: 2.00000000 -> 2  (para fórmulas sustituidas). */
export function numCompacto(v, dec = 8) {
  const s = numHTML(v, dec);
  if (s.includes("·10")) return s;
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

/** Versión corta para etiquetas de ejes y gráficos. */
export function corto(v, cifras = 4) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-4) return v.toExponential(2).replace("-", MENOS).replace("e+", "e");
  return parseFloat(v.toPrecision(cifras)).toString().replace("-", MENOS);
}

/** Valor para insertar en un campo de texto: sin pérdida de precisión. */
export function paraCampo(v) {
  return String(parseFloat(v.toPrecision(12)));
}

export function escapar(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Variables CSS del tema actual (los canvas las leen al dibujar). */
export function colores() {
  const css = getComputedStyle(document.documentElement);
  const v = (nombre) => css.getPropertyValue(nombre).trim();
  return {
    papel: v("--hoja"),
    cuadricula: v("--cuadricula"),
    cuadriculaFuerte: v("--cuadricula-fuerte"),
    tinta: v("--tinta"),
    tintaSuave: v("--tinta-suave"),
    grafito: v("--grafito"),
    grafitoSuave: v("--grafito-suave"),
    grafitoTenue: v("--grafito-tenue"),
    lapiz: v("--lapiz"),
    ocre: v("--ocre"),
    verde: v("--verde"),
    fuenteUI: v("--fuente-ui"),
    fuenteMat: v("--fuente-mat"),
  };
}

export const reducirMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)");
