"""
validacion.py — Validación de los datos que ingresa el usuario.

Cada problema se informa con el CAMPO donde ocurrió y un mensaje claro, para
que la interfaz pueda marcar exactamente qué dato corregir. El sistema nunca
debe "romperse" por un dato mal escrito.

Los valores numéricos se leen con el mismo intérprete de funciones, así que
se puede escribir  x₀ = pi/4,  tolerancia = 1e-6  o  x₁ = sqrt(2).
"""

from nucleo import matematica as m
from nucleo.expresiones import Expresion, ErrorSintaxis, contiene_x
from nucleo.secante import CRITERIOS, CRITERIO_RELATIVO

MAXIMO_ITERACIONES_PERMITIDO = 1000


class ErrorValidacion(Exception):
    """Agrupa todos los errores encontrados en los datos de entrada."""

    def __init__(self, errores):
        super().__init__("; ".join(e["mensaje"] for e in errores))
        self.errores = errores      # lista de {"campo": ..., "mensaje": ...}


class Problema:
    """Datos de un problema ya validados y convertidos a números."""

    def __init__(self, funcion, x0, x1, tolerancia, max_iteraciones, criterio):
        self.funcion = funcion          # objeto Expresion
        self.x0 = x0
        self.x1 = x1
        self.tolerancia = tolerancia
        self.max_iteraciones = max_iteraciones
        self.criterio = criterio
        self.advertencias = []


def leer_numero(texto, campo, nombre):
    """
    Convierte el texto de un campo en número real.
    Acepta coma decimal ("0,001") y expresiones constantes ("pi/2", "1e-4").
    """
    if texto is None or str(texto).strip() == "":
        raise ErrorValidacion([{"campo": campo, "mensaje": "Falta ingresar %s." % nombre}])

    texto = str(texto).strip()
    # Coma decimal: "0,5" -> "0.5" (solo si hay una sola coma)
    if texto.count(",") == 1 and "." not in texto:
        texto = texto.replace(",", ".")

    try:
        expresion = Expresion(texto)
    except ErrorSintaxis:
        raise ErrorValidacion([{"campo": campo,
                                "mensaje": "%s debe ser un número (se ingresó \"%s\")." % (
                                    nombre.capitalize(), texto)}])

    if contiene_x(expresion.arbol):
        raise ErrorValidacion([{"campo": campo,
                                "mensaje": "%s debe ser un número, no puede contener x." % nombre.capitalize()}])
    try:
        valor = expresion(0.0)
    except m.ErrorMatematico as error:
        raise ErrorValidacion([{"campo": campo, "mensaje": "%s no es un valor válido: %s" % (
            nombre.capitalize(), error)}])
    return valor


def leer_entero(texto, campo, nombre):
    valor = leer_numero(texto, campo, nombre)
    if valor != int(valor):
        raise ErrorValidacion([{"campo": campo, "mensaje": "%s debe ser un número entero." % nombre.capitalize()}])
    return int(valor)


def validar_funcion(texto):
    """Devuelve la Expresion o lanza ErrorValidacion con la posición del error."""
    try:
        funcion = Expresion(texto)
    except ErrorSintaxis as error:
        raise ErrorValidacion([{"campo": "funcion", "mensaje": error.mensaje,
                                "posicion": error.posicion, "longitud": error.longitud}])
    if not contiene_x(funcion.arbol):
        raise ErrorValidacion([{"campo": "funcion",
                                "mensaje": "La función es constante (no depende de x): "
                                           "no tiene sentido buscarle raíces."}])
    return funcion


def validar_problema(datos):
    """
    Valida un diccionario con las claves:
        funcion, x0, x1, tolerancia, max_iteraciones, criterio
    Junta TODOS los errores (no solo el primero) para informarlos de una vez.
    """
    errores = []

    def intentar(funcion_lectura, *argumentos):
        try:
            return funcion_lectura(*argumentos)
        except ErrorValidacion as error:
            errores.extend(error.errores)
            return None

    funcion = intentar(validar_funcion, datos.get("funcion"))
    x0 = intentar(leer_numero, datos.get("x0"), "x0", "el valor inicial x₀")
    x1 = intentar(leer_numero, datos.get("x1"), "x1", "el valor inicial x₁")
    tolerancia = intentar(leer_numero, datos.get("tolerancia"), "tolerancia", "la tolerancia")
    # El máximo de iteraciones es opcional: si no se envía, se itera hasta alcanzar el error
    max_iteraciones = None
    if str(datos.get("max_iteraciones") or "").strip():
        max_iteraciones = intentar(leer_entero, datos.get("max_iteraciones"), "max_iteraciones",
                                   "el máximo de iteraciones")

    criterio = datos.get("criterio") or "absoluto"
    if criterio not in CRITERIOS:
        errores.append({"campo": "criterio", "mensaje": "Criterio de parada desconocido: %s" % criterio})

    # Reglas propias del método
    if x0 is not None and x1 is not None and x0 == x1:
        errores.append({"campo": "x1",
                        "mensaje": "x₀ y x₁ deben ser distintos: la secante necesita dos puntos "
                                   "diferentes para trazar la recta."})
    if tolerancia is not None:
        if tolerancia <= 0:
            errores.append({"campo": "tolerancia", "mensaje": "La tolerancia debe ser un número positivo (ej.: 0.0001)."})
        elif tolerancia < 1e-15 and criterio != CRITERIO_RELATIVO:
            errores.append({"campo": "tolerancia",
                            "mensaje": "La tolerancia es demasiado chica: la computadora trabaja con unas "
                                       "16 cifras significativas. Usá un valor ≥ 1e-15."})
        elif criterio == CRITERIO_RELATIVO and tolerancia >= 100:
            errores.append({"campo": "tolerancia",
                            "mensaje": "Con el criterio relativo la tolerancia es un porcentaje: debe ser menor a 100 %."})
    if max_iteraciones is not None and not (1 <= max_iteraciones <= MAXIMO_ITERACIONES_PERMITIDO):
        errores.append({"campo": "max_iteraciones",
                        "mensaje": "El máximo de iteraciones debe estar entre 1 y %d." % MAXIMO_ITERACIONES_PERMITIDO})

    if errores:
        raise ErrorValidacion(errores)

    problema = Problema(funcion, x0, x1, tolerancia, max_iteraciones, criterio)
    if criterio != CRITERIO_RELATIVO and tolerancia >= 1:
        problema.advertencias.append(
            "La tolerancia (%g) es grande: el resultado tendrá poca precisión." % tolerancia)
    return problema


def validar_rango(desde_texto, hasta_texto):
    """Valida un intervalo [desde, hasta] para graficar o buscar raíces."""
    errores = []
    desde = hasta = None
    try:
        desde = leer_numero(desde_texto, "desde", "el extremo izquierdo")
    except ErrorValidacion as error:
        errores.extend(error.errores)
    try:
        hasta = leer_numero(hasta_texto, "hasta", "el extremo derecho")
    except ErrorValidacion as error:
        errores.extend(error.errores)
    if not errores and desde >= hasta:
        errores.append({"campo": "hasta", "mensaje": "El intervalo es incorrecto: el extremo izquierdo debe ser menor que el derecho."})
    if errores:
        raise ErrorValidacion(errores)
    return desde, hasta
