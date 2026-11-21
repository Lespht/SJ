/// <reference path="../pb_data/types.d.ts" />

// Tema del chat, compartido: un solo registro que cualquiera de los dos puede cambiar y que
// el otro ve al instante (realtime). Nadie crea ni borra registros: el único lo crea esta migración.

const LOGUEADO = "@request.auth.id != ''";

migrate(
  (app) => {
    const chat = new Collection({
      type: "base",
      name: "chat",
      listRule: LOGUEADO,
      viewRule: LOGUEADO,
      createRule: null,
      updateRule: LOGUEADO,
      deleteRule: null,
      fields: [
        {
          name: "tema",
          type: "select",
          maxSelect: 1,
          required: true,
          values: ["polaroid", "atardecer", "mar", "noche", "lavanda"],
        },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    });
    app.save(chat);

    const registro = new Record(chat);
    registro.set("id", "chatprincipal01");
    registro.set("tema", "polaroid");
    app.save(registro);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("chat"));
  },
);
