"""Pruebas del intérprete de funciones (tokenizador, parser, evaluación y derivadas)."""
import math
import unittest

from nucleo.expresiones import Expresion, ErrorSintaxis
from nucleo.matematica import ErrorMatematico


class TestEvaluacion(unittest.TestCase):

    def assertCerca(self, a, b, tol=1e-12):
        self.assertTrue(abs(a - b) <= tol * max(1, abs(b)), "%r != %r" % (a, b))

    def test_precedencia(self):
        self.assertEqual(Expresion("2 + 3 * 4")(0), 14)
        self.assertEqual(Expresion("2^3^2")(0), 512)          # asociativa a derecha
        self.assertEqual(Expresion("-2^2")(0), -4)            # el signo va después de la potencia
        self.assertEqual(Expresion("(-2)^2")(0), 4)
        self.assertEqual(Expresion("10 - 4 - 3")(0), 3)       # asociativa a izquierda
        self.assertEqual(Expresion("12 / 3 / 2")(0), 2)

    def test_multiplicacion_implicita(self):
        self.assertEqual(Expresion("4x")(2), 8)
        self.assertEqual(Expresion("2(x+1)")(3), 8)
        self.assertEqual(Expresion("(x+1)(x-1)")(3), 8)
        self.assertEqual(Expresion("3x^2")(2), 12)
        self.assertCerca(Expresion("2pi")(0), 2 * math.pi)

    def test_funciones_y_constantes(self):
        x = 0.7
        self.assertCerca(Expresion("sin(x) + cos(x)")(x), math.sin(x) + math.cos(x))
        self.assertCerca(Expresion("e^x")(x), math.exp(x))
        self.assertCerca(Expresion("exp(x) - ln(x)")(x), math.exp(x) - math.log(x))
        self.assertCerca(Expresion("sqrt(x) * log(x)")(x), math.sqrt(x) * math.log10(x))
        self.assertCerca(Expresion("sen(x)")(x), math.sin(x))            # alias en español
        self.assertCerca(Expresion("x³ − 2·x")(x), x ** 3 - 2 * x)        # símbolos unicode
        self.assertCerca(Expresion("x**2")(x), x * x)

    def test_notacion_cientifica(self):
        self.assertEqual(Expresion("1e-3")(0), 0.001)
        self.assertEqual(Expresion("2.5E2")(0), 250)
        self.assertCerca(Expresion("2e")(0), 2 * math.e)                 # 2·e, no notación

    def test_errores_de_dominio(self):
        with self.assertRaises(ErrorMatematico):
            Expresion("ln(x)")(-1)
        with self.assertRaises(ErrorMatematico):
            Expresion("1/x")(0)
        self.assertIsNone(Expresion("sqrt(x)").evaluar_seguro(-4))

    def test_errores_de_sintaxis(self):
        for texto in ["", "   ", "x^", "sin x", "2,5x", "y + 1", "(x+1", "x+1)", "x $ 2", "()", "3 +", "*x"]:
            with self.assertRaises(ErrorSintaxis, msg=texto):
                Expresion(texto)

    def test_posicion_del_error(self):
        try:
            Expresion("x + y")
        except ErrorSintaxis as e:
            self.assertEqual(e.posicion, 4)


class TestDerivadas(unittest.TestCase):

    def test_formas_simplificadas(self):
        casos = {
            "x^3 - 4x - 1": "3x^2 - 4",
            "cos(x) - x": "-sin(x) - 1",
            "e^-x - x": "-e^(-x) - 1",
            "x^2": "2x",
            "5": "0",
            "2^x": "2^x*ln(2)",
        }
        for funcion, esperado in casos.items():
            self.assertEqual(Expresion(funcion).derivada().texto, esperado, funcion)

    def test_derivada_numericamente(self):
        """La derivada simbólica debe coincidir con el cociente incremental."""
        funciones = ["x^3 - 4x - 1", "x*e^x", "sin(x)^2", "ln(x)/x", "sqrt(x^2+1)", "x^x",
                     "tan(x)", "atan(2x)", "3x^2*sin(2x)", "log(x) - 1/x", "cosh(x)/x"]
        h = 1e-6
        for texto in funciones:
            f = Expresion(texto)
            df = f.derivada()
            for x in [0.5, 1.1, 1.7]:
                aproximada = (f(x + h) - f(x - h)) / (2 * h)
                self.assertAlmostEqual(df(x), aproximada, places=5, msg=texto)

    def test_texto_se_puede_volver_a_leer(self):
        for texto in ["x^3 - 4x - 1", "e^(-x) - x", "-x^2 + 3", "sin(x)/(x + 1)", "2^(x - 1)"]:
            f = Expresion(texto)
            self.assertEqual(Expresion(f.texto).texto, f.texto)


if __name__ == "__main__":
    unittest.main()
