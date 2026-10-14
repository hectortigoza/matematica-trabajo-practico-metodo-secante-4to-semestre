// pasos.js — Paso a paso: la resolución de la tabla, celda por celda.
//
// Cada iteración se recorre en 6 pasos y cada paso carga una celda:
//   0. Cargar xₙ₋₁ y xₙ (en la primera fila, los valores iniciales x₀ y x₁)
//   1. Calcular f(xₙ₋₁)          fórmula → reemplazo → resultado
//   2. Calcular f(xₙ)            fórmula → reemplazo → resultado
//   3. Calcular xₙ₊₁ (secante)   fórmula → reemplazo → resultado
//   4. Calcular el error         fórmula → reemplazo → resultado
//   5. Comparar con el error pedido → seguir o detenerse
//
// En cada paso se PINTAN las celdas que se usan, y los mismos números aparecen
// con el mismo color en el reemplazo de la fórmula:
//   xₙ₋₁ azul · xₙ violeta · f(xₙ₋₁) naranja · f(xₙ) verde · xₙ₊₁ rojo · error magenta
//
// Todos los números vienen calculados desde Python; acá solo se muestran.

import { numHTML, numCompacto, escapar } from "./formato.js";

const DURACION_PASO = 3600;          // ms por paso a velocidad 1×

/** x con subíndice real: x(3) -> "x₃" en HTML con cursiva. */
const x = (k) => `<i>x</i><sub>${k}</sub>`;
const fx = (k) => `<i>f</i>(${x(k)})`;
const frac = (a, b) => `<span class="m-frac"><span class="m-num-frac">${a}</span><span class="m-den">${b}</span></span>`;

const COLUMNAS_TABLA = ["n", "xa", "xn", "fa", "fn", "xs"];
// Color de cada columna (las clases c-a … c-e están en estilos.css)
const COLOR_COLUMNA = { xa: "a", xn: "b", fa: "c", fn: "d", xs: "r", err: "e" };

/** Número resaltado con el color de la celda de donde se toma. */
const chip = (contenido, color) => `<span class="chip c-${color}">${contenido}</span>`;
/** Símbolo de la fórmula (xₙ, f(xₙ)…) con el color de su columna. */
const simbolo = (contenido, color) => `<span class="sim c-${color}">${contenido}</span>`;
const COLUMNAS_ERROR = ["n", "err", "cmp"];

export class PasoAPaso {
  constructor(el) {
    // el = { explicacion, tabla, tablaError, tituloError, posicion, lineaTiempo,
    //        reproducir, anterior, siguiente, inicio, fin, velocidad }
    this.el = el;
    this.datos = null;
    this.pasos = [];
    this.actual = 0;
    this.decimales = 8;
    this.velocidad = 1;
    this.reproduciendo = false;
    this._temporizador = null;

    el.reproducir.addEventListener("click", () => this.alternar());
    el.anterior.addEventListener("click", () => this.retroceder());
    el.siguiente.addEventListener("click", () => this.avanzar());
    el.inicio.addEventListener("click", () => { this.pausar(); this.irA(0); });
    el.fin.addEventListener("click", () => { this.pausar(); this.irA(this.pasos.length - 1); });
    el.velocidad.addEventListener("change", () => {
      this.velocidad = parseFloat(el.velocidad.value);
      if (this.reproduciendo) this._programar();
    });
  }

  // ------------------------------------------------------------ control ---

  cargar(datos, decimales) {
    this.pausar();
    this.datos = datos;
    this.decimales = decimales;
    this.pasos = this._armarPasos();
    this.el.tituloError.innerHTML = this._nombreError();
    this._crearLineaTiempo();
    this.irA(0);
  }

  actualizarDecimales(decimales) {
    this.decimales = decimales;
    if (this.datos) this.irA(this.actual, false);
  }

  irA(indice, animar = true) {
    if (!this.pasos.length) return;
    this.actual = Math.max(0, Math.min(indice, this.pasos.length - 1));
    this._render(animar);
  }

  irAIteracion(i) {
    this.pausar();
    const indice = this.pasos.findIndex((p) => p.iteracion === i);
    this.irA(indice < 0 ? 0 : indice);
  }

  avanzar() {
    this.pausar();
    this.irA(this.actual + 1);
  }

  retroceder() {
    this.pausar();
    this.irA(this.actual - 1);
  }

  alternar() { this.reproduciendo ? this.pausar() : this.reproducir(); }

  reproducir() {
    if (!this.pasos.length) return;
    if (this.actual >= this.pasos.length - 1) this.irA(0);
    this.reproduciendo = true;
    this.el.reproducir.classList.add("reproduciendo");
    this.el.reproducir.setAttribute("aria-label", "Pausar");
    this._programar();
  }

  pausar() {
    this.reproduciendo = false;
    clearTimeout(this._temporizador);
    this.el.reproducir.classList.remove("reproduciendo");
    this.el.reproducir.setAttribute("aria-label", "Reproducir");
  }

  _programar() {
    clearTimeout(this._temporizador);
    this._temporizador = setTimeout(() => {
      if (!this.reproduciendo) return;
      if (this.actual >= this.pasos.length - 1) { this.pausar(); return; }
      this.irA(this.actual + 1);
      this._programar();
    }, DURACION_PASO / this.velocidad);
  }

  // ------------------------------------------------------------ pasos ---

  /**
   * Arma la lista de pasos. Cada paso dice qué celdas carga ("llena")
   * y qué mostrar en el cuadro de explicación.
   */
  _armarPasos() {
    const r = this.datos.resultado;
    const pasos = [];
    r.iteraciones.forEach((it, i) => {
      const fila = i;
      const celda = (col) => `${fila}:${col}`;
      const anterior = (col) => `${fila - 1}:${col}`;
      // "usa": celdas que se toman para calcular (se pintan con su color)
      pasos.push({ iteracion: i, tipo: "cargar", it, llena: [celda("n"), celda("xa"), celda("xn"), `e${fila}:n`],
        usa: i === 0 ? {} : { [anterior("xn")]: "a", [anterior("xs")]: "b" } });
      pasos.push({ iteracion: i, tipo: "fa", it, llena: [celda("fa")], usa: { [celda("xa")]: "a" } });
      pasos.push({ iteracion: i, tipo: "fn", it, llena: [celda("fn")], usa: { [celda("xn")]: "b" } });
      pasos.push({ iteracion: i, tipo: "secante", it, llena: [celda("xs")],
        usa: { [celda("xa")]: "a", [celda("xn")]: "b", [celda("fa")]: "c", [celda("fn")]: "d" } });
      pasos.push({ iteracion: i, tipo: "error", it, llena: [`e${fila}:err`],
        usa: r.criterio === "residuo" ? { [celda("xs")]: "r" } : { [celda("xs")]: "r", [celda("xn")]: "b" } });
      pasos.push({ iteracion: i, tipo: "comparar", it, llena: [`e${fila}:cmp`], usa: { [`e${fila}:err`]: "e" },
        ultima: i === r.iteraciones.length - 1 });
    });
    pasos.push({ iteracion: r.iteraciones.length, tipo: "final", llena: [], usa: {} });
    return pasos;
  }

  _nombreError() {
    const c = this.datos.resultado.criterio;
    if (c === "relativo") return "Error ε<sub>a</sub> %";
    if (c === "residuo") return "Error |<i>f</i>(<i>x</i><sub>n+1</sub>)|";
    return "Error E<sub>a</sub>";
  }

  /** Valor del error de una iteración según el criterio elegido. */
  _error(it) {
    const c = this.datos.resultado.criterio;
    if (c === "relativo") return it.error_relativo;
    if (c === "residuo") return Math.abs(it.f_siguiente);
    return it.error_absoluto;
  }

  /** f(x) con x reemplazada por el valor, pintado del color de su celda: (2)³ − 4(2) − 1 */
  _sustituir(valor, color) {
    const v = chip(`(${numCompacto(valor, this.decimales)})`, color);
    return this.datos.funcion.html.split('<i class="m-var">x</i>').join(v);
  }

  // ------------------------------------------------------------ render ---

  _render(animar) {
    const paso = this.pasos[this.actual];
    this._renderTablas(animar);
    this._renderExplicacion(paso, animar);
    this._renderPosicion(paso);
  }

  _renderPosicion(paso) {
    const total = this.datos.resultado.iteraciones.length;
    const indiceEnIteracion = this.pasos.filter((p, k) => p.iteracion === paso.iteracion && k <= this.actual).length;
    this.el.posicion.textContent = paso.tipo === "final"
      ? "Resultado final"
      : `Iteración ${paso.iteracion + 1} de ${total} · paso ${indiceEnIteracion} de 6`;
    const botones = this.el.lineaTiempo.children;
    for (let k = 0; k < botones.length; k++) {
      botones[k].classList.toggle("hecho", k < paso.iteracion);
      botones[k].classList.toggle("actual", k === paso.iteracion);
    }
  }

  _crearLineaTiempo() {
    const cont = this.el.lineaTiempo;
    cont.innerHTML = "";
    this.datos.resultado.iteraciones.forEach((it, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = it.n;
      b.title = `Ir a la iteración ${it.n}`;
      b.addEventListener("click", () => this.irAIteracion(i));
      cont.appendChild(b);
    });
  }

  /** Dibuja las dos tablas con las celdas cargadas hasta el paso actual. */
  _renderTablas(animar) {
    const d = this.decimales;
    const r = this.datos.resultado;
    const llenas = new Set();
    for (let k = 0; k <= this.actual; k++) this.pasos[k].llena.forEach((c) => llenas.add(c));
    const paso = this.pasos[this.actual];
    const nuevas = new Set(paso.llena);
    const usadas = paso.usa;
    const claseCelda = (clave, col) => {
      const clases = [];
      if (usadas[clave]) clases.push("usa", `c-${usadas[clave]}`);
      else if (nuevas.has(clave) && COLOR_COLUMNA[col]) clases.push("carga", `c-${COLOR_COLUMNA[col]}`, animar ? "animar" : "");
      else if (nuevas.has(clave) && col === "cmp") clases.push("carga", "c-cmp", animar ? "animar" : "");
      return clases.join(" ");
    };
    const unidad = r.criterio === "relativo" ? " %" : "";

    const filasTabla = [];
    const filasError = [];
    r.iteraciones.forEach((it, i) => {
      if (!llenas.has(`${i}:n`)) return;
      const valores = {
        n: it.n,
        xa: numHTML(it.x_anterior, d), xn: numHTML(it.x_actual, d),
        fa: numHTML(it.f_anterior, d), fn: numHTML(it.f_actual, d),
        xs: numHTML(it.x_siguiente, d),
      };
      const celdas = COLUMNAS_TABLA.map((col) => {
        const clave = `${i}:${col}`;
        return `<td class="${claseCelda(clave, col)}">${llenas.has(clave) ? valores[col] : ""}</td>`;
      });
      const enCurso = paso.iteracion === i ? "en-curso" : "";
      filasTabla.push(`<tr class="${enCurso}">${celdas.join("")}</tr>`);

      const error = this._error(it);
      const cumple = i === r.iteraciones.length - 1 && r.exitoso;
      const valoresError = {
        n: it.n,
        err: error === null ? "—" : numHTML(error, d) + unidad,
        cmp: cumple ? `&lt; ${r.tolerancia}${unidad} <b>→ para</b>` : `≥ ${r.tolerancia}${unidad} → sigue`,
      };
      const celdasError = COLUMNAS_ERROR.map((col) => {
        const clave = `e${i}:${col}`;
        const clase = [col === "cmp" ? "comparacion" : "", col === "cmp" && cumple ? "cumple" : "",
          claseCelda(clave, col)].join(" ");
        return `<td class="${clase}">${llenas.has(clave) ? valoresError[col] : ""}</td>`;
      });
      filasError.push(`<tr class="${enCurso} ${cumple && llenas.has(`e${i}:cmp`) ? "final" : ""}">${celdasError.join("")}</tr>`);
    });

    const vacia = (cols) => `<tr><td colspan="${cols}" class="tenue" style="text-align:center">—</td></tr>`;
    this.el.tabla.querySelector("tbody").innerHTML = filasTabla.join("") || vacia(6);
    this.el.tablaError.querySelector("tbody").innerHTML = filasError.join("") || vacia(3);
  }

  /** Cuadro superior: fórmula, reemplazo y resultado del paso actual, con colores. */
  _renderExplicacion(paso, animar) {
    const d = this.decimales;
    const r = this.datos.resultado;
    const v = (valor) => numHTML(valor, d);
    const c = (valor) => numCompacto(valor, d);
    const p = (valor) => (valor < 0 ? `(${c(valor)})` : c(valor));
    const bloque = (etiqueta, contenido, clase = "") =>
      `<div class="paso-bloque ${clase}"><span class="paso-etiqueta">${etiqueta}</span><div class="formula-paso">${contenido}</div></div>`;
    let titulo = "";
    let cuerpo = "";
    let nota = "";

    if (paso.tipo === "final") {
      titulo = r.exitoso ? "Resultado" : "El método se detuvo";
      cuerpo = r.exitoso
        ? bloque("Raíz", `<span class="resultado-paso">${x("")} ≈ ${v(r.raiz)}</span>`, "resultado")
        : `<p>${escapar(r.mensaje)}</p>`;
      nota = r.exitoso ? escapar(r.mensaje) : "";
    } else {
      const it = paso.it;
      const n = it.n;
      const ia = n - 1, in_ = n, is = n + 1;
      // Símbolos con el color de su columna
      const XA = simbolo(x(ia), "a"), XN = simbolo(x(in_), "b"), XS = simbolo(x(is), "r");
      const FA = simbolo(fx(ia), "c"), FN = simbolo(fx(in_), "d");

      if (paso.tipo === "cargar") {
        titulo = n === 1 ? "Cargar los valores iniciales" : "Correr los valores a la nueva fila";
        cuerpo = n === 1
          ? bloque("Datos", `${XA} = ${chip(c(it.x_anterior), "a")} <span class="igual">y</span> ${XN} = ${chip(c(it.x_actual), "b")}`)
          : bloque("Se toma", `el ${simbolo("x<sub>n</sub>", "a")} de la fila ${n - 1} → pasa a ser ${XA} = ${chip(c(it.x_anterior), "a")}`) +
            bloque("Se toma", `el ${simbolo("x<sub>n+1</sub>", "b")} de la fila ${n - 1} → pasa a ser ${XN} = ${chip(c(it.x_actual), "b")}`);
        nota = n === 1
          ? "Se cargan en las columnas x<sub>n−1</sub> y x<sub>n</sub> de la fila 1."
          : `Se descarta el valor más viejo y los dos últimos se cargan en la fila ${n}.`;
      } else if (paso.tipo === "fa" || paso.tipo === "fn") {
        const esA = paso.tipo === "fa";
        const color = esA ? "a" : "b";
        const colorRes = esA ? "c" : "d";
        const k = esA ? ia : in_;
        const valor = esA ? it.x_anterior : it.x_actual;
        const resultado = esA ? it.f_anterior : it.f_actual;
        titulo = `Calcular ${fx(k)}`;
        cuerpo = bloque("Fórmula", `<i>f</i>(<i>x</i>) = ${this.datos.funcion.html}`) +
          bloque("Reemplazo", `${simbolo(fx(k), colorRes)} = ${this._sustituir(valor, color)}`) +
          bloque("Resultado", `${simbolo(fx(k), colorRes)} = ${chip(v(resultado), colorRes)}`, "resultado");
        nota = `Se toma ${simbolo(x(k), color)} de la tabla y el resultado se carga en la columna f(x<sub>${esA ? "n−1" : "n"}</sub>).`;
      } else if (paso.tipo === "secante") {
        titulo = `Calcular ${x(is)} con la fórmula de la secante`;
        cuerpo = bloque("Fórmula", `${XS} = ${XN} − ${frac(`${FN} · (${XN} − ${XA})`, `${FN} − ${FA}`)}`) +
          bloque("Reemplazo", `${XS} = ${chip(c(it.x_actual), "b")} − ${frac(
            `${chip(p(it.f_actual), "d")} · (${chip(c(it.x_actual), "b")} − ${chip(p(it.x_anterior), "a")})`,
            `${chip(p(it.f_actual), "d")} − ${chip(p(it.f_anterior), "c")}`)}`) +
          bloque("Resultado", `${XS} = ${chip(v(it.x_siguiente), "r")}`, "resultado");
        nota = "Se toman los cuatro valores pintados de la fila y el resultado se carga en la columna x<sub>n+1</sub>.";
      } else if (paso.tipo === "error") {
        const crit = r.criterio;
        const E = simbolo(crit === "relativo" ? "ε<sub>a</sub>" : crit === "residuo" ? "E" : "E<sub>a</sub>", "e");
        titulo = "Calcular el error";
        if (crit === "relativo") {
          cuerpo = bloque("Fórmula", `${E} = ${frac(`|${XS} − ${XN}|`, `|${XS}|`)} · 100`) +
            bloque("Reemplazo", `${E} = ${frac(`|${chip(c(it.x_siguiente), "r")} − ${chip(p(it.x_actual), "b")}|`, `|${chip(c(it.x_siguiente), "r")}|`)} · 100`) +
            bloque("Resultado", `${E} = ${chip((it.error_relativo === null ? "—" : v(it.error_relativo)) + " %", "e")}`, "resultado");
        } else if (crit === "residuo") {
          cuerpo = bloque("Fórmula", `${E} = |<i>f</i>(${XS})|`) +
            bloque("Reemplazo", `${E} = |${this._sustituir(it.x_siguiente, "r")}|`) +
            bloque("Resultado", `${E} = |${v(it.f_siguiente)}| = ${chip(v(Math.abs(it.f_siguiente)), "e")}`, "resultado");
        } else {
          cuerpo = bloque("Fórmula", `${E} = |${XS} − ${XN}|`) +
            bloque("Reemplazo", `${E} = |${chip(c(it.x_siguiente), "r")} − ${chip(p(it.x_actual), "b")}|`) +
            bloque("Resultado", `${E} = ${chip(v(it.error_absoluto), "e")}`, "resultado");
        }
        nota = "Se carga en el cuadro de la comparativa del error.";
      } else if (paso.tipo === "comparar") {
        const unidad = r.criterio === "relativo" ? " %" : "";
        const error = this._error(it);
        const nombre = simbolo(r.criterio === "relativo" ? "ε<sub>a</sub>" : r.criterio === "residuo" ? "E" : "E<sub>a</sub>", "e");
        const cumple = paso.ultima && r.exitoso;
        titulo = "Comparar con el error pedido";
        cuerpo = bloque("Condición", `${nombre} &lt; error pedido`) +
          bloque("Reemplazo", `${chip(v(error) + unidad, "e")} &lt; ${r.tolerancia}${unidad}`);
        if (cumple && r.estado === "raiz_exacta") {
          cuerpo += bloque("Resultado", `<span class="resultado-paso">${fx(is)} = 0: raíz exacta → se detiene</span>`, "resultado cumple");
        } else if (cumple) {
          cuerpo += bloque("Resultado", `<span class="resultado-paso">Sí se cumple → se detiene. Raíz ≈ ${v(it.x_siguiente)}</span>`, "resultado cumple");
        } else if (paso.ultima) {
          cuerpo += bloque("Resultado", `<span class="resultado-paso">No se cumple</span>`, "resultado");
          nota = escapar(r.mensaje);
        } else {
          cuerpo += bloque("Resultado", `<span class="resultado-paso">No se cumple → se pasa a la iteración ${n + 1}</span>`, "resultado");
        }
        if (!nota) nota = "El resultado de la comparación se carga en la última columna.";
      }
    }

    const exp = this.el.explicacion;
    exp.classList.toggle("animar", animar);
    exp.innerHTML = `
      <div class="explicacion-cabecera"><h2>${titulo}</h2></div>
      <div class="paso-bloques">${cuerpo}</div>
      ${nota ? `<p class="paso-nota">${nota}</p>` : ""}`;
  }
}
