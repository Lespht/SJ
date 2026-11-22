// Avisos push (NOS-37): busca las suscripciones y le pide al servicio de avisos (avisos/) que entregue.
// Un aviso nunca hace fallar lo que lo disparó: los errores solo van al log.
//   AVISOS_SECRETO  clave compartida con el servicio (sin ella, no se avisa nada)
//   AVISOS_URL      default http://127.0.0.1:8091

function nombreDe(usuario) {
  return (usuario && usuario.getString("name")) || "Alguien";
}

/** Manda el aviso a todos los usuarios menos `excluir` ("" = a todos). */
function avisar(excluir, aviso) {
  const secreto = $os.getenv("AVISOS_SECRETO");
  if (!secreto) return;
  try {
    const suscripciones = $app
      .findRecordsByFilter("suscripciones", "usuario != {:excluir}", "", 0, 0, { excluir: excluir })
      .map((s) => ({ endpoint: s.getString("endpoint"), p256dh: s.getString("p256dh"), auth: s.getString("auth") }));
    if (!suscripciones.length) return;
    const r = $http.send({
      url: ($os.getenv("AVISOS_URL") || "http://127.0.0.1:8091") + "/enviar",
      method: "POST",
      body: JSON.stringify({ suscripciones: suscripciones, aviso: aviso }),
      headers: { "content-type": "application/json", "x-avisos-clave": secreto },
      timeout: 3,
    });
    if (r.statusCode !== 202) $app.logger().warn("El servicio de avisos respondió " + r.statusCode);
  } catch (error) {
    $app.logger().warn("No se pudo pedir el aviso", "error", String(error));
  }
}

function idDe(usuario) {
  return usuario ? usuario.id : "";
}

/** Corre `fn` sin dejar que un error llegue a quien hizo el pedido (lo suyo ya se guardó). */
function seguro(fn) {
  try {
    fn();
  } catch (error) {
    $app.logger().warn("Falló un aviso", "error", String(error));
  }
}

module.exports = { nombreDe: nombreDe, idDe: idDe, avisar: avisar, seguro: seguro };
