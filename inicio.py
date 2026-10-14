# ==========================================================================
#  inicio.py — El archivo que se ejecuta al inicio
#
#  1. Prende un servidor web en la propia computadora.
#  2. Abre el navegador con la página (carpeta web/).
#  3. Cuando en la página se toca "Resolver", la página le manda los datos
#     a este archivo, y acá se llama a los métodos de metodos.py.
#
#  Para ejecutarlo:   python inicio.py
# ==========================================================================

import json
import os
import sys
import threading
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler

import metodos

PUERTO = 8765

# Carpeta donde está la página web (si es el .exe, PyInstaller la guarda en otra carpeta)
if getattr(sys, "frozen", False):
    CARPETA_WEB = os.path.join(sys._MEIPASS, "web")
else:
    CARPETA_WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")


class Servidor(SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        # Los archivos de la página se buscan en la carpeta web/
        super().__init__(*args, directory=CARPETA_WEB, **kwargs)

    def log_message(self, formato, *args):
        pass    # no mostrar cada pedido en la consola

    def end_headers(self):
        # Que el navegador no guarde versiones viejas de la página
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        # La página manda los datos en formato JSON
        largo = int(self.headers.get("Content-Length", 0))
        datos = json.loads(self.rfile.read(largo) or "{}")

        if self.path == "/api/resolver":
            # Se llama al método principal con lo que escribió el usuario
            respuesta = metodos.resolver_secante(
                datos.get("funcion", ""),
                datos.get("a", ""),
                datos.get("b", ""),
                datos.get("error", ""),
            )
        elif self.path == "/api/salir":
            respuesta = {"ok": True}
            threading.Thread(target=servidor.shutdown).start()
        else:
            respuesta = {"ok": False, "errores": [{"mensaje": "Pedido desconocido"}]}

        # Se devuelve la respuesta a la página, también en JSON
        texto = json.dumps(respuesta).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(texto)))
        self.end_headers()
        self.wfile.write(texto)


def buscar_puerto_libre():
    # Si el puerto 8765 está ocupado, se prueba con el siguiente.
    # (En Windows, sin esta línea Python podría "compartir" un puerto ocupado)
    HTTPServer.allow_reuse_address = False
    puerto = PUERTO
    while puerto < PUERTO + 20:
        try:
            return HTTPServer(("127.0.0.1", puerto), Servidor)
        except OSError:
            puerto = puerto + 1
    raise OSError("No hay puertos libres")


servidor = buscar_puerto_libre()

if __name__ == "__main__":
    direccion = "http://127.0.0.1:" + str(servidor.server_address[1]) + "/"
    print("Método de la Secante")
    print("Abrí en el navegador: " + direccion)
    print("Para salir: botón Salir de la página, o cerrá esta ventana.")

    if "--sin-navegador" not in sys.argv:
        webbrowser.open(direccion)

    servidor.serve_forever()
