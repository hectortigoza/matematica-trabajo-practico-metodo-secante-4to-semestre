# Pruebas de metodos.py
# Para ejecutarlas:   python -m unittest discover -s tests -t .

import unittest

import metodos


class PruebasMetodos(unittest.TestCase):

    def test_preparar_funcion(self):
        self.assertEqual(metodos.preparar_funcion("x^3 - 4x - 1"), "x**3-4*x-1")
        self.assertEqual(metodos.preparar_funcion("2(x+1)"), "2*(x+1)")
        self.assertEqual(metodos.preparar_funcion("(x+1)(x-1)"), "(x+1)*(x-1)")

    def test_evaluar(self):
        funcion = metodos.preparar_funcion("x^3 - 4x - 1")
        self.assertEqual(metodos.evaluar(funcion, 2), -1)
        self.assertEqual(metodos.evaluar(funcion, 3), 14)

    def test_cambio_de_signo(self):
        self.assertTrue(metodos.hay_cambio_de_signo(-1, 14))      # acheck falso, bcheck verdadero
        self.assertFalse(metodos.hay_cambio_de_signo(-4, -1))     # los dos negativos
        self.assertFalse(metodos.hay_cambio_de_signo(3, 5))       # los dos positivos

    def test_formula_a_mano(self):
        # a = 2, b = 3, f(a) = -1, f(b) = 14  ->  x = (2·14 - 3·(-1)) / (14 - (-1)) = 31/15
        self.assertAlmostEqual(metodos.calcular_x_siguiente(2, 3, -1, 14), 31 / 15)

    def test_ejemplo_completo(self):
        r = metodos.resolver_secante("x^3 - 4x - 1", "2", "3", "0.0001")
        self.assertTrue(r["cambio_de_signo"])
        self.assertTrue(r["encontrada"])
        self.assertEqual(r["tabla"][0]["k"], 0)                  # k empieza en 0
        self.assertAlmostEqual(r["raiz"], 2.11490754, places=4)
        self.assertLess(abs(r["tabla"][-1]["fx"]), 0.0001)       # test de parada

    def test_siguiente_iteracion_corre_los_valores(self):
        r = metodos.resolver_secante("x^3 - 4x - 1", "2", "3", "0.0001")
        fila0, fila1 = r["tabla"][0], r["tabla"][1]
        self.assertEqual(fila1["a"], fila0["b"])                 # a toma el valor de b
        self.assertEqual(fila1["b"], fila0["x"])                 # b toma el valor de x(k+1)

    def test_sin_cambio_de_signo_no_resuelve(self):
        r = metodos.resolver_secante("x^3 - 4x - 1", "1", "2", "0.0001")
        self.assertFalse(r["cambio_de_signo"])
        self.assertEqual(r["tabla"], [])

    def test_otras_funciones(self):
        self.assertAlmostEqual(metodos.resolver_secante("cos(x) - x", "0", "1", "1e-8")["raiz"], 0.7390851332, places=6)
        self.assertAlmostEqual(metodos.resolver_secante("x^2 - 2", "1", "2", "1e-10")["raiz"], 2 ** 0.5, places=8)

    def test_validaciones(self):
        self.assertFalse(metodos.resolver_secante("", "1", "2", "0.1")["ok"])          # falta la función
        self.assertFalse(metodos.resolver_secante("x + y", "1", "2", "0.1")["ok"])     # mal escrita
        self.assertFalse(metodos.resolver_secante("x^2-2", "abc", "2", "0.1")["ok"])   # a no es número
        self.assertFalse(metodos.resolver_secante("x^2-2", "1", "1", "0.1")["ok"])     # a = b
        self.assertFalse(metodos.resolver_secante("x^2-2", "1", "2", "-1")["ok"])      # error negativo
        self.assertFalse(metodos.resolver_secante("ln(x)", "-1", "2", "0.1")["ok"])    # fuera del dominio

    def test_advertencia_asintota(self):
        # 1/x cambia de signo en [-1, 2] por la asíntota en x = 0, no por una raíz
        r = metodos.resolver_secante("1/x", "-1", "2", "0.0001")
        self.assertNotEqual(r["advertencia"], "")


if __name__ == "__main__":
    unittest.main()
