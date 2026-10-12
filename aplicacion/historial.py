"""
historial.py — Guarda los ejercicios resueltos en un archivo JSON.

El archivo vive en la carpeta del usuario (~/.metodo_secante/historial.json),
así funciona igual desde el código fuente o desde el ejecutable.
"""

import json
import os
import threading
import time

CARPETA = os.path.join(os.path.expanduser("~"), ".metodo_secante")
ARCHIVO = os.path.join(CARPETA, "historial.json")
MAXIMO_ENTRADAS = 100

_candado = threading.Lock()      # el servidor atiende pedidos en paralelo


def _leer():
    try:
        with open(ARCHIVO, "r", encoding="utf-8") as archivo:
            datos = json.load(archivo)
            return datos if isinstance(datos, list) else []
    except (OSError, ValueError):
        return []


def _escribir(entradas):
    os.makedirs(CARPETA, exist_ok=True)
    temporal = ARCHIVO + ".tmp"
    with open(temporal, "w", encoding="utf-8") as archivo:
        json.dump(entradas, archivo, ensure_ascii=False, indent=1)
    os.replace(temporal, ARCHIVO)      # reemplazo atómico: nunca queda un archivo a medias


def listar():
    with _candado:
        return _leer()


def agregar(problema, resultado):
    """Guarda un problema resuelto. Si ya existía el mismo problema, lo sube al principio."""
    entrada = {
        "id": "%d" % int(time.time() * 1000),
        "fecha": time.strftime("%Y-%m-%d %H:%M"),
        "funcion": problema["funcion"],
        "x0": problema["x0"],
        "x1": problema["x1"],
        "tolerancia": problema["tolerancia"],
        "max_iteraciones": problema["max_iteraciones"],
        "criterio": problema["criterio"],
        "raiz": resultado.get("raiz"),
        "iteraciones": resultado.get("cantidad_iteraciones"),
        "estado": resultado.get("estado"),
        "exitoso": resultado.get("exitoso"),
    }
    clave = ("funcion", "x0", "x1", "tolerancia", "max_iteraciones", "criterio")
    with _candado:
        entradas = [e for e in _leer() if any(str(e.get(c)) != str(entrada[c]) for c in clave)]
        entradas.insert(0, entrada)
        _escribir(entradas[:MAXIMO_ENTRADAS])
    return entrada


def borrar(identificador):
    with _candado:
        entradas = [e for e in _leer() if e.get("id") != identificador]
        _escribir(entradas)
        return entradas


def vaciar():
    with _candado:
        _escribir([])
