/// <reference path="../pb_data/types.d.ts" />

// Mensajes sin leer: cada usuario guarda hasta cuándo vio el chat. Hay algo nuevo si existe
// un mensaje del otro posterior a esa fecha. Cada uno actualiza solo el suyo
// (users.updateRule ya es "id = @request.auth.id").

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new DateField({ name: "mensajes_vistos" }));
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("mensajes_vistos");
    app.save(users);
  },
);
