# Nosotros — instrucciones para el asistente

App privada de pareja (recuerdos y planes). SvelteKit (SPA) en `web/` + PocketBase en `server/`.
Producción corre en el servidor casero (repo `homeserver`, `services/nosotros/`, `deploy.sh`).

## Forma de trabajo

- Paso a paso: proponé qué tocar y por qué, y esperá mi visto bueno. Vale también para la documentación.
- Si algo va a crear un documento nuevo (vos o una skill), pedime permiso antes. Si lo apruebo, seguí normal.
- Solución mínima que funcione; nada de abstracciones "para después".
- Antes de infraestructura o un módulo nuevo: puerta de decisión (qué duele, cómo se mide, lo más barato) y esperá.
- Nada de agentes en paralelo salvo que lo pida.
- Si un check falla y la causa no está clara en ~5 minutos, pará y avisame.
- Nunca muestres claves ni contraseñas en la salida.

## Commits y ramas

- Se trabaja en la rama `Jose`; a `main` solo cuando esté estable. Antes de cada commit, confirmá la rama.
- IDs del repo en orden: `NOS-01`, `NOS-02`… Uno por tarea, en el scope del commit:
  `fix(NOS-07): la sesión ya no se cierra si el servidor no responde`.
- Commits atómicos; el mensaje describe el comportamiento, no el archivo.
- Para un fallo: primero el test que falla, después el arreglo. Antes de un refactor: test de caracterización.

## Datos y tests

- El PocketBase de desarrollo (`127.0.0.1:8090`) tiene una **copia de datos reales**. Lo que se escriba ahí
  para probar lleva la marca `[prueba]` en el texto y se borra al terminar.
- Los tests nunca tocan PocketBase ni la red: `web/src/test/setup.ts` hace fallar cualquier `fetch`.
- Verificación visual con Chrome DevTools (servidor MCP `chromium-devtools`).

## Comandos (desde `web/`)

- `pnpm check` · `pnpm test` · `pnpm format` · `pnpm lint` (prettier + svelte-check)

## Documentación

Solo `README.md` y `decisiones/AAAA-MM-DD-tema.md` cuando haga falta. Los documentos de trabajo
(`docs/`) son locales y están fuera de git.
