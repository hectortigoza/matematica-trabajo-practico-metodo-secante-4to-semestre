// comparacion.js — Otros métodos para comparar con la secante (se calculan en la página).
// Todos usan el mismo test de parada que la secante: |f(x)| < error.

const LIMITE = 100;   // igual que LIMITE_DE_ITERACIONES en metodos.py

// Marca el resultado de un método como terminado (convergió o no) con su mensaje.
function cerrar(r, exitoso, mensaje) {
  r.exitoso = exitoso;
  r.mensaje = mensaje;
  r.estado = exitoso ? "convergio" : "no_converge";
  return r;
}

// Resultado vacío de un método: nombre, fórmula y la lista de iteraciones.
function nuevo(metodo, descripcion) {
  return { metodo, descripcion, aplicable: true, exitoso: false, estado: "", mensaje: "", raiz: null, iteraciones: [] };
}

// Bisección: parte [a, b] a la mitad y se queda con la mitad donde f cambia de signo.
export function biseccion(f, a, b, error) {
  const r = nuevo("Bisección", "c = (a + b) / 2");
  let fa = f(a);
  if (fa === null || f(b) === null) return cerrar(r, false, "f no está definida en a o b.");
  for (let k = 0; k < LIMITE; k++) {
    const c = (a + b) / 2;
    const fc = f(c);
    if (fc === null) return cerrar(r, false, "f no está definida en c.");
    r.iteraciones.push({ n: k, x: c, fx: fc });
    r.raiz = c;
    if (Math.abs(fc) < error) return cerrar(r, true, `Convergió en ${k + 1} iteraciones.`);
    if (fa * fc < 0) b = c;
    else { a = c; fa = fc; }
  }
  return cerrar(r, false, "No converge.");
}

// Falsa posición: misma fórmula que la secante, pero reemplaza el extremo que
// conserva el cambio de signo (la raíz queda siempre encerrada entre a y b).
export function falsaPosicion(f, a, b, error) {
  const r = nuevo("Falsa posición", "c = (a·f(b) − b·f(a)) / (f(b) − f(a)), conservando el cambio de signo");
  let fa = f(a), fb = f(b);
  if (fa === null || fb === null) return cerrar(r, false, "f no está definida en a o b.");
  for (let k = 0; k < LIMITE; k++) {
    if (fb === fa) return cerrar(r, false, "División por cero.");
    const c = (a * fb - b * fa) / (fb - fa);
    const fc = f(c);
    if (fc === null) return cerrar(r, false, "f no está definida en c.");
    r.iteraciones.push({ n: k, x: c, fx: fc });
    r.raiz = c;
    if (Math.abs(fc) < error) return cerrar(r, true, `Convergió en ${k + 1} iteraciones.`);
    if (fa * fc < 0) { b = c; fb = fc; } else { a = c; fa = fc; }
  }
  return cerrar(r, false, "No converge.");
}

// Newton-Raphson: usa la recta tangente. La derivada se aproxima con
// diferencias centrales: f′(x) ≈ (f(x + h) − f(x − h)) / 2h.
export function newtonRaphson(f, x, error) {
  const r = nuevo("Newton-Raphson", "xₖ₊₁ = xₖ − f(xₖ) / f′(xₖ)");
  for (let k = 0; k < LIMITE; k++) {
    const fx = f(x);
    const h = 1e-6 * Math.max(1, Math.abs(x));
    const fmas = f(x + h), fmenos = f(x - h);
    if (fx === null || fmas === null || fmenos === null) return cerrar(r, false, "f no está definida.");
    const derivada = (fmas - fmenos) / (2 * h);         // derivada aproximada
    if (derivada === 0) return cerrar(r, false, "f′(x) = 0: la tangente es horizontal.");
    x = x - fx / derivada;
    const fnuevo = f(x);
    if (fnuevo === null || !Number.isFinite(x)) return cerrar(r, false, "Diverge.");
    r.iteraciones.push({ n: k, x, fx: fnuevo });
    r.raiz = x;
    if (Math.abs(fnuevo) < error) return cerrar(r, true, `Convergió en ${k + 1} iteraciones.`);
  }
  return cerrar(r, false, "No converge.");
}

/** Compara la secante (calculada por Python) con los otros tres métodos. */
export function compararMetodos(f, datos) {
  const secante = nuevo("Secante", "xₖ₊₁ = (a·f(b) − b·f(a)) / (f(b) − f(a))");
  secante.iteraciones = datos.tabla.map((fila) => ({ n: fila.k, x: fila.x, fx: fila.fx }));
  secante.raiz = datos.raiz;
  cerrar(secante, datos.encontrada, datos.mensaje);

  const metodos = [
    secante,
    newtonRaphson(f, datos.b, datos.error),
    falsaPosicion(f, datos.a, datos.b, datos.error),
    biseccion(f, datos.a, datos.b, datos.error),
  ];

  const conclusiones = [];
  const exitosos = metodos.filter((m) => m.exitoso);
  if (exitosos.length) {
    const minimo = Math.min(...exitosos.map((m) => m.iteraciones.length));
    const ganadores = exitosos.filter((m) => m.iteraciones.length === minimo).map((m) => m.metodo);
    conclusiones.push(ganadores.length === 1
      ? `El método más rápido fue ${ganadores[0]}, con ${minimo} iteraciones.`
      : `Empataron ${ganadores.join(" y ")}, con ${minimo} iteraciones cada uno.`);
    const bis = metodos[3];
    if (secante.exitoso && bis.exitoso) {
      conclusiones.push(`La secante necesitó ${(bis.iteraciones.length / secante.iteraciones.length).toFixed(1)} veces menos iteraciones que la bisección.`);
    }
    conclusiones.push("Newton-Raphson necesita la derivada f′(x); la secante no, porque la reemplaza por la pendiente entre a y b.");
  } else {
    conclusiones.push("Ningún método llegó al error pedido.");
  }
  return { metodos, conclusiones };
}
