/// <reference path="../pb_data/types.d.ts" />

// Avisos push (NOS-37): cada acción le avisa al otro (nunca a quien la hizo), y a las 9:00 de El
// Salvador llega el recordatorio de los planes del día. Cada handler corre aislado: los require()
// van adentro. Textos y reglas: avisos_reglas.js; envío: avisos_envio.js. Todo lo que pasa después
// de e.next() va en seguro(): lo que el usuario hizo ya se guardó y un aviso no lo hace fallar.

onRecordCreateRequest((e) => {
  e.next();
  const r = require(`${__hooks}/avisos_reglas.js`);
  const { avisar, idDe, nombreDe, seguro } = require(`${__hooks}/avisos_envio.js`);
  seguro(() => avisar(idDe(e.auth), r.avisoMensaje(nombreDe(e.auth), e.record.getString("texto"))));
}, "mensajes");

onRecordCreateRequest((e) => {
  e.next();
  const r = require(`${__hooks}/avisos_reglas.js`);
  const { avisar, idDe, nombreDe, seguro } = require(`${__hooks}/avisos_envio.js`);
  seguro(() => {
    const post = e.record;
    avisar(
      idDe(e.auth),
      r.avisoPostNuevo(nombreDe(e.auth), {
        id: post.id,
        tipo: post.getString("tipo"),
        titulo: post.getString("titulo"),
        texto: post.getString("texto"),
        hecho: post.getBool("hecho"),
        respuesta_a: post.getString("respuesta_a"),
      }),
    );
  });
}, "posts");

onRecordUpdateRequest((e) => {
  const antes = e.record.original().getBool("hecho");
  e.next();
  const r = require(`${__hooks}/avisos_reglas.js`);
  const { avisar, idDe, seguro } = require(`${__hooks}/avisos_envio.js`);
  seguro(() => {
    const post = e.record;
    if (post.getString("tipo") !== "plan" || !r.seCompleto(antes, post.getBool("hecho"))) return;
    avisar(idDe(e.auth), r.avisoPlanHecho({ id: post.id, titulo: post.getString("titulo") }));
  });
}, "posts");

onRecordCreateRequest((e) => {
  e.next();
  const r = require(`${__hooks}/avisos_reglas.js`);
  const { avisar, idDe, nombreDe, seguro } = require(`${__hooks}/avisos_envio.js`);
  seguro(() => {
    const autor = idDe(e.auth);
    const post = $app.findRecordById("posts", e.record.getString("post"));
    const clave = "avisos:fotos:" + post.id + ":" + autor;
    const ahora = Date.now();
    const creado = post.getDateTime("created").unix() * 1000;
    if (!r.avisarFotos(creado, $app.store().get(clave) || 0, ahora)) return;
    $app.store().set(clave, ahora);
    avisar(
      autor,
      r.avisoFotos(nombreDe(e.auth), {
        id: post.id,
        tipo: post.getString("tipo"),
        titulo: post.getString("titulo"),
      }),
    );
  });
}, "fotos");

// 15:00 UTC = 9:00 en El Salvador. El cron de PocketBase corre en UTC.
cronAdd("avisos-recordatorio", "0 15 * * *", () => {
  const r = require(`${__hooks}/avisos_reglas.js`);
  const { avisar, seguro } = require(`${__hooks}/avisos_envio.js`);
  seguro(() => {
    const dia = r.diaElSalvador(Date.now());
    const planes = $app.findRecordsByFilter(
      "posts",
      "tipo = 'plan' && hecho = false && archivado = false && fecha >= {:desde} && fecha <= {:hasta}",
      "hora",
      0,
      0,
      { desde: dia + " 00:00:00.000Z", hasta: dia + " 23:59:59.999Z" },
    );
    for (const plan of planes) {
      avisar(
        "",
        r.avisoRecordatorio({ id: plan.id, titulo: plan.getString("titulo"), hora: plan.getString("hora") }),
      );
    }
  });
});

// El servicio de avisos informa los celulares que ya no existen (404/410) para borrar su suscripción.
routerAdd("POST", "/api/avisos/vencidas", (e) => {
  const secreto = $os.getenv("AVISOS_SECRETO");
  if (!secreto || !$security.equal(e.request.header.get("X-Avisos-Clave"), secreto)) {
    return e.json(401, {});
  }
  const endpoints = e.requestInfo().body.endpoints;
  if (!Array.isArray(endpoints)) return e.json(400, {});
  for (const endpoint of endpoints) {
    const vencidas = $app.findRecordsByFilter("suscripciones", "endpoint = {:endpoint}", "", 0, 0, {
      endpoint: String(endpoint),
    });
    for (const s of vencidas) $app.delete(s);
  }
  return e.json(200, {});
});
