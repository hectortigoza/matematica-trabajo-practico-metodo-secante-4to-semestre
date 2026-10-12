"""
Sistema de Cálculo Numérico — Método de la Secante
Matemática IV · Análisis de Sistemas

Punto de entrada: levanta el servidor local y abre la interfaz en el navegador.

    python app.py              (abre el navegador automáticamente)
    python app.py --sin-navegador
"""

import sys
import threading
import webbrowser

from aplicacion.servidor import crear_servidor


def main():
    # La consola de Windows no siempre usa UTF-8: se evita que un acento la rompa
    for flujo in (sys.stdout, sys.stderr):
        if flujo is not None and hasattr(flujo, "reconfigure"):
            flujo.reconfigure(encoding="utf-8", errors="replace")

    servidor = crear_servidor()
    direccion = "http://127.0.0.1:%d/" % servidor.server_address[1]

    print("=" * 60)
    print("  Método de la Secante — Sistema de Cálculo Numérico")
    print("=" * 60)
    print("  Interfaz disponible en: %s" % direccion)
    print("  Para salir: botón 'Salir' de la interfaz o cerrá esta ventana.")
    print("=" * 60)

    if "--sin-navegador" not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(direccion)).start()

    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        servidor.server_close()
        print("Servidor detenido. ¡Hasta luego!")


if __name__ == "__main__":
    main()
