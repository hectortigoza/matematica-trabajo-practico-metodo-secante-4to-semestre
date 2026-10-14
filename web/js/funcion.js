// funcion.js — La función f(x) del lado de la página.
//
// Python (metodos.py) resuelve el método. La página necesita evaluar f(x)
// por su cuenta para dibujar gráficos, animar y comparar métodos, así que
// prepara la función con las MISMAS reglas que metodos.py.

const NOMBRES = {
  sin: Math.sin, sen: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, raiz: Math.sqrt, exp: Math.exp,
  ln: Math.log, log: Math.log10, abs: Math.abs,
  pi: Math.PI, e: Math.E,
};

/** "x^3 - 4x - 1"  ->  "x**3-4*x-1"  (igual que preparar_funcion de metodos.py) */
export function prepararFuncion(texto) {
  const f = String(texto).replace(/\s+/g, "").replace(/,/g, ".").replace(/\^/g, "**");
  let resultado = "";
  for (let i = 0; i < f.length; i++) {
    const c = f[i];
    const s = f[i + 1] ?? "";
    resultado += c;
    const numeroYLetra = /\d/.test(c) && (/[a-z(]/i.test(s));
    const parentesisYAlgo = c === ")" && /[\w(]/.test(s);
    const xYParentesis = c === "x" && s === "(";
    if (numeroYLetra || parentesisYAlgo || xYParentesis) resultado += "*";
  }
  return resultado;
}

/** Devuelve una función de JavaScript f(x). Si no se puede calcular, devuelve null. */
export function compilarFuncion(texto) {
  const expresion = prepararFuncion(texto);
  // Solo se permiten x, números, operadores y los nombres conocidos
  const palabras = expresion.match(/[a-z_]+/gi) || [];
  if (palabras.some((p) => p !== "x" && !(p in NOMBRES))) return null;
  let calcular;
  try {
    calcular = new Function("M", "x", `const {${Object.keys(NOMBRES).join(",")}} = M; return (${expresion});`);
  } catch (e) {
    return null;
  }
  return (x) => {
    try {
      const y = calcular(NOMBRES, x);
      return typeof y === "number" && Number.isFinite(y) ? y : null;
    } catch (e) {
      return null;
    }
  };
}

/** Texto -> HTML lindo: x^3 - 4x - 1  ->  x³ − 4x − 1 (con superíndices) */
export function funcionHTML(texto) {
  let t = String(texto).replace(/\s+/g, " ").trim()
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Exponentes: ^(…) y ^algo
  for (let i = 0; i < 3; i++) t = t.replace(/\^\(([^()]*)\)/g, "<sup>$1</sup>");
  t = t.replace(/\^\s*(-?[\w.]+)/g, "<sup>$1</sup>");
  t = t.replace(/\*\*/g, "^").replace(/\*/g, "·").replace(/-/g, "−");
  t = t.replace(/\bpi\b/g, "π").replace(/\bsqrt\b/g, "√");
  t = t.replace(/(^|[^a-z])x(?![a-z])/gi, "$1<i>x</i>");
  return t;
}
