// app.js — Interfaz principal: formulario, pestañas, resultados e historial.

import { llamar } from "./api.js";
import { numHTML, corto, escapar, paraCampo, reducirMovimiento } from "./formato.js";
import { Lienzo } from "./lienzo.js";
import { PasoAPaso } from "./pasos.js";
import { graficoLineas, redibujarTodos } from "./lineas.js";

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

const EJEMPLOS = [
  { funcion: "x^3 - 4x - 1", x0: "1", x1: "2", nota: "ejemplo del enunciado" },
  { funcion: "cos(x) - x", x0: "0", x1: "1", nota: "trascendente" },
  { funcion: "e^(-x) - x", x0: "0", x1: "1", nota: "exponencial" },
  { funcion: "x^2 - 2", x0: "1", x1: "2", nota: "calcula √2" },
  { funcion: "x*sin(x) - 1", x0: "0", x1: "2", nota: "producto" },
  { funcion: "ln(x) + x - 2", x0: "1", x1: "3", nota: "logaritmo" },
  { funcion: "x^3 - 4x - 1", x0: "-1", x1: "0", nota: "otra de sus 3 raíces" },
  { funcion: "(x - 1)^2", x0: "0", x1: "0.5", nota: "raíz doble: más lenta" },
  { funcion: "x^2 + 1", x0: "0", x1: "1", nota: "sin raíces reales" },
  { funcion: "x^2 - 4", x0: "-1", x1: "1", nota: "secante horizontal" },
];

const ESTADOS = {
  convergio: ["bien", "Convergencia alcanzada"],
  raiz_exacta: ["bien", "Raíz exacta encontrada"],
  max_iteraciones: ["alerta", "Máximo de iteraciones alcanzado"],
  division_cero: ["mal", "Detenido: división por cero"],
  fuera_dominio: ["mal", "Detenido: fuera del dominio"],
  divergencia: ["mal", "Detenido: el método diverge"],
  no_aplicable: ["alerta", "No aplicable"],
  discontinuidad: ["mal", "Converge a una discontinuidad"],
};

const AYUDA_CRITERIO = {
  absoluto: "Se detiene cuando |xₙ₊₁ − xₙ| es menor que la tolerancia.",
  relativo: "La tolerancia es un porcentaje: se detiene cuando εₐ = |(xₙ₊₁ − xₙ)/xₙ₊₁|·100 es menor.",
  residuo: "Se detiene cuando |f(xₙ₊₁)| es menor que la tolerancia.",
};

const COLORES_METODO = { "Secante": "lapiz", "Newton-Raphson": "tinta", "Falsa posición": "ocre", "Bisección": "verde" };

const estado = {
  datos: null,            // última respuesta de /api/resolver
  decimales: 8,
  vistaPrevia: null,      // { texto } de la función válida que se está escribiendo
  autoplayPendiente: false,
};

// ======================================================================
//  Elementos
// ======================================================================

const form = $("#formulario");
const campo = (nombre) => $(`#${nombre}`);

const lienzoPrincipal = new Lienzo($("#grafico-principal"));
const lienzoPasos = new Lienzo($("#grafico-pasos"));
const pasos = new PasoAPaso(lienzoPasos, {
  explicacion: $("#explicacion"),
  lineaTiempo: $("#linea-tiempo"),
  reproducir: $("#paso-reproducir"),
  anterior: $("#paso-anterior"),
  siguiente: $("#paso-siguiente"),
  inicio: $("#paso-inicio"),
  fin: $("#paso-fin"),
  velocidad: $("#velocidad"),
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

function datosFormulario() {
  return {
    funcion: campo("funcion").value,
    x0: campo("x0").value,
    x1: campo("x1").value,
    tolerancia: campo("tolerancia").value,
    max_iteraciones: campo("max_iteraciones").value,
    criterio: $("input[name=criterio]:checked").value,
  };
}

function cargarEnFormulario(d) {
  campo("funcion").value = d.funcion;
  campo("x0").value = d.x0;
  campo("x1").value = d.x1;
  if (d.tolerancia !== undefined) campo("tolerancia").value = d.tolerancia;
  if (d.max_iteraciones !== undefined) campo("max_iteraciones").value = d.max_iteraciones;
  if (d.criterio) {
    const radio = $(`input[name=criterio][value="${d.criterio}"]`);
    if (radio) radio.checked = true;
    actualizarAyudaCriterio();
  }
  limpiarErrores();
  analizarFuncion();
  actualizarBolzanoVivo();
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
//  Vista previa de la función mientras se escribe
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
    estado.vistaPrevia = null;
    if (!estado.datos) {
      lienzoPrincipal.fijarFuncion(null);
      $("#grafico-vacio-texto").textContent = "Escribí una función para ver su gráfica.";
      $("#grafico-vacio").hidden = false;
    }
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
    // Mientras la función tenga errores no se muestra una gráfica que no le corresponde
    if (!estado.datos) {
      estado.vistaPrevia = null;
      lienzoPrincipal.fijarFuncion(null);
      $("#grafico-vacio-texto").textContent = "Corregí la función para ver su gráfica.";
      $("#grafico-vacio").hidden = false;
      $("#bolzano-vivo").textContent = "";
    }
    return;
  }

  contenedor.classList.remove("con-error");
  $(".error-campo", contenedor).textContent = "";
  vista.innerHTML = `<i>f</i>(<i>x</i>) = ${r.html}<span class="vista-derivada"><i>f′</i>(<i>x</i>) = ${r.derivada_html}</span>`;

  const cambio = !estado.vistaPrevia || estado.vistaPrevia.texto !== r.texto;
  estado.vistaPrevia = { texto: r.texto };

  // Si la función cambió, el resultado anterior deja de corresponder
  if (estado.datos && estado.datos.funcion.texto !== r.texto) invalidarResultado();

  if (!estado.datos && cambio) {
    $("#grafico-vacio").hidden = true;
    lienzoPrincipal.fijarVista(vistaInicial());
    await lienzoPrincipal.fijarFuncion(r.texto, { ajustar: true });
    actualizarBolzanoVivo();
  }
}

function valoresIniciales() {
  const leer = (id) => {
    const v = parseFloat(campo(id).value.replace(",", "."));
    return Number.isFinite(v) ? v : null;
  };
  return [leer("x0"), leer("x1")];
}

function vistaInicial() {
  const [x0, x1] = valoresIniciales();
  if (x0 !== null && x1 !== null && x0 !== x1) {
    const centro = (x0 + x1) / 2;
    const ancho = Math.max(Math.abs(x1 - x0) * 4, 4);
    return { xmin: centro - ancho / 2, xmax: centro + ancho / 2, ymin: -5, ymax: 5 };
  }
  return { xmin: -6, xmax: 6, ymin: -5, ymax: 5 };
}

/** Indicador de Bolzano en vivo mientras se escriben x₀ y x₁. */
const actualizarBolzanoVivo = demorar(async () => {
  const el = $("#bolzano-vivo");
  const [x0, x1] = valoresIniciales();
  lienzoPrincipal.solicitarDibujo();
  if (!estado.vistaPrevia || x0 === null || x1 === null || x0 === x1) { el.textContent = ""; return; }
  const r = await llamar("muestrear", {
    funcion: estado.vistaPrevia.texto, desde: Math.min(x0, x1), hasta: Math.max(x0, x1), puntos: 2,
  });
  if (!r.ok) { el.textContent = ""; return; }
  const [[, fa], [, fb]] = r.curva;
  if (fa === null || fb === null) {
    el.className = "bolzano-vivo sin-cambio";
    el.innerHTML = "<b>f no está definida</b> en alguno de los valores iniciales.";
    return;
  }
  const fx0 = x0 < x1 ? fa : fb, fx1 = x0 < x1 ? fb : fa;
  const hayCambio = fx0 * fx1 <= 0;
  el.className = `bolzano-vivo ${hayCambio ? "" : "sin-cambio"}`;
  el.innerHTML = `f(x₀) = ${corto(fx0, 5)}, f(x₁) = ${corto(fx1, 5)} · ` +
    (hayCambio ? "<b>hay cambio de signo</b>" : "<b>sin cambio de signo</b> (la secante igual puede funcionar)");
}, 250);

// ======================================================================
//  Capa del gráfico principal
// ======================================================================

lienzoPrincipal.capas.push((ctx, L) => {
  const c = L.c;
  const etiqueta = (x, texto, color) => {
    ctx.font = `italic 15px ${c.fuenteMat}`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    const y = Math.min(L.alto - 8, Math.max(18, L.aY(0) + 20));
    ctx.fillText(texto, L.aX(x), y);
  };

  if (!estado.datos) {
    // Antes de resolver: marcar x₀ y x₁
    const [x0, x1] = valoresIniciales();
    for (const [x, nombre] of [[x0, "x₀"], [x1, "x₁"]]) {
      if (x === null || !estado.vistaPrevia) continue;
      ctx.strokeStyle = c.lapiz;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(L.aX(x), 0);
      ctx.lineTo(L.aX(x), L.alto);
      ctx.stroke();
      ctx.setLineDash([]);
      const y = L.valorEn(x);
      if (y !== null) {
        ctx.fillStyle = c.lapiz;
        ctx.beginPath(); ctx.arc(L.aX(x), L.aY(y), 5, 0, Math.PI * 2); ctx.fill();
      }
      // Etiqueta arriba del gráfico, para no pisar la escala del eje x
      ctx.font = `italic 16px ${c.fuenteMat}`;
      ctx.fillStyle = c.lapiz;
      ctx.textAlign = "center";
      ctx.fillText(nombre, L.aX(x), 20);
    }
    return;
  }

  // Después de resolver: todas las secantes y la raíz
  const r = estado.datos.resultado;
  r.iteraciones.forEach((it, k) => {
    const alfa = Math.max(0.18, 0.75 - k * 0.12);
    ctx.globalAlpha = alfa;
    ctx.strokeStyle = c.lapiz;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(L.aX(it.x_anterior), L.aY(it.f_anterior));
    ctx.lineTo(L.aX(it.x_siguiente), L.aY(0));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = c.lapiz;
    ctx.beginPath(); ctx.arc(L.aX(it.x_siguiente), L.aY(0), 3, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
  for (const [x, y] of [[r.x0, r.f_x0], [r.x1, r.f_x1]]) {
    if (y === null || y === undefined) continue;
    ctx.fillStyle = c.tinta;
    ctx.beginPath(); ctx.arc(L.aX(x), L.aY(y), 4.5, 0, Math.PI * 2); ctx.fill();
  }
  if (r.raiz !== null && r.exitoso) {
    ctx.strokeStyle = c.lapiz;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(L.aX(r.raiz), L.aY(0), 8, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `italic 15px ${c.fuenteMat}`;
    ctx.fillStyle = c.lapiz;
    ctx.textAlign = "left";
    ctx.fillText(`x* ≈ ${corto(r.raiz, 8)}`, L.aX(r.raiz) + 12, L.aY(0) - 12);
  }
});

lienzoPrincipal.alAjustar = () => {
  if (estado.datos) {
    const [desde, hasta] = estado.datos.rango;
    lienzoPrincipal.fijarVista({ ...lienzoPrincipal.vista, xmin: desde, xmax: hasta });
    lienzoPrincipal.ajustarY();
  } else {
    lienzoPrincipal.fijarVista(vistaInicial());
    lienzoPrincipal.ajustarY();
  }
};

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
  renderizarTodo();
  $("#resultado-contenido").classList.remove("revelar");
  void $("#resultado-contenido").offsetWidth;
  $("#resultado-contenido").classList.add("revelar");
  avisar(r.resultado.exitoso ? `Raíz encontrada en ${r.resultado.cantidad_iteraciones} iteraciones.` : r.resultado.mensaje,
    r.resultado.exitoso ? "" : "error");
  cargarHistorial();
}

function invalidarResultado() {
  estado.datos = null;
  pasos.pausar();
  $("#resultado-contenido").hidden = true;
  $$("[data-sin-datos]").forEach((el) => { el.hidden = false; });
  $$("[data-con-datos]").forEach((el) => { el.hidden = true; });
}

function renderizarTodo() {
  const d = estado.datos;
  if (!d) return;
  $("#grafico-vacio").hidden = true;
  $("#resultado-contenido").hidden = false;
  $$("[data-sin-datos]").forEach((el) => { el.hidden = true; });
  $$("[data-con-datos]").forEach((el) => { el.hidden = false; });

  renderResultado(d);
  renderConvergencia(d);
  renderComparacion(d);
  pasos.cargar(d, estado.decimales);
  if (pestanaActiva() === "pasos") iniciarAutoplay();
}

function renderResultado(d) {
  const r = d.resultado;
  const dec = estado.decimales;
  const [clase, texto] = ESTADOS[r.estado] || ["alerta", r.estado];

  $("#respuesta-estado").innerHTML = `<span class="estado ${clase}">${texto}</span>`;
  $("#respuesta-raiz").innerHTML = r.raiz === null ? "—" : `<i>x</i> ≈ ${numHTML(r.raiz, dec + 2)}`;
  $("#respuesta-fx").innerHTML = r.f_raiz === null ? "" : `f(x) = ${numHTML(r.f_raiz, dec)}`;
  $("#dato-iteraciones").textContent = r.cantidad_iteraciones;
  $("#dato-error-abs").innerHTML = numHTML(r.error_absoluto, dec);
  $("#dato-error-rel").innerHTML = r.error_relativo === null ? "—" : `${numHTML(r.error_relativo, dec)} %`;
  $("#dato-cifras").textContent = d.analisis.cifras_significativas ?? "—";
  $("#respuesta-mensaje").textContent = r.mensaje;

  const v = d.verificacion;
  const nota = $("#nota-bolzano");
  nota.className = `nota nota-bolzano ${v.cumple ? "" : "alerta"}`;
  nota.innerHTML = `<p class="nota-titulo">Teorema de Bolzano en [x₀, x₁]</p><p>${escapar(v.mensaje)}</p>` +
    (v.detalle.length ? `<ul>${v.detalle.map((t) => `<li>${escapar(t)}</li>`).join("")}</ul>` : "");

  const cuerpo = $("#tabla-iteraciones tbody");
  cuerpo.innerHTML = r.iteraciones.map((it, k) => `
    <tr data-i="${k}" class="${k === r.iteraciones.length - 1 && r.exitoso ? "final" : ""}" title="Ver la iteración ${it.n} animada">
      <td>${it.n}</td>
      <td>${numHTML(it.x_anterior, dec)}</td><td>${numHTML(it.x_actual, dec)}</td>
      <td>${numHTML(it.f_anterior, dec)}</td><td>${numHTML(it.f_actual, dec)}</td>
      <td class="col-nueva">${numHTML(it.x_siguiente, dec)}</td><td>${numHTML(it.f_siguiente, dec)}</td>
      <td>${numHTML(it.error_absoluto, dec)}</td>
      <td>${it.error_relativo === null ? "—" : numHTML(it.error_relativo, dec)}</td>
    </tr>`).join("") || `<tr><td colspan="9" class="tenue" style="text-align:center">No se realizaron iteraciones.</td></tr>`;

  const lista = [
    ...d.analisis.conclusiones.map((t) => `<li>${escapar(t)}</li>`),
    ...d.analisis.advertencias.map((t) => `<li class="advertencia">${escapar(t)}</li>`),
  ];
  $("#conclusiones").innerHTML = lista.join("") || "<li>Sin observaciones.</li>";

  lienzoPrincipal.fijarCurva(d.funcion.texto, d.curva);
  lienzoPrincipal.alAjustar();
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
      `La teoría predice φ = (1 + √5)/2 ≈ 1.618 cuando f′(r) ≠ 0. Eso significa que, cerca de la raíz, ` +
      `<b>la cantidad de cifras correctas se multiplica por ≈ 1.6 en cada iteración</b>. En el gráfico de la izquierda se ve ` +
      `como una curva que cae cada vez más rápido.</p>`);
  } else {
    parrafos.push("<p>Hacen falta al menos tres iteraciones para estimar el orden de convergencia.</p>");
  }
  if (a.cifras_significativas !== null && r.exitoso) {
    parrafos.push(`<p>Con un error relativo de ${numHTML(r.error_relativo, 6)} %, el criterio de Scarborough asegura ` +
      `al menos <b>${a.cifras_significativas} cifras significativas</b> correctas.</p>`);
  }
  parrafos.push(`<p class="tenue">Como no se conoce la raíz exacta, el error se aproxima con la diferencia entre dos ` +
    `aproximaciones consecutivas: eₙ ≈ |xₙ₊₁ − xₙ|.</p>`);
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
  if (nombre === "historial") cargarHistorial();
  requestAnimationFrame(redibujarTodos);
}

function iniciarAutoplay() {
  if (!estado.datos || !estado.autoplayPendiente) return;
  estado.autoplayPendiente = false;
  if (!reducirMovimiento.matches) setTimeout(() => pasos.reproducir(), 350);
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
        <div class="historial-detalle">x₀ = ${escapar(h.x0)}, x₁ = ${escapar(h.x1)}, tol = ${escapar(h.tolerancia)} ·
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
  const li = boton.closest("li");
  const id = li.dataset.id;
  if (boton.dataset.accion === "borrar") {
    const r = await llamar("historial/borrar", { id });
    if (r.ok) renderHistorial(r.historial);
    return;
  }
  const h = $("#lista-historial")._lista.find((x) => x.id === id);
  if (!h) return;
  cargarEnFormulario(h);
  activarPestana("resultado");
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
//  Buscador de intervalos
// ======================================================================

$("#btn-buscar-abrir").addEventListener("click", () => {
  const panel = $("#buscador");
  panel.hidden = !panel.hidden;
  if (!panel.hidden) $("#desde").focus();
});

$("#btn-buscar").addEventListener("click", async () => {
  limpiarErrores();
  const r = await llamar("buscar", { funcion: campo("funcion").value, desde: $("#desde").value, hasta: $("#hasta").value });
  const ul = $("#lista-intervalos");
  if (!r.ok) { mostrarErrores(r.errores); ul.innerHTML = ""; return; }
  const items = r.intervalos.map((i) => i.exacta
    ? `<li><button type="button" data-a="${i.a}" data-b="${i.a + 0.5}">x = ${corto(i.a, 8)} <span>es raíz exacta</span></button></li>`
    : `<li><button type="button" data-a="${i.a}" data-b="${i.b}">[${corto(i.a, 6)}, ${corto(i.b, 6)}] <span>usar como x₀, x₁</span></button></li>`);
  if (r.asintotas.length) {
    items.push(`<li>Además hay ${r.asintotas.length} cambio(s) de signo por asíntotas (no son raíces), cerca de x ≈ ${r.asintotas.map((i) => corto((i.a + i.b) / 2, 4)).join(", ")}.</li>`);
  }
  ul.innerHTML = items.join("") || "<li>No se encontraron cambios de signo en ese rango. Probá con un rango más amplio.</li>";
  if (!estado.datos && r.curva) {
    lienzoPrincipal.fijarVista({ xmin: r.rango[0], xmax: r.rango[1], ymin: -5, ymax: 5 });
    lienzoPrincipal.fijarCurva(campo("funcion").value, r.curva);
    lienzoPrincipal.ajustarY();
  }
});

$("#lista-intervalos").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-a]");
  if (!b) return;
  campo("x0").value = paraCampo(parseFloat(b.dataset.a));
  campo("x1").value = paraCampo(parseFloat(b.dataset.b));
  limpiarErrores();
  actualizarBolzanoVivo();
  avisar("Valores iniciales cargados. Presioná Resolver.");
});

// ======================================================================
//  Formulario y teclado matemático
// ======================================================================

form.addEventListener("submit", (e) => {
  e.preventDefault();
  resolver();
});

campo("funcion").addEventListener("input", demorar(analizarFuncion, 220));
["x0", "x1"].forEach((id) => campo(id).addEventListener("input", () => {
  if (estado.datos) invalidarResultado();
  actualizarBolzanoVivo();
}));
["tolerancia", "max_iteraciones"].forEach((id) => campo(id).addEventListener("input", () => {
  const c = $(`.campo[data-campo="${id}"]`);
  c.classList.remove("con-error");
  $(".error-campo", c).textContent = "";
}));

function actualizarAyudaCriterio() {
  $("#ayuda-criterio").textContent = AYUDA_CRITERIO[$("input[name=criterio]:checked").value];
}
$$("input[name=criterio]").forEach((r) => r.addEventListener("change", actualizarAyudaCriterio));

$("#decimales").addEventListener("input", (e) => {
  estado.decimales = parseInt(e.target.value, 10);
  $("#decimales-valor").textContent = estado.decimales;
  if (estado.datos) {
    renderResultado(estado.datos);
    renderComparacion(estado.datos);
    pasos.decimales = estado.decimales;
    pasos._renderExplicacion();
    pasos._actualizarSubpasos();
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

// Ejemplos
$("#lista-ejemplos").innerHTML = EJEMPLOS.map((ej, k) => `
  <li><button type="button" data-ejemplo="${k}">
    <span class="ejemplo-fx">${escapar(ej.funcion)}</span>
    <span class="ejemplo-nota">${escapar(ej.nota)}</span>
  </button></li>`).join("");

$("#lista-ejemplos").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-ejemplo]");
  if (!b) return;
  const ej = EJEMPLOS[+b.dataset.ejemplo];
  invalidarResultado();
  cargarEnFormulario({ ...ej, tolerancia: "0.0001", max_iteraciones: "50", criterio: "absoluto" });
  await resolver();
  if (window.innerWidth < 900) $(".area").scrollIntoView({ behavior: "smooth" });
});

// Atajos del paso a paso
document.addEventListener("keydown", (e) => {
  if (pestanaActiva() !== "pasos" || !estado.datos) return;
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if (e.key === " ") { e.preventDefault(); pasos.alternar(); }
  else if (e.key === "ArrowRight" && !e.target.closest("[role=tablist]")) { e.preventDefault(); pasos.avanzar(); }
  else if (e.key === "ArrowLeft" && !e.target.closest("[role=tablist]")) { e.preventDefault(); pasos.retroceder(); }
});

// Fila de la tabla -> animación de esa iteración
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
  lienzoPrincipal.dibujar();
  lienzoPasos.dibujar();
  redibujarTodos();
  if (estado.datos) renderComparacion(estado.datos);
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  lienzoPrincipal.dibujar();
  lienzoPasos.dibujar();
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

actualizarAyudaCriterio();
cargarHistorial();
cargarEnFormulario({ funcion: "x^3 - 4x - 1", x0: "1", x1: "2" });
document.fonts?.ready.then(() => { lienzoPrincipal.dibujar(); redibujarTodos(); });
