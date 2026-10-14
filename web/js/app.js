// app.js — Interfaz principal: formulario, tabla, comparativa del error, pestañas e historial.

import { llamar } from "./api.js";
import { numHTML, corto, escapar, reducirMovimiento } from "./formato.js";
import { PasoAPaso } from "./pasos.js";
import { Lienzo } from "./lienzo.js";
import { Animacion } from "./animacion.js";
import { graficoLineas, redibujarTodos } from "./lineas.js";

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

const ESTADOS = {
  convergio: ["bien", "Convergencia alcanzada"],
  raiz_exacta: ["bien", "Raíz exacta encontrada"],
  max_iteraciones: ["alerta", "No converge"],
  division_cero: ["mal", "Detenido: división por cero"],
  fuera_dominio: ["mal", "Detenido: fuera del dominio"],
  divergencia: ["mal", "Detenido: el método diverge"],
  no_aplicable: ["alerta", "No aplicable"],
  discontinuidad: ["mal", "Converge a una discontinuidad"],
};

const COLORES_METODO = { "Secante": "lapiz", "Newton-Raphson": "tinta", "Falsa posición": "ocre", "Bisección": "verde" };

const estado = {
  datos: null,            // última respuesta de /api/resolver
  decimales: 8,
  autoplayPendiente: false,           // paso a paso
  autoplayAnimacionPendiente: false,  // animación sobre la gráfica
};

// ======================================================================
//  Elementos
// ======================================================================

const form = $("#formulario");
const campo = (nombre) => $(`#${nombre}`);

const pasos = new PasoAPaso({
  explicacion: $("#explicacion"),
  tabla: $("#pasos-tabla"),
  tablaError: $("#pasos-error"),
  tituloError: $("#pasos-error-titulo"),
  posicion: $("#paso-posicion"),
  lineaTiempo: $("#linea-tiempo"),
  reproducir: $("#paso-reproducir"),
  anterior: $("#paso-anterior"),
  siguiente: $("#paso-siguiente"),
  inicio: $("#paso-inicio"),
  fin: $("#paso-fin"),
  velocidad: $("#velocidad"),
});

// Animación del método sobre la gráfica (pestaña "Animación")
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

function demorar(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function criterio() {
  return campo("criterio").value;
}

function datosFormulario() {
  return {
    funcion: campo("funcion").value,
    x0: campo("x0").value,
    x1: campo("x1").value,
    tolerancia: campo("tolerancia").value,
    criterio: criterio(),
  };
}

function cargarEnFormulario(d) {
  campo("funcion").value = d.funcion;
  campo("x0").value = d.x0;
  campo("x1").value = d.x1;
  if (d.tolerancia !== undefined) campo("tolerancia").value = d.tolerancia;
  if (d.criterio) campo("criterio").value = d.criterio;
  actualizarUnidadError();
  limpiarErrores();
  analizarFuncion();
}

/** Con el criterio relativo, el error pedido es un porcentaje. */
function actualizarUnidadError() {
  $("#unidad-error").textContent = criterio() === "relativo" ? "(%)" : "";
}

// ======================================================================
//  Errores de validación
// ======================================================================

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
    if (e.campo === "funcion" && e.posicion !== undefined) marcarErrorFuncion(e);
  }
  const primero = $(".campo.con-error input");
  if (primero) primero.focus();
  avisar(generales.length ? generales.join(" ") : "Revisá los datos marcados en rojo.", "error");
}

function marcarErrorFuncion(error) {
  const texto = campo("funcion").value;
  const ini = Math.min(error.posicion, texto.length);
  const fin = Math.min(ini + (error.longitud || 1), texto.length);
  const marcado = ini >= texto.length
    ? `${escapar(texto)}<mark>&nbsp;</mark>`
    : `${escapar(texto.slice(0, ini))}<mark>${escapar(texto.slice(ini, fin))}</mark>${escapar(texto.slice(fin))}`;
  $("#vista-funcion").innerHTML = `<span style="font-family:var(--fuente-ui);font-size:1rem">${marcado}</span>`;
}

// ======================================================================
//  Vista previa de la ecuación mientras se escribe
// ======================================================================

let pedidoAnalisis = 0;

async function analizarFuncion() {
  const texto = campo("funcion").value;
  const contenedor = $('.campo[data-campo="funcion"]');
  const vista = $("#vista-funcion");
  const numero = ++pedidoAnalisis;

  if (!texto.trim()) {
    vista.innerHTML = "";
    contenedor.classList.remove("con-error");
    $(".error-campo", contenedor).textContent = "";
    return;
  }

  const r = await llamar("analizar", { funcion: texto });
  if (numero !== pedidoAnalisis) return;

  if (!r.ok) {
    const e = r.errores[0];
    contenedor.classList.add("con-error");
    $(".error-campo", contenedor).textContent = e.mensaje;
    if (e.posicion !== undefined) marcarErrorFuncion(e);
    else vista.innerHTML = "";
    return;
  }

  contenedor.classList.remove("con-error");
  $(".error-campo", contenedor).textContent = "";
  vista.innerHTML = `<i>f</i>(<i>x</i>) = ${r.html}`;

  // Si la ecuación cambió, la tabla anterior deja de corresponder
  if (estado.datos && estado.datos.funcion.texto !== r.texto) invalidarResultado();
}

// ======================================================================
//  Resolver
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

  estado.datos = r;
  estado.autoplayPendiente = true;
  estado.autoplayAnimacionPendiente = true;
  renderizarTodo();
  const contenido = $("#resultado-contenido");
  contenido.classList.remove("revelar");
  void contenido.offsetWidth;
  contenido.classList.add("revelar");
  cargarHistorial();
}

function invalidarResultado() {
  estado.datos = null;
  pasos.pausar();
  animacion.pausar();
  $("#resultado-contenido").hidden = true;
  $("#resolver-vacio").hidden = false;
  $$("[data-sin-datos]").forEach((el) => { el.hidden = false; });
  $$("[data-con-datos]").forEach((el) => { el.hidden = true; });
}

function renderizarTodo() {
  const d = estado.datos;
  if (!d) return;
  $("#resolver-vacio").hidden = true;
  $("#resultado-contenido").hidden = false;
  $$("[data-sin-datos]").forEach((el) => { el.hidden = true; });
  $$("[data-con-datos]").forEach((el) => { el.hidden = false; });

  renderTablas(d);
  renderConvergencia(d);
  renderComparacion(d);
  pasos.cargar(d, estado.decimales);
  animacion.cargar(d, estado.decimales);
  if (pestanaActiva() === "pasos") iniciarAutoplay();
  if (pestanaActiva() === "animacion") iniciarAnimacion();
}

/** Valor del error según el criterio elegido en la cabecera del cuadro. */
function errorSegunCriterio(it, criterioActual) {
  if (criterioActual === "relativo") return it.error_relativo;
  if (criterioActual === "residuo") return Math.abs(it.f_siguiente);
  return it.error_absoluto;
}

function renderTablas(d) {
  const r = d.resultado;
  const dec = estado.decimales;
  const its = r.iteraciones;
  const tol = r.tolerancia;
  const unidad = r.criterio === "relativo" ? " %" : "";
  const ultima = its.length - 1;

  // ---- Cuadro izquierdo: la tabla con los valores iniciales y los resultados de la fórmula
  $("#tabla-iteraciones tbody").innerHTML = its.map((it, k) => `
    <tr data-i="${k}" class="${k === ultima && r.exitoso ? "final" : ""}" title="Ver la iteración ${it.n} paso a paso">
      <td>${it.n}</td>
      <td>${numHTML(it.x_anterior, dec)}</td><td>${numHTML(it.x_actual, dec)}</td>
      <td>${numHTML(it.f_anterior, dec)}</td><td>${numHTML(it.f_actual, dec)}</td>
      <td class="col-nueva">${numHTML(it.x_siguiente, dec)}</td>
    </tr>`).join("")
    || `<tr><td colspan="6" class="tenue" style="text-align:center">No se realizaron iteraciones.</td></tr>`;

  // ---- Cuadro derecho: la comparativa del error contra el error pedido
  $("#tabla-error tbody").innerHTML = its.map((it, k) => {
    const error = errorSegunCriterio(it, r.criterio);
    const cumple = k === ultima && r.exitoso;
    const comparacion = error === null
      ? "—"
      : cumple
        ? `&lt; ${tol}${unidad} <b>→ se detiene</b>`
        : `≥ ${tol}${unidad} → sigue iterando`;
    return `<tr class="${cumple ? "final" : ""}">
      <td>${it.n}</td>
      <td>${error === null ? "—" : numHTML(error, dec) + unidad}</td>
      <td class="comparacion ${cumple ? "cumple" : ""}">${comparacion}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="3" class="tenue" style="text-align:center">—</td></tr>`;

  // ---- Resultado final
  const [clase, texto] = ESTADOS[r.estado] || ["alerta", r.estado];
  const final = $("#resultado-final");
  if (r.exitoso) {
    final.innerHTML = `
      <span class="estado ${clase}">${texto}</span>
      <p class="raiz-final">Raíz ≈ <b>${numHTML(r.raiz, dec)}</b></p>
      <p class="tenue">${escapar(r.mensaje)} El error ${errorNombre(r.criterio)} quedó en
        ${numHTML(errorSegunCriterio(its[ultima] || {}, r.criterio) ?? 0, dec)}${unidad}, menor que ${tol}${unidad}.</p>`;
  } else {
    final.innerHTML = `
      <span class="estado ${clase}">${texto}</span>
      <p class="tenue">${escapar(r.mensaje)}</p>`;
  }
}

function errorNombre(criterioActual) {
  if (criterioActual === "relativo") return "relativo |xₙ₊₁ − xₙ| / |xₙ₊₁|";
  if (criterioActual === "residuo") return "|f(xₙ₊₁)|";
  return "|xₙ₊₁ − xₙ|";
}

function renderConvergencia(d) {
  const its = d.resultado.iteraciones;
  graficoLineas($("#canvas-error"), {
    logY: true,
    etiquetaX: "iteración",
    series: [
      { nombre: "Error absoluto Eₐ", color: "lapiz", puntos: its.map((it) => [it.n, it.error_absoluto]) },
      { nombre: "|f(xₙ₊₁)|", color: "tinta", puntos: its.map((it) => [it.n, Math.abs(it.f_siguiente)]), punteada: true },
    ],
  });
  graficoLineas($("#canvas-orden"), {
    etiquetaX: "iteración",
    limitesY: [-0.5, 3.5],
    referencia: { y: d.analisis.orden_teorico, etiqueta: "φ ≈ 1.618" },
    series: [{ nombre: "p estimado", color: "lapiz", puntos: d.analisis.estimaciones_orden.map((e) => [e.n, e.p]) }],
  });

  const r = d.resultado;
  const a = d.analisis;
  const parrafos = [];
  const [, textoEstado] = ESTADOS[r.estado] || ["", r.estado];
  parrafos.push(`<p><b>${textoEstado}.</b> ${escapar(r.mensaje)}</p>`);
  if (a.orden_estimado !== null) {
    parrafos.push(`<p>El orden de convergencia estimado con las últimas iteraciones es <b>p ≈ ${a.orden_estimado.toFixed(3)}</b>. ` +
      `La teoría predice φ = (1 + √5)/2 ≈ 1.618 cuando f′(r) ≠ 0: cerca de la raíz, ` +
      `<b>la cantidad de cifras correctas se multiplica por ≈ 1.6 en cada iteración</b>.</p>`);
  } else {
    parrafos.push("<p>Hacen falta al menos tres iteraciones para estimar el orden de convergencia.</p>");
  }
  if (a.cifras_significativas !== null && r.exitoso) {
    parrafos.push(`<p>Con un error relativo de ${numHTML(r.error_relativo, 6)} %, el criterio de Scarborough asegura ` +
      `al menos <b>${a.cifras_significativas} cifras significativas</b> correctas.</p>`);
  }
  for (const t of a.advertencias) parrafos.push(`<p class="tenue">⚠ ${escapar(t)}</p>`);
  $("#texto-convergencia").innerHTML = parrafos.join("");
}

function renderComparacion(d) {
  const dec = estado.decimales;
  const metodos = d.comparacion.metodos;
  const exitosos = metodos.filter((m) => m.exitoso);
  const mejor = exitosos.length ? Math.min(...exitosos.map((m) => m.iteraciones.length)) : null;

  $("#tabla-comparacion tbody").innerHTML = metodos.map((m) => {
    const [clase, texto] = ESTADOS[m.estado] || ["alerta", m.estado];
    const color = `var(--${COLORES_METODO[m.metodo]})`;
    return `<tr class="${m.exitoso && m.iteraciones.length === mejor ? "destacada" : ""}">
      <td><span class="muestra" style="background:${color}"></span>${m.metodo}</td>
      <td>${escapar(m.descripcion)}</td>
      <td>${m.aplicable ? m.iteraciones.length : "—"}</td>
      <td>${m.raiz === null ? "—" : numHTML(m.raiz, dec)}</td>
      <td><span class="estado ${clase}" title="${escapar(m.mensaje)}">${texto}</span></td>
    </tr>`;
  }).join("");

  const newton = metodos.find((m) => m.metodo === "Newton-Raphson");
  $("#derivada-newton").innerHTML = newton?.derivada_html
    ? `Derivada usada por Newton-Raphson (calculada simbólicamente): <i>f′</i>(<i>x</i>) = ${newton.derivada_html}` : "";

  graficoLineas($("#canvas-comparacion"), {
    logY: true,
    etiquetaX: "iteración",
    series: metodos.filter((m) => m.iteraciones.length).map((m) => ({
      nombre: m.metodo,
      color: COLORES_METODO[m.metodo],
      puntos: m.iteraciones.map((it) => [it.n, it.error_absoluto]),
    })),
  });

  $("#conclusiones-comparacion").innerHTML = d.comparacion.conclusiones.map((t) => `<li>${escapar(t)}</li>`).join("");
}

// ======================================================================
//  Pestañas
// ======================================================================

const pestanas = $$(".pestanas [role=tab]");

function pestanaActiva() {
  const activa = pestanas.find((p) => p.getAttribute("aria-selected") === "true");
  return activa.id.replace("tab-", "");
}

function activarPestana(nombre) {
  for (const p of pestanas) {
    const activa = p.id === `tab-${nombre}`;
    p.setAttribute("aria-selected", String(activa));
    p.tabIndex = activa ? 0 : -1;
    $(`#${p.getAttribute("aria-controls")}`).hidden = !activa;
  }
  if (nombre === "pasos") iniciarAutoplay();
  else pasos.pausar();
  if (nombre === "animacion") iniciarAnimacion();
  else animacion.pausar();
  if (nombre === "historial") cargarHistorial();
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
//  Historial
// ======================================================================

async function cargarHistorial() {
  const r = await llamar("historial");
  if (r.ok) renderHistorial(r.historial);
}

function renderHistorial(lista) {
  const ul = $("#lista-historial");
  if (!lista.length) {
    ul.innerHTML = `<li class="historial-vacio">Todavía no resolviste ningún ejercicio. Los que resuelvas aparecen acá.</li>`;
    return;
  }
  ul.innerHTML = lista.map((h) => {
    const [clase] = ESTADOS[h.estado] || ["alerta"];
    return `<li data-id="${escapar(h.id)}">
      <div>
        <div class="historial-fx">f(x) = ${escapar(h.funcion)}</div>
        <div class="historial-detalle">x₀ = ${escapar(h.x0)}, x₁ = ${escapar(h.x1)}, error = ${escapar(h.tolerancia)} ·
          ${h.raiz === null || !h.exitoso ? "sin raíz" : `raíz ≈ ${corto(h.raiz, 10)}`} · ${h.iteraciones} it. · ${escapar(h.fecha)}
          <span class="estado ${clase}" style="padding:1px 8px;font-size:.72rem;margin-left:4px">${(ESTADOS[h.estado] || ["", h.estado])[1]}</span></div>
      </div>
      <button type="button" class="boton-chico" data-accion="cargar">Volver a resolver</button>
      <button type="button" class="boton-borrar" data-accion="borrar" title="Borrar del historial" aria-label="Borrar">×</button>
    </li>`;
  }).join("");
  ul._lista = lista;
}

$("#lista-historial").addEventListener("click", async (e) => {
  const boton = e.target.closest("button[data-accion]");
  if (!boton) return;
  const id = boton.closest("li").dataset.id;
  if (boton.dataset.accion === "borrar") {
    const r = await llamar("historial/borrar", { id });
    if (r.ok) renderHistorial(r.historial);
    return;
  }
  const h = $("#lista-historial")._lista.find((x) => x.id === id);
  if (!h) return;
  cargarEnFormulario(h);
  activarPestana("resolver");
  await resolver();
});

$("#btn-vaciar-historial").addEventListener("click", async () => {
  if (!confirm("¿Borrar todos los ejercicios del historial?")) return;
  const r = await llamar("historial/borrar", {});
  if (r.ok) renderHistorial([]);
});

// ======================================================================
//  Exportar
// ======================================================================

$$("[data-exportar]").forEach((b) => b.addEventListener("click", async () => {
  const formato = b.dataset.exportar;
  const r = await llamar("exportar", { ...datosFormulario(), formato, decimales: estado.decimales });
  if (!r.ok) { mostrarErrores(r.errores); return; }
  const blob = new Blob([r.contenido], { type: r.tipo });
  const url = URL.createObjectURL(blob);
  if (formato === "html") {
    window.open(url, "_blank");
    avisar("Informe abierto en una pestaña nueva. Usá Ctrl+P para guardarlo como PDF.");
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = r.nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    avisar(`Se descargó ${r.nombre}`);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}));

// ======================================================================
//  Formulario, criterio y teclado matemático
// ======================================================================

form.addEventListener("submit", (e) => {
  e.preventDefault();
  resolver();
});

campo("funcion").addEventListener("input", demorar(analizarFuncion, 220));
["x0", "x1", "tolerancia"].forEach((id) => campo(id).addEventListener("input", () => {
  const c = $(`.campo[data-campo="${id}"]`);
  c.classList.remove("con-error");
  $(".error-campo", c).textContent = "";
  if (estado.datos) invalidarResultado();
}));

// El criterio de parada se elige en la cabecera del cuadro del error.
// Al cambiarlo se vuelve a resolver, porque cambia en qué iteración se detiene.
campo("criterio").addEventListener("change", () => {
  actualizarUnidadError();
  if (estado.datos) resolver();
});

campo("decimales").addEventListener("change", (e) => {
  estado.decimales = parseInt(e.target.value, 10);
  if (estado.datos) {
    renderTablas(estado.datos);
    renderComparacion(estado.datos);
    pasos.actualizarDecimales(estado.decimales);
    animacion.decimales = estado.decimales;
    animacion._renderExplicacion();
    animacion._actualizarSubpasos();
  }
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

// Atajos del paso a paso y de la animación: espacio = reproducir/pausar, flechas = avanzar/retroceder
document.addEventListener("keydown", (e) => {
  const activa = pestanaActiva();
  const control = activa === "pasos" ? pasos : activa === "animacion" ? animacion : null;
  if (!control || !estado.datos) return;
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if (e.key === " ") { e.preventDefault(); control.alternar(); }
  else if (e.key === "ArrowRight" && !e.target.closest("[role=tablist]")) { e.preventDefault(); control.avanzar(); }
  else if (e.key === "ArrowLeft" && !e.target.closest("[role=tablist]")) { e.preventDefault(); control.retroceder(); }
});

// Fila de la tabla -> esa iteración paso a paso
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

cargarHistorial();
cargarEnFormulario({ funcion: "x^3 - 4x - 1", x0: "1", x1: "2" });
document.fonts?.ready.then(() => redibujarTodos());
