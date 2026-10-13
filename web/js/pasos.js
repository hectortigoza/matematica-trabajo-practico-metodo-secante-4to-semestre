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
// Todos los números vienen calculados desde Python; acá solo se muestran.

import { numHTML, numCompacto, escapar } from "./formato.js";

const DURACION_PASO = 3600;          // ms por paso a velocidad 1×
const SUB = { "-": "₋", "+": "₊", 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };

/** x con subíndice real: x(3) -> "x₃" en HTML con cursiva. */
const x = (k) => `<i>x</i><sub>${k}</sub>`;
const fx = (k) => `<i>f</i>(${x(k)})`;
const frac = (a, b) => `<span class="m-frac"><span class="m-num-frac">${a}</span><span class="m-den">${b}</span></span>`;
const subTexto = (k) => String(k).split("").map((c) => SUB[c] ?? c).join("");

const COLUMNAS_TABLA = ["n", "xa", "xn", "fa", "fn", "xs"];
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
      pasos.push({ iteracion: i, tipo: "cargar", it, llena: [celda("n"), celda("xa"), celda("xn"), `e${fila}:n`] });
      pasos.push({ iteracion: i, tipo: "fa", it, llena: [celda("fa")] });
      pasos.push({ iteracion: i, tipo: "fn", it, llena: [celda("fn")] });
      pasos.push({ iteracion: i, tipo: "secante", it, llena: [celda("xs")] });
      pasos.push({ iteracion: i, tipo: "error", it, llena: [`e${fila}:err`] });
      pasos.push({ iteracion: i, tipo: "comparar", it, llena: [`e${fila}:cmp`], ultima: i === r.iteraciones.length - 1 });
    });
    pasos.push({ iteracion: r.iteraciones.length, tipo: "final", llena: [] });
    return pasos;
  }

  _nombreError() {
    const c = this.datos.resultado.criterio;
    if (c === "relativo") return "Error relativo ε<sub>a</sub> %";
    if (c === "residuo") return "Error |<i>f</i>(<i>x</i><sub>n+1</sub>)|";
    return "Error E<sub>a</sub> = |<i>x</i><sub>n+1</sub> − <i>x</i><sub>n</sub>|";
  }

  /** Valor del error de una iteración según el criterio elegido. */
  _error(it) {
    const c = this.datos.resultado.criterio;
    if (c === "relativo") return it.error_relativo;
    if (c === "residuo") return Math.abs(it.f_siguiente);
    return it.error_absoluto;
  }

  /** f(x) con x reemplazada por el valor: (2)³ − 4(2) − 1 */
  _sustituir(valor) {
    const v = `<span class="valor-a">(${numCompacto(valor, this.decimales)})</span>`;
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
    const nuevas = new Set(animar ? this.pasos[this.actual].llena : []);
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
        const clase = [col === "xs" ? "col-nueva" : "", nuevas.has(clave) ? "recien" : ""].join(" ");
        return `<td class="${clase}">${llenas.has(clave) ? valores[col] : ""}</td>`;
      });
      const enCurso = this.pasos[this.actual].iteracion === i ? "en-curso" : "";
      filasTabla.push(`<tr class="${enCurso}">${celdas.join("")}</tr>`);

      const error = this._error(it);
      const cumple = i === r.iteraciones.length - 1 && r.exitoso;
      const valoresError = {
        n: it.n,
        err: error === null ? "—" : numHTML(error, d) + unidad,
        cmp: cumple ? `&lt; ${r.tolerancia}${unidad} <b>→ se detiene</b>` : `≥ ${r.tolerancia}${unidad} → sigue iterando`,
      };
      const celdasError = COLUMNAS_ERROR.map((col) => {
        const clave = `e${i}:${col}`;
        const clase = [col === "cmp" ? "comparacion" : "", col === "cmp" && cumple ? "cumple" : "",
          nuevas.has(clave) ? "recien" : ""].join(" ");
        return `<td class="${clase}">${llenas.has(clave) ? valoresError[col] : ""}</td>`;
      });
      filasError.push(`<tr class="${enCurso} ${cumple && llenas.has(`e${i}:cmp`) ? "final" : ""}">${celdasError.join("")}</tr>`);
    });

    const vacia = (cols) => `<tr><td colspan="${cols}" class="tenue" style="text-align:center">—</td></tr>`;
    this.el.tabla.querySelector("tbody").innerHTML = filasTabla.join("") || vacia(6);
    this.el.tablaError.querySelector("tbody").innerHTML = filasError.join("") || vacia(3);
  }

  /** Cuadro superior: fórmula, reemplazo y resultado del paso actual. */
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

      if (paso.tipo === "cargar") {
        titulo = n === 1 ? "Cargar los valores iniciales" : "Correr los valores para la nueva iteración";
        cuerpo = n === 1
          ? bloque("Datos", `${x(0)} = ${v(it.x_anterior)} <span class="igual">y</span> ${x(1)} = ${v(it.x_actual)}`)
          : bloque("Datos", `${x(ia)} = ${v(it.x_anterior)} <span class="igual">— era el x${subTexto(ia)} de la fila anterior</span>`) +
            bloque("", `${x(in_)} = ${v(it.x_actual)} <span class="igual">— es el x${subTexto(in_)} calculado en la fila anterior</span>`);
        nota = n === 1
          ? `Se cargan en las columnas <i>x</i><sub>n−1</sub> y <i>x</i><sub>n</sub> de la fila 1.`
          : `Se descarta el valor más viejo y los dos últimos se cargan en la fila ${n}.`;
      } else if (paso.tipo === "fa" || paso.tipo === "fn") {
        const esA = paso.tipo === "fa";
        const k = esA ? ia : in_;
        const valor = esA ? it.x_anterior : it.x_actual;
        const resultado = esA ? it.f_anterior : it.f_actual;
        titulo = `Calcular ${fx(k)}`;
        cuerpo = bloque("Fórmula", `<i>f</i>(<i>x</i>) = ${this.datos.funcion.html}`) +
          bloque("Reemplazo", `${fx(k)} = ${this._sustituir(valor)}`) +
          bloque("Resultado", `<span class="resultado-paso">${fx(k)} = ${v(resultado)}</span>`, "resultado");
        nota = `Se carga en la columna <i>f</i>(<i>x</i><sub>${esA ? "n−1" : "n"}</sub>) de la fila ${n}.`;
      } else if (paso.tipo === "secante") {
        titulo = `Calcular ${x(is)} con la fórmula de la secante`;
        cuerpo = bloque("Fórmula", `${x(is)} = ${x(in_)} − ${frac(`${fx(in_)} · (${x(in_)} − ${x(ia)})`, `${fx(in_)} − ${fx(ia)}`)}`) +
          bloque("Reemplazo", `${x(is)} = ${c(it.x_actual)} − ${frac(`${p(it.f_actual)} · (${c(it.x_actual)} − ${p(it.x_anterior)})`, `${p(it.f_actual)} − ${p(it.f_anterior)}`)}`) +
          bloque("Resultado", `<span class="resultado-paso">${x(is)} = ${v(it.x_siguiente)}</span>`, "resultado");
        nota = `Se carga en la columna <i>x</i><sub>n+1</sub> de la fila ${n}.`;
      } else if (paso.tipo === "error") {
        const crit = r.criterio;
        titulo = "Calcular el error";
        if (crit === "relativo") {
          cuerpo = bloque("Fórmula", `ε<sub>a</sub> = ${frac(`|${x(is)} − ${x(in_)}|`, `|${x(is)}|`)} · 100`) +
            bloque("Reemplazo", `ε<sub>a</sub> = ${frac(`|${c(it.x_siguiente)} − ${p(it.x_actual)}|`, `|${c(it.x_siguiente)}|`)} · 100`) +
            bloque("Resultado", `<span class="resultado-paso">ε<sub>a</sub> = ${it.error_relativo === null ? "—" : v(it.error_relativo)} %</span>`, "resultado");
        } else if (crit === "residuo") {
          cuerpo = bloque("Fórmula", `E = |${fx(is)}|`) +
            bloque("Reemplazo", `E = |${this._sustituir(it.x_siguiente)}|`) +
            bloque("Resultado", `<span class="resultado-paso">E = |${v(it.f_siguiente)}| = ${v(Math.abs(it.f_siguiente))}</span>`, "resultado");
        } else {
          cuerpo = bloque("Fórmula", `E<sub>a</sub> = |${x(is)} − ${x(in_)}|`) +
            bloque("Reemplazo", `E<sub>a</sub> = |${c(it.x_siguiente)} − ${p(it.x_actual)}|`) +
            bloque("Resultado", `<span class="resultado-paso">E<sub>a</sub> = ${v(it.error_absoluto)}</span>`, "resultado");
        }
        nota = `Se carga en el cuadro de la comparativa del error, fila ${n}.`;
      } else if (paso.tipo === "comparar") {
        const unidad = r.criterio === "relativo" ? " %" : "";
        const error = this._error(it);
        const nombre = r.criterio === "relativo" ? "ε<sub>a</sub>" : r.criterio === "residuo" ? "E" : "E<sub>a</sub>";
        const cumple = paso.ultima && r.exitoso;
        titulo = "Comparar con el error pedido";
        cuerpo = bloque("Condición", `${nombre} &lt; error pedido`) +
          bloque("Reemplazo", `${v(error)}${unidad} &lt; ${r.tolerancia}${unidad}`);
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
        if (!nota) nota = `Se carga en la columna de comparación, fila ${n}.`;
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
