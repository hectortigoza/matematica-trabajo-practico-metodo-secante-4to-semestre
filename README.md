# Sistema de Cálculo Numérico — Método de la Secante

Trabajo Práctico Grupal de **Matemática IV (Cálculo Numérico)**, Análisis de Sistemas.

Sistema para encontrar raíces de ecuaciones no lineales **f(x) = 0** con el **método de la secante**. Muestra cada iteración animada paso a paso, analiza la convergencia y compara con otros métodos.
Toda la matemática está implementada **desde cero en Python**, sin `math`, `numpy`, `sympy` ni `eval()`.

![Pantalla principal](docs/capturas/02-resultado.png)

## Cómo ejecutarlo

| Opción | Cómo |
|---|---|
| **Ejecutable (Windows)** | Doble clic en `ejecutable/MetodoSecante.exe`. No requiere instalar nada ni conexión a internet. |
| **Desde el código** | `python app.py` (Python 3.10 o superior, sin dependencias externas). |
| **Generar el ejecutable** | `python -m pip install pyinstaller` y luego `python construir_exe.py` → `dist/MetodoSecante.exe` |
| **Pruebas** | `python -m unittest discover -s tests -t .` (40 pruebas) |

Se abre el navegador con la interfaz. Para cerrar el programa, usá el botón **Salir** o cerrá la ventana de la consola.

## Qué incluye

- **Método de la secante** con tres criterios de parada (error absoluto, error relativo % y |f(x)|), máximo de iteraciones y detección de división por cero, divergencia y salida del dominio.
- **Paso a paso animado**: cada iteración en 5 subpasos, con la fórmula sustituida con los valores reales.
- **Análisis de convergencia**: error en escala logarítmica, orden estimado (≈ φ = 1.618), cifras significativas (Scarborough) y conclusiones automáticas.
- **Comparación automática** con Newton-Raphson (derivada simbólica propia), falsa posición y bisección.
- **Teorema de Bolzano**, buscador de intervalos con cambio de signo y detección de asíntotas.
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
