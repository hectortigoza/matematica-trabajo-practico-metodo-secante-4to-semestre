"""
servidor.py — Servidor web local (solo biblioteca estándar de Python).

  GET  /                 -> la interfaz (archivos de la carpeta web/)
  POST /api/<ruta>       -> llama a la función correspondiente de api.py

El servidor escucha solo en 127.0.0.1: no es accesible desde otras computadoras.
"""

import json
import mimetypes
import os
import socket
import sys
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from aplicacion import api


def carpeta_recursos():
    """Carpeta base: la del proyecto, o la temporal si corre como ejecutable (PyInstaller)."""
    if getattr(sys, "frozen", False):
        return sys._MEIPASS
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


CARPETA_WEB = os.path.join(carpeta_recursos(), "web")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("font/woff2", ".woff2")


class Manejador(BaseHTTPRequestHandler):
    servidor_principal = None

    def log_message(self, formato, *args):       # silencia el log de cada pedido
        pass

    def _enviar(self, codigo, cuerpo, tipo):
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(cuerpo)

    def _json(self, datos, codigo=200):
        self._enviar(codigo, json.dumps(datos, ensure_ascii=False, allow_nan=False).encode("utf-8"),
                     "application/json; charset=utf-8")

    def do_GET(self):
        ruta = self.path.split("?")[0]
        if ruta == "/":
            ruta = "/index.html"
        archivo = os.path.normpath(os.path.join(CARPETA_WEB, ruta.lstrip("/")))
        # Evita que se pidan archivos fuera de la carpeta web (../../)
        if not archivo.startswith(os.path.normpath(CARPETA_WEB)) or not os.path.isfile(archivo):
            self._enviar(404, b"No encontrado", "text/plain; charset=utf-8")
            return
        tipo = mimetypes.guess_type(archivo)[0] or "application/octet-stream"
        if tipo.startswith("text/") or tipo.endswith("javascript"):
            tipo += "; charset=utf-8"
        with open(archivo, "rb") as contenido:
            self._enviar(200, contenido.read(), tipo)

    def do_POST(self):
        ruta = self.path.split("?")[0]
        if not ruta.startswith("/api/"):
            self._json({"ok": False, "errores": [{"mensaje": "Ruta desconocida"}]}, 404)
            return
        nombre = ruta[len("/api/"):]

        if nombre == "salir":
            self._json({"ok": True})
            threading.Thread(target=self.servidor_principal.shutdown, daemon=True).start()
            return

        funcion = api.RUTAS.get(nombre)
        if funcion is None:
            self._json({"ok": False, "errores": [{"mensaje": "Ruta desconocida: %s" % nombre}]}, 404)
            return
        try:
            largo = int(self.headers.get("Content-Length") or 0)
            datos = json.loads(self.rfile.read(largo).decode("utf-8") or "{}") if largo else {}
            self._json(funcion(datos))
        except Exception:
            # Último recurso: el sistema nunca se cae, informa el problema
            traceback.print_exc()
            self._json({"ok": False, "errores": [{"mensaje": "Ocurrió un error inesperado al procesar "
                                                             "los datos. Revisá los valores ingresados."}]})


def puerto_libre(preferido=8765):
    for puerto in range(preferido, preferido + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", puerto))
                return puerto
            except OSError:
                continue
    return 0


def crear_servidor(puerto=None):
    servidor = ThreadingHTTPServer(("127.0.0.1", puerto or puerto_libre()), Manejador)
    Manejador.servidor_principal = servidor
    return servidor
