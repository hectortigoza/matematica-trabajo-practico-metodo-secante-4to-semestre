"""
Pruebas de las funciones matemáticas propias.

El módulo `math` de Python se usa SOLO acá, como referencia para verificar
que nuestras implementaciones dan el mismo resultado.
"""
import math
import unittest

from nucleo import matematica as m


def cerca(a, b, rel=1e-13, abs_=1e-15):
    return abs(a - b) <= max(rel * abs(b), abs_)


class TestMatematica(unittest.TestCase):

    def muestras(self, desde, hasta, n=400):
        paso = (hasta - desde) / n
        return [desde + i * paso for i in range(n + 1)]

    def comparar(self, propia, referencia, valores, rel=1e-13, abs_=1e-15):
        for v in valores:
            obtenido, esperado = propia(v), referencia(v)
            self.assertTrue(cerca(obtenido, esperado, rel, abs_),
                            "%s(%r) = %r, esperado %r" % (propia.__name__, v, obtenido, esperado))

    def test_exp(self):
        self.comparar(m.exp, math.exp, self.muestras(-700, 700))
        self.comparar(m.exp, math.exp, self.muestras(-1, 1))
        self.assertEqual(m.exp(0), 1.0)

    def test_ln(self):
        self.comparar(m.ln, math.log, self.muestras(1e-6, 50))
        self.comparar(m.ln, math.log, [1e-300, 1e-10, 0.5, 2, 1e10, 1e300])
        self.assertEqual(m.ln(1), 0.0)
        with self.assertRaises(m.ErrorDominio):
            m.ln(0)
        with self.assertRaises(m.ErrorDominio):
            m.ln(-3)

    def test_raices(self):
        self.comparar(m.raiz_cuadrada, math.sqrt, self.muestras(0, 1000) + [1e-300, 1e300, 2, 0.5])
        self.assertEqual(m.raiz_cuadrada(16), 4.0)
        self.assertTrue(cerca(m.raiz_cuadrada(2), math.sqrt(2), rel=1e-15))
        with self.assertRaises(m.ErrorDominio):
            m.raiz_cuadrada(-1)
        self.assertTrue(cerca(m.raiz_cubica(-27), -3.0))
        self.assertTrue(cerca(m.raiz_cubica(10), 10 ** (1 / 3)))

    def test_trigonometricas(self):
        valores = self.muestras(-100, 100, 2000)
        self.comparar(m.seno, math.sin, valores, rel=1e-12, abs_=1e-14)
        self.comparar(m.coseno, math.cos, valores, rel=1e-12, abs_=1e-14)
        self.comparar(m.tangente, math.tan, self.muestras(-1.5, 1.5), rel=1e-12, abs_=1e-14)

    def test_inversas(self):
        self.comparar(m.arcotangente, math.atan, self.muestras(-50, 50), rel=1e-14)
        self.comparar(m.arcoseno, math.asin, self.muestras(-1, 1), rel=1e-13)
        self.comparar(m.arcocoseno, math.acos, self.muestras(-1, 1), rel=1e-13)
        with self.assertRaises(m.ErrorDominio):
            m.arcoseno(1.5)

    def test_hiperbolicas(self):
        valores = self.muestras(-20, 20)
        self.comparar(m.seno_hiperbolico, math.sinh, valores, rel=1e-13)
        self.comparar(m.coseno_hiperbolico, math.cosh, valores, rel=1e-13)
        self.comparar(m.tangente_hiperbolica, math.tanh, valores, rel=1e-13)

    def test_potencia(self):
        self.assertEqual(m.potencia(2, 10), 1024.0)
        self.assertEqual(m.potencia(-2, 3), -8.0)
        self.assertEqual(m.potencia(2, -2), 0.25)
        self.assertTrue(cerca(m.potencia(2, 0.5), math.sqrt(2)))
        self.assertTrue(cerca(m.potencia(10, 2.5), 10 ** 2.5, rel=1e-13))
        with self.assertRaises(m.ErrorDominio):
            m.potencia(-8, 1 / 3)
        with self.assertRaises(m.ErrorDivisionCero):
            m.potencia(0, -1)
        with self.assertRaises(m.ErrorDesbordamiento):
            m.exp(1000)


if __name__ == "__main__":
    unittest.main()
