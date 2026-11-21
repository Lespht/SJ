/// <reference path="../pb_data/types.d.ts" />

// Un plan pendiente puede tener fecha y, si tiene día, una hora opcional en formato HH:MM.

migrate(
  (app) => {
    const posts = app.findCollectionByNameOrId("posts");
    posts.fields.add(new TextField({ name: "hora", max: 5, pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" }));
    app.save(posts);
  },
  (app) => {
    const posts = app.findCollectionByNameOrId("posts");
    posts.fields.removeByName("hora");
    app.save(posts);
  },
);
