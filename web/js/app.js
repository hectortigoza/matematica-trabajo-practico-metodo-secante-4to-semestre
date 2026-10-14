// app.js — La página: formulario, tabla, test de parada, pestañas, historial y exportar.
//
// Python (metodos.py) resuelve el método y devuelve la tabla.
// Todo lo demás (animación, gráficos, comparación, historial, exportar)
// se hace acá, en la página.

import { llamar } from "./api.js";
import { numHTML, num, corto, escapar, reducirMovimiento } from "./formato.js";
import { compilarFuncion, funcionHTML } from "./funcion.js";
import { PasoAPaso } from "./pasos.js";
import { Lienzo } from "./lienzo.js";
import { Animacion } from "./animacion.js";
import { graficoLineas, redibujarTodos } from "./lineas.js";
import { compararMetodos } from "./comparacion.js";

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

const COLORES_METODO = { "Secante": "lapiz", "Newton-Raphson": "tinta", "Falsa posición": "ocre", "Bisección": "verde" };
const PHI = (1 + Math.sqrt(5)) / 2;

const estado = {
  datos: null,                        // respuesta de Python (metodos.resolver_secante)
  decimales: 8,
  autoplayPendiente: false,           // paso a paso
  autoplayAnimacionPendiente: false,  // animación
};

const campo = (id) => $(`#${id}`);

// ======================================================================
//  Paso a paso y animación
// ======================================================================

const pasos = new PasoAPaso({
  explicacion: $("#explicacion"),
  tabla: $("#pasos-tabla"),
  tablaError: $("#pasos-error"),
  posicion: $("#paso-posicion"),
  lineaTiempo: $("#linea-tiempo"),
  reproducir: $("#paso-reproducir"),
  anterior: $("#paso-anterior"),
  siguiente: $("#paso-siguiente"),
  inicio: $("#paso-inicio"),
  fin: $("#paso-fin"),
  velocidad: $("#velocidad"),
});

const lienzoAnimacion = new Lienzo($("#grafico-animacion"));
const animacion = new Animacion(lienzoAnimacion, {
  explicacion: $("#anim-explicacion"),
  lineaTiempo: $("#anim-linea-tiempo"),
  reproducir: $("#anim-reproducir"),
  anterior: $("#anim-anterior"),
  siguiente: $("#anim-siguiente"),
  inicio: $("#anim-inicio"),
  fin: $("#anim-fin"),
  velocidad: $("#anim-velocidad"),
});

/** La animación usa otros nombres de datos: se los arma a partir de la tabla. */
function datosParaAnimacion(r) {
  const iteraciones = r.tabla.map((fila) => ({
    n: fila.k,
    x_anterior: fila.a, x_actual: fila.b,
    f_anterior: fila.fa, f_actual: fila.fb,
    x_siguiente: fila.x, f_siguiente: fila.fx,
    error_absoluto: Math.abs(fila.x - fila.b),
    error_relativo: fila.x !== 0 ? Math.abs((fila.x - fila.b) / fila.x) * 100 : null,
    pendiente: (fila.fb - fila.fa) / (fila.b - fila.a),
  }));
  // Curva de la función en un rango que contiene todos los puntos
  const xs = [r.a, r.b, ...r.tabla.map((f) => f.x)].filter(Number.isFinite);
  let desde = Math.min(...xs), hasta = Math.max(...xs);
  const margen = (hasta - desde || 1) * 0.35;
  desde -= margen; hasta += margen;
  const f = compilarFuncion(r.funcion);
  const curva = [];
  for (let i = 0; i < 700; i++) {
    const x = desde + ((hasta - desde) * i) / 699;
    curva.push([x, f ? f(x) : null]);
  }
  return {
    funcion: { texto: r.funcion, html: funcionHTML(r.funcion) },
    curva,
    rango: [desde, hasta],
    resultado: {
      x0: r.a, x1: r.b, f_x0: r.fa, f_x1: r.fb,
      iteraciones,
      criterio: "residuo",
      tolerancia: r.error,
      exitoso: r.encontrada,
      estado: r.encontrada ? "convergio" : "max_iteraciones",
      mensaje: r.mensaje,
      raiz: r.raiz,
    },
  };
}

// ======================================================================
//  Utilidades
// ======================================================================

function avisar(texto, tipo = "") {
  const el = $("#aviso");
  el.textContent = texto;
  el.className = `aviso visible ${tipo}`;
  clearTimeout(avisar._t);
  avisar._t = setTimeout(() => { el.className = "aviso"; }, tipo === "error" ? 5000 : 2600);
}

function datosFormulario() {
  return {
    funcion: campo("funcion").value,
    a: campo("x0").value,
    b: campo("x1").value,
    error: campo("tolerancia").value,
  };
}

function cargarEnFormulario(d) {
  campo("funcion").value = d.funcion;
  campo("x0").value = d.a;
  campo("x1").value = d.b;
  if (d.error !== undefined) campo("tolerancia").value = d.error;
  limpiarErrores();
  vistaPrevia();
}

function limpiarErrores() {
  $$(".campo.con-error").forEach((c) => c.classList.remove("con-error"));
  $$(".error-campo").forEach((p) => { p.textContent = ""; });
}

function mostrarErrores(errores) {
  limpiarErrores();
  const generales = [];
  for (const e of errores) {
    const contenedor = e.campo && $(`.campo[data-campo="${e.campo}"]`);
    if (!contenedor) { generales.push(e.mensaje); continue; }
    contenedor.classList.add("con-error");
    const p = $(".error-campo", contenedor);
    p.textContent = p.textContent ? `${p.textContent} ${e.mensaje}` : e.mensaje;
  }
  const primero = $(".campo.con-error input");
  if (primero) primero.focus();
  avisar(generales.length ? generales.join(" ") : "Revisá los datos marcados en rojo.", "error");
}

/** Muestra la función escrita en forma matemática mientras se escribe. */
function vistaPrevia() {
  const texto = campo("funcion").value;
  const vista = $("#vista-funcion");
  if (!texto.trim()) { vista.innerHTML = ""; return; }
  vista.innerHTML = compilarFuncion(texto)
    ? `<i>f</i>(<i>x</i>) = ${funcionHTML(texto)}`
    : `<span class="vista-error">Revisá la función: hay algo mal escrito.</span>`;
  if (estado.datos && estado.datos.funcion !== texto) invalidarResultado();
}

// ======================================================================
//  Resolver: se llama a Python (metodos.resolver_secante)
// ======================================================================

async function resolver() {
  const boton = $("#btn-resolver");
  boton.setAttribute("aria-busy", "true");
  limpiarErrores();
  const r = await llamar("resolver", datosFormulario());
  boton.removeAttribute("aria-busy");

  if (!r.ok) {
    mostrarErrores(r.errores);
    return;
  }

  invalidarResultado();
  $("#resolver-vacio").hidden = true;
  renderCambioSigno(r);
  if (!r.cambio_de_signo) return;           // sin cambio de signo no se resuelve la tabla

  estado.datos = r;
  estado.autoplayPendiente = true;
  estado.autoplayAnimacionPendiente = true;
  renderizarTodo();
  const contenido = $("#resultado-contenido");
  contenido.classList.remove("revelar");
  void contenido.offsetWidth;
  contenido.classList.add("revelar");
  guardarEnHistorial(r);
}

function invalidarResultado() {
  estado.datos = null;
  pasos.pausar();
  animacion.pausar();
  $("#resultado-contenido").hidden = true;
  $("#cambio-signo").hidden = true;
  $("#resolver-vacio").hidden = false;
  $$("[data-sin-datos]").forEach((el) => { el.hidden = false; });
  $$("[data-con-datos]").forEach((el) => { el.hidden = true; });
}

function renderizarTodo() {
  const r = estado.datos;
  $("#resolver-vacio").hidden = true;
  $("#resultado-contenido").hidden = false;
  $$("[data-sin-datos]").forEach((el) => { el.hidden = !!r.tabla.length; });
  $$("[data-con-datos]").forEach((el) => { el.hidden = !r.tabla.length; });

  renderTablas(r);
  if (!r.tabla.length) return;              // a o b ya eran la raíz: no hay iteraciones
  renderConvergencia(r);
  renderComparacion(r);
  pasos.cargar(r, estado.decimales);
  animacion.cargar(datosParaAnimacion(r), estado.decimales);
  if (pestanaActiva() === "pasos") iniciarAutoplay();
  if (pestanaActiva() === "animacion") iniciarAnimacion();
}

/** acheck = f(a) > 0, bcheck = f(b) > 0. Si son iguales, no hay cambio de signo. */
function renderCambioSigno(r) {
  const dec = estado.decimales;
  const caja = $("#cambio-signo");
  const si = (v) => (v ? "verdadero" : "falso");
  caja.hidden = false;
  caja.className = `hoja cambio-signo ${r.cambio_de_signo ? "hay" : "alerta"}`;
  caja.innerHTML = `
    <h2>¿Hay cambio de signo entre <i>a</i> y <i>b</i>?</h2>
    <p class="formula-signo">f(a) = f(${num(r.a, dec)}) = ${numHTML(r.fa, dec)} &nbsp;→&nbsp; acheck = f(a) &gt; 0 = <b>${si(r.acheck)}</b></p>
    <p class="formula-signo">f(b) = f(${num(r.b, dec)}) = ${numHTML(r.fb, dec)} &nbsp;→&nbsp; bcheck = f(b) &gt; 0 = <b>${si(r.bcheck)}</b></p>
    <p class="veredicto-signo">${r.cambio_de_signo
      ? "acheck ≠ bcheck → sí hay cambio de signo: se resuelve la tabla."
      : "acheck = bcheck → no hay cambio de signo: no se resuelve la tabla."}</p>
    ${r.cambio_de_signo ? "" : `<p class="tenue">Elegí valores de a y b donde f(x) tenga signos opuestos.</p>`}`;
}

function renderTablas(r) {
  const dec = estado.decimales;
  const ultima = r.tabla.length - 1;

  // Cuadro izquierdo: la tabla
  $("#tabla-iteraciones tbody").innerHTML = r.tabla.map((f, i) => `
    <tr data-i="${i}" class="${f.cumple ? "final" : ""}" title="Ver la iteración k = ${f.k} paso a paso">
      <td>${f.k}</td>
      <td>${numHTML(f.a, dec)}</td><td>${numHTML(f.b, dec)}</td>
      <td>${numHTML(f.fa, dec)}</td><td>${numHTML(f.fb, dec)}</td>
      <td class="col-nueva">${numHTML(f.x, dec)}</td>
    </tr>`).join("") || `<tr><td colspan="6" class="tenue" style="text-align:center">No hizo falta iterar.</td></tr>`;

  // Cuadro derecho: test de parada |f(x(k+1))| < error
  $("#tabla-error tbody").innerHTML = r.tabla.map((f) => `
    <tr class="${f.cumple ? "final" : ""}">
      <td>${f.k}</td>
      <td>${numHTML(f.fx, dec)}</td>
      <td class="comparacion ${f.cumple ? "cumple" : ""}">${f.cumple
        ? `${num(Math.abs(f.fx), dec)} &lt; ${r.error} <b>→ sí, es la raíz</b>`
        : `${num(Math.abs(f.fx), dec)} ≥ ${r.error} → no, sigue`}</td>
    </tr>`).join("") || `<tr><td colspan="3" class="tenue" style="text-align:center">—</td></tr>`;

  // Resultado final
  const final = $("#resultado-final");
  if (r.encontrada) {
    final.innerHTML = `
      <span class="estado bien">Raíz encontrada</span>
      <p class="raiz-final">x ≈ <b>${numHTML(r.raiz, dec)}</b></p>
      <p class="tenue">${escapar(r.mensaje)}${ultima >= 0 ? ` |f(x)| = ${num(Math.abs(r.tabla[ultima].fx), dec)} &lt; ${r.error}.` : ""}</p>
      ${r.advertencia ? `<p class="advertencia-final">${escapar(r.advertencia)}</p>` : ""}`;
  } else {
    final.innerHTML = `<span class="estado mal">Sin resultado</span><p class="tenue">${escapar(r.mensaje)}</p>`;
  }
}

// ======================================================================
//  Convergencia (se calcula en la página)
// ======================================================================

function renderConvergencia(r) {
  const errores = r.tabla.map((f) => Math.abs(f.x - f.b));
  graficoLineas($("#canvas-error"), {
    logY: true,
    etiquetaX: "k",
    referencia: { y: r.error, etiqueta: `error pedido = ${r.error}` },
    series: [
      { nombre: "|f(xₖ₊₁)|", color: "lapiz", puntos: r.tabla.map((f) => [f.k, Math.abs(f.fx)]) },
      { nombre: "|xₖ₊₁ − b|", color: "tinta", puntos: r.tabla.map((f, i) => [f.k, errores[i]]), punteada: true },
    ],
  });

  // Orden de convergencia: p ≈ ln(e(k+1)/e(k)) / ln(e(k)/e(k-1))
  const estimaciones = [];
  for (let i = 2; i < errores.length; i++) {
    const [e0, e1, e2] = [errores[i - 2], errores[i - 1], errores[i]];
    const ruido = 1e-13 * (1 + Math.abs(r.tabla[i].x));
    let p = null;
    if (e0 > 0 && e1 > ruido && e2 > ruido && e1 !== e0) p = Math.log(e2 / e1) / Math.log(e1 / e0);
    estimaciones.push([r.tabla[i].k, p]);
  }
  graficoLineas($("#canvas-orden"), {
    etiquetaX: "k",
    limitesY: [-0.5, 3.5],
    referencia: { y: PHI, etiqueta: "φ ≈ 1.618" },
    series: [{ nombre: "p estimado", color: "lapiz", puntos: estimaciones }],
  });

  const validas = estimaciones.map(([, p]) => p).filter((p) => p !== null && p > 0 && p < 4).slice(-2);
  const orden = validas.length ? validas.reduce((s, p) => s + p, 0) / validas.length : null;
  const textos = [`<p><b>${r.encontrada ? "Converge." : "No converge."}</b> ${escapar(r.mensaje)}</p>`];
  textos.push(orden !== null
    ? `<p>Orden de convergencia estimado: <b>p ≈ ${orden.toFixed(3)}</b>. La teoría dice que la secante tiene orden φ = (1 + √5)/2 ≈ 1.618: en cada iteración las cifras correctas se multiplican por ≈ 1.6.</p>`
    : "<p>Hacen falta al menos tres iteraciones para estimar el orden de convergencia.</p>");
  $("#texto-convergencia").innerHTML = textos.join("");
}

// ======================================================================
//  Comparación con otros métodos (se calcula en la página)
// ======================================================================

function renderComparacion(r) {
  const dec = estado.decimales;
  const f = compilarFuncion(r.funcion);
  if (!f) return;
  const { metodos, conclusiones } = compararMetodos(f, r);
  const exitosos = metodos.filter((m) => m.exitoso);
  const mejor = exitosos.length ? Math.min(...exitosos.map((m) => m.iteraciones.length)) : null;

  $("#tabla-comparacion tbody").innerHTML = metodos.map((m) => `
    <tr class="${m.exitoso && m.iteraciones.length === mejor ? "destacada" : ""}">
      <td><span class="muestra" style="background:var(--${COLORES_METODO[m.metodo]})"></span>${m.metodo}</td>
      <td>${escapar(m.descripcion)}</td>
      <td>${m.iteraciones.length}</td>
      <td>${m.raiz === null ? "—" : numHTML(m.raiz, dec)}</td>
      <td><span class="estado ${m.exitoso ? "bien" : "mal"}" title="${escapar(m.mensaje)}">${m.exitoso ? "Convergió" : "No convergió"}</span></td>
    </tr>`).join("");
  $("#derivada-newton").innerHTML = "Newton-Raphson usa una derivada aproximada: f′(x) ≈ (f(x+h) − f(x−h)) / 2h.";

  graficoLineas($("#canvas-comparacion"), {
    logY: true,
    etiquetaX: "k",
    series: metodos.filter((m) => m.iteraciones.length).map((m) => ({
      nombre: m.metodo,
      color: COLORES_METODO[m.metodo],
      puntos: m.iteraciones.map((it) => [it.n, Math.abs(it.fx)]),
    })),
  });
  $("#conclusiones-comparacion").innerHTML = conclusiones.map((t) => `<li>${escapar(t)}</li>`).join("");
}

// ======================================================================
//  Pestañas
// ======================================================================

const pestanas = $$(".pestanas [role=tab]");

function pestanaActiva() {
  return pestanas.find((p) => p.getAttribute("aria-selected") === "true").id.replace("tab-", "");
}

function activarPestana(nombre) {
  for (const p of pestanas) {
    const activa = p.id === `tab-${nombre}`;
    p.setAttribute("aria-selected", String(activa));
    p.tabIndex = activa ? 0 : -1;
    $(`#${p.getAttribute("aria-controls")}`).hidden = !activa;
  }
  if (nombre === "pasos") iniciarAutoplay(); else pasos.pausar();
  if (nombre === "animacion") iniciarAnimacion(); else animacion.pausar();
  if (nombre === "historial") renderHistorial();
  requestAnimationFrame(redibujarTodos);
}

function iniciarAutoplay() {
  if (!estado.datos || !estado.autoplayPendiente) return;
  estado.autoplayPendiente = false;
  if (!reducirMovimiento.matches) setTimeout(() => pasos.reproducir(), 350);
}

function iniciarAnimacion() {
  if (!estado.datos || !estado.autoplayAnimacionPendiente) return;
  estado.autoplayAnimacionPendiente = false;
  if (!reducirMovimiento.matches) setTimeout(() => animacion.reproducir(), 350);
}

pestanas.forEach((p, k) => {
  p.addEventListener("click", () => activarPestana(p.id.replace("tab-", "")));
  p.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const siguiente = pestanas[(k + (e.key === "ArrowRight" ? 1 : pestanas.length - 1)) % pestanas.length];
    siguiente.focus();
    activarPestana(siguiente.id.replace("tab-", ""));
  });
});

// ======================================================================
//  Historial (se guarda en el navegador)
// ======================================================================

function leerHistorial() {
  try { return JSON.parse(localStorage.getItem("historial") || "[]"); } catch (e) { return []; }
}

function guardarHistorial(lista) {
  try { localStorage.setItem("historial", JSON.stringify(lista.slice(0, 50))); } catch (e) { /* sin almacenamiento */ }
}

function guardarEnHistorial(r) {
  const entrada = {
    id: String(Date.now()),
    fecha: new Date().toLocaleString("es"),
    funcion: r.funcion, a: r.a, b: r.b, error: r.error,
    raiz: r.raiz, iteraciones: r.tabla.length, encontrada: r.encontrada,
  };
  const lista = leerHistorial().filter((h) => !(h.funcion === r.funcion && h.a === r.a && h.b === r.b && h.error === r.error));
  guardarHistorial([entrada, ...lista]);
}

function renderHistorial() {
  const lista = leerHistorial();
  const ul = $("#lista-historial");
  if (!lista.length) {
    ul.innerHTML = `<li class="historial-vacio">Todavía no resolviste ningún ejercicio. Los que resuelvas aparecen acá.</li>`;
    return;
  }
  ul.innerHTML = lista.map((h) => `
    <li data-id="${escapar(h.id)}">
      <div>
        <div class="historial-fx">f(x) = ${funcionHTML(h.funcion)}</div>
        <div class="historial-detalle">a = ${h.a}, b = ${h.b}, error = ${h.error} ·
          ${h.encontrada ? `raíz ≈ ${corto(h.raiz, 10)}` : "sin raíz"} · ${h.iteraciones} iteraciones · ${escapar(h.fecha)}</div>
      </div>
      <button type="button" class="boton-chico" data-accion="cargar">Volver a resolver</button>
      <button type="button" class="boton-borrar" data-accion="borrar" title="Borrar del historial" aria-label="Borrar">×</button>
    </li>`).join("");
}

$("#lista-historial").addEventListener("click", async (e) => {
  const boton = e.target.closest("button[data-accion]");
  if (!boton) return;
  const id = boton.closest("li").dataset.id;
  const lista = leerHistorial();
  if (boton.dataset.accion === "borrar") {
    guardarHistorial(lista.filter((h) => h.id !== id));
    renderHistorial();
    return;
  }
  const h = lista.find((x) => x.id === id);
  if (!h) return;
  cargarEnFormulario({ funcion: h.funcion, a: String(h.a), b: String(h.b), error: String(h.error) });
  activarPestana("resolver");
  await resolver();
});

$("#btn-vaciar-historial").addEventListener("click", () => {
  if (!confirm("¿Borrar todos los ejercicios del historial?")) return;
  guardarHistorial([]);
  renderHistorial();
});

// ======================================================================
//  Exportar (se arma el archivo en la página)
// ======================================================================

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

$$("[data-exportar]").forEach((b) => b.addEventListener("click", () => {
  const r = estado.datos;
  if (!r) return;
  const dec = estado.decimales;
  const formato = b.dataset.exportar;

  if (formato === "csv") {
    // ; y coma decimal para que Excel en español lo abra en columnas
    const n = (v) => num(v, dec).replace("−", "-").replace(".", ",");
    const lineas = [`f(x);${r.funcion}`, `a;${n(r.a)}`, `b;${n(r.b)}`, `error;${n(r.error)}`, "",
      "k;a;b;f(a);f(b);x(k+1);f(x(k+1));¿|f(x(k+1))| < error?",
      ...r.tabla.map((f) => [f.k, n(f.a), n(f.b), n(f.fa), n(f.fb), n(f.x), n(f.fx), f.cumple ? "sí" : "no"].join(";")),
      "", `Raíz;${r.raiz === null ? "-" : n(r.raiz)}`];
    descargar("secante.csv", "﻿" + lineas.join("\r\n"), "text/csv;charset=utf-8");
    avisar("Se descargó secante.csv");
    return;
  }

  if (formato === "txt") {
    const ancho = dec + 8;
    const col = (v) => num(v, dec).padStart(ancho);
    const lineas = ["MÉTODO DE LA SECANTE", `f(x) = ${r.funcion}`, `a = ${r.a}   b = ${r.b}   error = ${r.error}`, "",
      "   k" + ["a", "b", "f(a)", "f(b)", "x(k+1)", "f(x(k+1))"].map((t) => t.padStart(ancho)).join(""),
      ...r.tabla.map((f) => String(f.k).padStart(4) + [f.a, f.b, f.fa, f.fb, f.x, f.fx].map(col).join("")),
      "", r.mensaje, r.raiz === null ? "" : `Raíz ≈ ${num(r.raiz, dec)}`];
    descargar("secante.txt", lineas.join("\r\n"), "text/plain;charset=utf-8");
    avisar("Se descargó secante.txt");
    return;
  }

  // Informe para imprimir o guardar como PDF
  const v = (x) => numHTML(x, dec);
  const filas = r.tabla.map((f) => `<tr><td>${f.k}</td><td>${v(f.a)}</td><td>${v(f.b)}</td><td>${v(f.fa)}</td><td>${v(f.fb)}</td>
    <td>${v(f.x)}</td><td>${v(f.fx)}</td><td>${f.cumple ? "sí" : "no"}</td></tr>`).join("");
  const informe = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe — Método de la Secante</title>
    <style>body{font-family:Georgia,serif;max-width:900px;margin:30px auto;padding:0 20px;color:#1d2420}
    h1{color:#1c3f6e}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #c9ddd3;padding:5px 8px;text-align:right}
    th{background:#eef5f1}td:first-child{text-align:center}.raiz{font-size:20px}</style></head><body>
    <h1>Método de la Secante</h1>
    <p><b>f(x)</b> = ${funcionHTML(r.funcion)} &nbsp; <b>a</b> = ${r.a} &nbsp; <b>b</b> = ${r.b} &nbsp; <b>error</b> = ${r.error}</p>
    <p><b>Cambio de signo:</b> f(a) = ${v(r.fa)} (acheck = ${r.acheck ? "verdadero" : "falso"}), f(b) = ${v(r.fb)} (bcheck = ${r.bcheck ? "verdadero" : "falso"}) → ${r.cambio_de_signo ? "sí hay cambio de signo" : "no hay cambio de signo"}.</p>
    <p><b>Fórmula:</b> x<sub>k+1</sub> = (a·f(b) − b·f(a)) / (f(b) − f(a)) &nbsp;&nbsp; <b>Test de parada:</b> |f(x<sub>k+1</sub>)| &lt; error</p>
    <table><tr><th>k</th><th>a</th><th>b</th><th>f(a)</th><th>f(b)</th><th>x<sub>k+1</sub></th><th>f(x<sub>k+1</sub>)</th><th>¿&lt; error?</th></tr>${filas}</table>
    <p class="raiz">${r.encontrada ? `<b>Raíz ≈ ${v(r.raiz)}</b>` : ""}</p><p>${escapar(r.mensaje)}</p>
    <script>window.onload = () => window.print();<\/script></body></html>`;
  const ventana = window.open("", "_blank");
  if (ventana) {
    ventana.document.write(informe);
    ventana.document.close();
    avisar("Informe abierto: elegí «Guardar como PDF» para guardarlo.");
  }
}));

// ======================================================================
//  Formulario y teclado matemático
// ======================================================================

$("#formulario").addEventListener("submit", (e) => {
  e.preventDefault();
  resolver();
});

let temporizadorVista;
campo("funcion").addEventListener("input", () => {
  clearTimeout(temporizadorVista);
  temporizadorVista = setTimeout(vistaPrevia, 150);
});
["x0", "x1", "tolerancia"].forEach((id) => campo(id).addEventListener("input", () => {
  const c = $(`.campo[data-campo="${id}"]`);
  c.classList.remove("con-error");
  $(".error-campo", c).textContent = "";
  if (estado.datos) invalidarResultado();
}));

campo("decimales").addEventListener("change", (e) => {
  estado.decimales = parseInt(e.target.value, 10);
  if (!estado.datos) return;
  renderTablas(estado.datos);
  renderComparacion(estado.datos);
  pasos.actualizarDecimales(estado.decimales);
  animacion.decimales = estado.decimales;
  animacion._renderExplicacion();
  animacion._actualizarSubpasos();
});

$("#teclado").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-insertar]");
  if (!b) return;
  const input = campo("funcion");
  const texto = b.dataset.insertar;
  const ini = input.selectionStart ?? input.value.length;
  const fin = input.selectionEnd ?? input.value.length;
  const seleccion = input.value.slice(ini, fin);
  let insertar = texto;
  let cursor = ini + texto.length;
  if (texto.endsWith("()")) {
    insertar = texto.slice(0, -1) + seleccion + ")";
    cursor = ini + texto.length - 1 + seleccion.length + (seleccion ? 1 : 0);
  }
  input.setRangeText(insertar, ini, fin, "end");
  input.focus();
  input.setSelectionRange(cursor, cursor);
  input.dispatchEvent(new Event("input"));
});

// Atajos: espacio = reproducir/pausar, flechas = avanzar/retroceder
document.addEventListener("keydown", (e) => {
  const activa = pestanaActiva();
  const control = activa === "pasos" ? pasos : activa === "animacion" ? animacion : null;
  if (!control || !estado.datos) return;
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if (e.key === " ") { e.preventDefault(); control.alternar(); }
  else if (e.key === "ArrowRight" && !e.target.closest("[role=tablist]")) { e.preventDefault(); control.avanzar(); }
  else if (e.key === "ArrowLeft" && !e.target.closest("[role=tablist]")) { e.preventDefault(); control.retroceder(); }
});

// Fila de la tabla -> esa iteración en el paso a paso
$("#tabla-iteraciones tbody").addEventListener("click", (e) => {
  const fila = e.target.closest("tr[data-i]");
  if (!fila) return;
  estado.autoplayPendiente = false;
  activarPestana("pasos");
  pasos.irAIteracion(+fila.dataset.i);
});

// ======================================================================
//  Tema y salida
// ======================================================================

$("#btn-tema").addEventListener("click", () => {
  const raiz = document.documentElement;
  const oscuroAhora = raiz.dataset.theme
    ? raiz.dataset.theme === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
  raiz.dataset.theme = oscuroAhora ? "light" : "dark";
  try { localStorage.setItem("tema", raiz.dataset.theme); } catch (err) { /* sin almacenamiento */ }
  lienzoAnimacion.dibujar();
  redibujarTodos();
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  lienzoAnimacion.dibujar();
  redibujarTodos();
});

$("#btn-salir").addEventListener("click", async () => {
  if (!confirm("¿Cerrar el programa? Se detendrá el servidor.")) return;
  await llamar("salir");
  document.body.innerHTML = `<div class="sin-datos" style="margin:15vh auto;max-width:520px">
    <p>El programa se cerró correctamente.</p><p class="tenue">Ya podés cerrar esta pestaña.</p></div>`;
});

// ======================================================================
//  Inicio
// ======================================================================

renderHistorial();
cargarEnFormulario({ funcion: "x^3 - 4x - 1", a: "2", b: "3", error: "0.0001" });
document.fonts?.ready.then(() => redibujarTodos());
