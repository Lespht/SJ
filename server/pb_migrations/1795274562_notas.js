/// <reference path="../pb_data/types.d.ts" />

// Notas en las fotos: cada persona puede dejar UNA nota propia por foto,
// editable solo por quien la escribió. Y cada foto la modifica solo quien la subió.

const LOGUEADO = "@request.auth.id != ''";
const ES_AUTOR = "@request.auth.id != '' && autor = @request.auth.id";
const CREA_COMO_SI_MISMO = "@request.auth.id != '' && @request.body.autor = @request.auth.id";
const SIN_CAMBIAR_AUTOR = "@request.body.autor:isset = false";

const FOTOS_UPDATE_ANTERIOR = `${LOGUEADO} && ${SIN_CAMBIAR_AUTOR}`;

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const fotos = app.findCollectionByNameOrId("fotos");

  // Arreglo de seguridad: antes cualquiera de los dos podía modificar la foto del otro.
  fotos.updateRule = `${ES_AUTOR} && ${SIN_CAMBIAR_AUTOR}`;
  app.save(fotos);

  app.save(new Collection({
    type: "base",
    name: "notas",
    listRule: LOGUEADO,
    viewRule: LOGUEADO,
    createRule: CREA_COMO_SI_MISMO,
    // Solo se edita el texto: ni el autor ni la foto se pueden cambiar.
    updateRule: `${ES_AUTOR} && ${SIN_CAMBIAR_AUTOR} && @request.body.foto:isset = false`,
    deleteRule: ES_AUTOR,
    fields: [
      {
        name: "foto",
        type: "relation",
        collectionId: fotos.id,
        maxSelect: 1,
        cascadeDelete: true, // si se borra la foto, se borran sus notas
        required: true,
      },
      {
        name: "autor",
        type: "relation",
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
        required: true,
      },
      { name: "texto", type: "text", required: true, max: 500 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    // Una nota por persona por foto.
    indexes: ["CREATE UNIQUE INDEX idx_notas_foto_autor ON notas (foto, autor)"],
  }));
}, (app) => {
  app.delete(app.findCollectionByNameOrId("notas"));

  const fotos = app.findCollectionByNameOrId("fotos");
  fotos.updateRule = FOTOS_UPDATE_ANTERIOR;
  app.save(fotos);
});
