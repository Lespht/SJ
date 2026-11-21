/// <reference path="../pb_data/types.d.ts" />

// Estructura inicial: fotos, ideas, mensajes y puntajes de juegos.
// Todo es privado: solo usuarios logueados ven algo, y solo el autor
// puede borrar lo suyo.

const LOGUEADO = "@request.auth.id != ''";
const ES_AUTOR = "@request.auth.id != '' && autor = @request.auth.id";
const CREA_COMO_SI_MISMO = "@request.auth.id != '' && @request.body.autor = @request.auth.id";

// En updates no se permite tocar el campo autor.
const SIN_CAMBIAR_AUTOR = "@request.body.autor:isset = false";

const timestamps = () => [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  // Nadie se registra solo: los dos usuarios se crean desde el panel admin.
  users.createRule = null;
  // Cada uno puede ver el nombre/avatar del otro.
  users.listRule = LOGUEADO;
  users.viewRule = LOGUEADO;
  app.save(users);

  const autor = (required = true) => ({
    name: "autor",
    type: "relation",
    collectionId: users.id,
    maxSelect: 1,
    cascadeDelete: false,
    required,
  });

  app.save(new Collection({
    type: "base",
    name: "fotos",
    listRule: LOGUEADO,
    viewRule: LOGUEADO,
    createRule: CREA_COMO_SI_MISMO,
    updateRule: `${LOGUEADO} && ${SIN_CAMBIAR_AUTOR}`,
    deleteRule: ES_AUTOR,
    fields: [
      {
        name: "imagen",
        type: "file",
        required: true,
        maxSelect: 1,
        maxSize: 25 * 1024 * 1024,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"],
        thumbs: ["400x400", "1600x0"],
        // Los archivos requieren token: nadie los ve con solo adivinar la URL.
        protected: true,
      },
      { name: "descripcion", type: "text", max: 500 },
      { name: "fecha", type: "date" },
      autor(),
      ...timestamps(),
    ],
    indexes: ["CREATE INDEX idx_fotos_fecha ON fotos (fecha)"],
  }));

  app.save(new Collection({
    type: "base",
    name: "ideas",
    listRule: LOGUEADO,
    viewRule: LOGUEADO,
    createRule: CREA_COMO_SI_MISMO,
    updateRule: `${LOGUEADO} && ${SIN_CAMBIAR_AUTOR}`, // cualquiera de los dos puede marcarla como hecha
    deleteRule: ES_AUTOR,
    fields: [
      { name: "titulo", type: "text", required: true, max: 200 },
      { name: "detalle", type: "text", max: 2000 },
      {
        name: "categoria",
        type: "select",
        maxSelect: 1,
        values: ["cita", "viaje", "regalo", "comida", "otro"],
      },
      { name: "hecha", type: "bool" },
      autor(),
      ...timestamps(),
    ],
  }));

  app.save(new Collection({
    type: "base",
    name: "mensajes",
    listRule: LOGUEADO,
    viewRule: LOGUEADO,
    createRule: CREA_COMO_SI_MISMO,
    updateRule: `${ES_AUTOR} && ${SIN_CAMBIAR_AUTOR}`,
    deleteRule: ES_AUTOR,
    fields: [
      { name: "texto", type: "text", required: true, max: 4000 },
      autor(),
      ...timestamps(),
    ],
    indexes: ["CREATE INDEX idx_mensajes_created ON mensajes (created)"],
  }));

  app.save(new Collection({
    type: "base",
    name: "puntajes",
    listRule: LOGUEADO,
    viewRule: LOGUEADO,
    createRule: CREA_COMO_SI_MISMO,
    updateRule: null,
    deleteRule: ES_AUTOR,
    fields: [
      { name: "juego", type: "text", required: true, max: 50 },
      { name: "puntos", type: "number", required: true, onlyInt: true },
      autor(),
      ...timestamps(),
    ],
  }));
}, (app) => {
  for (const name of ["puntajes", "mensajes", "ideas", "fotos"]) {
    app.delete(app.findCollectionByNameOrId(name));
  }
  const users = app.findCollectionByNameOrId("users");
  // Aun deshaciendo todo, el registro público queda cerrado.
  users.createRule = null;
  users.listRule = "id = @request.auth.id";
  users.viewRule = "id = @request.auth.id";
  app.save(users);
});
