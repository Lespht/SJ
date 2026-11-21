/// <reference path="../pb_data/types.d.ts" />

// La sesión dura 30 días en vez de 5: si no abren la app en unos días, no tienen que
// volver a loguearse. Cada vez que se abre la app, el token se renueva (renovarSesion).

const TREINTA_DIAS = 30 * 24 * 60 * 60;
const ANTERIOR = 5 * 24 * 60 * 60; // valor que tenía la colección antes de esta migración

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.authToken.duration = TREINTA_DIAS;
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.authToken.duration = ANTERIOR;
    app.save(users);
  },
);
