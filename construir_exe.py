"""
construir_exe.py — Genera el ejecutable MetodoSecante.exe con PyInstaller.

    python -m pip install pyinstaller
    python construir_exe.py

El resultado queda en dist/MetodoSecante.exe: un solo archivo que incluye
Python, el código y la interfaz web. No hace falta instalar nada para usarlo.
"""

import os
import shutil
import subprocess
import sys

RAIZ = os.path.dirname(os.path.abspath(__file__))
SEPARADOR = ";" if os.name == "nt" else ":"


def main():
    comando = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--console",                       # la ventana muestra la dirección y permite cerrar el programa
        "--name", "MetodoSecante",
        "--add-data", "web%sweb" % SEPARADOR,
        "--exclude-module", "tkinter",
        "--exclude-module", "unittest",
        "--exclude-module", "pydoc",
        "inicio.py",
    ]
    print("Ejecutando:", " ".join(comando))
    subprocess.run(comando, cwd=RAIZ, check=True)

    # Limpieza de archivos intermedios
    shutil.rmtree(os.path.join(RAIZ, "build"), ignore_errors=True)
    spec = os.path.join(RAIZ, "MetodoSecante.spec")
    if os.path.exists(spec):
        os.remove(spec)

    print("\nListo: dist/MetodoSecante.exe")


if __name__ == "__main__":
    main()
