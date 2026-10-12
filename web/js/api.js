// api.js — Comunicación con el servidor Python.

export async function llamar(ruta, datos = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`/api/${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
  } catch (e) {
    return {
      ok: false,
      errores: [{ mensaje: "No se pudo conectar con el servidor. ¿Se cerró la ventana del programa?" }],
    };
  }
  try {
    return await respuesta.json();
  } catch (e) {
    return { ok: false, errores: [{ mensaje: "El servidor devolvió una respuesta inválida." }] };
  }
}
