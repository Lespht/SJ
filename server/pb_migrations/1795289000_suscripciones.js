/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const propia = "usuario = @request.auth.id";
  app.save(new Collection({
    type: "base",
    name: "suscripciones",
    listRule: propia,
    viewRule: propia,
    createRule: "@request.auth.id != '' && @request.body.usuario = @request.auth.id",
    updateRule: null,
    deleteRule: propia,
    fields: [
      {
        name: "usuario",
        type: "relation",
        collectionId: users.id,
        maxSelect: 1,
        required: true,
        cascadeDelete: true,
      },
      { name: "endpoint", type: "text", required: true },
      { name: "p256dh", type: "text", required: true },
      { name: "auth", type: "text", required: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_suscripciones_endpoint ON suscripciones (endpoint)"],
  }));
}, (app) => {
  app.delete(app.findCollectionByNameOrId("suscripciones"));
});
