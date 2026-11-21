/// <reference path="../pb_data/types.d.ts" />

// Las descartadas (NOS-43): un momento se puede guardar dentro de un plan ya hecho, como "las que
// salieron chistosas". Sigue siendo un momento (con su respuesta, que viaja con él), pero sale del
// feed y aparece en una fila aparte debajo del plan.
//   - Solo el autor del momento lo guarda o lo saca, y solo en un plan HECHO.
//   - Una respuesta no se guarda sola: va con su original.
//   - Si se borra el plan, sus descartadas no se borran: vuelven a ser momentos sueltos.

const DESCARTADA_CREAR = " && @request.body.descartada_en:isset = false";
const DESCARTADA_EDITAR =
  " && (@request.body.descartada_en:isset = false || (tipo = 'momento' && autor = @request.auth.id && (" +
  "@request.body.descartada_en = '' || (respuesta_a = '' && " +
  "@request.body.descartada_en.tipo = 'plan' && @request.body.descartada_en.hecho = true))))";

migrate(
  (app) => {
    const posts = app.findCollectionByNameOrId("posts");
    posts.fields.add(new RelationField({
      name: "descartada_en",
      collectionId: posts.id,
      maxSelect: 1,
      cascadeDelete: false,
      required: false,
    }));
    posts.createRule += DESCARTADA_CREAR;
    posts.updateRule += DESCARTADA_EDITAR;
    app.save(posts);
  },
  (app) => {
    const posts = app.findCollectionByNameOrId("posts");
    posts.createRule = posts.createRule.replace(DESCARTADA_CREAR, "");
    posts.updateRule = posts.updateRule.replace(DESCARTADA_EDITAR, "");
    posts.fields.removeByName("descartada_en");
    app.save(posts);
  },
);
