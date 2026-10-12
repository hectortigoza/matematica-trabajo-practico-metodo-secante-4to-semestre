"""
matematica.py — Funciones matemáticas implementadas desde cero.

En lugar de usar el módulo `math` de Python, cada función se calcula con
técnicas numéricas clásicas:

  * Series de Taylor / Maclaurin  (exp, sen, cos, atan, atanh)
  * Reducción de argumento        (llevar x a un rango pequeño donde la serie
                                   converge muy rápido)
  * Método de Newton              (raíz cuadrada y raíz cúbica)

Todas las funciones lanzan un ErrorMatematico (con mensaje en español) cuando
el valor está fuera del dominio, en lugar de devolver resultados inválidos.
"""


# --------------------------------------------------------------------------
#  Errores propios
# --------------------------------------------------------------------------

class ErrorMatematico(Exception):
    """Error base de todas las operaciones matemáticas del sistema."""


class ErrorDominio(ErrorMatematico):
    """El valor no pertenece al dominio de la función (ej.: ln(-1))."""


class ErrorDivisionCero(ErrorMatematico):
    """Se intentó dividir por cero."""


class ErrorDesbordamiento(ErrorMatematico):
    """El resultado es demasiado grande para representarse (overflow)."""


# --------------------------------------------------------------------------
#  Constantes
# --------------------------------------------------------------------------

PI = 3.141592653589793
E = 2.718281828459045
INFINITO = float("inf")

# ln(2) dividido en una parte "alta" y otra "baja" (técnica de Cody–Waite).
# Al multiplicar k·ln2 con k grande, separar la constante evita perder
# precisión en la reducción de argumento.
LN2_ALTO = 6.93147180369123816490e-01
LN2_BAJO = 1.90821492927058770002e-10
LN2 = 0.6931471805599453
LN10 = 2.302585092994046

# π/2 también dividido en dos partes para la reducción de sen y cos.
PI_2_ALTO = 1.57079632673412561417e+00
PI_2_BAJO = 6.07710050650619224932e-11
PI_2 = PI / 2

RAIZ_3 = 1.7320508075688772
TAN_PI_12 = 0.2679491924311228      # tan(15°) = 2 − √3

LIMITE_EXP = 709.782712893384        # e^x desborda a infinito por encima de esto

# Cantidad máxima de términos de las series (nunca se llega a usar en
# la práctica: las series cortan apenas el término deja de aportar).
MAX_TERMINOS = 60


# --------------------------------------------------------------------------
#  Utilidades básicas
# --------------------------------------------------------------------------

def es_finito(x):
    """Verdadero si x es un número real representable (no NaN ni ±∞)."""
    return x == x and x != INFINITO and x != -INFINITO


def valor_absoluto(x):
    return -x if x < 0 else x


def signo(x):
    if x > 0:
        return 1.0
    if x < 0:
        return -1.0
    return 0.0


def redondear_entero(x):
    """Entero más cercano a x (los .5 se alejan del cero)."""
    if x >= 0:
        return int(x + 0.5)
    return -int(-x + 0.5)


def potencia_de_dos(k):
    """Calcula 2^k para k entero multiplicando por 2 (o por 1/2)."""
    resultado = 1.0
    if k >= 0:
        for _ in range(k):
            resultado *= 2.0
    else:
        for _ in range(-k):
            resultado *= 0.5
    return resultado


def escalar_por_potencia_de_dos(x, k):
    """Devuelve x·2^k sin desbordar en pasos intermedios."""
    # Se multiplica en partes para que 2^k no desborde antes de aplicar x
    while k > 1000:
        x *= potencia_de_dos(1000)
        k -= 1000
    while k < -1000:
        x *= potencia_de_dos(-1000)
        k += 1000
    return x * potencia_de_dos(k)


# --------------------------------------------------------------------------
#  Exponencial y logaritmos
# --------------------------------------------------------------------------

def exp(x):
    """
    e^x por reducción de argumento + serie de Taylor.

    Se escribe x = k·ln2 + r  con |r| ≤ ln2/2 ≈ 0.347, entonces
        e^x = 2^k · e^r
    y e^r se obtiene con la serie  1 + r + r²/2! + r³/3! + ...
    que con |r| tan chico converge en ~18 términos.
    """
    if not es_finito(x):
        if x != x:
            raise ErrorDominio("exp recibió un valor indefinido (NaN)")
        return INFINITO if x > 0 else 0.0
    if x > LIMITE_EXP:
        raise ErrorDesbordamiento("e^%g es demasiado grande (desbordamiento)" % x)
    if x < -745.2:
        return 0.0

    k = redondear_entero(x / LN2)
    r = (x - k * LN2_ALTO) - k * LN2_BAJO

    suma = 1.0
    termino = 1.0
    for n in range(1, MAX_TERMINOS):
        termino *= r / n
        nueva = suma + termino
        if nueva == suma:          # el término ya no cambia el resultado
            break
        suma = nueva

    return escalar_por_potencia_de_dos(suma, k)


def ln(x):
    """
    Logaritmo natural.

    1) Se descompone x = m · 2^k con m en [√½, √2).
    2) ln(x) = k·ln2 + ln(m)
    3) ln(m) se calcula con la serie de la arcotangente hiperbólica:
           ln(m) = 2·atanh(s),  s = (m−1)/(m+1)
           atanh(s) = s + s³/3 + s⁵/5 + ...
       Como |s| ≤ 0.172, la serie converge muy rápido.
    """
    if x != x:
        raise ErrorDominio("ln recibió un valor indefinido (NaN)")
    if x <= 0:
        raise ErrorDominio("ln(x) solo está definido para x > 0 (se recibió x = %g)" % x)
    if x == INFINITO:
        return INFINITO

    m = x
    k = 0
    while m >= 1.4142135623730951:   # √2
        m *= 0.5
        k += 1
    while m < 0.7071067811865476:    # √½
        m *= 2.0
        k -= 1

    s = (m - 1.0) / (m + 1.0)
    s2 = s * s
    suma = s
    potencia = s
    for n in range(3, 2 * MAX_TERMINOS, 2):
        potencia *= s2
        nueva = suma + potencia / n
        if nueva == suma:
            break
        suma = nueva

    return k * LN2_ALTO + (k * LN2_BAJO + 2.0 * suma)


def log10(x):
    """Logaritmo en base 10 mediante cambio de base: ln(x)/ln(10)."""
    return ln(x) / LN10


def log2(x):
    """Logaritmo en base 2 mediante cambio de base: ln(x)/ln(2)."""
    return ln(x) / LN2


# --------------------------------------------------------------------------
#  Raíces
# --------------------------------------------------------------------------

def raiz_cuadrada(x):
    """
    √x con el método de Newton aplicado a g(y) = y² − x:
        y_{n+1} = (y_n + x / y_n) / 2

    Para que arranque cerca, primero se escribe x = m·4^k con m en [1, 4),
    así √x = √m · 2^k  y solo hay que iterar sobre m.
    Comenzando por encima de la raíz, la sucesión baja de forma monótona,
    así que se corta cuando deja de disminuir.
    """
    if x != x:
        raise ErrorDominio("raíz cuadrada de un valor indefinido (NaN)")
    if x < 0:
        raise ErrorDominio("√x solo está definida para x ≥ 0 (se recibió x = %g)" % x)
    if x == 0 or x == INFINITO:
        return x

    m = x
    k = 0
    while m >= 4.0:
        m *= 0.25
        k += 1
    while m < 1.0:
        m *= 4.0
        k -= 1

    y = (m + 1.0) / 2.0               # por la desigualdad AM-GM, y ≥ √m
    for _ in range(MAX_TERMINOS):
        siguiente = 0.5 * (y + m / y)
        if siguiente >= y:
            break
        y = siguiente

    return escalar_por_potencia_de_dos(y, k)


def raiz_cubica(x):
    """
    ∛x (definida también para negativos).
    Primera aproximación con e^(ln|x|/3) y luego dos pasos de Newton sobre
    g(y) = y³ − x para pulir el resultado.
    """
    if x == 0 or not es_finito(x):
        return x
    s = signo(x)
    a = valor_absoluto(x)
    y = exp(ln(a) / 3.0)
    for _ in range(3):
        y = y - (y * y * y - a) / (3.0 * y * y)
    return s * y


# --------------------------------------------------------------------------
#  Potencias
# --------------------------------------------------------------------------

def _potencia_entera(base, n):
    """base^n para n entero ≥ 0 usando exponenciación binaria (cuadrados sucesivos)."""
    resultado = 1.0
    while n > 0:
        if n % 2 == 1:
            resultado *= base
        base *= base
        n //= 2
    return resultado


def potencia(base, exponente):
    """
    base^exponente.
      * Exponente entero  -> exponenciación binaria (exacta y admite base negativa)
      * Exponente real    -> e^(exponente · ln(base)),  requiere base > 0
    """
    if exponente == 0:
        return 1.0
    if base == 0:
        if exponente > 0:
            return 0.0
        raise ErrorDivisionCero("0 elevado a un exponente negativo implica dividir por cero")

    es_entero = exponente == int(exponente) and valor_absoluto(exponente) < 2 ** 53
    if es_entero:
        n = int(exponente)
        resultado = _potencia_entera(base, n if n > 0 else -n)
        if n > 0:
            if not es_finito(resultado):
                raise ErrorDesbordamiento("%g^%g es demasiado grande (desbordamiento)" % (base, exponente))
            return resultado
        # Exponente negativo: base^(−n) = 1 / base^n
        if not es_finito(resultado):
            return 0.0
        if resultado == 0:
            raise ErrorDesbordamiento("%g^%g es demasiado grande (desbordamiento)" % (base, exponente))
        return 1.0 / resultado

    if base < 0:
        raise ErrorDominio(
            "Una base negativa (%g) no puede elevarse a un exponente no entero (%g). "
            "Para raíces cúbicas usá cbrt(x)." % (base, exponente))

    return exp(exponente * ln(base))


# --------------------------------------------------------------------------
#  Trigonométricas
# --------------------------------------------------------------------------

def _seno_taylor(r):
    """sen(r) = r − r³/3! + r⁵/5! − ...   (válida y rápida para |r| ≤ π/4)."""
    r2 = r * r
    termino = r
    suma = r
    for n in range(1, MAX_TERMINOS):
        termino *= -r2 / ((2 * n) * (2 * n + 1))
        nueva = suma + termino
        if nueva == suma:
            break
        suma = nueva
    return suma


def _coseno_taylor(r):
    """cos(r) = 1 − r²/2! + r⁴/4! − ...   (válida y rápida para |r| ≤ π/4)."""
    r2 = r * r
    termino = 1.0
    suma = 1.0
    for n in range(1, MAX_TERMINOS):
        termino *= -r2 / ((2 * n - 1) * (2 * n))
        nueva = suma + termino
        if nueva == suma:
            break
        suma = nueva
    return suma


def _reducir_cuadrante(x):
    """
    Escribe x = k·(π/2) + r con |r| ≤ π/4.
    Devuelve (r, k mod 4): el cuadrante indica qué fórmula usar.
    """
    k = redondear_entero(x / PI_2)
    r = (x - k * PI_2_ALTO) - k * PI_2_BAJO
    return r, k % 4


def seno(x):
    if not es_finito(x):
        raise ErrorDominio("sen(x) no está definido para x infinito o indefinido")
    r, cuadrante = _reducir_cuadrante(x)
    if cuadrante == 0:
        return _seno_taylor(r)
    if cuadrante == 1:
        return _coseno_taylor(r)
    if cuadrante == 2:
        return -_seno_taylor(r)
    return -_coseno_taylor(r)


def coseno(x):
    if not es_finito(x):
        raise ErrorDominio("cos(x) no está definido para x infinito o indefinido")
    r, cuadrante = _reducir_cuadrante(x)
    if cuadrante == 0:
        return _coseno_taylor(r)
    if cuadrante == 1:
        return -_seno_taylor(r)
    if cuadrante == 2:
        return -_coseno_taylor(r)
    return _seno_taylor(r)


def tangente(x):
    c = coseno(x)
    if valor_absoluto(c) < 1e-15:
        raise ErrorDominio("tan(x) no está definida en x = %g (cos(x) = 0)" % x)
    return seno(x) / c


def _arcotangente_reducida(x):
    """atan(x) = x − x³/3 + x⁵/5 − ...  para |x| ≤ tan(15°) ≈ 0.268."""
    x2 = x * x
    potencia_x = x
    suma = x
    for n in range(1, MAX_TERMINOS):
        potencia_x *= -x2
        nueva = suma + potencia_x / (2 * n + 1)
        if nueva == suma:
            break
        suma = nueva
    return suma


def arcotangente(x):
    """
    atan(x) usando dos identidades para achicar el argumento:
      1) Si |x| > 1:       atan(x) = ±π/2 − atan(1/x)
      2) Si |x| > tan15°:  atan(x) = π/6 + atan((√3·x − 1)/(√3 + x))
    y luego la serie de Taylor sobre el argumento reducido.
    """
    if x != x:
        raise ErrorDominio("atan recibió un valor indefinido (NaN)")
    if x == INFINITO:
        return PI_2
    if x == -INFINITO:
        return -PI_2

    s = signo(x)
    a = valor_absoluto(x)

    invertido = False
    if a > 1.0:
        a = 1.0 / a
        invertido = True

    desplazado = False
    if a > TAN_PI_12:
        a = (RAIZ_3 * a - 1.0) / (RAIZ_3 + a)
        desplazado = True

    resultado = _arcotangente_reducida(a)
    if desplazado:
        resultado += PI / 6
    if invertido:
        resultado = PI_2 - resultado
    return s * resultado


def arcoseno(x):
    """asin(x) = atan(x / √(1 − x²)),  definida para −1 ≤ x ≤ 1."""
    if x != x or x < -1.0 or x > 1.0:
        raise ErrorDominio("asin(x) solo está definida para −1 ≤ x ≤ 1 (se recibió x = %g)" % x)
    if x == 1.0:
        return PI_2
    if x == -1.0:
        return -PI_2
    return arcotangente(x / raiz_cuadrada((1.0 - x) * (1.0 + x)))


def arcocoseno(x):
    """acos(x) = 2·atan(√((1 − x)/(1 + x))),  definida para −1 ≤ x ≤ 1."""
    if x != x or x < -1.0 or x > 1.0:
        raise ErrorDominio("acos(x) solo está definida para −1 ≤ x ≤ 1 (se recibió x = %g)" % x)
    if x == -1.0:
        return PI
    return 2.0 * arcotangente(raiz_cuadrada((1.0 - x) / (1.0 + x)))


# --------------------------------------------------------------------------
#  Hiperbólicas
# --------------------------------------------------------------------------

def seno_hiperbolico(x):
    """sinh(x) = (eˣ − e⁻ˣ)/2. Para |x| chico se usa la serie para no perder precisión."""
    if valor_absoluto(x) < 0.5:
        x2 = x * x
        termino = x
        suma = x
        for n in range(1, MAX_TERMINOS):
            termino *= x2 / ((2 * n) * (2 * n + 1))
            nueva = suma + termino
            if nueva == suma:
                break
            suma = nueva
        return suma
    ex = exp(x)
    return (ex - 1.0 / ex) / 2.0


def coseno_hiperbolico(x):
    """cosh(x) = (eˣ + e⁻ˣ)/2."""
    ex = exp(valor_absoluto(x))
    return (ex + 1.0 / ex) / 2.0


def tangente_hiperbolica(x):
    """tanh(x) = sinh(x)/cosh(x). Para |x| > 20 ya vale ±1 en doble precisión."""
    if x > 20:
        return 1.0
    if x < -20:
        return -1.0
    if valor_absoluto(x) < 0.5:
        return seno_hiperbolico(x) / coseno_hiperbolico(x)
    e2x = exp(2.0 * x)
    return (e2x - 1.0) / (e2x + 1.0)


# --------------------------------------------------------------------------
#  Otras
# --------------------------------------------------------------------------

def dividir(a, b):
    """División que informa claramente la división por cero."""
    if b == 0:
        raise ErrorDivisionCero("División por cero")
    return a / b
