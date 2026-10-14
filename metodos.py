# ==========================================================================
#  metodos.py — Método de la Secante
#
#  Acá están TODOS los métodos (funciones) que usa el sistema.
#  Están escritos paso a paso, como un algoritmo de PSeInt.
#
#  Notación que usamos:
#     k      número de iteración (empieza en 0)
#     a      x(k-1)  -> el valor anterior
#     b      x(k)    -> el valor actual
#     x      x(k+1)  -> el valor nuevo que calcula la fórmula
#
#  Fórmula de la secante:
#
#               a · f(b) - b · f(a)
#     x(k+1) = ---------------------
#                  f(b) - f(a)
#
#  Test de parada: se reemplaza x(k+1) en la función.
#  Si |f(x(k+1))| es menor que el error pedido, x(k+1) es la respuesta.
# ==========================================================================

import math

# Si después de esta cantidad de iteraciones no se llegó al error pedido,
# el método no converge (sirve para que el programa no quede trabado).
LIMITE_DE_ITERACIONES = 100

# Nombres que el usuario puede usar al escribir la función
NOMBRES_PERMITIDOS = {
    "x": 0,
    "sin": math.sin, "sen": math.sin, "cos": math.cos, "tan": math.tan,
    "asin": math.asin, "acos": math.acos, "atan": math.atan,
    "sqrt": math.sqrt, "raiz": math.sqrt, "exp": math.exp,
    "ln": math.log, "log": math.log10, "abs": abs,
    "pi": math.pi, "e": math.e,
}


# --------------------------------------------------------------------------
#  1) Preparar la función que escribió el usuario
# --------------------------------------------------------------------------

def preparar_funcion(texto):
    # El usuario escribe, por ejemplo:   x^3 - 4x - 1
    # Python necesita:                   x**3 - 4*x - 1

    funcion = texto.replace(" ", "")      # sacamos los espacios
    funcion = funcion.replace(",", ".")   # coma decimal -> punto
    funcion = funcion.replace("^", "**")  # potencia: ^ -> **

    # Multiplicación que no se escribe:  4x -> 4*x    2(x+1) -> 2*(x+1)    (x+1)(x-1) -> (x+1)*(x-1)
    resultado = ""
    i = 0
    while i < len(funcion):
        caracter = funcion[i]
        resultado = resultado + caracter
        if i + 1 < len(funcion):
            siguiente = funcion[i + 1]
            numero_y_letra = caracter.isdigit() and (siguiente.isalpha() or siguiente == "(")
            parentesis_y_algo = caracter == ")" and (siguiente.isalnum() or siguiente == "(")
            x_y_parentesis = caracter == "x" and siguiente == "("
            if numero_y_letra or parentesis_y_algo or x_y_parentesis:
                resultado = resultado + "*"
        i = i + 1

    return resultado


def funcion_esta_bien_escrita(funcion):
    # Python revisa si el texto es una cuenta válida (paréntesis cerrados, operadores, etc.)
    try:
        codigo = compile(funcion, "funcion", "eval")
    except SyntaxError:
        return False

    # Revisamos que solo use nombres conocidos (x, sin, cos, ln, ...)
    for nombre in codigo.co_names:
        if nombre not in NOMBRES_PERMITIDOS:
            return False

    # Tiene que depender de x
    if "x" not in codigo.co_names:
        return False

    return True


# --------------------------------------------------------------------------
#  2) Calcular f(x): reemplazar x por un número
# --------------------------------------------------------------------------

def evaluar(funcion, x):
    # Se reemplaza x por el número y Python hace la cuenta.
    # Ejemplo: funcion = "x**3 - 4*x - 1",  x = 2   ->   2**3 - 4*2 - 1 = -1
    nombres = dict(NOMBRES_PERMITIDOS)
    nombres["x"] = x
    resultado = eval(funcion, {"__builtins__": {}}, nombres)

    # Por ejemplo (-8)**(1/3) da un número complejo: lo tratamos como fuera del dominio
    if isinstance(resultado, complex):
        raise ValueError("resultado complejo")
    return resultado


# --------------------------------------------------------------------------
#  3) Validar los datos que ingresó el usuario
# --------------------------------------------------------------------------

def leer_numero(texto):
    # Convierte el texto en número. Si no se puede, devuelve None.
    texto = str(texto).strip().replace(",", ".")
    try:
        return float(texto)
    except ValueError:
        return None


def validar_datos(texto_funcion, texto_a, texto_b, texto_error):
    # Devuelve la lista de errores encontrados (vacía si todo está bien)
    errores = []

    if str(texto_funcion).strip() == "":
        errores.append({"campo": "funcion", "mensaje": "Falta escribir la función."})
    elif not funcion_esta_bien_escrita(preparar_funcion(texto_funcion)):
        errores.append({"campo": "funcion",
                        "mensaje": "La función está mal escrita. Ejemplo válido: x^3 - 4x - 1"})

    a = leer_numero(texto_a)
    b = leer_numero(texto_b)
    error = leer_numero(texto_error)

    if a is None:
        errores.append({"campo": "x0", "mensaje": "El valor inicial a debe ser un número."})
    if b is None:
        errores.append({"campo": "x1", "mensaje": "El valor inicial b debe ser un número."})
    if a is not None and b is not None and a == b:
        errores.append({"campo": "x1", "mensaje": "a y b tienen que ser distintos."})
    if error is None or error <= 0:
        errores.append({"campo": "tolerancia", "mensaje": "El error debe ser un número mayor que 0 (ej.: 0.0001)."})

    return errores


# --------------------------------------------------------------------------
#  4) ¿Hay cambio de signo entre a y b?
# --------------------------------------------------------------------------

def hay_cambio_de_signo(fa, fb):
    acheck = fa > 0          # ¿f(a) es positivo?
    bcheck = fb > 0          # ¿f(b) es positivo?

    if acheck == bcheck:     # los dos positivos o los dos negativos
        return False         # -> NO hay cambio de signo
    else:
        return True          # -> SÍ hay cambio de signo


# --------------------------------------------------------------------------
#  5) La fórmula de la secante
# --------------------------------------------------------------------------

def calcular_x_siguiente(a, b, fa, fb):
    #             a · f(b) - b · f(a)
    #   x(k+1) = ---------------------
    #                f(b) - f(a)
    return (a * fb - b * fa) / (fb - fa)


# --------------------------------------------------------------------------
#  6) Resolver: arma la tabla iteración por iteración
# --------------------------------------------------------------------------

def resolver_secante(texto_funcion, texto_a, texto_b, texto_error):

    # Paso 1: validar los datos
    errores = validar_datos(texto_funcion, texto_a, texto_b, texto_error)
    if len(errores) > 0:
        return {"ok": False, "errores": errores}

    funcion = preparar_funcion(texto_funcion)
    a = leer_numero(texto_a)
    b = leer_numero(texto_b)
    error = leer_numero(texto_error)

    # Paso 2: calcular f(a) y f(b)
    try:
        fa = evaluar(funcion, a)
        fb = evaluar(funcion, b)
    except (ValueError, ZeroDivisionError, OverflowError):
        return {"ok": False, "errores": [{"campo": "x0",
                "mensaje": "La función no se puede calcular en a o en b (fuera de su dominio)."}]}

    respuesta = {
        "ok": True,
        "funcion": texto_funcion,
        "funcion_python": funcion,
        "a": a, "b": b, "error": error,
        "fa": fa, "fb": fb,
        "acheck": fa > 0,
        "bcheck": fb > 0,
        "cambio_de_signo": hay_cambio_de_signo(fa, fb),
        "tabla": [],
        "encontrada": False,
        "raiz": None,
        "mensaje": "",
        "advertencia": "",
    }

    # Paso 3: si a o b ya son raíz, no hace falta iterar
    if fa == 0 or fb == 0:
        respuesta["cambio_de_signo"] = True
        respuesta["encontrada"] = True
        if fa == 0:
            respuesta["raiz"] = a
        else:
            respuesta["raiz"] = b
        respuesta["mensaje"] = "Uno de los valores iniciales ya es la raíz: f = 0."
        return respuesta

    # Paso 4: si no hay cambio de signo, no se resuelve
    if not respuesta["cambio_de_signo"]:
        respuesta["mensaje"] = "No hay cambio de signo entre a y b: no se resuelve la tabla."
        return respuesta

    # Paso 5: iterar
    a_inicial = a
    b_inicial = b
    k = 0
    encontrada = False
    while not encontrada and k < LIMITE_DE_ITERACIONES:

        fa = evaluar(funcion, a)
        fb = evaluar(funcion, b)

        if fb - fa == 0:
            respuesta["mensaje"] = "f(a) y f(b) son iguales: no se puede dividir por cero."
            return respuesta

        x = calcular_x_siguiente(a, b, fa, fb)

        if math.isinf(x) or math.isnan(x):
            respuesta["mensaje"] = "x(k+1) se va al infinito: el método diverge."
            return respuesta

        # Test de parada: reemplazar x(k+1) en la función
        try:
            fx = evaluar(funcion, x)
        except (ValueError, ZeroDivisionError, OverflowError):
            respuesta["mensaje"] = "x(k+1) cae fuera del dominio de la función."
            return respuesta

        if abs(fx) < error:
            encontrada = True

        respuesta["tabla"].append({
            "k": k,
            "a": a, "b": b,
            "fa": fa, "fb": fb,
            "x": x,              # x(k+1)
            "fx": fx,            # f(x(k+1)) -> test de parada
            "cumple": encontrada,
        })

        # Siguiente iteración: a toma el valor de b, y b toma el valor de x(k+1)
        a = b
        b = x
        k = k + 1

    # Paso 6: resultado
    if encontrada:
        respuesta["encontrada"] = True
        respuesta["raiz"] = x
        respuesta["mensaje"] = "Raíz encontrada en la iteración k = " + str(k - 1) + "."

        # Como había cambio de signo, la raíz debería estar entre a y b.
        # Si quedó afuera, probablemente el cambio de signo era una asíntota (ej.: 1/x).
        if x < min(a_inicial, b_inicial) or x > max(a_inicial, b_inicial):
            respuesta["advertencia"] = ("Ojo: la raíz encontrada está fuera de [a, b]. Puede que el cambio "
                                        "de signo se deba a una discontinuidad (asíntota) y no a una raíz.")
    else:
        respuesta["mensaje"] = ("Después de " + str(LIMITE_DE_ITERACIONES) +
                                " iteraciones no se llegó al error pedido: el método no converge.")
    return respuesta
