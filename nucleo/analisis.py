"""
analisis.py — Herramientas de análisis alrededor del método.

  * verificar_intervalo   Teorema de Bolzano: ¿hay una raíz garantizada entre x₀ y x₁?
  * buscar_intervalos     Recorre un rango y encuentra dónde f cambia de signo
                          (sugiere buenos valores iniciales).
  * orden_convergencia    Estima experimentalmente el orden de convergencia p.
                          Para la secante la teoría dice p = φ = (1+√5)/2 ≈ 1.618.
  * analizar_resultado    Genera conclusiones automáticas en lenguaje natural.
  * muestrear             Puntos (x, f(x)) para graficar.
"""

from nucleo import matematica as m
from nucleo import secante as sec

PHI = (1 + m.raiz_cuadrada(5)) / 2       # número áureo ≈ 1.6180339887


def _num(x, cifras=8):
    return "%.*g" % (cifras, x)


# ==========================================================================
#  Teorema de Bolzano
# ==========================================================================

def verificar_intervalo(f, a, b, muestras=400):
    """
    Teorema de Bolzano: si f es continua en [a, b] y f(a)·f(b) < 0,
    entonces existe al menos una raíz en (a, b).

    El método de la secante NO exige esta condición (a diferencia de
    bisección), pero si se cumple sabemos que hay una raíz cerca de los
    valores iniciales. Además se muestrea el intervalo para detectar
    puntos donde f no está definida o tiene saltos (posibles asíntotas).
    """
    if a > b:
        a, b = b, a

    fa = f.evaluar_seguro(a)
    fb = f.evaluar_seguro(b)

    # Muestreo del intervalo para detectar discontinuidades y contar cambios de signo
    indefinidos = 0
    cambios = 0
    saltos = []
    anterior = None
    x_anterior = None
    for i in range(muestras + 1):
        x = a + (b - a) * i / muestras
        y = f.evaluar_seguro(x)
        if y is None:
            indefinidos += 1
            anterior = None
            continue
        if anterior is not None and anterior * y < 0:
            # Un cambio de signo puede ser una raíz o una asíntota (salto)
            if _es_asintota(f, x_anterior, x, anterior, y):
                saltos.append((x_anterior + x) / 2)
            else:
                cambios += 1
        anterior, x_anterior = y, x

    resultado = {
        "a": a, "b": b, "fa": fa, "fb": fb,
        "producto": None,
        "cumple": False,
        "indefinidos": indefinidos,
        "cambios_de_signo": cambios,
        "posibles_asintotas": saltos,
        "mensaje": "",
        "detalle": [],
    }

    if fa is None or fb is None:
        resultado["mensaje"] = "f(x) no está definida en uno de los extremos del intervalo."
        return resultado

    producto = fa * fb
    resultado["producto"] = producto

    if fa == 0 or fb == 0:
        resultado["cumple"] = True
        resultado["mensaje"] = "Uno de los valores iniciales ya es una raíz exacta."
    elif producto < 0 and (saltos or indefinidos) and cambios == 0:
        resultado["mensaje"] = (
            "f(x₀)·f(x₁) = %s < 0, pero f no es continua en el intervalo: el cambio de signo se "
            "debe a una discontinuidad, no a una raíz. Bolzano no se puede aplicar." % _num(producto, 5))
    elif producto < 0:
        resultado["cumple"] = True
        resultado["mensaje"] = (
            "f(x₀)·f(x₁) = %s < 0: hay cambio de signo, así que por el teorema de Bolzano "
            "existe al menos una raíz entre x₀ y x₁." % _num(producto, 5))
    else:
        resultado["mensaje"] = (
            "f(x₀)·f(x₁) = %s > 0: no hay cambio de signo entre x₀ y x₁. La raíz no está "
            "garantizada en ese intervalo, pero la secante igual puede encontrarla porque "
            "no necesita encerrar la raíz." % _num(producto, 5))

    if indefinidos:
        resultado["detalle"].append(
            "La función no está definida en algunos puntos del intervalo: no es continua en [x₀, x₁].")
    if saltos:
        resultado["detalle"].append(
            "Posible asíntota cerca de x ≈ %s: el cambio de signo ahí no corresponde a una raíz." %
            ", ".join(_num(s, 5) for s in saltos))
    if cambios > 1:
        resultado["detalle"].append(
            "Se detectaron %d cambios de signo dentro del intervalo: puede haber varias raíces." % cambios)

    return resultado


# ==========================================================================
#  Búsqueda de intervalos con cambio de signo
# ==========================================================================

def _es_asintota(f, a, b, fa, fb, pasos=50):
    """
    Distingue una raíz de un salto (por ejemplo 1/x en x = 0), ya que en
    ambos casos f cambia de signo. Se achica el intervalo con bisección:
    cerca de una raíz |f| tiende a 0, cerca de una asíntota |f| crece.
    """
    referencia = max(m.valor_absoluto(fa), m.valor_absoluto(fb))
    for _ in range(pasos):
        c = (a + b) / 2
        fc = f.evaluar_seguro(c)
        if fc is None:
            return True
        if fc == 0:
            return False
        if fa * fc < 0:
            b, fb = c, fc
        else:
            a, fa = c, fc
    return min(m.valor_absoluto(fa), m.valor_absoluto(fb)) > referencia


def buscar_intervalos(f, desde, hasta, subdivisiones=200):
    """
    Divide [desde, hasta] en subintervalos iguales y devuelve aquellos donde
    f cambia de signo (o se anula). Sirve para elegir x₀ y x₁.
    """
    paso = (hasta - desde) / subdivisiones
    encontrados = []
    x_anterior = desde
    y_anterior = f.evaluar_seguro(desde)

    for i in range(1, subdivisiones + 1):
        x = desde + i * paso
        y = f.evaluar_seguro(x)
        if y is not None and y_anterior is not None:
            if y_anterior == 0:
                encontrados.append({"a": x_anterior, "b": x_anterior, "exacta": True, "asintota": False})
            elif y_anterior * y < 0:
                asintota = _es_asintota(f, x_anterior, x, y_anterior, y)
                encontrados.append({"a": x_anterior, "b": x, "exacta": False, "asintota": asintota})
        x_anterior, y_anterior = x, y

    if y_anterior == 0:
        encontrados.append({"a": hasta, "b": hasta, "exacta": True, "asintota": False})
    return encontrados


# ==========================================================================
#  Orden de convergencia
# ==========================================================================

def orden_convergencia(iteraciones):
    """
    Si eₙ es el error en el paso n, un método de orden p cumple
        eₙ₊₁ ≈ C · eₙᵖ
    Tomando logaritmos en tres pasos consecutivos y despejando:

             ln(eₙ₊₁ / eₙ)
        p ≈ ───────────────
             ln(eₙ / eₙ₋₁)

    Como no conocemos la raíz exacta, usamos el error aproximado
    eₙ = |xₙ₊₁ − xₙ|.  Devuelve la lista de estimaciones (None si no se puede).
    """
    errores = [it.error_absoluto for it in iteraciones]
    estimaciones = []
    for i in range(2, len(errores)):
        e0, e1, e2 = errores[i - 2], errores[i - 1], errores[i]
        # Si el error ya es del tamaño del redondeo de la máquina, la estimación no sirve
        ruido = 1e-13 * (1 + m.valor_absoluto(iteraciones[i].x_siguiente))
        p = None
        if e0 > 0 and e1 > ruido and e2 > ruido and e1 != e0:
            denominador = m.ln(e1 / e0)
            if denominador != 0:
                p = m.ln(e2 / e1) / denominador
        estimaciones.append({"n": iteraciones[i].n, "p": p})
    return estimaciones


def orden_representativo(estimaciones):
    """
    Promedio de las DOS últimas estimaciones válidas. La fórmula de p supone que
    ya estamos cerca de la raíz, así que las primeras iteraciones no sirven;
    las afectadas por el redondeo ya se descartaron en orden_convergencia().
    """
    validas = [e["p"] for e in estimaciones if e["p"] is not None and 0 < e["p"] < 4]
    if not validas:
        return None
    ultimas = validas[-2:]
    return sum(ultimas) / len(ultimas)


# ==========================================================================
#  Conclusiones automáticas
# ==========================================================================

def cifras_significativas(error_relativo_porcentual):
    """
    Criterio de Scarborough: si εₐ < 0.5·10^(2−n) %, el resultado es correcto
    en al menos n cifras significativas.  Despejando:  n = 2 − log₁₀(2·εₐ).
    """
    if error_relativo_porcentual is None:
        return None
    if error_relativo_porcentual == 0:
        return 15
    n = int(2 - m.log10(2 * error_relativo_porcentual))
    return max(0, min(n, 15))


def analizar_resultado(resultado, verificacion=None):
    """Devuelve un diccionario con indicadores y una lista de conclusiones en texto."""
    iteraciones = resultado.iteraciones
    estimaciones = orden_convergencia(iteraciones)
    orden = orden_representativo(estimaciones)
    conclusiones = []
    advertencias = []

    if resultado.exitoso and resultado.raiz is not None:
        conclusiones.append("La raíz aproximada es x ≈ %s, donde f(x) = %s." % (
            _num(resultado.raiz, 12), _num(resultado.f_raiz, 4)))

    if len(iteraciones) >= 2:
        decrecientes = all(iteraciones[i].error_absoluto <= iteraciones[i - 1].error_absoluto
                           for i in range(1, len(iteraciones)))
        if decrecientes:
            conclusiones.append("El error disminuyó en todas las iteraciones: convergencia monótona.")
        else:
            subidas = sum(1 for i in range(1, len(iteraciones))
                          if iteraciones[i].error_absoluto > iteraciones[i - 1].error_absoluto)
            conclusiones.append(
                "El error aumentó en %d iteración(es) antes de converger: en las primeras "
                "iteraciones el método todavía estaba lejos de la raíz." % subidas)

    if orden is not None:
        diferencia = m.valor_absoluto(orden - PHI)
        texto = "Orden de convergencia estimado: p ≈ %.3f" % orden
        if diferencia < 0.25:
            texto += " — muy cercano al valor teórico φ ≈ 1.618 (convergencia superlineal)."
        elif orden < 1.2:
            texto += (" — menor al teórico φ ≈ 1.618. Suele pasar con raíces múltiples "
                      "(donde f'(r) = 0), en las que la secante converge solo linealmente.")
        else:
            texto += " (el valor teórico es φ ≈ 1.618)."
        conclusiones.append(texto)

    cifras = cifras_significativas(resultado.error_relativo) if iteraciones else None
    if resultado.exitoso and cifras is not None:
        conclusiones.append("Según el criterio de Scarborough el resultado tiene al menos %d cifras "
                            "significativas correctas." % cifras)

    # Advertencias sobre la calidad de la raíz encontrada
    if resultado.exitoso and resultado.f_raiz is not None:
        if m.valor_absoluto(resultado.f_raiz) > 1e-3:
            advertencias.append(
                "Aunque las aproximaciones se estabilizaron, |f(x)| = %s no es cercano a cero. "
                "Podría tratarse de una discontinuidad o de una tolerancia demasiado grande." %
                _num(m.valor_absoluto(resultado.f_raiz), 4))

    if resultado.raiz is not None and verificacion and verificacion.get("cumple"):
        a, b = verificacion["a"], verificacion["b"]
        if resultado.exitoso and not (a <= resultado.raiz <= b):
            advertencias.append(
                "La raíz encontrada está fuera del intervalo [x₀, x₁] aunque ahí había cambio de "
                "signo: la secante encontró otra raíz. Es una de sus limitaciones: no encierra la raíz.")

    if iteraciones:
        pendientes_chicas = [it.n for it in iteraciones
                             if m.valor_absoluto(it.pendiente) < 1e-8 * (1 + m.valor_absoluto(it.f_actual))]
        if pendientes_chicas:
            advertencias.append("En la iteración %d la secante fue casi horizontal: la siguiente "
                                "aproximación saltó lejos." % pendientes_chicas[0])

    return {
        "orden_estimado": orden,
        "orden_teorico": PHI,
        "estimaciones_orden": estimaciones,
        "cifras_significativas": cifras,
        "conclusiones": conclusiones,
        "advertencias": advertencias,
    }


# ==========================================================================
#  Muestreo para graficar
# ==========================================================================

def muestrear(f, desde, hasta, puntos=600):
    """Devuelve [[x, y], ...] con y = None donde f no está definida."""
    puntos = max(2, min(int(puntos), 4000))
    paso = (hasta - desde) / (puntos - 1)
    salida = []
    for i in range(puntos):
        x = desde + i * paso
        salida.append([x, f.evaluar_seguro(x)])
    return salida


def rango_sugerido(resultado):
    """Ventana de gráfico que contiene x₀, x₁, todas las aproximaciones y un margen."""
    xs = [resultado.x0, resultado.x1] + [it.x_siguiente for it in resultado.iteraciones]
    xs = [x for x in xs if x is not None and m.es_finito(x)]
    minimo, maximo = min(xs), max(xs)
    ancho = maximo - minimo
    if ancho == 0:
        ancho = max(1.0, m.valor_absoluto(minimo))
    margen = ancho * 0.35
    return minimo - margen, maximo + margen
