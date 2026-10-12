"""
comparacion.py — Otros métodos de búsqueda de raíces para COMPARAR con la secante.

  * Bisección          (cerrado: necesita cambio de signo, converge siempre, lento)
  * Falsa posición     (cerrado: secante que mantiene la raíz encerrada)
  * Newton-Raphson     (abierto: usa la derivada, convergencia cuadrática)
  * Secante            (abierto: aproxima la derivada, orden φ ≈ 1.618)

Todos usan la misma tolerancia y el mismo criterio de parada para que la
comparación sea justa. Cada método devuelve la misma estructura de datos.
"""

from nucleo import matematica as m
from nucleo import secante as sec


def _resultado(metodo, descripcion):
    return {
        "metodo": metodo,
        "descripcion": descripcion,
        "aplicable": True,
        "estado": None,
        "exitoso": False,
        "mensaje": "",
        "raiz": None,
        "f_raiz": None,
        "iteraciones": [],
    }


def _fila(n, x, fx, x_previo):
    absoluto, relativo = sec.calcular_errores(x, x_previo) if x_previo is not None else (None, None)
    return {"n": n, "x": x, "fx": fx, "error_absoluto": absoluto, "error_relativo": relativo}


def _cerrar(resultado, estado, mensaje):
    resultado["estado"] = estado
    resultado["exitoso"] = estado in sec.ESTADOS_EXITOSOS
    resultado["mensaje"] = mensaje
    return resultado


# --------------------------------------------------------------------------
#  Bisección
# --------------------------------------------------------------------------

def biseccion(f, a, b, tolerancia, max_iteraciones, criterio):
    """
    Parte el intervalo a la mitad: c = (a + b)/2, y se queda con la mitad
    donde f cambia de signo. El error se reduce a la mitad en cada paso.
    """
    r = _resultado("Bisección", "c = (a + b) / 2")
    if a > b:
        a, b = b, a
    try:
        fa, fb = f(a), f(b)
    except m.ErrorMatematico as error:
        r["aplicable"] = False
        return _cerrar(r, sec.FUERA_DOMINIO, "No aplicable: %s" % error)

    if fa * fb > 0:
        r["aplicable"] = False
        return _cerrar(r, "no_aplicable",
                       "No aplicable: f(x₀) y f(x₁) tienen el mismo signo, la bisección necesita "
                       "un intervalo con cambio de signo.")

    c_previo = None
    for n in range(1, max_iteraciones + 1):
        c = (a + b) / 2
        try:
            fc = f(c)
        except m.ErrorMatematico as error:
            return _cerrar(r, sec.FUERA_DOMINIO, "f no está definida en c = %g: %s" % (c, error))
        fila = _fila(n, c, fc, c_previo)
        r["iteraciones"].append(fila)
        r["raiz"], r["f_raiz"] = c, fc

        if fc == 0:
            return _cerrar(r, sec.RAIZ_EXACTA, "Raíz exacta en la iteración %d." % n)
        if c_previo is not None and sec.cumple_criterio(criterio, tolerancia, fila["error_absoluto"],
                                                        fila["error_relativo"], fc):
            return _cerrar(r, sec.CONVERGIO, "Convergió en %d iteraciones." % n)

        if fa * fc < 0:
            b, fb = c, fc
        else:
            a, fa = c, fc
        c_previo = c

    return _cerrar(r, sec.MAX_ITERACIONES, "Alcanzó el máximo de iteraciones.")


# --------------------------------------------------------------------------
#  Falsa posición (Regula Falsi)
# --------------------------------------------------------------------------

def falsa_posicion(f, a, b, tolerancia, max_iteraciones, criterio):
    """
    Usa la MISMA fórmula que la secante, pero en lugar de descartar siempre
    el punto más viejo, conserva el extremo que mantiene el cambio de signo.
    Así la raíz queda siempre encerrada.
    """
    r = _resultado("Falsa posición", "c = b − f(b)·(b − a) / (f(b) − f(a))")
    if a > b:
        a, b = b, a
    try:
        fa, fb = f(a), f(b)
    except m.ErrorMatematico as error:
        r["aplicable"] = False
        return _cerrar(r, sec.FUERA_DOMINIO, "No aplicable: %s" % error)

    if fa * fb > 0:
        r["aplicable"] = False
        return _cerrar(r, "no_aplicable",
                       "No aplicable: f(x₀) y f(x₁) tienen el mismo signo, la falsa posición "
                       "necesita un intervalo con cambio de signo.")

    c_previo = None
    for n in range(1, max_iteraciones + 1):
        if fb == fa:
            return _cerrar(r, sec.DIVISION_CERO, "División por cero: f(a) = f(b).")
        c = b - fb * (b - a) / (fb - fa)
        try:
            fc = f(c)
        except m.ErrorMatematico as error:
            return _cerrar(r, sec.FUERA_DOMINIO, "f no está definida en c = %g: %s" % (c, error))
        fila = _fila(n, c, fc, c_previo)
        r["iteraciones"].append(fila)
        r["raiz"], r["f_raiz"] = c, fc

        if fc == 0:
            return _cerrar(r, sec.RAIZ_EXACTA, "Raíz exacta en la iteración %d." % n)
        if c_previo is not None and sec.cumple_criterio(criterio, tolerancia, fila["error_absoluto"],
                                                        fila["error_relativo"], fc):
            return _cerrar(r, sec.CONVERGIO, "Convergió en %d iteraciones." % n)

        if fa * fc < 0:
            b, fb = c, fc
        else:
            a, fa = c, fc
        c_previo = c

    return _cerrar(r, sec.MAX_ITERACIONES, "Alcanzó el máximo de iteraciones.")


# --------------------------------------------------------------------------
#  Newton-Raphson
# --------------------------------------------------------------------------

def newton_raphson(f, x_inicial, tolerancia, max_iteraciones, criterio):
    """
    xₙ₊₁ = xₙ − f(xₙ) / f'(xₙ)
    La derivada se obtiene SIMBÓLICAMENTE con nuestro derivador (expresiones.py).
    """
    derivada = f.derivada()
    r = _resultado("Newton-Raphson", "xₙ₊₁ = xₙ − f(xₙ) / f'(xₙ)")
    r["derivada"] = derivada.texto
    r["derivada_html"] = derivada.html

    x = x_inicial
    for n in range(1, max_iteraciones + 1):
        try:
            fx = f(x)
            dfx = derivada(x)
        except m.ErrorMatematico as error:
            return _cerrar(r, sec.FUERA_DOMINIO, "No se pudo evaluar en x = %g: %s" % (x, error))
        if dfx == 0:
            return _cerrar(r, sec.DIVISION_CERO, "f'(x) = 0 en x = %g: la tangente es horizontal." % x)

        x_nuevo = x - fx / dfx
        if not m.es_finito(x_nuevo) or m.valor_absoluto(x_nuevo) > sec.LIMITE_DIVERGENCIA:
            return _cerrar(r, sec.DIVERGENCIA, "Diverge en la iteración %d." % n)
        try:
            f_nuevo = f(x_nuevo)
        except m.ErrorMatematico as error:
            return _cerrar(r, sec.FUERA_DOMINIO, "La aproximación cae fuera del dominio: %s" % error)

        fila = _fila(n, x_nuevo, f_nuevo, x)
        r["iteraciones"].append(fila)
        r["raiz"], r["f_raiz"] = x_nuevo, f_nuevo

        if f_nuevo == 0:
            return _cerrar(r, sec.RAIZ_EXACTA, "Raíz exacta en la iteración %d." % n)
        if sec.cumple_criterio(criterio, tolerancia, fila["error_absoluto"], fila["error_relativo"], f_nuevo):
            return _cerrar(r, sec.CONVERGIO, "Convergió en %d iteraciones." % n)
        x = x_nuevo

    return _cerrar(r, sec.MAX_ITERACIONES, "Alcanzó el máximo de iteraciones.")


# --------------------------------------------------------------------------
#  Comparación
# --------------------------------------------------------------------------

def secante_como_fila(resultado):
    """Adapta el ResultadoSecante al mismo formato que los otros métodos."""
    r = _resultado("Secante", "xₙ₊₁ = xₙ − f(xₙ)·(xₙ − xₙ₋₁) / (f(xₙ) − f(xₙ₋₁))")
    for it in resultado.iteraciones:
        r["iteraciones"].append({"n": it.n, "x": it.x_siguiente, "fx": it.f_siguiente,
                                 "error_absoluto": it.error_absoluto, "error_relativo": it.error_relativo})
    r["raiz"], r["f_raiz"] = resultado.raiz, resultado.f_raiz
    return _cerrar(r, resultado.estado, resultado.mensaje)


def comparar_metodos(problema):
    """Ejecuta los cuatro métodos sobre el mismo problema y arma un resumen."""
    f = problema.funcion
    args = (problema.tolerancia, problema.max_iteraciones, problema.criterio)

    resultado_secante = sec.metodo_secante(f, problema.x0, problema.x1, *args)
    metodos = [
        secante_como_fila(resultado_secante),
        newton_raphson(f, problema.x1, *args),
        falsa_posicion(f, problema.x0, problema.x1, *args),
        biseccion(f, problema.x0, problema.x1, *args),
    ]

    exitosos = [r for r in metodos if r["exitoso"]]
    conclusiones = []
    if exitosos:
        mas_rapido = min(exitosos, key=lambda r: len(r["iteraciones"]))
        conclusiones.append("El método más rápido fue %s, con %d iteraciones." % (
            mas_rapido["metodo"], len(mas_rapido["iteraciones"])))
        secante = metodos[0]
        biseccion_r = metodos[3]
        if secante["exitoso"] and biseccion_r["exitoso"] and len(secante["iteraciones"]) > 0:
            factor = len(biseccion_r["iteraciones"]) / len(secante["iteraciones"])
            conclusiones.append("La secante necesitó %.1f veces menos iteraciones que la bisección." % factor)
        newton = metodos[1]
        if secante["exitoso"] and newton["exitoso"]:
            conclusiones.append(
                "Newton-Raphson evalúa f y f' en cada paso (2 evaluaciones); la secante solo evalúa f "
                "una vez por iteración. Por eso, aunque Newton haga menos iteraciones, la secante "
                "suele ser competitiva en costo total, y no requiere conocer la derivada.")
        raices = [r["raiz"] for r in exitosos]
        if max(raices) - min(raices) > 1e-4 * (1 + m.valor_absoluto(raices[0])):
            conclusiones.append("¡Atención! No todos los métodos llegaron a la misma raíz: "
                                "la función tiene más de una raíz y cada método encontró una distinta.")
    else:
        conclusiones.append("Ningún método convergió con estos datos.")

    return {"metodos": metodos, "conclusiones": conclusiones}
