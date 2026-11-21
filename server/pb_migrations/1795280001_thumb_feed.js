/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const fotos = app.findCollectionByNameOrId("fotos");
    fotos.fields.getByName("imagen").thumbs = ["400x400", "1600x0", "800x0"];
    app.save(fotos);
  },
  (app) => {
    const fotos = app.findCollectionByNameOrId("fotos");
    fotos.fields.getByName("imagen").thumbs = ["400x400", "1600x0"];
    app.save(fotos);
  },
);
