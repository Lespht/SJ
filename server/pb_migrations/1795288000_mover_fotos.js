/// <reference path="../pb_data/types.d.ts" />

// Mover fotos (NOS-44): el autor de una foto puede pasarla a otro post, pero solo a un plan (aportar
// al plan, juntar salidas partidas) o a un post propio. Antes podía meterla en un momento del otro.

const SOLO_PLAN_O_PROPIO =
  " && (@request.body.post:isset = false || @request.body.post.tipo = 'plan' || " +
  "@request.body.post.autor = @request.auth.id)";

migrate(
  (app) => {
    const fotos = app.findCollectionByNameOrId("fotos");
    fotos.updateRule += SOLO_PLAN_O_PROPIO;
    app.save(fotos);
  },
  (app) => {
    const fotos = app.findCollectionByNameOrId("fotos");
    fotos.updateRule = fotos.updateRule.replace(SOLO_PLAN_O_PROPIO, "");
    app.save(fotos);
  },
);
