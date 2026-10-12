"""
api.py — Puente entre la interfaz y el núcleo matemático.

Cada función recibe un diccionario (lo que manda la interfaz en JSON) y
devuelve otro diccionario con la respuesta. Ninguna función lanza
excepciones hacia afuera: los errores se devuelven como mensajes claros.
"""

from nucleo import matematica as m
from nucleo import analisis
from nucleo.comparacion import comparar_metodos
from nucleo.expresiones import FUNCIONES
from nucleo.secante import metodo_secante, CRITERIOS
from nucleo.validacion import validar_problema, validar_funcion, validar_rango, ErrorValidacion
from aplicacion import historial, exportar


def limpiar(valor):
    """JSON no admite NaN ni infinito: se reemplazan por None."""
    if isinstance(valor, float):
        return valor if m.es_finito(valor) else None
    if isinstance(valor, dict):
        return {k: limpiar(v) for k, v in valor.items()}
    if isinstance(valor, (list, tuple)):
        return [limpiar(v) for v in valor]
    return valor


def _error(errores):
    return {"ok": False, "errores": errores}


def informacion(_datos=None):
    """Catálogo de funciones y criterios (para la ayuda de la interfaz)."""
    return {
        "ok": True,
        "funciones": [{"nombre": n, "descripcion": d.descripcion} for n, d in FUNCIONES.items()],
        "criterios": [{"clave": k, "descripcion": v} for k, v in CRITERIOS.items()],
    }


def analizar_funcion(datos):
    """Vista previa mientras el usuario escribe: forma 'linda' y derivada."""
    try:
        funcion = validar_funcion(datos.get("funcion"))
    except ErrorValidacion as error:
        return _error(error.errores)
    derivada = funcion.derivada()
    return {"ok": True, "texto": funcion.texto, "html": funcion.html,
            "derivada_texto": derivada.texto, "derivada_html": derivada.html}


def _resolver_completo(datos):
    """Resuelve y arma todos los datos que muestra la interfaz (o exporta)."""
    problema = validar_problema(datos)
    f = problema.funcion

    resultado = metodo_secante(f, problema.x0, problema.x1, problema.tolerancia,
                               problema.max_iteraciones, problema.criterio)
    verificacion = analisis.verificar_intervalo(f, problema.x0, problema.x1)
    estudio = analisis.analizar_resultado(resultado, verificacion)
    estudio["advertencias"] = problema.advertencias + estudio["advertencias"]
    desde, hasta = analisis.rango_sugerido(resultado)
    derivada = f.derivada()

    return {
        "ok": True,
        "funcion": {"texto": f.texto, "html": f.html,
                    "derivada_texto": derivada.texto, "derivada_html": derivada.html},
        "resultado": resultado.a_diccionario(),
        "verificacion": verificacion,
        "analisis": estudio,
        "comparacion": comparar_metodos(problema),
        "rango": [desde, hasta],
        "curva": analisis.muestrear(f, desde, hasta, 700),
    }


def resolver(datos):
    try:
        respuesta = _resolver_completo(datos)
    except ErrorValidacion as error:
        return _error(error.errores)
    try:
        historial.agregar(datos, respuesta["resultado"])
    except OSError:
        pass        # si no se puede guardar el historial, el cálculo igual se muestra
    return limpiar(respuesta)


def muestrear(datos):
    """Puntos de la curva para redibujar el gráfico al hacer zoom o desplazar."""
    try:
        f = validar_funcion(datos.get("funcion"))
        desde, hasta = validar_rango(datos.get("desde"), datos.get("hasta"))
    except ErrorValidacion as error:
        return _error(error.errores)
    puntos = datos.get("puntos") or 600
    return limpiar({"ok": True, "curva": analisis.muestrear(f, desde, hasta, puntos)})


def buscar_intervalos(datos):
    try:
        f = validar_funcion(datos.get("funcion"))
        desde, hasta = validar_rango(datos.get("desde"), datos.get("hasta"))
    except ErrorValidacion as error:
        return _error(error.errores)
    intervalos = analisis.buscar_intervalos(f, desde, hasta, 400)
    raices = [i for i in intervalos if not i["asintota"]]
    asintotas = [i for i in intervalos if i["asintota"]]
    return limpiar({"ok": True, "intervalos": raices, "asintotas": asintotas,
                    "curva": analisis.muestrear(f, desde, hasta, 700), "rango": [desde, hasta]})


def listar_historial(_datos=None):
    return {"ok": True, "historial": historial.listar()}


def borrar_historial(datos):
    if datos.get("id"):
        return {"ok": True, "historial": historial.borrar(datos["id"])}
    historial.vaciar()
    return {"ok": True, "historial": []}


def exportar_resultado(datos):
    formato = datos.get("formato", "html")
    if formato not in exportar.FORMATOS:
        return _error([{"campo": "formato", "mensaje": "Formato de exportación desconocido."}])
    try:
        completo = _resolver_completo(datos)
    except ErrorValidacion as error:
        return _error(error.errores)
    tipo, extension, generar = exportar.FORMATOS[formato]
    decimales = int(datos.get("decimales") or 8)
    return {"ok": True, "contenido": generar(completo, decimales), "tipo": tipo,
            "nombre": "secante_resultado.%s" % extension}


RUTAS = {
    "informacion": informacion,
    "analizar": analizar_funcion,
    "resolver": resolver,
    "muestrear": muestrear,
    "buscar": buscar_intervalos,
    "historial": listar_historial,
    "historial/borrar": borrar_historial,
    "exportar": exportar_resultado,
}
