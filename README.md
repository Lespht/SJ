# Nosotros 💞

App privada de pareja: un feed de recuerdos (momentos y planes con fotos), mensajes en tiempo real y juegos.

- **server/**: [PocketBase](https://pocketbase.io) v0.40.6 (base de datos SQLite, auth, archivos, realtime, panel admin).
- **web/**: SvelteKit 3 + TypeScript, compilado como SPA dentro de `server/pb_public/`.

```
server/
├── pocketbase            binario (no versionado)
├── pb_migrations/        estructura de la base (colecciones y reglas)
├── pb_data/              datos reales: DB + fotos  ← HACER BACKUP
├── pb_public/            frontend compilado
└── nosotros.service      servicio systemd de usuario
web/                      código del frontend
```

## Colecciones

| Colección  | Campos                                                            | Reglas                                                                  |
|------------|-------------------------------------------------------------------|-------------------------------------------------------------------------|
| `users`    | email, name, avatar, modo, acento, mensajes_vistos                | ver: logueados · editar: uno mismo · se crean desde el admin            |
| `posts`    | tipo (momento/plan), titulo, texto, categoria, hecho, fecha, archivado, archivado_en, autor | ver: logueados · un plan lo puede completar cualquiera; un momento, solo su autor · archivar: cualquiera · borrar: autor, solo si está archivado o no tiene fotos |
| `fotos`    | imagen (protegida), descripcion, fecha, post, autor               | ver: logueados · editar/borrar: autor                                   |
| `notas`    | foto, autor, texto (una por persona y foto)                       | ver: logueados · editar/borrar: autor · se borran con la foto           |
| `mensajes` | texto, autor                                                      | ver: logueados · editar/borrar: autor                                   |
| `chat`     | tema (un solo registro, compartido)                               | ver/editar: logueados · no se crea ni se borra                          |
| `puntajes` | juego, puntos, autor                                              | ver: logueados · no editables                                           |
| `ideas`    | titulo, detalle, categoria, hecha, autor                          | **en desuso**: sus datos se copiaron a `posts`; se borra tras desplegar |

Nadie puede crear registros a nombre del otro ni cambiar el `autor`.
Las fotos piden un token de archivo: no se ven con solo conocer la URL.

## Primera vez

```fish
cd server
./pocketbase superuser upsert tu@email.com 'una-contraseña-larga'
./pocketbase serve --http 0.0.0.0:8090
```

1. Entrá a `http://localhost:8090/_/` con ese superusuario.
2. En **Collections → users** creá los dos usuarios (email, contraseña, nombre).
3. Abrí `http://localhost:8090` e iniciá sesión.

## Desarrollo

```fish
# terminal 1
cd server; ./pocketbase serve --dev
# terminal 2
cd web; pnpm dev
```

Vite (`http://localhost:5173`) reenvía `/api` y `/_` a PocketBase, así que el código usa siempre la misma URL.

Para publicar cambios del frontend: `cd web; pnpm build` (escribe en `server/pb_public/`, sin reiniciar nada).

### Checks

Una vez por clon, activá los hooks del repo (formatean al commitear y corren los tests al hacer push):

```fish
git config core.hooksPath .githooks
```

Desde `web/`: `pnpm test` (tests, sin red ni PocketBase), `pnpm lint` (prettier + tipos), `pnpm format`.
El CI (`.github/workflows/ci.yml`) corre lint, tests, build y `pnpm audit` en cada push.

Reglas de la API (antes de cambiar permisos o migraciones), desde `server/`: `sh tests/probar-reglas.sh`.
Trabaja sobre una copia temporal de `pb_data` en el puerto 8099; la base real no se toca.

## Servidor + Meshnet

1. Copiá la carpeta al PC viejo (o cloná el repo y descargá el binario de PocketBase allí).
2. Instalá el servicio (detalles en `server/nosotros.service`):
   ```fish
   mkdir -p ~/.config/systemd/user
   cp server/nosotros.service ~/.config/systemd/user/
   systemctl --user daemon-reload
   systemctl --user enable --now nosotros
   loginctl enable-linger $USER
   ```
3. Desde el celular/PC con Meshnet activo: `http://<ip-meshnet-del-servidor>:8090`
   (la IP o el nombre `*.nord` aparecen en `nordvpn meshnet peer list`).
4. En Meshnet, el servidor tiene que **permitir tráfico entrante** de tus dispositivos
   (`nordvpn meshnet peer incoming allow <peer>`). No hace falta "acceso a red local" ni "routing".
5. Recomendado: firewall que solo deje entrar al puerto 8090 desde la interfaz de Meshnet (`nordlynx`).

### Instalarla en el celular

La app trae ícono y `manifest.json` (en `web/static/`).

- **Android (Chrome):** abrí la app → menú ⋮ → **Agregar a la pantalla principal**.
- **iPhone (Safari):** botón compartir → **Agregar a inicio**.

Por HTTP queda como acceso directo que abre el navegador. Para que se instale como app completa
(sin barra del navegador, y más adelante con notificaciones) el servidor tiene que servirse por HTTPS.

## Servidor en Windows (PC viejo)

`server/windows/instalar.ps1` deja todo listo en `C:\Nosotros`: descarga `pocketbase.exe` (verificando el SHA-256),
crea una regla del Firewall que **solo** acepta el puerto 8090 desde Meshnet (`100.64.0.0/10`), una tarea programada que
lo arranca con Windows (sin iniciar sesión) y lo reinicia si falla, y desactiva la suspensión estando enchufado.

1. **En Linux**, compilá el frontend: `cd web; pnpm build`.
2. Llevá la carpeta `server/` completa al PC con Windows (USB, o `nordvpn fileshare send <peer> server/`).
   `pb_public/` no está en git, por eso hay que copiarla.
   Para llevarte también los datos de prueba, primero detené el servicio: `systemctl --user stop nosotros`.
3. **En Windows**, PowerShell **como Administrador**, dentro de `server\windows`:
   ```powershell
   # instalación nueva
   powershell -ExecutionPolicy Bypass -File .\instalar.ps1
   # o trayendo los datos (fotos, usuarios, mensajes) del servidor de prueba
   powershell -ExecutionPolicy Bypass -File .\instalar.ps1 -DatosDesde "..\pb_data"
   ```
4. En NordVPN del PC viejo activá Meshnet y permití *tráfico entrante* a tus dispositivos.

Para actualizar el frontend: `pnpm build`, copiá `server/pb_public` y volvé a correr el script (los datos no se tocan).
Para quitarlo: `.\instalar.ps1 -Desinstalar` (deja los datos en `C:\Nosotros\pb_data`).

Una vez que funcione en Windows, apagá el de prueba en Linux: `systemctl --user disable --now nosotros`.

## Backups

Todo vive en `server/pb_data/`. En el panel admin → **Settings → Backups** podés programar
backups automáticos (ej. cron `0 3 * * *`). Copialos a otro disco o a la nube, por ejemplo con `rclone`.

## Actualizar PocketBase

Leé las notas de la versión antes (todavía no es 1.0), hacé un backup y reemplazá el binario.
