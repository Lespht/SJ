// Avisos push (NOS-37): textos y reglas de cuándo avisar. Sin nada de PocketBase, para poder
// testearlo (avisos/src/reglas-pb.test.ts). Lo usa avisos.pb.js con require().

const MINUTO = 60 * 1000;

function corto(texto, largo) {
  const limpio = String(texto || "").trim();
  return limpio.length > largo ? limpio.slice(0, largo - 1) + "…" : limpio;
}

/** Arma el aviso sin `cuerpo` si viene vacío. */
function aviso(titulo, cuerpo, url) {
  return cuerpo ? { titulo: titulo, cuerpo: cuerpo, url: url } : { titulo: titulo, url: url };
}

function urlPost(post) {
  return "/post/" + post.id;
}

function avisoMensaje(nombre, texto) {
  return aviso(nombre, corto(texto, 100), "/mensajes");
}

function avisoPostNuevo(nombre, post) {
  if (post.tipo === "plan") {
    const que = post.hecho ? " compartió un plan hecho" : " propuso un plan";
    return aviso(nombre + que, "«" + post.titulo + "»", urlPost(post));
  }
  if (post.respuesta_a) return aviso(nombre + " respondió a tu momento", "", urlPost(post));
  return aviso(nombre + " compartió un momento", corto(post.texto, 100), urlPost(post));
}

function avisoPlanHecho(post) {
  return aviso("«" + post.titulo + "» quedó hecho", "", urlPost(post));
}

function avisoFotos(nombre, post) {
  const donde = post.tipo === "plan" ? "«" + post.titulo + "»" : "un momento";
  return aviso(nombre + " sumó fotos a " + donde, "", urlPost(post));
}

function avisoRecordatorio(post) {
  return aviso("Hoy: «" + post.titulo + "»", post.hora ? "A las " + post.hora : "", urlPost(post));
}

function seCompleto(antes, ahora) {
  return !antes && !!ahora;
}

/**
 * Fotos nuevas: si el post se creó hace menos de 5 min ya avisó el post; si no, un aviso por post y
 * persona cada 30 min (cada foto se sube por separado). `ultimo` = ms del último aviso, 0 si no hubo.
 */
function avisarFotos(postCreadoMs, ultimo, ahora) {
  if (ahora - postCreadoMs < 5 * MINUTO) return false;
  return !ultimo || ahora - ultimo >= 30 * MINUTO;
}

/** "AAAA-MM-DD" del día en El Salvador (UTC−6 todo el año). */
function diaElSalvador(ahoraMs) {
  return new Date(ahoraMs - 6 * 60 * MINUTO).toISOString().slice(0, 10);
}

module.exports = {
  avisoMensaje: avisoMensaje,
  avisoPostNuevo: avisoPostNuevo,
  avisoPlanHecho: avisoPlanHecho,
  avisoFotos: avisoFotos,
  avisoRecordatorio: avisoRecordatorio,
  seCompleto: seCompleto,
  avisarFotos: avisarFotos,
  diaElSalvador: diaElSalvador,
};
