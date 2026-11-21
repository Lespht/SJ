/// <reference path="../pb_data/types.d.ts" />

// Las preferencias vacías usan el modo del sistema y el acento verde en la interfaz.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new SelectField({ name: "modo", maxSelect: 1, values: ["sistema", "claro", "oscuro"] }));
    users.fields.add(new SelectField({ name: "acento", maxSelect: 1, values: ["verde", "azul", "vino", "ambar", "grafito"] }));

    const avatar = users.fields.getByName("avatar");
    if (!avatar.thumbs?.length) avatar.thumbs = ["96x96"];

    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("modo");
    users.fields.removeByName("acento");
    app.save(users);
  },
);
