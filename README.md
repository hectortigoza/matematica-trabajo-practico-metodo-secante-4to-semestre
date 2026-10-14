# Sistema de Cálculo Numérico — Método de la Secante

Trabajo Práctico Grupal de **Matemática IV (Cálculo Numérico)**, Análisis de Sistemas.

Encuentra raíces de ecuaciones f(x) = 0 con el **método de la secante**.

![Pantalla principal](docs/capturas/02-resultado.png)

## Cómo ejecutarlo

| Opción | Cómo |
|---|---|
| **Ejecutable (Windows)** | Doble clic en `ejecutable/MetodoSecante.exe`. No hace falta instalar nada. |
| **Desde el código** | `python inicio.py` (Python 3.10 o superior, sin dependencias). |
| **Pruebas** | `python -m unittest discover -s tests -t .` |
| **Generar el ejecutable** | `python -m pip install pyinstaller` y luego `python construir_exe.py` |

## Cómo está hecho

```
inicio.py      Se ejecuta al inicio: prende el servidor, abre la página y llama a los métodos
metodos.py     Todos los métodos, escritos paso a paso (estilo PSeInt)
web/           La página: tabla, paso a paso, animación, gráficos, comparación, historial
tests/         Pruebas de metodos.py
docs/          Documentación técnica y guía del código
```

**El método (en `metodos.py`):**

1. **Cambio de signo:** acheck = f(a) > 0, bcheck = f(b) > 0. Si son iguales, no hay cambio de signo y no se resuelve.
2. **Fórmula:** x<sub>k+1</sub> = (a·f(b) − b·f(a)) / (f(b) − f(a)), con k empezando en 0.
3. **Test de parada:** si |f(x<sub>k+1</sub>)| < error, x<sub>k+1</sub> es la raíz. Si no, a ← b, b ← x<sub>k+1</sub> y se repite.

## Documentación

- [Guía del código](docs/GUIA_DEL_CODIGO.md): explicación simple de `inicio.py` y `metodos.py`, y preguntas para la defensa.
- [Documentación técnica](docs/DOCUMENTACION_TECNICA.md): fundamento matemático, diseño, validaciones y casos de prueba (base del informe).
