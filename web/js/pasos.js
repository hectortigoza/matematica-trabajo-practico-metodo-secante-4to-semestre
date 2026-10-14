// pasos.js — Paso a paso: la resolución de la tabla como la haría una persona.
//
// Primero se verifica el cambio de signo: f(a) y f(b), ¿positivo o negativo?
// Después, en cada iteración k (empieza en 0):
//   0. Cargar a y b
//   1. Calcular f(a)            fórmula → reemplazo → resultado
//   2. Calcular f(b)            fórmula → reemplazo → resultado
//   3. Calcular x(k+1)          fórmula → reemplazo → resultado
//   4. Test de parada f(x(k+1)) fórmula → reemplazo → resultado
//   5. Comparar |f(x(k+1))| con el error pedido → seguir o parar
//
// Las celdas que se usan se pintan:
//   a azul · b violeta · f(a) naranja · f(b) verde · x(k+1) rojo · f(x(k+1)) magenta
//
// Todos los números vienen de Python (metodos.py); acá solo se muestran.

import { numHTML, numCompacto, escapar } from "./formato.js";
import { funcionHTML } from "./funcion.js";

const DURACION_PASO = 3600;          // ms por paso a velocidad 1×

const xk1 = (k) => `<i>x</i><sub>${k + 1}</sub>`;          // x(k+1) con su número: x₁, x₂…
const frac = (a, b) => `<span class="m-frac"><span class="m-num-frac">${a}</span><span class="m-den">${b}</span></span>`;
const chip = (contenido, color) => `<span class="chip c-${color}">${contenido}</span>`;
const sim = (contenido, color) => `<span class="sim c-${color}">${contenido}</span>`;
const signo = (valor) => (valor > 0 ? "positivo" : valor < 0 ? "negativo" : "cero");

const COLUMNAS_TABLA = ["k", "a", "b", "fa", "fb", "x"];
const COLUMNAS_TEST = ["k", "fx", "cmp"];
const COLOR = { a: "a", b: "b", fa: "c", fb: "d", x: "r", fx: "e" };

export class PasoAPaso {
  constructor(el) {
    // el = { explicacion, tabla, tablaError, posicion, lineaTiempo,
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
    this.funcionHTML = funcionHTML(datos.funcion);
    this.pasos = this._armarPasos();
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

  avanzar() { this.pausar(); this.irA(this.actual + 1); }
  retroceder() { this.pausar(); this.irA(this.actual - 1); }
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

  /** Lista de pasos: qué celdas carga cada uno ("llena") y cuáles usa ("usa"). */
  _armarPasos() {
    const tabla = this.datos.tabla;
    const pasos = [{ iteracion: -1, tipo: "signo", llena: [], usa: {} }];
    tabla.forEach((fila, i) => {
      const celda = (col) => `${i}:${col}`;
      const anterior = (col) => `${i - 1}:${col}`;
      pasos.push({ iteracion: i, tipo: "cargar", fila, llena: [celda("k"), celda("a"), celda("b"), `t${i}:k`],
        usa: i === 0 ? {} : { [anterior("b")]: "a", [anterior("x")]: "b" } });
      pasos.push({ iteracion: i, tipo: "fa", fila, llena: [celda("fa")], usa: { [celda("a")]: "a" } });
      pasos.push({ iteracion: i, tipo: "fb", fila, llena: [celda("fb")], usa: { [celda("b")]: "b" } });
      pasos.push({ iteracion: i, tipo: "x", fila, llena: [celda("x")],
        usa: { [celda("a")]: "a", [celda("b")]: "b", [celda("fa")]: "c", [celda("fb")]: "d" } });
      pasos.push({ iteracion: i, tipo: "test", fila, llena: [`t${i}:fx`], usa: { [celda("x")]: "r" } });
      pasos.push({ iteracion: i, tipo: "comparar", fila, llena: [`t${i}:cmp`], usa: { [`t${i}:fx`]: "e" },
        ultima: i === tabla.length - 1 });
    });
    pasos.push({ iteracion: tabla.length, tipo: "final", llena: [], usa: {} });
    return pasos;
  }

  /** f(x) con x reemplazada por el valor, pintado del color de su celda. */
  _sustituir(valor, color) {
    return this.funcionHTML.split("<i>x</i>").join(chip(`(${numCompacto(valor, this.decimales)})`, color));
  }

  // ------------------------------------------------------------ render ---

  _render(animar) {
    const paso = this.pasos[this.actual];
    this._renderTablas(animar);
    this._renderExplicacion(paso, animar);
    this._renderPosicion(paso);
  }

  _renderPosicion(paso) {
    const total = this.datos.tabla.length;
    if (paso.tipo === "signo") this.el.posicion.textContent = "Antes de iterar";
    else if (paso.tipo === "final") this.el.posicion.textContent = "Resultado final";
    else {
      const enIteracion = this.pasos.filter((p, k) => p.iteracion === paso.iteracion && k <= this.actual).length;
      this.el.posicion.textContent = `k = ${paso.iteracion} (de 0 a ${total - 1}) · paso ${enIteracion} de 6`;
    }
    const botones = this.el.lineaTiempo.children;
    for (let i = 0; i < botones.length; i++) {
      botones[i].classList.toggle("hecho", i < paso.iteracion);
      botones[i].classList.toggle("actual", i === paso.iteracion);
    }
  }

  _crearLineaTiempo() {
    const cont = this.el.lineaTiempo;
    cont.innerHTML = "";
    this.datos.tabla.forEach((fila, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = `k=${fila.k}`;
      b.title = `Ir a la iteración k = ${fila.k}`;
      b.addEventListener("click", () => this.irAIteracion(i));
      cont.appendChild(b);
    });
  }

  /** Dibuja las dos tablas con las celdas cargadas hasta el paso actual. */
  _renderTablas(animar) {
    const d = this.decimales;
    const r = this.datos;
    const llenas = new Set();
    for (let i = 0; i <= this.actual; i++) this.pasos[i].llena.forEach((c) => llenas.add(c));
    const paso = this.pasos[this.actual];
    const nuevas = new Set(paso.llena);
    const claseCelda = (clave, col) => {
      if (paso.usa[clave]) return `usa c-${paso.usa[clave]}`;
      if (nuevas.has(clave) && COLOR[col]) return `carga c-${COLOR[col]} ${animar ? "animar" : ""}`;
      if (nuevas.has(clave) && col === "cmp") return `carga c-cmp ${animar ? "animar" : ""}`;
      return "";
    };

    const filasTabla = [];
    const filasTest = [];
    r.tabla.forEach((fila, i) => {
      if (!llenas.has(`${i}:k`)) return;
      const valores = {
        k: fila.k, a: numHTML(fila.a, d), b: numHTML(fila.b, d),
        fa: numHTML(fila.fa, d), fb: numHTML(fila.fb, d), x: numHTML(fila.x, d),
      };
      const enCurso = paso.iteracion === i ? "en-curso" : "";
      filasTabla.push(`<tr class="${enCurso}">${COLUMNAS_TABLA.map((col) =>
        `<td class="${claseCelda(`${i}:${col}`, col)}">${llenas.has(`${i}:${col}`) ? valores[col] : ""}</td>`).join("")}</tr>`);

      const valoresTest = {
        k: fila.k,
        fx: numHTML(fila.fx, d),
        cmp: fila.cumple ? `menor <b>→ es la raíz</b>` : `mayor → k = k + 1`,
      };
      const cumple = fila.cumple && llenas.has(`t${i}:cmp`) ? "final" : "";
      filasTest.push(`<tr class="${enCurso} ${cumple}">${COLUMNAS_TEST.map((col) => {
        const clave = `t${i}:${col}`;
        const extra = col === "cmp" ? `comparacion ${fila.cumple ? "cumple" : ""}` : "";
        return `<td class="${extra} ${claseCelda(clave, col)}">${llenas.has(clave) ? valoresTest[col] : ""}</td>`;
      }).join("")}</tr>`);
    });

    const vacia = (cols) => `<tr><td colspan="${cols}" class="tenue" style="text-align:center">—</td></tr>`;
    this.el.tabla.querySelector("tbody").innerHTML = filasTabla.join("") || vacia(6);
    this.el.tablaError.querySelector("tbody").innerHTML = filasTest.join("") || vacia(3);
  }

  /** Cuadro superior: fórmula, reemplazo y resultado del paso actual. */
  _renderExplicacion(paso, animar) {
    const d = this.decimales;
    const r = this.datos;
    const v = (valor) => numHTML(valor, d);
    const c = (valor) => numCompacto(valor, d);
    const p = (valor) => (valor < 0 ? `(${c(valor)})` : c(valor));
    const bloque = (etiqueta, contenido, clase = "") =>
      `<div class="paso-bloque ${clase}"><span class="paso-etiqueta">${etiqueta}</span><div class="formula-paso">${contenido}</div></div>`;
    const fx = `<i>f</i>(<i>x</i>) = ${this.funcionHTML}`;
    const A = sim("a", "a"), B = sim("b", "b"), FA = sim("f(a)", "c"), FB = sim("f(b)", "d");
    let titulo = "";
    let cuerpo = "";
    let nota = "";

    if (paso.tipo === "signo") {
      titulo = "¿Hay cambio de signo entre a y b?";
      cuerpo = bloque("a", `${A} = ${chip(c(r.a), "a")} &nbsp;→&nbsp; ${FA} = ${this._sustituir(r.a, "a")} = ${chip(v(r.fa), "c")} &nbsp;→&nbsp; <b>${signo(r.fa)}</b>`) +
        bloque("b", `${B} = ${chip(c(r.b), "b")} &nbsp;→&nbsp; ${FB} = ${this._sustituir(r.b, "b")} = ${chip(v(r.fb), "d")} &nbsp;→&nbsp; <b>${signo(r.fb)}</b>`) +
        bloque("Resultado", r.cambio_de_signo
          ? `<span class="resultado-paso">f(a) es ${signo(r.fa)} y f(b) es ${signo(r.fb)} → hay cambio de signo, se resuelve</span>`
          : `<span class="resultado-paso">f(a) y f(b) son los dos ${signo(r.fa)}s → no hay cambio de signo</span>`, `resultado ${r.cambio_de_signo ? "cumple" : ""}`);
      nota = `a = ${c(r.a)}, b = ${c(r.b)}, error pedido = ${r.error}.`;
    } else if (paso.tipo === "final") {
      titulo = r.encontrada ? "Resultado" : "El método se detuvo";
      cuerpo = r.encontrada
        ? bloque("Raíz", `<span class="resultado-paso">x ≈ ${v(r.raiz)}</span>`, "resultado cumple")
        : `<p>${escapar(r.mensaje)}</p>`;
      nota = r.encontrada ? escapar(r.mensaje) + (r.advertencia ? " " + escapar(r.advertencia) : "") : "";
    } else {
      const f = paso.fila;
      const k = f.k;
      const X = sim(xk1(k), "r");
      if (paso.tipo === "cargar") {
        titulo = k === 0 ? "k = 0: cargar los valores iniciales" : `k = ${k}: correr los valores`;
        cuerpo = k === 0
          ? bloque("Datos", `${A} = ${chip(c(f.a), "a")} &nbsp; y &nbsp; ${B} = ${chip(c(f.b), "b")}`)
          : bloque("a", `${A} toma el valor de b de la fila anterior → ${A} = ${chip(c(f.a), "a")}`) +
            bloque("b", `${B} toma el valor de x de la fila anterior → ${B} = ${chip(c(f.b), "b")}`);
        nota = k === 0 ? "Se cargan en las columnas a y b de la fila k = 0." : `Se cargan en la fila k = ${k}.`;
      } else if (paso.tipo === "fa" || paso.tipo === "fb") {
        const esA = paso.tipo === "fa";
        const valor = esA ? f.a : f.b;
        const res = esA ? f.fa : f.fb;
        titulo = `Calcular ${esA ? "f(a)" : "f(b)"}`;
        cuerpo = bloque("Fórmula", fx) +
          bloque("Reemplazo", `${esA ? FA : FB} = ${this._sustituir(valor, esA ? "a" : "b")}`) +
          bloque("Resultado", `${esA ? FA : FB} = ${chip(v(res), esA ? "c" : "d")}`, "resultado");
        nota = `Se reemplaza x por ${esA ? "a" : "b"} y el resultado se carga en la columna ${esA ? "f(a)" : "f(b)"}.`;
      } else if (paso.tipo === "x") {
        titulo = `Calcular ${xk1(k)} con la fórmula de la secante`;
        cuerpo = bloque("Fórmula", `${X} = ${frac(`${A} · ${FB} − ${B} · ${FA}`, `${FB} − ${FA}`)}`) +
          bloque("Reemplazo", `${X} = ${frac(
            `${chip(p(f.a), "a")} · ${chip(p(f.fb), "d")} − ${chip(p(f.b), "b")} · ${chip(p(f.fa), "c")}`,
            `${chip(p(f.fb), "d")} − ${chip(p(f.fa), "c")}`)}`) +
          bloque("Resultado", `${X} = ${chip(v(f.x), "r")}`, "resultado");
        nota = `Se usan las cuatro celdas pintadas y el resultado se carga en la columna x<sub>k+1</sub>.`;
      } else if (paso.tipo === "test") {
        titulo = "Test de parada: reemplazar x<sub>k+1</sub> en la función";
        cuerpo = bloque("Fórmula", fx) +
          bloque("Reemplazo", `<i>f</i>(${X}) = ${this._sustituir(f.x, "r")}`) +
          bloque("Resultado", `<i>f</i>(${X}) = ${chip(v(f.fx), "e")}`, "resultado");
        nota = "El resultado se carga en el cuadro del test de parada.";
      } else if (paso.tipo === "comparar") {
        titulo = "Comparar con el error pedido";
        cuerpo = bloque("Condición", `|<i>f</i>(${X})| &lt; error`) +
          bloque("Reemplazo", `${chip(c(Math.abs(f.fx)), "e")} &lt; ${r.error}`);
        if (f.cumple) {
          cuerpo += bloque("Resultado", `<span class="resultado-paso">|f(${xk1(k)})| es menor al error → ${xk1(k)} = ${v(f.x)} es la raíz</span>`, "resultado cumple");
        } else if (paso.ultima) {
          cuerpo += bloque("Resultado", `<span class="resultado-paso">|f(${xk1(k)})| es mayor al error</span>`, "resultado");
          nota = escapar(r.mensaje);
        } else {
          cuerpo += bloque("Resultado", `<span class="resultado-paso">|f(${xk1(k)})| es mayor al error → k = k + 1 = ${k + 1}</span>`, "resultado");
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
