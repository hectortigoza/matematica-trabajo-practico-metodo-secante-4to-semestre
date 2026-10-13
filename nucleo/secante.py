"""
secante.py — Método de la Secante.

IDEA
----
Queremos encontrar una raíz r de f(x) = 0. Partimos de DOS aproximaciones
iniciales x₀ y x₁. Por los puntos (x₀, f(x₀)) y (x₁, f(x₁)) trazamos una recta
(la "secante") y tomamos como nueva aproximación el punto donde esa recta
corta al eje x. Repetimos con los dos últimos puntos.

FÓRMULA
-------
La recta que pasa por (xₙ₋₁, f(xₙ₋₁)) y (xₙ, f(xₙ)) tiene pendiente

        m = [f(xₙ) − f(xₙ₋₁)] / (xₙ − xₙ₋₁)

Igualando la recta a cero  (y = f(xₙ) + m·(x − xₙ) = 0)  y despejando x:

                         f(xₙ) · (xₙ − xₙ₋₁)
        xₙ₊₁  =  xₙ  −  ─────────────────────
                         f(xₙ) − f(xₙ₋₁)

Es la fórmula de Newton-Raphson reemplazando la derivada f'(xₙ) por la
pendiente de la secante (un cociente incremental), por eso NO necesita
conocer la derivada.

ERROR APROXIMADO
----------------
    Absoluto:   Eₐ = |xₙ₊₁ − xₙ|
    Relativo:   εₐ = |(xₙ₊₁ − xₙ) / xₙ₊₁| · 100 %

CRITERIO DE PARADA
------------------
Se detiene cuando el error elegido es menor que la tolerancia, cuando f(xₙ₊₁)
es exactamente 0, o cuando se alcanza el máximo de iteraciones. También se
detiene (informando el motivo) si f(xₙ) = f(xₙ₋₁) (división por cero), si la
aproximación cae fuera del dominio de f, o si los valores divergen.
"""

from nucleo import matematica as m


# Criterios de parada disponibles
CRITERIO_ABSOLUTO = "absoluto"      # |xₙ₊₁ − xₙ| < tol
CRITERIO_RELATIVO = "relativo"      # |(xₙ₊₁ − xₙ)/xₙ₊₁|·100 < tol  (tol en %)
CRITERIO_RESIDUO = "residuo"        # |f(xₙ₊₁)| < tol

CRITERIOS = {
    CRITERIO_ABSOLUTO: "Error absoluto |xₙ₊₁ − xₙ|",
    CRITERIO_RELATIVO: "Error relativo porcentual",
    CRITERIO_RESIDUO: "Valor de la función |f(xₙ₊₁)|",
}

# Estados posibles al terminar
CONVERGIO = "convergio"
RAIZ_EXACTA = "raiz_exacta"
MAX_ITERACIONES = "max_iteraciones"
DIVISION_CERO = "division_cero"
FUERA_DOMINIO = "fuera_dominio"
DIVERGENCIA = "divergencia"

ESTADOS_EXITOSOS = (CONVERGIO, RAIZ_EXACTA)

# No hay máximo de iteraciones elegido por el usuario: se itera hasta alcanzar el error
# pedido. Este límite solo protege de un ciclo infinito cuando el método NO converge
# (la secante, si converge, lo hace en pocas iteraciones: orden ≈ 1.618).
LIMITE_SEGURIDAD = 100

# Si una aproximación supera este valor en módulo se considera que el método diverge
LIMITE_DIVERGENCIA = 1e12
# También diverge si se aleja más de un millón de veces la escala de los valores iniciales
# (pasa, por ejemplo, con f(x) = 1/x: f tiende a 0 cuando x tiende a infinito)
FACTOR_DIVERGENCIA = 1e6


class Iteracion:
    """Todos los valores de un paso del método (una fila de la tabla)."""

    def __init__(self, n, x_anterior, x_actual, f_anterior, f_actual,
                 x_siguiente, f_siguiente, error_absoluto, error_relativo):
        self.n = n
        self.x_anterior = x_anterior        # xₙ₋₁
        self.x_actual = x_actual            # xₙ
        self.f_anterior = f_anterior        # f(xₙ₋₁)
        self.f_actual = f_actual            # f(xₙ)
        self.x_siguiente = x_siguiente      # xₙ₊₁  (nueva aproximación)
        self.f_siguiente = f_siguiente      # f(xₙ₊₁)
        self.error_absoluto = error_absoluto
        self.error_relativo = error_relativo  # en %, o None si xₙ₊₁ = 0
        # Pendiente de la recta secante (útil para graficar y explicar)
        self.pendiente = (f_actual - f_anterior) / (x_actual - x_anterior)

    def a_diccionario(self):
        return {
            "n": self.n,
            "x_anterior": self.x_anterior,
            "x_actual": self.x_actual,
            "f_anterior": self.f_anterior,
            "f_actual": self.f_actual,
            "x_siguiente": self.x_siguiente,
            "f_siguiente": self.f_siguiente,
            "error_absoluto": self.error_absoluto,
            "error_relativo": self.error_relativo,
            "pendiente": self.pendiente,
        }


class ResultadoSecante:
    def __init__(self, x0, x1, tolerancia, max_iteraciones, criterio):
        self.x0 = x0
        self.x1 = x1
        self.tolerancia = tolerancia
        self.max_iteraciones = max_iteraciones
        self.criterio = criterio
        self.iteraciones = []
        self.estado = None
        self.mensaje = ""
        self.raiz = None
        self.f_raiz = None
        self.f_x0 = None
        self.f_x1 = None

    @property
    def exitoso(self):
        return self.estado in ESTADOS_EXITOSOS

    @property
    def error_absoluto(self):
        return self.iteraciones[-1].error_absoluto if self.iteraciones else 0.0

    @property
    def error_relativo(self):
        return self.iteraciones[-1].error_relativo if self.iteraciones else 0.0

    def a_diccionario(self):
        return {
            "x0": self.x0,
            "x1": self.x1,
            "f_x0": self.f_x0,
            "f_x1": self.f_x1,
            "tolerancia": self.tolerancia,
            "max_iteraciones": self.max_iteraciones,
            "criterio": self.criterio,
            "criterio_descripcion": CRITERIOS[self.criterio],
            "estado": self.estado,
            "exitoso": self.exitoso,
            "mensaje": self.mensaje,
            "raiz": self.raiz,
            "f_raiz": self.f_raiz,
            "cantidad_iteraciones": len(self.iteraciones),
            "error_absoluto": self.error_absoluto,
            "error_relativo": self.error_relativo,
            "iteraciones": [it.a_diccionario() for it in self.iteraciones],
        }


def calcular_errores(x_nuevo, x_viejo):
    """Devuelve (error absoluto, error relativo %) entre dos aproximaciones."""
    absoluto = m.valor_absoluto(x_nuevo - x_viejo)
    relativo = None if x_nuevo == 0 else m.valor_absoluto(absoluto / x_nuevo) * 100.0
    return absoluto, relativo


def cumple_criterio(criterio, tolerancia, error_absoluto, error_relativo, f_nuevo):
    """¿Se alcanzó la precisión pedida según el criterio elegido?"""
    if criterio == CRITERIO_ABSOLUTO:
        return error_absoluto < tolerancia
    if criterio == CRITERIO_RELATIVO:
        # Si xₙ₊₁ = 0 el error relativo no existe; se usa el absoluto
        if error_relativo is None:
            return error_absoluto < tolerancia
        return error_relativo < tolerancia
    if criterio == CRITERIO_RESIDUO:
        return m.valor_absoluto(f_nuevo) < tolerancia
    raise ValueError("Criterio desconocido: %s" % criterio)


def _evaluar(f, x, descripcion):
    """Evalúa f(x) traduciendo cualquier error matemático a un mensaje claro."""
    try:
        return f(x), None
    except m.ErrorMatematico as error:
        return None, "f(x) no se puede evaluar en %s = %s: %s" % (descripcion, _num(x), error)


def _num(x):
    return "%.10g" % x


def metodo_secante(f, x0, x1, tolerancia=1e-6, max_iteraciones=None, criterio=CRITERIO_ABSOLUTO):
    """
    Aplica el método de la secante a la función f.

    Parámetros
        f                 función de una variable (ej. un objeto Expresion)
        x0, x1            aproximaciones iniciales (distintas)
        tolerancia        precisión deseada (en % si el criterio es relativo)
        max_iteraciones   opcional; si no se indica se itera hasta alcanzar el error
                          pedido (con LIMITE_SEGURIDAD como protección)
        criterio          'absoluto', 'relativo' o 'residuo'

    Devuelve un ResultadoSecante con la raíz, el estado final y la tabla
    completa de iteraciones.
    """
    resultado = ResultadoSecante(x0, x1, tolerancia, max_iteraciones, criterio)
    limite_iteraciones = max_iteraciones or LIMITE_SEGURIDAD

    # --- Paso 0: evaluar la función en los dos puntos iniciales -------------
    f0, error = _evaluar(f, x0, "x₀")
    if error:
        resultado.estado, resultado.mensaje = FUERA_DOMINIO, error
        return resultado
    f1, error = _evaluar(f, x1, "x₁")
    if error:
        resultado.estado, resultado.mensaje = FUERA_DOMINIO, error
        return resultado
    resultado.f_x0, resultado.f_x1 = f0, f1

    # Si alguno de los puntos iniciales ya es raíz, no hace falta iterar
    if f0 == 0 or f1 == 0:
        raiz = x0 if f0 == 0 else x1
        resultado.estado = RAIZ_EXACTA
        resultado.raiz, resultado.f_raiz = raiz, 0.0
        resultado.mensaje = "El valor inicial x = %s ya es una raíz exacta: f(x) = 0." % _num(raiz)
        return resultado

    x_anterior, x_actual = x0, x1
    f_anterior, f_actual = f0, f1
    limite = min(LIMITE_DIVERGENCIA,
                 FACTOR_DIVERGENCIA * (1 + max(m.valor_absoluto(x0), m.valor_absoluto(x1))))

    # --- Iteraciones ---------------------------------------------------------
    for n in range(1, limite_iteraciones + 1):

        if x_actual == x_anterior:
            # Las aproximaciones ya no cambian: se llegó al límite de precisión
            # de la computadora (≈ 16 cifras significativas)
            resultado.estado = CONVERGIO
            resultado.mensaje = (
                "Convergencia alcanzada en %d iteraciones: las aproximaciones ya no cambian "
                "(se llegó al límite de precisión de la máquina)." % (n - 1))
            return resultado

        denominador = f_actual - f_anterior
        if denominador == 0:
            # La secante es horizontal: nunca corta al eje x
            resultado.estado = DIVISION_CERO
            resultado.raiz, resultado.f_raiz = x_actual, f_actual
            resultado.mensaje = (
                "División por cero en la iteración %d: f(xₙ) = f(xₙ₋₁) = %s. "
                "La recta secante es horizontal y no corta al eje x. "
                "Probá con otros valores iniciales." % (n, _num(f_actual)))
            return resultado

        # Fórmula de la secante
        x_siguiente = x_actual - f_actual * (x_actual - x_anterior) / denominador

        if not m.es_finito(x_siguiente) or m.valor_absoluto(x_siguiente) > limite:
            resultado.estado = DIVERGENCIA
            resultado.raiz, resultado.f_raiz = x_actual, f_actual
            resultado.mensaje = (
                "El método diverge en la iteración %d: la nueva aproximación (%s) se aleja "
                "sin control. La función podría no tener raíz cerca de los valores iniciales." % (
                    n, _num(x_siguiente) if m.es_finito(x_siguiente) else "∞"))
            return resultado

        f_siguiente, error = _evaluar(f, x_siguiente, "x%d" % (n + 1))
        if error:
            resultado.estado = FUERA_DOMINIO
            resultado.raiz, resultado.f_raiz = x_actual, f_actual
            resultado.mensaje = (
                "En la iteración %d la nueva aproximación cae fuera del dominio de la función. %s. "
                "Elegí valores iniciales más cercanos a la raíz." % (n, error))
            return resultado

        error_absoluto, error_relativo = calcular_errores(x_siguiente, x_actual)

        resultado.iteraciones.append(Iteracion(
            n, x_anterior, x_actual, f_anterior, f_actual,
            x_siguiente, f_siguiente, error_absoluto, error_relativo))

        resultado.raiz, resultado.f_raiz = x_siguiente, f_siguiente

        if f_siguiente == 0:
            resultado.estado = RAIZ_EXACTA
            resultado.mensaje = "Se encontró la raíz exacta en la iteración %d: f(x) = 0." % n
            return resultado

        if cumple_criterio(criterio, tolerancia, error_absoluto, error_relativo, f_siguiente):
            resultado.estado = CONVERGIO
            resultado.mensaje = "Convergencia alcanzada en %d iteraciones." % n
            return resultado

        # Se descarta el punto más viejo y se avanza
        x_anterior, f_anterior = x_actual, f_actual
        x_actual, f_actual = x_siguiente, f_siguiente

    resultado.estado = MAX_ITERACIONES
    if max_iteraciones is None:
        resultado.mensaje = (
            "Después de %d iteraciones el error todavía no es menor al pedido: el método no "
            "converge con estos valores iniciales. Puede que la ecuación no tenga una raíz real "
            "cerca, o que haya que partir de valores más próximos a la raíz."
            % limite_iteraciones)
    else:
        resultado.mensaje = (
            "Se alcanzó el máximo de %d iteraciones sin llegar a la tolerancia pedida. "
            "El valor obtenido es una aproximación." % max_iteraciones)
    return resultado
