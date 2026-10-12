"""
exportar.py — Exportación de resultados: CSV (Excel), TXT e informe HTML imprimible.

El informe HTML incluye un gráfico SVG dibujado acá mismo (sin bibliotecas de
gráficos): la función, las rectas secantes y las aproximaciones sucesivas.
"""

import time
from html import escape

from nucleo import matematica as m

ESTADOS = {
    "convergio": "Convergencia alcanzada",
    "raiz_exacta": "Raíz exacta encontrada",
    "max_iteraciones": "Máximo de iteraciones alcanzado",
    "division_cero": "Detenido: división por cero",
    "fuera_dominio": "Detenido: fuera del dominio",
    "divergencia": "Detenido: el método diverge",
    "no_aplicable": "No aplicable",
    "discontinuidad": "Converge a una discontinuidad",
}


def fmt(valor, decimales=8):
    if valor is None:
        return "—"
    if isinstance(valor, float) and not m.es_finito(valor):
        return "∞"
    if valor != 0 and (m.valor_absoluto(valor) < 10 ** -(decimales - 2) or m.valor_absoluto(valor) >= 1e9):
        return "%.*e" % (max(decimales - 4, 3), valor)
    return "%.*f" % (decimales, valor)


# ==========================================================================
#  CSV
# ==========================================================================

def a_csv(datos, decimales=10):
    """
    Separador ';' y coma decimal: así Excel en español lo abre directamente
    en columnas. Se antepone el BOM de UTF-8 para que respete los acentos.
    """
    resultado = datos["resultado"]

    def numero(v):
        return "" if v is None else fmt(v, decimales).replace(".", ",")

    lineas = [
        "Método de la Secante",
        "f(x);%s" % datos["funcion"]["texto"],
        "x0;%s" % numero(resultado["x0"]),
        "x1;%s" % numero(resultado["x1"]),
        "Tolerancia;%s" % numero(resultado["tolerancia"]),
        "Criterio;%s" % resultado["criterio_descripcion"],
        "Estado;%s" % ESTADOS.get(resultado["estado"], resultado["estado"]),
        "Raíz aproximada;%s" % numero(resultado["raiz"]),
        "",
        "n;x(n-1);x(n);f(x(n-1));f(x(n));x(n+1);f(x(n+1));Error absoluto;Error relativo (%)",
    ]
    for it in resultado["iteraciones"]:
        lineas.append(";".join([str(it["n"])] + [numero(it[c]) for c in (
            "x_anterior", "x_actual", "f_anterior", "f_actual", "x_siguiente", "f_siguiente",
            "error_absoluto", "error_relativo")]))
    return "﻿" + "\r\n".join(lineas) + "\r\n"


# ==========================================================================
#  TXT
# ==========================================================================

def a_txt(datos, decimales=8):
    resultado = datos["resultado"]
    ancho = decimales + 8
    columnas = ["n", "x(n-1)", "x(n)", "x(n+1)", "f(x(n+1))", "Error abs.", "Error rel.%"]
    lineas = [
        "=" * 78,
        " MÉTODO DE LA SECANTE — Resultado",
        "=" * 78,
        " f(x)        = %s" % datos["funcion"]["texto"],
        " x0, x1      = %s, %s" % (fmt(resultado["x0"], decimales), fmt(resultado["x1"], decimales)),
        " Tolerancia  = %s  (%s)" % (resultado["tolerancia"], resultado["criterio_descripcion"]),
        " Estado      = %s" % ESTADOS.get(resultado["estado"], resultado["estado"]),
        " Raíz        = %s" % fmt(resultado["raiz"], decimales + 4),
        " f(raíz)     = %s" % fmt(resultado["f_raiz"], decimales),
        " Iteraciones = %d" % resultado["cantidad_iteraciones"],
        "",
        " " + resultado["mensaje"],
        "",
        "".join(c.rjust(4 if c == "n" else ancho) for c in columnas),
        "-" * (4 + ancho * (len(columnas) - 1)),
    ]
    for it in resultado["iteraciones"]:
        valores = [it["x_anterior"], it["x_actual"], it["x_siguiente"], it["f_siguiente"],
                   it["error_absoluto"], it["error_relativo"]]
        lineas.append(str(it["n"]).rjust(4) + "".join(fmt(v, decimales).rjust(ancho) for v in valores))
    lineas.append("")
    for conclusion in datos["analisis"]["conclusiones"]:
        lineas.append(" • " + conclusion)
    return "\r\n".join(lineas) + "\r\n"


# ==========================================================================
#  Gráfico SVG propio
# ==========================================================================

def _percentil(valores, p):
    ordenados = sorted(valores)
    if not ordenados:
        return 0.0
    k = (len(ordenados) - 1) * p
    i = int(k)
    j = min(i + 1, len(ordenados) - 1)
    return ordenados[i] + (ordenados[j] - ordenados[i]) * (k - i)


def grafico_svg(datos, ancho=760, alto=400):
    """Dibuja f(x), las secantes de las primeras iteraciones y la raíz."""
    puntos = datos["curva"]
    iteraciones = datos["resultado"]["iteraciones"]
    x_min, x_max = datos["rango"]

    ys = [p[1] for p in puntos if p[1] is not None]
    if not ys:
        return ""
    # Se recortan los valores extremos (asíntotas) para que el gráfico se lea bien
    y_min, y_max = _percentil(ys, 0.03), _percentil(ys, 0.97)
    y_min, y_max = min(y_min, 0.0), max(y_max, 0.0)
    margen_y = (y_max - y_min) * 0.12 or 1.0
    y_min, y_max = y_min - margen_y, y_max + margen_y

    izq, der, arr, aba = 56, 16, 16, 34
    w, h = ancho - izq - der, alto - arr - aba

    def px(x):
        return izq + (x - x_min) / (x_max - x_min) * w

    def py(y):
        return arr + (y_max - y) / (y_max - y_min) * h

    partes = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" class="grafico">' % (ancho, alto),
              '<rect x="%d" y="%d" width="%d" height="%d" fill="#fbfdfb" stroke="#c9ddd3"/>' % (izq, arr, w, h)]

    # Cuadrícula y escala
    for i in range(11):
        gx = izq + w * i / 10
        gy = arr + h * i / 10
        partes.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="#e1ede7"/>' % (gx, arr, gx, arr + h))
        partes.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="#e1ede7"/>' % (izq, gy, izq + w, gy))
        if i % 2 == 0:
            vx = x_min + (x_max - x_min) * i / 10
            vy = y_max - (y_max - y_min) * i / 10
            partes.append('<text x="%.1f" y="%d" font-size="11" text-anchor="middle" fill="#55605a">%s</text>'
                          % (gx, arr + h + 16, "%.3g" % vx))
            partes.append('<text x="%d" y="%.1f" font-size="11" text-anchor="end" fill="#55605a">%s</text>'
                          % (izq - 6, gy + 4, "%.3g" % vy))

    # Ejes
    if y_min <= 0 <= y_max:
        partes.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="#2e3138" stroke-width="1.2"/>'
                      % (izq, py(0), izq + w, py(0)))
    if x_min <= 0 <= x_max:
        partes.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="#2e3138" stroke-width="1.2"/>'
                      % (px(0), arr, px(0), arr + h))

    partes.append('<clipPath id="area"><rect x="%d" y="%d" width="%d" height="%d"/></clipPath><g clip-path="url(#area)">'
                  % (izq, arr, w, h))

    # Curva: se corta en los puntos no definidos o en saltos enormes
    tramo = []
    alto_limite = (y_max - y_min) * 4
    anterior = None
    for x, y in puntos:
        if y is None or (anterior is not None and m.valor_absoluto(y - anterior) > alto_limite):
            if len(tramo) > 1:
                partes.append('<polyline fill="none" stroke="#1c3f6e" stroke-width="2" points="%s"/>' % " ".join(tramo))
            tramo = []
        if y is not None:
            tramo.append("%.1f,%.1f" % (px(x), py(max(min(y, y_max + alto_limite), y_min - alto_limite))))
        anterior = y
    if len(tramo) > 1:
        partes.append('<polyline fill="none" stroke="#1c3f6e" stroke-width="2" points="%s"/>' % " ".join(tramo))

    # Secantes de las primeras iteraciones
    for it in iteraciones[:6]:
        x_a, y_a = it["x_anterior"], it["f_anterior"]
        x_s = it["x_siguiente"]
        partes.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#c8323c" stroke-width="1.3" '
                      'stroke-dasharray="5 3" opacity="0.85"/>' % (px(x_a), py(y_a), px(x_s), py(0)))
        partes.append('<circle cx="%.1f" cy="%.1f" r="3" fill="#c8323c"/>' % (px(x_s), py(0)))

    partes.append('</g>')
    raiz = datos["resultado"]["raiz"]
    if raiz is not None and x_min <= raiz <= x_max:
        partes.append('<circle cx="%.1f" cy="%.1f" r="6" fill="none" stroke="#c8323c" stroke-width="2"/>'
                      % (px(raiz), py(0)))
    partes.append('</svg>')
    return "".join(partes)


# ==========================================================================
#  Informe HTML imprimible
# ==========================================================================

ESTILO_INFORME = """
body{font-family:Georgia,'Times New Roman',serif;color:#1d2420;max-width:880px;margin:32px auto;padding:0 20px;line-height:1.55}
h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px;border-bottom:1px solid #c9ddd3;padding-bottom:4px}
.sub{color:#55605a;margin:0 0 20px}table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}
th,td{border:1px solid #c9ddd3;padding:5px 8px;text-align:right}th{background:#eef5f1;text-align:center}
td:first-child{text-align:center}.datos td{text-align:left}.datos td:first-child{text-align:left;width:220px;color:#55605a}
.estado{display:inline-block;padding:3px 10px;border-radius:4px;background:#e3f1e8;color:#1d6b3e;font-weight:bold}
.estado.mal{background:#f8e4e4;color:#9a2a2a}.grafico{width:100%;height:auto;margin-top:8px}
.formula{font-size:17px;text-align:center;margin:12px 0}li{margin:4px 0}.pie{margin-top:36px;color:#7a847f;font-size:12px}
@media print{body{margin:0}h2{page-break-after:avoid}table{page-break-inside:auto}tr{page-break-inside:avoid}}
"""


def a_html(datos, decimales=8):
    resultado = datos["resultado"]
    analisis = datos["analisis"]
    verificacion = datos["verificacion"]
    e = escape

    filas = []
    for it in resultado["iteraciones"]:
        filas.append("<tr><td>%d</td>%s</tr>" % (it["n"], "".join(
            "<td>%s</td>" % fmt(it[c], decimales) for c in (
                "x_anterior", "x_actual", "f_anterior", "f_actual", "x_siguiente",
                "f_siguiente", "error_absoluto", "error_relativo"))))

    comparacion = []
    for metodo in datos["comparacion"]["metodos"]:
        comparacion.append("<tr><td style='text-align:left'>%s</td><td>%s</td><td>%s</td><td style='text-align:left'>%s</td></tr>" % (
            e(metodo["metodo"]),
            len(metodo["iteraciones"]) if metodo["aplicable"] else "—",
            fmt(metodo["raiz"], decimales) if metodo["raiz"] is not None else "—",
            e(ESTADOS.get(metodo["estado"], metodo["estado"] or ""))))

    lista = lambda items: "".join("<li>%s</li>" % e(t) for t in items)

    return """<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Informe — Método de la Secante</title>
<style>%(estilo)s</style></head><body>
<h1>Método de la Secante</h1>
<p class="sub">Informe generado el %(fecha)s · Sistema de Cálculo Numérico — Matemática IV</p>

<h2>Problema</h2>
<table class="datos">
<tr><td>Función</td><td>f(x) = %(funcion)s</td></tr>
<tr><td>Valores iniciales</td><td>x₀ = %(x0)s &nbsp;&nbsp; x₁ = %(x1)s</td></tr>
<tr><td>Tolerancia</td><td>%(tol)s</td></tr>
<tr><td>Criterio de parada</td><td>%(criterio)s</td></tr>
<tr><td>Máximo de iteraciones</td><td>%(maxit)s</td></tr>
</table>

<h2>Resultado</h2>
<p><span class="estado %(clase)s">%(estado)s</span></p>
<table class="datos">
<tr><td>Raíz aproximada</td><td><b>%(raiz)s</b></td></tr>
<tr><td>f(raíz)</td><td>%(fraiz)s</td></tr>
<tr><td>Iteraciones realizadas</td><td>%(n)d</td></tr>
<tr><td>Error absoluto aproximado</td><td>%(ea)s</td></tr>
<tr><td>Error relativo aproximado</td><td>%(er)s %%</td></tr>
</table>
<p>%(mensaje)s</p>
<p><b>Verificación del intervalo inicial:</b> %(bolzano)s</p>

<h2>Gráfico</h2>
%(svg)s

<h2>Fórmula utilizada</h2>
<p class="formula">x<sub>n+1</sub> = x<sub>n</sub> − f(x<sub>n</sub>) · (x<sub>n</sub> − x<sub>n−1</sub>) / (f(x<sub>n</sub>) − f(x<sub>n−1</sub>))</p>

<h2>Iteraciones</h2>
<table>
<tr><th>n</th><th>x<sub>n−1</sub></th><th>x<sub>n</sub></th><th>f(x<sub>n−1</sub>)</th><th>f(x<sub>n</sub>)</th>
<th>x<sub>n+1</sub></th><th>f(x<sub>n+1</sub>)</th><th>Error abs.</th><th>Error rel. %%</th></tr>
%(filas)s
</table>

<h2>Análisis</h2>
<ul>%(conclusiones)s%(advertencias)s</ul>

<h2>Comparación con otros métodos</h2>
<table>
<tr><th>Método</th><th>Iteraciones</th><th>Raíz</th><th>Estado</th></tr>
%(comparacion)s
</table>
<ul>%(conclusiones_comp)s</ul>

<p class="pie">Todos los cálculos fueron realizados con implementaciones propias (sin bibliotecas matemáticas).</p>
</body></html>""" % {
        "estilo": ESTILO_INFORME,
        "fecha": time.strftime("%d/%m/%Y %H:%M"),
        "funcion": datos["funcion"]["html"],
        "x0": fmt(resultado["x0"], decimales), "x1": fmt(resultado["x1"], decimales),
        "tol": resultado["tolerancia"], "criterio": e(resultado["criterio_descripcion"]),
        "maxit": resultado["max_iteraciones"],
        "clase": "" if resultado["exitoso"] else "mal",
        "estado": e(ESTADOS.get(resultado["estado"], resultado["estado"])),
        "raiz": fmt(resultado["raiz"], decimales + 4),
        "fraiz": fmt(resultado["f_raiz"], decimales),
        "n": resultado["cantidad_iteraciones"],
        "ea": fmt(resultado["error_absoluto"], decimales),
        "er": fmt(resultado["error_relativo"], decimales),
        "mensaje": e(resultado["mensaje"]),
        "bolzano": e(verificacion["mensaje"]),
        "svg": grafico_svg(datos),
        "filas": "".join(filas),
        "conclusiones": lista(analisis["conclusiones"]),
        "advertencias": lista(analisis["advertencias"]),
        "comparacion": "".join(comparacion),
        "conclusiones_comp": lista(datos["comparacion"]["conclusiones"]),
    }


FORMATOS = {
    "csv": ("text/csv; charset=utf-8", "csv", a_csv),
    "txt": ("text/plain; charset=utf-8", "txt", a_txt),
    "html": ("text/html; charset=utf-8", "html", a_html),
}
