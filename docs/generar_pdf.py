"""
generar_pdf.py — Convierte la documentación Markdown a PDF (herramienta de documentación).

    python -m pip install markdown
    python docs/generar_pdf.py

Usa Google Chrome en modo "headless" para imprimir. Los diagramas Mermaid se
dibujan con mermaid.js (necesita internet solo al generar el PDF).
"""

import os
import re
import subprocess
import sys

import markdown

CARPETA = os.path.dirname(os.path.abspath(__file__))
DOCUMENTOS = ["DOCUMENTACION_TECNICA.md", "GUIA_DEL_CODIGO.md"]
CHROME = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
]

ESTILO = """
@page { size: A4; margin: 18mm 16mm; }
body { font-family: Georgia, 'Cambria', serif; color: #1d2420; font-size: 10.5pt; line-height: 1.55; }
h1 { font-size: 21pt; color: #1c3f6e; border-bottom: 3px double #1c3f6e; padding-bottom: 6px; }
h2 { font-size: 15pt; color: #1c3f6e; margin-top: 26px; border-bottom: 1px solid #c9ddd3; padding-bottom: 3px; page-break-after: avoid; }
h3 { font-size: 12pt; color: #1c3f6e; page-break-after: avoid; }
code { font-family: Consolas, 'Cascadia Mono', monospace; font-size: 9pt; background: #eef5f1; padding: 1px 4px; border-radius: 3px; }
pre { background: #f5f9f6; border: 1px solid #c9ddd3; border-left: 3px solid #1c3f6e; padding: 10px 12px; border-radius: 4px;
      font-size: 8.6pt; line-height: 1.45; overflow: hidden; white-space: pre-wrap; page-break-inside: avoid; }
pre code { background: none; padding: 0; }
pre.mermaid { background: #fff; border: 0; text-align: center; white-space: pre; }
pre.mermaid svg { max-height: 235mm; max-width: 100%; height: auto; }
table { border-collapse: collapse; width: 100%; font-size: 9pt; margin: 10px 0; page-break-inside: auto; }
th, td { border: 1px solid #c9ddd3; padding: 4px 7px; vertical-align: top; }
th { background: #eef5f1; color: #1c3f6e; }
tr { page-break-inside: avoid; }
img { max-width: 100%; border: 1px solid #c9ddd3; border-radius: 4px; margin: 8px 0; page-break-inside: avoid; }
blockquote { margin: 10px 0; padding: 6px 14px; border-left: 3px solid #c8323c; background: #fbf3f3; color: #3a2a2a; }
a { color: #1c3f6e; }
hr { border: 0; border-top: 1px dashed #c9ddd3; margin: 20px 0; }
.portada { text-align: center; page-break-after: always; padding-top: 18mm; }
.portada p { margin: 0 0 6px; }
.portada-institucion { font-size: 17pt; font-weight: bold; color: #1c3f6e; line-height: 1.35; }
.portada-carrera { font-size: 13pt; margin-top: 6px !important; }
.portada-asignatura { font-size: 13pt; font-weight: bold; margin-bottom: 30mm !important; }
.portada-tipo { font-size: 11pt; text-transform: uppercase; letter-spacing: 1px; color: #4a5a52; }
.portada-titulo { font-size: 24pt; font-weight: bold; color: #1c3f6e; line-height: 1.25; margin: 6px 0 10px !important; }
.portada-grupo { font-size: 12pt; margin-bottom: 26mm !important; }
.portada-etiqueta { font-size: 10pt; text-transform: uppercase; letter-spacing: 1px; color: #4a5a52; margin-top: 10px !important; }
.portada-integrantes, .portada-docente { font-size: 12pt; line-height: 1.5; }
.portada-fecha { font-size: 11pt; margin-top: 22mm !important; }
"""


def convertir(nombre):
    with open(os.path.join(CARPETA, nombre), encoding="utf-8") as archivo:
        texto = archivo.read()

    # Los bloques ```mermaid se convierten en <pre class="mermaid"> para que mermaid.js los dibuje
    diagramas = []

    def guardar(coincidencia):
        diagramas.append(coincidencia.group(1))
        return "\n\nMERMAID_%d\n\n" % (len(diagramas) - 1)

    texto = re.sub(r"```mermaid\n(.*?)```", guardar, texto, flags=re.S)
    html = markdown.markdown(texto, extensions=["tables", "fenced_code", "toc"])
    for i, codigo in enumerate(diagramas):
        html = html.replace("<p>MERMAID_%d</p>" % i, '<pre class="mermaid">%s</pre>' % codigo)

    titulo = re.search(r"^# (.+)$", texto, flags=re.M).group(1)
    pagina = """<!doctype html><html lang="es"><head><meta charset="utf-8"><title>%s</title><style>%s</style>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
<script>mermaid.initialize({startOnLoad: true, theme: "neutral", flowchart: {useMaxWidth: true}});</script>
</head><body>%s</body></html>""" % (titulo, ESTILO, html)

    ruta_html = os.path.join(CARPETA, "_" + nombre.replace(".md", ".html"))
    with open(ruta_html, "w", encoding="utf-8") as archivo:
        archivo.write(pagina)

    navegador = next((c for c in CHROME if os.path.exists(c)), None)
    if navegador is None:
        sys.exit("No se encontró Chrome ni Edge para generar el PDF.")
    ruta_pdf = os.path.join(CARPETA, nombre.replace(".md", ".pdf"))
    subprocess.run([navegador, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                    "--virtual-time-budget=15000", "--run-all-compositor-stages-before-draw",
                    "--print-to-pdf=" + ruta_pdf, "file:///" + ruta_html.replace("\\", "/")],
                   check=True, capture_output=True)
    if "--conservar-html" not in sys.argv:
        os.remove(ruta_html)
    print("Generado:", ruta_pdf)


if __name__ == "__main__":
    for documento in DOCUMENTOS:
        convertir(documento)
