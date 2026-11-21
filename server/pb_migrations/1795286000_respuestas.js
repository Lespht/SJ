/// <reference path="../pb_data/types.d.ts" />

const RESPUESTA_CREAR =
  " && (@request.body.respuesta_a:isset = false || @request.body.respuesta_a = '' || (" +
  "@request.body.tipo = 'momento' && @request.body.respuesta_a.tipo = 'momento' && " +
  "@request.body.respuesta_a.autor != @request.auth.id && @request.body.respuesta_a.respuesta_a = ''))";
const RESPUESTA_INMUTABLE = " && @request.body.respuesta_a:isset = false";

migrate(
  (app) => {
    const posts = app.findCollectionByNameOrId("posts");
    posts.fields.add(new RelationField({
      name: "respuesta_a",
      collectionId: posts.id,
      maxSelect: 1,
      cascadeDelete: false,
      required: false,
    }));
    posts.addIndex("idx_posts_respuesta", true, "respuesta_a", "respuesta_a != ''");
    posts.createRule += RESPUESTA_CREAR;
    posts.updateRule += RESPUESTA_INMUTABLE;
    app.save(posts);
  },
  (app) => {
    const posts = app.findCollectionByNameOrId("posts");
    posts.createRule = posts.createRule.replace(RESPUESTA_CREAR, "");
    posts.updateRule = posts.updateRule.replace(RESPUESTA_INMUTABLE, "");
    posts.removeIndex("idx_posts_respuesta");
    posts.fields.removeByName("respuesta_a");
    app.save(posts);
  },
);
