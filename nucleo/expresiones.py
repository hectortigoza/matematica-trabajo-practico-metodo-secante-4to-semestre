"""
expresiones.py — Intérprete de funciones matemáticas escrito desde cero.

El usuario escribe la función como texto, por ejemplo  "x^3 - 4x - 1".
Para poder evaluarla SIN usar eval() (que sería inseguro y no muestra
comprensión del problema), el texto pasa por tres etapas:

  1. ANÁLISIS LÉXICO (tokenizar):   "x^3 - 4x - 1"
        -> [x] [^] [3] [-] [4] [x] [-] [1]

  2. ANÁLISIS SINTÁCTICO (Parser):  los tokens se organizan en un
     ÁRBOL DE SINTAXIS respetando la precedencia de operadores:

                 (−)
                /   \\
             (−)     1
            /   \\
         (^)    (·)
        /  \\    /  \\
       x    3  4    x

  3. EVALUACIÓN (compilar): el árbol se convierte en una función de Python
     que, dado un x, recorre el árbol y calcula el valor usando nuestras
     propias funciones matemáticas (nucleo/matematica.py).

Además, el árbol permite DERIVAR la función simbólicamente (necesario para
comparar con Newton-Raphson) y mostrarla en forma "linda" en pantalla.

Gramática que reconoce el parser (de menor a mayor precedencia):

    expresion  ->  termino  (('+' | '-') termino)*
    termino    ->  unario   (('*' | '/') unario | <multiplicación implícita>)*
    unario     ->  ('+' | '-') unario  |  potencia
    potencia   ->  primario ('^' unario)?            (asociativa a derecha)
    primario   ->  NUMERO | 'x' | CONSTANTE | FUNCION '(' expresion ')'
                   | '(' expresion ')'
"""

from nucleo import matematica as m


# ==========================================================================
#  Errores
# ==========================================================================

class ErrorSintaxis(Exception):
    """La función escrita por el usuario no es válida.

    Guarda la posición del error en el texto para poder señalarla en pantalla.
    """

    def __init__(self, mensaje, posicion=None, longitud=1):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.posicion = posicion
        self.longitud = longitud


# ==========================================================================
#  Catálogo de funciones y constantes permitidas
# ==========================================================================

class DefinicionFuncion:
    def __init__(self, nombre, calcular, descripcion):
        self.nombre = nombre            # nombre canónico (el que se muestra)
        self.calcular = calcular        # implementación propia en matematica.py
        self.descripcion = descripcion


FUNCIONES = {
    "sin":   DefinicionFuncion("sin", m.seno, "seno"),
    "cos":   DefinicionFuncion("cos", m.coseno, "coseno"),
    "tan":   DefinicionFuncion("tan", m.tangente, "tangente"),
    "asin":  DefinicionFuncion("asin", m.arcoseno, "arcoseno"),
    "acos":  DefinicionFuncion("acos", m.arcocoseno, "arcocoseno"),
    "atan":  DefinicionFuncion("atan", m.arcotangente, "arcotangente"),
    "sinh":  DefinicionFuncion("sinh", m.seno_hiperbolico, "seno hiperbólico"),
    "cosh":  DefinicionFuncion("cosh", m.coseno_hiperbolico, "coseno hiperbólico"),
    "tanh":  DefinicionFuncion("tanh", m.tangente_hiperbolica, "tangente hiperbólica"),
    "exp":   DefinicionFuncion("exp", m.exp, "exponencial e^x"),
    "ln":    DefinicionFuncion("ln", m.ln, "logaritmo natural"),
    "log":   DefinicionFuncion("log", m.log10, "logaritmo en base 10"),
    "log2":  DefinicionFuncion("log2", m.log2, "logaritmo en base 2"),
    "sqrt":  DefinicionFuncion("sqrt", m.raiz_cuadrada, "raíz cuadrada"),
    "cbrt":  DefinicionFuncion("cbrt", m.raiz_cubica, "raíz cúbica"),
    "abs":   DefinicionFuncion("abs", m.valor_absoluto, "valor absoluto"),
}

# Nombres alternativos que también se aceptan (en español o notación habitual)
ALIAS_FUNCIONES = {
    "sen": "sin", "tg": "tan", "arcsen": "asin", "arcsin": "asin", "asen": "asin",
    "arccos": "acos", "arctan": "atan", "arctg": "atan", "senh": "sinh",
    "raiz": "sqrt", "log10": "log",
}

CONSTANTES = {
    "pi": m.PI,
    "e": m.E,
}

VARIABLE = "x"


# ==========================================================================
#  1) ANÁLISIS LÉXICO
# ==========================================================================

class Token:
    def __init__(self, tipo, valor, posicion, longitud=1):
        self.tipo = tipo          # NUMERO, IDENT, OP, PAREN_IZQ, PAREN_DER, FIN
        self.valor = valor
        self.posicion = posicion
        self.longitud = longitud

    def __repr__(self):
        return "Token(%s, %r)" % (self.tipo, self.valor)


# Caracteres "lindos" que la gente copia/pega y su equivalente simple
REEMPLAZOS_UNICODE = {
    "−": "-", "–": "-", "·": "*", "×": "*", "÷": "/", "π": "pi",
    "²": "^2", "³": "^3", "√": "sqrt",
}

OPERADORES = "+-*/^"


def _es_digito(c):
    return "0" <= c <= "9"


def _es_letra(c):
    return ("a" <= c <= "z") or ("A" <= c <= "Z") or c == "_"


def _separar_identificador(palabra, posicion):
    """
    Separa una palabra en nombres conocidos para permitir escribir sin '*':
        "xsin" -> ["x", "sin"]      "pix" -> ["pi", "x"]     "xe" -> ["x", "e"]
    Se toma siempre el nombre conocido MÁS LARGO al principio de la palabra.
    """
    conocidos = list(FUNCIONES) + list(ALIAS_FUNCIONES) + list(CONSTANTES) + [VARIABLE]
    partes = []
    i = 0
    while i < len(palabra):
        mejor = None
        for nombre in conocidos:
            if palabra.startswith(nombre, i) and (mejor is None or len(nombre) > len(mejor)):
                mejor = nombre
        if mejor is None:
            raise ErrorSintaxis(
                "No se reconoce '%s'. La función debe depender solo de x; "
                "funciones disponibles: %s" % (palabra[i:], ", ".join(sorted(FUNCIONES))),
                posicion + i, len(palabra) - i)
        partes.append((mejor, posicion + i))
        i += len(mejor)
    return partes


def tokenizar(texto):
    """Convierte el texto en una lista de tokens."""
    for original, reemplazo in REEMPLAZOS_UNICODE.items():
        texto = texto.replace(original, reemplazo)
    texto = texto.replace("**", "^")

    tokens = []
    i = 0
    n = len(texto)
    while i < n:
        c = texto[i]

        if c in " \t\n":
            i += 1
            continue

        # Número: 12   3.5   .5   1e-3   2.5E4
        if _es_digito(c) or (c == "." and i + 1 < n and _es_digito(texto[i + 1])):
            inicio = i
            while i < n and _es_digito(texto[i]):
                i += 1
            if i < n and texto[i] == ".":
                i += 1
                while i < n and _es_digito(texto[i]):
                    i += 1
            # Notación científica solo si después de la 'e' viene un número
            if i < n and texto[i] in "eE":
                j = i + 1
                if j < n and texto[j] in "+-":
                    j += 1
                if j < n and _es_digito(texto[j]):
                    i = j
                    while i < n and _es_digito(texto[i]):
                        i += 1
            literal = texto[inicio:i]
            tokens.append(Token("NUMERO", float(literal), inicio, i - inicio))
            continue

        if _es_letra(c):
            inicio = i
            while i < n and (_es_letra(texto[i]) or _es_digito(texto[i])):
                i += 1
            palabra = texto[inicio:i].lower()
            # "log2" y "log10" llevan dígitos en el nombre; el resto de los
            # dígitos pegados a letras se separan (ej. "x2" no es válido)
            if palabra not in FUNCIONES and palabra not in ALIAS_FUNCIONES:
                fin_letras = inicio
                while fin_letras < i and _es_letra(texto[fin_letras]):
                    fin_letras += 1
                if fin_letras < i:
                    i = fin_letras
                    palabra = texto[inicio:i].lower()
            for nombre, pos in _separar_identificador(palabra, inicio):
                tokens.append(Token("IDENT", nombre, pos, len(nombre)))
            continue

        if c in OPERADORES:
            tokens.append(Token("OP", c, i))
            i += 1
            continue
        if c in "([{":
            tokens.append(Token("PAREN_IZQ", "(", i))
            i += 1
            continue
        if c in ")]}":
            tokens.append(Token("PAREN_DER", ")", i))
            i += 1
            continue
        if c == ",":
            raise ErrorSintaxis("Usá punto para los decimales (ej.: 2.5 en lugar de 2,5)", i)

        raise ErrorSintaxis("Carácter no permitido: '%s'" % c, i)

    tokens.append(Token("FIN", None, n, 0))
    return tokens


# ==========================================================================
#  2) ÁRBOL DE SINTAXIS (nodos)
# ==========================================================================

class Nodo:
    precedencia = 5


class Numero(Nodo):
    def __init__(self, valor):
        self.valor = float(valor)


class Variable(Nodo):
    pass


class Constante(Nodo):
    def __init__(self, nombre):
        self.nombre = nombre
        self.valor = CONSTANTES[nombre]


class Unario(Nodo):
    """Cambio de signo: −u"""
    precedencia = 3

    def __init__(self, hijo):
        self.hijo = hijo


class Binario(Nodo):
    """Operación entre dos subexpresiones: izq (op) der"""
    PRECEDENCIAS = {"+": 1, "-": 1, "*": 2, "/": 2, "^": 4}

    def __init__(self, operador, izquierdo, derecho):
        self.operador = operador
        self.izquierdo = izquierdo
        self.derecho = derecho
        self.precedencia = Binario.PRECEDENCIAS[operador]


class LlamadaFuncion(Nodo):
    """Aplicación de una función: nombre(argumento)"""

    def __init__(self, nombre, argumento):
        self.nombre = nombre
        self.argumento = argumento


# ==========================================================================
#  2) ANÁLISIS SINTÁCTICO — parser descendente recursivo
# ==========================================================================

class Parser:
    """
    Cada regla de la gramática es un método. Un método "consume" los tokens
    que le corresponden y devuelve el subárbol construido.
    """

    def __init__(self, tokens):
        self.tokens = tokens
        self.i = 0

    @property
    def actual(self):
        return self.tokens[self.i]

    def avanzar(self):
        token = self.tokens[self.i]
        self.i += 1
        return token

    def es_operador(self, simbolos):
        return self.actual.tipo == "OP" and self.actual.valor in simbolos

    def analizar(self):
        if self.actual.tipo == "FIN":
            raise ErrorSintaxis("Ingresá una función de x, por ejemplo: x^3 - 4x - 1", 0)
        arbol = self.expresion()
        if self.actual.tipo != "FIN":
            token = self.actual
            if token.tipo == "PAREN_DER":
                raise ErrorSintaxis("Hay un paréntesis ')' que no tiene su '(' correspondiente", token.posicion)
            raise ErrorSintaxis("Símbolo inesperado '%s'" % token.valor, token.posicion, token.longitud)
        return arbol

    # expresion -> termino (('+' | '-') termino)*
    def expresion(self):
        nodo = self.termino()
        while self.es_operador("+-"):
            operador = self.avanzar().valor
            nodo = Binario(operador, nodo, self.termino())
        return nodo

    # termino -> unario (('*' | '/') unario | multiplicación implícita)*
    def termino(self):
        nodo = self.unario()
        while True:
            if self.es_operador("*/"):
                operador = self.avanzar().valor
                nodo = Binario(operador, nodo, self.unario())
            elif self.actual.tipo in ("NUMERO", "IDENT", "PAREN_IZQ"):
                # Multiplicación implícita: 4x, 2(x+1), (x+1)(x-1), x sin(x)
                nodo = Binario("*", nodo, self.potencia())
            else:
                return nodo

    # unario -> ('+' | '-') unario | potencia
    def unario(self):
        if self.es_operador("-"):
            self.avanzar()
            return Unario(self.unario())
        if self.es_operador("+"):
            self.avanzar()
            return self.unario()
        return self.potencia()

    # potencia -> primario ('^' unario)?
    def potencia(self):
        base = self.primario()
        if self.es_operador("^"):
            self.avanzar()
            if self.actual.tipo == "FIN":
                raise ErrorSintaxis("Falta el exponente después de '^'", self.actual.posicion)
            return Binario("^", base, self.unario())
        return base

    def primario(self):
        token = self.actual

        if token.tipo == "NUMERO":
            self.avanzar()
            return Numero(token.valor)

        if token.tipo == "IDENT":
            self.avanzar()
            nombre = ALIAS_FUNCIONES.get(token.valor, token.valor)
            if nombre == VARIABLE:
                return Variable()
            if nombre in CONSTANTES:
                return Constante(nombre)
            # Es una función: exige paréntesis
            if self.actual.tipo != "PAREN_IZQ":
                raise ErrorSintaxis("Después de '%s' se esperaba '('. Ejemplo: %s(x)" % (token.valor, token.valor),
                                    token.posicion, token.longitud)
            self.avanzar()
            if self.actual.tipo == "PAREN_DER":
                raise ErrorSintaxis("La función '%s' necesita un argumento entre paréntesis" % token.valor,
                                    self.actual.posicion)
            argumento = self.expresion()
            self.esperar_cierre(token.posicion + token.longitud)
            return LlamadaFuncion(nombre, argumento)

        if token.tipo == "PAREN_IZQ":
            self.avanzar()
            if self.actual.tipo == "PAREN_DER":
                raise ErrorSintaxis("Paréntesis vacíos '()'", token.posicion, 2)
            interior = self.expresion()
            self.esperar_cierre(token.posicion)
            return interior

        if token.tipo == "FIN":
            raise ErrorSintaxis("La expresión está incompleta: falta un valor al final", token.posicion)
        if token.tipo == "PAREN_DER":
            raise ErrorSintaxis("Se esperaba un valor antes de ')'", token.posicion)
        raise ErrorSintaxis("Se esperaba un número, x o una función, pero se encontró '%s'" % token.valor,
                            token.posicion)

    def esperar_cierre(self, posicion_apertura):
        if self.actual.tipo != "PAREN_DER":
            raise ErrorSintaxis("Falta cerrar un paréntesis ')'", posicion_apertura)
        self.avanzar()


def analizar(texto):
    """Texto -> árbol de sintaxis."""
    if texto is None or not str(texto).strip():
        raise ErrorSintaxis("Ingresá una función de x, por ejemplo: x^3 - 4x - 1", 0)
    return Parser(tokenizar(str(texto))).analizar()


# ==========================================================================
#  3) EVALUACIÓN — el árbol se "compila" a funciones anidadas de Python
# ==========================================================================

def compilar(nodo):
    """
    Devuelve una función g(x) que calcula el valor del subárbol.
    Se recorre el árbol UNA sola vez; después evaluar es muy rápido,
    lo que importa al graficar cientos de puntos.
    """
    if isinstance(nodo, Numero) or isinstance(nodo, Constante):
        valor = nodo.valor
        return lambda x: valor

    if isinstance(nodo, Variable):
        return lambda x: x

    if isinstance(nodo, Unario):
        hijo = compilar(nodo.hijo)
        return lambda x: -hijo(x)

    if isinstance(nodo, LlamadaFuncion):
        calcular = FUNCIONES[nodo.nombre].calcular
        argumento = compilar(nodo.argumento)
        return lambda x: calcular(argumento(x))

    if isinstance(nodo, Binario):
        izq = compilar(nodo.izquierdo)
        der = compilar(nodo.derecho)
        op = nodo.operador
        if op == "+":
            return lambda x: izq(x) + der(x)
        if op == "-":
            return lambda x: izq(x) - der(x)
        if op == "*":
            return lambda x: izq(x) * der(x)
        if op == "/":
            return lambda x: m.dividir(izq(x), der(x))
        if op == "^":
            return lambda x: m.potencia(izq(x), der(x))

    raise ValueError("Nodo desconocido: %r" % nodo)


def contiene_x(nodo):
    """¿El subárbol depende de x?"""
    if isinstance(nodo, Variable):
        return True
    if isinstance(nodo, Unario):
        return contiene_x(nodo.hijo)
    if isinstance(nodo, LlamadaFuncion):
        return contiene_x(nodo.argumento)
    if isinstance(nodo, Binario):
        return contiene_x(nodo.izquierdo) or contiene_x(nodo.derecho)
    return False


# ==========================================================================
#  SIMPLIFICACIÓN algebraica básica
#  (para que la derivada se lea "3x^2 - 4" y no "3*x^2*1 - (0*x + 4*1) - 0")
# ==========================================================================

def _es_numero(nodo, valor=None):
    return isinstance(nodo, Numero) and (valor is None or nodo.valor == valor)


def _negar(nodo):
    if isinstance(nodo, Numero):
        return Numero(-nodo.valor)
    if isinstance(nodo, Unario):
        return nodo.hijo
    if isinstance(nodo, Binario) and nodo.operador == "*" and _es_numero(nodo.izquierdo):
        return simplificar(Binario("*", Numero(-nodo.izquierdo.valor), nodo.derecho))
    return Unario(nodo)


def _es_negativo(nodo):
    """¿El nodo se muestra con un signo menos adelante?"""
    if isinstance(nodo, Numero):
        return nodo.valor < 0
    if isinstance(nodo, Unario):
        return True
    if isinstance(nodo, Binario) and nodo.operador in "*/":
        return _es_negativo(nodo.izquierdo)
    return False


def _separar_coeficiente(nodo):
    """3·x^2 -> (3, x^2)     x -> (1, x)     5 -> (5, None)"""
    if isinstance(nodo, Numero):
        return nodo.valor, None
    if isinstance(nodo, Binario) and nodo.operador == "*" and isinstance(nodo.izquierdo, Numero):
        return nodo.izquierdo.valor, nodo.derecho
    return 1.0, nodo


def simplificar(nodo):
    if isinstance(nodo, Unario):
        return _negar(simplificar(nodo.hijo))

    if isinstance(nodo, LlamadaFuncion):
        argumento = simplificar(nodo.argumento)
        if nodo.nombre == "ln" and isinstance(argumento, Constante) and argumento.nombre == "e":
            return Numero(1)                                      # ln(e) = 1
        if isinstance(argumento, Numero):
            try:
                valor = FUNCIONES[nodo.nombre].calcular(argumento.valor)
                if valor == int(valor):                           # sqrt(4) = 2, ln(1) = 0
                    return Numero(valor)
            except m.ErrorMatematico:
                pass
        return LlamadaFuncion(nodo.nombre, argumento)

    if not isinstance(nodo, Binario):
        return nodo

    a = simplificar(nodo.izquierdo)
    b = simplificar(nodo.derecho)
    op = nodo.operador

    # Operación entre dos números: se calcula directamente
    if isinstance(a, Numero) and isinstance(b, Numero):
        try:
            valor = compilar(Binario(op, a, b))(0.0)
            if m.es_finito(valor) and (valor == int(valor) or op in "+-*"):
                return Numero(valor)
        except m.ErrorMatematico:
            pass

    if op == "+":
        if _es_numero(a, 0):
            return b
        if _es_numero(b, 0):
            return a
        if _es_negativo(b):                       # a + (−b)  ->  a − b
            return Binario("-", a, _negar(b))
        if isinstance(b, Numero) is False and isinstance(a, Numero):
            return Binario("+", b, a)              # 2 + x  ->  x + 2
    elif op == "-":
        if _es_numero(b, 0):
            return a
        if _es_numero(a, 0):
            return _negar(b)
        if _es_negativo(b):                       # a − (−b)  ->  a + b
            return Binario("+", a, _negar(b))
    elif op == "*":
        if _es_numero(a, 0) or _es_numero(b, 0):
            return Numero(0)
        if _es_numero(a, 1):
            return b
        if _es_numero(b, 1):
            return a
        if _es_numero(a, -1):
            return _negar(b)
        if _es_numero(b, -1):
            return _negar(a)
        if isinstance(b, Numero) and not isinstance(a, Numero):
            a, b = b, a                           # x·3  ->  3·x
        if isinstance(a, Unario):                 # (−u)·v  ->  −(u·v)
            return _negar(simplificar(Binario("*", a.hijo, b)))
        if isinstance(b, Unario):
            return _negar(simplificar(Binario("*", a, b.hijo)))
        # Juntar coeficientes:  3·(2·x) -> 6·x     (3·x^2)·(2·cos(x)) -> 6·(x^2·cos(x))
        ca, ra = _separar_coeficiente(a)
        cb, rb = _separar_coeficiente(b)
        if ra is not None and (rb is not None or ca != 1) and (isinstance(a, Binario) or isinstance(b, Binario)):
            if (ca != 1 or cb != 1) and not (isinstance(a, Numero) and ra is None):
                resto = ra if rb is None else (rb if ra is None else simplificar(Binario("*", ra, rb)))
                return simplificar(Binario("*", Numero(ca * cb), resto))
        if isinstance(a, Numero) and isinstance(b, Binario) and b.operador == "*" and isinstance(b.izquierdo, Numero):
            return simplificar(Binario("*", Numero(a.valor * b.izquierdo.valor), b.derecho))
    elif op == "/":
        if _es_numero(a, 0):
            return Numero(0)
        if _es_numero(b, 1):
            return a
        if isinstance(a, Unario):
            return _negar(simplificar(Binario("/", a.hijo, b)))
    elif op == "^":
        if _es_numero(b, 0):
            return Numero(1)
        if _es_numero(b, 1):
            return a
        if _es_numero(a, 1):
            return Numero(1)

    return Binario(op, a, b)


# ==========================================================================
#  DERIVACIÓN SIMBÓLICA
#  (se usa en la comparación con Newton-Raphson, que necesita f'(x))
# ==========================================================================

def derivar(nodo):
    """Devuelve el árbol de la derivada df/dx aplicando las reglas de derivación."""
    return simplificar(_derivar(nodo))


def _derivar(nodo):
    if isinstance(nodo, (Numero, Constante)):
        return Numero(0)                                           # (c)' = 0
    if isinstance(nodo, Variable):
        return Numero(1)                                           # (x)' = 1
    if isinstance(nodo, Unario):
        return Unario(_derivar(nodo.hijo))                         # (−u)' = −u'

    if isinstance(nodo, Binario):
        u, v = nodo.izquierdo, nodo.derecho
        du, dv = _derivar(u), _derivar(v)
        op = nodo.operador
        if op in "+-":
            return Binario(op, du, dv)                             # (u ± v)' = u' ± v'
        if op == "*":
            if not contiene_x(u):
                return Binario("*", u, dv)                         # (c·v)' = c·v'
            if not contiene_x(v):
                return Binario("*", v, du)
            return Binario("+", Binario("*", du, v), Binario("*", u, dv))   # regla del producto
        if op == "/":
            if not contiene_x(v):
                return Binario("/", du, v)
            if not contiene_x(u):
                # (c/v)' = −c·v'/v²
                return Unario(Binario("/", Binario("*", u, dv), Binario("^", v, Numero(2))))
            return Binario("/",                                    # regla del cociente
                           Binario("-", Binario("*", du, v), Binario("*", u, dv)),
                           Binario("^", v, Numero(2)))
        if op == "^":
            if not contiene_x(v):
                # (u^n)' = n·u^(n−1)·u'
                return Binario("*", Binario("*", v, Binario("^", u, Binario("-", v, Numero(1)))), du)
            if isinstance(u, Constante) and u.nombre == "e":
                return Binario("*", nodo, dv)                      # (e^v)' = e^v·v'
            if not contiene_x(u):
                # (a^v)' = a^v·ln(a)·v'
                return Binario("*", Binario("*", nodo, LlamadaFuncion("ln", u)), dv)
            # (u^v)' = u^v · (v'·ln(u) + v·u'/u)
            return Binario("*", nodo, Binario("+", Binario("*", dv, LlamadaFuncion("ln", u)),
                                               Binario("/", Binario("*", v, du), u)))

    if isinstance(nodo, LlamadaFuncion):
        u = nodo.argumento
        du = _derivar(u)
        externa = _derivada_funcion(nodo.nombre, u)
        return Binario("*", externa, du)                           # regla de la cadena

    raise ValueError("Nodo desconocido")


def _derivada_funcion(nombre, u):
    """Derivada de la función externa evaluada en u (sin multiplicar por u')."""
    uno, dos = Numero(1), Numero(2)
    if nombre == "sin":
        return LlamadaFuncion("cos", u)
    if nombre == "cos":
        return Unario(LlamadaFuncion("sin", u))
    if nombre == "tan":
        return Binario("/", uno, Binario("^", LlamadaFuncion("cos", u), dos))
    if nombre == "asin":
        return Binario("/", uno, LlamadaFuncion("sqrt", Binario("-", uno, Binario("^", u, dos))))
    if nombre == "acos":
        return Unario(Binario("/", uno, LlamadaFuncion("sqrt", Binario("-", uno, Binario("^", u, dos)))))
    if nombre == "atan":
        return Binario("/", uno, Binario("+", uno, Binario("^", u, dos)))
    if nombre == "sinh":
        return LlamadaFuncion("cosh", u)
    if nombre == "cosh":
        return LlamadaFuncion("sinh", u)
    if nombre == "tanh":
        return Binario("/", uno, Binario("^", LlamadaFuncion("cosh", u), dos))
    if nombre == "exp":
        return LlamadaFuncion("exp", u)
    if nombre == "ln":
        return Binario("/", uno, u)
    if nombre == "log":
        return Binario("/", uno, Binario("*", u, LlamadaFuncion("ln", Numero(10))))
    if nombre == "log2":
        return Binario("/", uno, Binario("*", u, LlamadaFuncion("ln", Numero(2))))
    if nombre == "sqrt":
        return Binario("/", uno, Binario("*", dos, LlamadaFuncion("sqrt", u)))
    if nombre == "cbrt":
        return Binario("/", uno, Binario("*", Numero(3), Binario("^", LlamadaFuncion("cbrt", u), dos)))
    if nombre == "abs":
        return Binario("/", u, LlamadaFuncion("abs", u))
    raise ValueError("Sin regla de derivación para " + nombre)


# ==========================================================================
#  REPRESENTACIÓN como texto
# ==========================================================================

def formatear_numero(valor):
    """Muestra 3.0 como "3" y 0.1 como "0.1" (sin decimales de más)."""
    if valor == int(valor) and abs(valor) < 1e15:
        return str(int(valor))
    texto = "%.10g" % valor
    return texto


def _signo_afuera(nodo):
    """(−2)·x  se muestra como  −(2·x), es decir "−2x"."""
    if (isinstance(nodo, Binario) and nodo.operador in "*/" and isinstance(nodo.izquierdo, Numero)
            and nodo.izquierdo.valor < 0):
        return Unario(Binario(nodo.operador, Numero(-nodo.izquierdo.valor), nodo.derecho))
    return nodo


def a_texto(nodo, padre=0, lado=None):
    """
    Árbol -> texto que el propio parser puede volver a leer.
    Solo agrega paréntesis cuando la precedencia lo exige.
    """
    nodo = _signo_afuera(nodo)
    if isinstance(nodo, Numero):
        texto = formatear_numero(nodo.valor)
        return "(" + texto + ")" if nodo.valor < 0 and padre > 0 else texto
    if isinstance(nodo, Variable):
        return VARIABLE
    if isinstance(nodo, Constante):
        return nodo.nombre
    if isinstance(nodo, LlamadaFuncion):
        return "%s(%s)" % (nodo.nombre, a_texto(nodo.argumento))
    if isinstance(nodo, Unario):
        # −(a·b) = (−a)·b, así que un producto no necesita paréntesis: −2x
        texto = "-" + a_texto(nodo.hijo, 2)
        return "(" + texto + ")" if padre >= 2 or lado == "der" else texto

    op = nodo.operador
    prec = nodo.precedencia
    if op == "^":
        izq = a_texto(nodo.izquierdo, 5)
        der = a_texto(nodo.derecho, 4)
        texto = izq + "^" + der
    else:
        izq = a_texto(nodo.izquierdo, prec, "izq")
        # Para '-' y '/' el lado derecho necesita paréntesis con igual precedencia
        der = a_texto(nodo.derecho, prec + (1 if op in "-/" else 0), "der")
        if op == "*" and _multiplicacion_implicita(nodo.izquierdo, nodo.derecho):
            texto = izq + der
        elif op == "*":
            texto = izq + "*" + der
        else:
            texto = "%s %s %s" % (izq, op, der) if op in "+-" else izq + op + der
    return "(" + texto + ")" if prec < padre else texto


def _multiplicacion_implicita(izq, der):
    """¿Se puede escribir "4x" en lugar de "4*x"?"""
    if not isinstance(izq, (Numero, Constante)):
        return False
    if isinstance(izq, Numero) and izq.valor < 0:
        return False
    # Se mira el primer factor de la derecha:  4·(x·sin x) -> "4x·sin(x)"
    objetivo = der
    while isinstance(objetivo, Binario) and objetivo.operador in "*^":
        objetivo = objetivo.izquierdo
    return isinstance(objetivo, (Variable, LlamadaFuncion, Constante)) and not (
        isinstance(izq, Constante) and isinstance(objetivo, Constante))


# ==========================================================================
#  REPRESENTACIÓN en HTML (exponentes y fracciones reales en pantalla)
# ==========================================================================

NOMBRES_MOSTRADOS = {"sqrt": "√", "cbrt": "∛"}


def _escapar(texto):
    return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def a_html(nodo, padre=0, lado=None):
    nodo = _signo_afuera(nodo)
    if isinstance(nodo, Numero):
        texto = formatear_numero(nodo.valor).replace("-", "−")
        if "e" in texto:
            mantisa, exponente = texto.split("e")
            texto = '%s·10<sup>%s</sup>' % (mantisa, int(exponente))
        texto = '<span class="m-num">%s</span>' % texto
        return "(" + texto + ")" if nodo.valor < 0 and padre > 0 else texto
    if isinstance(nodo, Variable):
        return '<i class="m-var">x</i>'
    if isinstance(nodo, Constante):
        return '<i class="m-const">%s</i>' % ("π" if nodo.nombre == "pi" else "e")
    if isinstance(nodo, LlamadaFuncion):
        argumento = a_html(nodo.argumento)
        if nodo.nombre in NOMBRES_MOSTRADOS:
            return '<span class="m-raiz">%s<span class="m-radicando">%s</span></span>' % (
                NOMBRES_MOSTRADOS[nodo.nombre], argumento)
        if nodo.nombre == "abs":
            return '|%s|' % argumento
        return '<span class="m-fn">%s</span>(%s)' % (_escapar(nodo.nombre), argumento)
    if isinstance(nodo, Unario):
        texto = "−" + a_html(nodo.hijo, 2)
        return "(" + texto + ")" if padre >= 2 or lado == "der" else texto

    op = nodo.operador
    prec = nodo.precedencia
    if op == "^":
        base = a_html(nodo.izquierdo, 5)
        exponente = a_html(nodo.derecho, 0)      # en superíndice no hacen falta paréntesis
        texto = '%s<sup>%s</sup>' % (base, exponente)
    elif op == "/":
        texto = '<span class="m-frac"><span class="m-num-frac">%s</span><span class="m-den">%s</span></span>' % (
            a_html(nodo.izquierdo), a_html(nodo.derecho))
        prec = 5
    else:
        izq = a_html(nodo.izquierdo, prec, "izq")
        der = a_html(nodo.derecho, prec + (1 if op == "-" else 0), "der")
        if op == "*":
            separador = "" if _multiplicacion_implicita(nodo.izquierdo, nodo.derecho) else "·"
            texto = izq + separador + der
        else:
            texto = "%s %s %s" % (izq, "−" if op == "-" else "+", der)
    return "(" + texto + ")" if prec < padre else texto


# ==========================================================================
#  Interfaz de alto nivel
# ==========================================================================

class Expresion:
    """
    Función f(x) lista para usar:

        f = Expresion("x^3 - 4x - 1")
        f(2)            -> 7.0
        f.texto         -> "x^3 - 4x - 1"
        f.derivada()    -> Expresion de 3x^2 - 4
    """

    def __init__(self, fuente):
        if isinstance(fuente, Nodo):
            self.arbol = fuente
            self.original = a_texto(fuente)
        else:
            self.original = str(fuente)
            self.arbol = analizar(fuente)
        self._calcular = compilar(self.arbol)

    def __call__(self, x):
        valor = self._calcular(float(x))
        if valor != valor:
            raise m.ErrorDominio("f(x) no está definida en x = %g" % x)
        if not m.es_finito(valor):
            raise m.ErrorDesbordamiento("f(%g) es demasiado grande para representarse" % x)
        return valor

    def evaluar_seguro(self, x):
        """Igual que f(x) pero devuelve None si no está definida (útil para graficar)."""
        try:
            return self(x)
        except m.ErrorMatematico:
            return None

    @property
    def texto(self):
        return a_texto(self.arbol)

    @property
    def html(self):
        return a_html(self.arbol)

    def derivada(self):
        return Expresion(derivar(self.arbol))

    def __repr__(self):
        return "Expresion(%r)" % self.texto
