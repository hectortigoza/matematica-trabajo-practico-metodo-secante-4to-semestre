# Sistema de Cálculo Numérico — Método de la Secante

Trabajo Práctico Grupal de **Matemática IV (Cálculo Numérico)**, Análisis de Sistemas.

Sistema para encontrar raíces de ecuaciones no lineales **f(x) = 0** con el **método de la secante**. Muestra la resolución de la tabla paso a paso, analiza la convergencia y compara con otros métodos.
Toda la matemática está implementada **desde cero en Python**, sin `math`, `numpy`, `sympy` ni `eval()`.

![Pantalla principal](docs/capturas/02-resultado.png)

## Cómo ejecutarlo

| Opción | Cómo |
|---|---|
| **Ejecutable (Windows)** | Doble clic en `ejecutable/MetodoSecante.exe`. No requiere instalar nada ni conexión a internet. |
| **Desde el código** | `python app.py` (Python 3.10 o superior, sin dependencias externas). |
| **Generar el ejecutable** | `python -m pip install pyinstaller` y luego `python construir_exe.py` → `dist/MetodoSecante.exe` |
| **Pruebas** | `python -m unittest discover -s tests -t .` (42 pruebas) |

Se abre el navegador con la interfaz. Para cerrar el programa, usá el botón **Salir** o cerrá la ventana de la consola.

## Qué incluye

**Página de inicio:** se cargan la ecuación, los valores iniciales y el error. Al resolver se verifica si **hay cambio de signo** entre x₀ y x₁ (f(x₀)·f(x₁) < 0, teorema de Bolzano) y aparecen la **tabla** (a la izquierda) y la **comparativa del error** (a la derecha), donde se elige el criterio de parada.

- **Método de la secante** que itera hasta alcanzar el error pedido, con tres criterios de parada elegibles desde la cabecera del cuadro del error (|xₙ₊₁ − xₙ|, relativo % y |f(xₙ₊₁)|), y detección de división por cero, divergencia y salida del dominio.
- **Paso a paso de la tabla**: arranca con los valores iniciales y, celda por celda, muestra la fórmula, el reemplazo y el resultado de f(xₙ₋₁), f(xₙ), xₙ₊₁ y del error, y la comparación con el error pedido. Las celdas que se usan se pintan de colores.
- **Animación** del método sobre la gráfica: la recta secante, su corte con el eje x y el error de cada iteración.
- **Análisis de convergencia**: error en escala logarítmica, orden estimado (≈ φ = 1.618), cifras significativas (Scarborough) y conclusiones automáticas.
- **Comparación automática** con Newton-Raphson (derivada simbólica propia), falsa posición y bisección.
- **Teorema de Bolzano** y detección de asíntotas en el análisis y en el informe.
- **Validación** campo por campo, con el error de la función subrayado en el lugar exacto.
- **Exportación** a informe HTML/PDF (con gráfico), Excel (CSV) y texto. **Historial** de ejercicios.
- Modo claro (papel milimetrado) y oscuro (cianotipo), adaptable a celular, funciona sin internet.

## Estructura

```
nucleo/        Lógica matemática: matematica, expresiones, secante, validacion, analisis, comparacion
aplicacion/    API, servidor local, historial y exportación
web/           Interfaz (HTML, CSS, JavaScript)
tests/         Pruebas automáticas
docs/          Documentación técnica, guía del código y capturas
```

## Documentación

- [Documentación técnica](docs/DOCUMENTACION_TECNICA.md): fundamento matemático, algoritmo, diseño, validaciones, casos de prueba y extensiones (base del informe).
- [Guía del código](docs/GUIA_DEL_CODIGO.md): explicación de toda la lógica, archivo por archivo, y preguntas para la defensa.
