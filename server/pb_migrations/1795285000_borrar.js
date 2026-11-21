/// <reference path="../pb_data/types.d.ts" />

// Borrar (NOS-39): cada uno borra lo suyo sin tener que archivarlo antes.
//   - Un momento: su autor, con o sin fotos (las fotos y sus notas se van en cascada).
//   - Un plan: solo quien lo creó, y solo si no tiene fotos del otro (aunque esté archivado),
//     para que nadie borre los recuerdos del otro. El otro primero saca las suyas.
// Antes: solo el autor, y solo si estaba archivado o no tenía fotos.

const ES_AUTOR = "@request.auth.id != '' && autor = @request.auth.id";
const ANTERIOR = `${ES_AUTOR} && (archivado = true || fotos_via_post.id = '')`;

migrate(
  (app) => {
    const posts = app.findCollectionByNameOrId("posts");
    // "todas sus fotos son mías" no se cumple sin fotos (no hay con qué comparar): va aparte.
    posts.deleteRule =
      `${ES_AUTOR} && (tipo = 'momento' || fotos_via_post.id = '' || ` +
      `fotos_via_post.autor = @request.auth.id)`;
    app.save(posts);
  },
  (app) => {
    const posts = app.findCollectionByNameOrId("posts");
    posts.deleteRule = ANTERIOR;
    app.save(posts);
  },
);
