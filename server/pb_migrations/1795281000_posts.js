/// <reference path="../pb_data/types.d.ts" />

// Todo lo que se comparte pasa a ser un "post":
//   - momento: "mirá esto", una o más fotos y un texto opcional.
//   - plan: una idea (título, detalle, categoría) que, al hacerse, se completa con fotos.
// Cada foto apunta a su post (fotos.post). Las notas siguen siendo por foto.
//
// Borrar un post con fotos = archivarlo (desaparece del feed, se puede restaurar).
// Solo se borra de verdad si no tiene fotos o si ya está archivado.
//
// Migración de datos: COPIA, no mueve. Cada idea → un plan con el mismo id; cada foto →
// un momento propio. La colección `ideas` no se toca: volver atrás no pierde nada.

const LOGUEADO = "@request.auth.id != ''";
const ES_AUTOR = "@request.auth.id != '' && autor = @request.auth.id";
const CREA_COMO_SI_MISMO = "@request.auth.id != '' && @request.body.autor = @request.auth.id";
const SIN_CAMBIAR_AUTOR = "@request.body.autor:isset = false";

// Cualquiera de los dos puede archivar o restaurar; el contenido de un momento solo lo
// edita su autor; un plan lo editan los dos (como las ideas hasta ahora).
const SOLO_ARCHIVO = [
  "@request.body.titulo:isset = false",
  "@request.body.texto:isset = false",
  "@request.body.categoria:isset = false",
  "@request.body.hecho:isset = false",
  "@request.body.fecha:isset = false",
].join(" && ");

// `created` es autodate: al guardar se pisa con "ahora". Se restaura el original para no
// perder el orden en que se crearon las ideas y fotos.
function conservarCreated(app, id, created) {
  app
    .db()
    .newQuery("UPDATE posts SET created = {:created} WHERE id = {:id}")
    .bind({ created: String(created), id })
    .execute();
}

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const fotos = app.findCollectionByNameOrId("fotos");

    const posts = new Collection({
      type: "base",
      name: "posts",
      listRule: LOGUEADO,
      viewRule: LOGUEADO,
      createRule: CREA_COMO_SI_MISMO,
      updateRule:
        `${LOGUEADO} && ${SIN_CAMBIAR_AUTOR} && @request.body.tipo:isset = false && ` +
        `(autor = @request.auth.id || tipo = 'plan' || (${SOLO_ARCHIVO}))`,
      deleteRule: null, // se asigna abajo, cuando ya existe fotos.post
      fields: [
        { name: "tipo", type: "select", required: true, maxSelect: 1, values: ["momento", "plan"] },
        { name: "titulo", type: "text", max: 200 },
        { name: "texto", type: "text", max: 2000 },
        {
          name: "categoria",
          type: "select",
          maxSelect: 1,
          values: ["cita", "viaje", "regalo", "comida", "otro"],
        },
        { name: "hecho", type: "bool" },
        { name: "fecha", type: "date" }, // cuándo pasó; vacío en un plan pendiente
        { name: "archivado", type: "bool" },
        { name: "archivado_en", type: "date" },
        {
          name: "autor",
          type: "relation",
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX idx_posts_feed ON posts (archivado, fecha)",
      ],
    });
    app.save(posts);

    // Si se borra un post (solo posible archivado o sin fotos), sus fotos se van con él.
    fotos.fields.add(
      new RelationField({
        name: "post",
        collectionId: posts.id,
        maxSelect: 1,
        cascadeDelete: true,
        required: false, // las fotos nuevas siempre lo llevan; se vuelve obligatorio al limpiar `ideas`
      }),
    );
    app.save(fotos);

    // Borrar de verdad: solo el autor, y solo si está archivado o no tiene fotos.
    posts.deleteRule = `${ES_AUTOR} && (archivado = true || fotos_via_post.id = '')`;
    app.save(posts);

    // ---- Copia de datos ----
    for (const idea of app.findAllRecords("ideas")) {
      const plan = new Record(posts);
      plan.set("id", idea.id);
      plan.set("tipo", "plan");
      plan.set("titulo", idea.get("titulo"));
      plan.set("texto", idea.get("detalle"));
      plan.set("categoria", idea.get("categoria"));
      plan.set("hecho", idea.get("hecha"));
      plan.set("fecha", idea.get("hecha") ? idea.get("updated") : "");
      plan.set("autor", idea.get("autor"));
      app.save(plan);
      conservarCreated(app, plan.id, idea.get("created"));
    }

    for (const foto of app.findAllRecords("fotos")) {
      const momento = new Record(posts);
      momento.set("tipo", "momento");
      momento.set("texto", foto.get("descripcion"));
      momento.set("fecha", foto.get("fecha") || foto.get("created"));
      momento.set("autor", foto.get("autor"));
      app.save(momento);
      conservarCreated(app, momento.id, foto.get("created"));

      foto.set("post", momento.id);
      app.save(foto);
    }
  },
  (app) => {
    const fotos = app.findCollectionByNameOrId("fotos");
    fotos.fields.removeByName("post");
    app.save(fotos);
    app.delete(app.findCollectionByNameOrId("posts"));
  },
);
