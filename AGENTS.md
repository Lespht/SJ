# AGENTS.md — reglas fijas para el implementador

Nosotros es una app privada de pareja (recuerdos y planes): SvelteKit 3 + Svelte 5 (runes) como SPA
en `web/`, PocketBase 0.40 en `server/`. Cada tarea llega en un prompt aparte con su ID (`NOS-NN`),
rutas, reglas, tests esperados, qué queda fuera de alcance y mensaje de commit. Este archivo tiene
solo lo que vale para todas las tareas.

## Antes de escribir código

- Leé el prompt completo y respondé con un **plan corto**: archivos que vas a tocar, reglas y tests.
  **Esperá el visto bueno** antes de implementar.
- Si algo del prompt es ambiguo, preguntá. No lo interpretes al pie de la letra ni lo amplíes.
- Hacé lo mínimo que cumple la tarea. Nada de abstracciones "para después" ni refactors no pedidos.

## Ramas y commits

- Trabajá en la rama `Jose`. Confirmá la rama antes de cada commit. Nunca hagas push ni toques `main`.
- Un commit por tarea (atómico), en español, conventional commits con el ID en el scope.
  El mensaje describe el comportamiento, no el archivo:
  `fix(NOS-07): las fotos cargan aunque el token de archivo haya vencido`
- Firmá cada commit con esta línea exacta, al final del mensaje:
  `Co-Authored-By: Codex <noreply@openai.com>`
- No agregues ni quites dependencias si el prompt no lo dice.

## Tests

- Para un fallo: primero el test que falla, después el arreglo. Antes de un refactor: test de
  caracterización que fije el comportamiento (entradas y salidas), no la forma del código.
- Los tests van junto al código: `web/src/**/*.test.ts` (vitest).
- **Los tests nunca tocan PocketBase ni la red.** `web/src/test/setup.ts` hace fallar cualquier
  `fetch`; no lo desactives. Mockeá `pb` con `vi.spyOn`.
- Corré solo los tests afectados mientras trabajás. Antes del commit, desde `web/`:
  `pnpm test` y `pnpm lint` (prettier + svelte-check) tienen que pasar.

## Formato

- Prettier (tabs, comillas simples, ancho 100). El hook de pre-commit formatea solo; si no está
  activo: `git config core.hooksPath .githooks`. Nunca un commit solo de formato.

## Qué no tocar

- `server/pb_data/` (datos reales), `server/pocketbase`, `server/pb_public/` (se genera con `pnpm build`).
- Migraciones ya aplicadas en `server/pb_migrations/`: un cambio de base es **siempre una migración
  nueva**, nunca editar una existente.
- `docs/` (documentos de trabajo locales, fuera de git), `CLAUDE.md`, este archivo.
- El PocketBase de desarrollo (`127.0.0.1:8090`) tiene una **copia de datos reales**: no escribas
  ahí. Si una prueba manual lo necesita, el texto lleva `[prueba]` y se borra al terminar.
- Nunca muestres claves, tokens ni contraseñas en la salida.

## Estilo de la UI (para tareas de interfaz)

- Sin emojis decorativos. Íconos SVG simples.
- Base clara/neutra con modo oscuro (`prefers-color-scheme`), acento sobrio, animaciones sutiles.
- Las fotos son lo principal. Skeletons mientras carga.
- Probá en ancho de celular (390 px) además de escritorio.

## Al terminar

Respondé breve: qué hiciste, qué supusiste, qué quedó fuera y qué te chocó del prompt.
