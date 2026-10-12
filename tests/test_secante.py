"""Pruebas del método de la secante, la validación, el análisis y la comparación."""
import math
import unittest

from nucleo.expresiones import Expresion
from nucleo import secante as sec
from nucleo import analisis
from nucleo.comparacion import comparar_metodos
from nucleo.validacion import validar_problema, ErrorValidacion


def resolver(funcion, x0, x1, tol=1e-6, max_it=50, criterio="absoluto"):
    return sec.metodo_secante(Expresion(funcion), x0, x1, tol, max_it, criterio)


class TestSecante(unittest.TestCase):

    def test_ejemplo_del_enunciado(self):
        # f(x) = x³ − 4x − 1 en [1, 2], tolerancia 0.0001
        r = resolver("x^3 - 4x - 1", 1, 2, 1e-4)
        self.assertEqual(r.estado, sec.CONVERGIO)
        self.assertAlmostEqual(r.raiz, 2.1149075414767, places=6)
        self.assertLess(r.error_absoluto, 1e-4)

    def test_primera_iteracion_a_mano(self):
        # f(1) = −4, f(2) = −1  ->  x₂ = 2 − (−1)(2 − 1)/(−1 − (−4)) = 2 + 1/3
        r = resolver("x^3 - 4x - 1", 1, 2, 1e-4)
        primera = r.iteraciones[0]
        self.assertEqual(primera.f_anterior, -4)
        self.assertEqual(primera.f_actual, -1)
        self.assertAlmostEqual(primera.x_siguiente, 2 + 1 / 3, places=14)
        self.assertAlmostEqual(primera.pendiente, 3, places=14)

    def test_raices_conocidas(self):
        casos = [
            ("x^2 - 2", 1, 2, math.sqrt(2)),
            ("cos(x) - x", 0, 1, 0.7390851332151607),
            ("e^(-x) - x", 0, 1, 0.5671432904097838),
            ("ln(x) + x", 0.5, 1, 0.5671432904097838),
            ("x^3 - x - 2", 1, 2, 1.5213797068045676),
        ]
        for f, x0, x1, raiz in casos:
            r = resolver(f, x0, x1, 1e-12)
            self.assertTrue(r.exitoso, f)
            self.assertAlmostEqual(r.raiz, raiz, places=10, msg=f)

    def test_criterios_de_parada(self):
        for criterio, tol in [("absoluto", 1e-8), ("relativo", 1e-6), ("residuo", 1e-10)]:
            r = resolver("x^2 - 2", 1, 2, tol, 50, criterio)
            self.assertEqual(r.estado, sec.CONVERGIO, criterio)
            self.assertAlmostEqual(r.raiz, math.sqrt(2), places=7)

    def test_raiz_exacta_inicial(self):
        r = resolver("x^2 - 4", 2, 3)
        self.assertEqual(r.estado, sec.RAIZ_EXACTA)
        self.assertEqual(r.raiz, 2)

    def test_division_por_cero(self):
        # f(−1) = f(1): la secante es horizontal
        r = resolver("x^2 - 4", -1, 1)
        self.assertEqual(r.estado, sec.DIVISION_CERO)
        self.assertFalse(r.exitoso)

    def test_fuera_de_dominio(self):
        r = resolver("ln(x)", -1, 2)
        self.assertEqual(r.estado, sec.FUERA_DOMINIO)

    def test_sin_raiz_no_converge(self):
        r = resolver("x^2 + 1", 1, 2, 1e-8, 30)
        self.assertFalse(r.exitoso)
        self.assertIn(r.estado, (sec.MAX_ITERACIONES, sec.DIVERGENCIA, sec.DIVISION_CERO))

    def test_maximo_iteraciones(self):
        r = resolver("x^3 - 4x - 1", 1, 2, 1e-14, 2)
        self.assertEqual(r.estado, sec.MAX_ITERACIONES)
        self.assertEqual(len(r.iteraciones), 2)

    def test_errores_calculados(self):
        r = resolver("x^2 - 2", 1, 2)
        for it in r.iteraciones:
            self.assertAlmostEqual(it.error_absoluto, abs(it.x_siguiente - it.x_actual), places=15)
            self.assertAlmostEqual(it.error_relativo, abs(it.error_absoluto / it.x_siguiente) * 100, places=12)


class TestAnalisis(unittest.TestCase):

    def test_orden_de_convergencia_es_aureo(self):
        r = resolver("x^3 - 4x - 1", 1, 2, 1e-14)
        orden = analisis.orden_representativo(analisis.orden_convergencia(r.iteraciones))
        self.assertAlmostEqual(orden, analisis.PHI, delta=0.25)

    def test_bolzano(self):
        f = Expresion("x^3 - 4x - 1")
        self.assertTrue(analisis.verificar_intervalo(f, 2, 3)["cumple"])
        self.assertFalse(analisis.verificar_intervalo(f, 1, 2)["cumple"])

    def test_busqueda_de_intervalos(self):
        f = Expresion("x^3 - 4x - 1")
        intervalos = analisis.buscar_intervalos(f, -3, 3, 60)
        self.assertEqual(len(intervalos), 3)                 # tres raíces reales

    def test_asintota_no_es_raiz(self):
        f = Expresion("1/x")
        intervalos = analisis.buscar_intervalos(f, -1.05, 1, 20)
        self.assertTrue(all(i["asintota"] for i in intervalos))

    def test_cifras_significativas(self):
        self.assertEqual(analisis.cifras_significativas(0.004), 4)


class TestValidacion(unittest.TestCase):

    def datos(self, **cambios):
        base = {"funcion": "x^3 - 4x - 1", "x0": "1", "x1": "2", "tolerancia": "0.0001",
                "max_iteraciones": "50", "criterio": "absoluto"}
        base.update(cambios)
        return base

    def campos_con_error(self, **cambios):
        try:
            validar_problema(self.datos(**cambios))
        except ErrorValidacion as e:
            return {err["campo"] for err in e.errores}
        return set()

    def test_datos_correctos(self):
        p = validar_problema(self.datos(x0="pi/4", tolerancia="1e-6"))
        self.assertAlmostEqual(p.x0, math.pi / 4)

    def test_coma_decimal(self):
        self.assertEqual(validar_problema(self.datos(tolerancia="0,001")).tolerancia, 0.001)

    def test_errores(self):
        self.assertEqual(self.campos_con_error(funcion=""), {"funcion"})
        self.assertEqual(self.campos_con_error(funcion="5"), {"funcion"})
        self.assertEqual(self.campos_con_error(x0="abc"), {"x0"})
        self.assertEqual(self.campos_con_error(x0=""), {"x0"})
        self.assertEqual(self.campos_con_error(x1="1"), {"x1"})
        self.assertEqual(self.campos_con_error(tolerancia="-1"), {"tolerancia"})
        self.assertEqual(self.campos_con_error(tolerancia="0"), {"tolerancia"})
        self.assertEqual(self.campos_con_error(max_iteraciones="2.5"), {"max_iteraciones"})
        self.assertEqual(self.campos_con_error(max_iteraciones="0"), {"max_iteraciones"})
        self.assertEqual(self.campos_con_error(x0="2x"), {"x0"})
        # Varios errores a la vez
        self.assertEqual(self.campos_con_error(x0="?", tolerancia="no"), {"x0", "tolerancia"})


class TestComparacion(unittest.TestCase):

    def test_todos_llegan_a_la_misma_raiz(self):
        p = validar_problema({"funcion": "x^3 - 4x - 1", "x0": "2", "x1": "3", "tolerancia": "1e-8",
                              "max_iteraciones": "100", "criterio": "absoluto"})
        resumen = comparar_metodos(p)
        for r in resumen["metodos"]:
            self.assertTrue(r["exitoso"], r["metodo"])
            self.assertAlmostEqual(r["raiz"], 2.1149075414767, places=6)
        iteraciones = {r["metodo"]: len(r["iteraciones"]) for r in resumen["metodos"]}
        self.assertLess(iteraciones["Secante"], iteraciones["Bisección"])

    def test_cerrados_no_aplicables_sin_cambio_de_signo(self):
        p = validar_problema({"funcion": "x^3 - 4x - 1", "x0": "1", "x1": "2", "tolerancia": "1e-8",
                              "max_iteraciones": "100", "criterio": "absoluto"})
        metodos = {r["metodo"]: r for r in comparar_metodos(p)["metodos"]}
        self.assertFalse(metodos["Bisección"]["aplicable"])
        self.assertTrue(metodos["Secante"]["exitoso"])


if __name__ == "__main__":
    unittest.main()
