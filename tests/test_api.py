"""Pruebas de la regla del sistema: solo se resuelve si hay cambio de signo entre x₀ y x₁."""
import unittest
from unittest import mock

from aplicacion import api


def datos(funcion, x0, x1):
    return {"funcion": funcion, "x0": x0, "x1": x1, "tolerancia": "0.0001", "criterio": "absoluto"}


@mock.patch("aplicacion.historial.agregar")      # las pruebas no tocan el historial real
class TestCambioDeSigno(unittest.TestCase):

    def test_con_cambio_de_signo_se_resuelve(self, _):
        r = api.resolver(datos("x^3 - 4x - 1", "2", "3"))
        self.assertTrue(r["ok"])
        self.assertNotIn("sin_cambio_de_signo", r)
        self.assertAlmostEqual(r["resultado"]["raiz"], 2.1149075, places=5)

    def test_sin_cambio_de_signo_no_se_resuelve(self, _):
        # f(1) = −4 y f(2) = −1: mismo signo
        r = api.resolver(datos("x^3 - 4x - 1", "1", "2"))
        self.assertTrue(r["sin_cambio_de_signo"])
        self.assertEqual(r["producto"], 4)
        self.assertNotIn("resultado", r)

    def test_asintota_no_cuenta_como_cambio_de_signo(self, _):
        # 1/x cambia de signo en [−1, 2] por la asíntota en x = 0, no por una raíz
        self.assertTrue(api.resolver(datos("1/x", "-1", "2"))["sin_cambio_de_signo"])

    def test_valor_inicial_que_es_raiz(self, _):
        r = api.resolver(datos("x^2 - 4", "2", "3"))
        self.assertEqual(r["resultado"]["estado"], "raiz_exacta")

    def test_no_se_exporta_sin_cambio_de_signo(self, _):
        r = api.exportar_resultado({**datos("x^3 - 4x - 1", "1", "2"), "formato": "csv"})
        self.assertFalse(r["ok"])


if __name__ == "__main__":
    unittest.main()
