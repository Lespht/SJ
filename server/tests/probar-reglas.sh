#!/bin/sh
# Prueba las reglas de la API sobre una COPIA de pb_data, nunca sobre la base real.
# Copia la base, aplica las migraciones, levanta PocketBase en 127.0.0.1:8099, corre
# los casos y borra todo al terminar. Uso (desde server/): sh tests/probar-reglas.sh
set -eu
cd "$(dirname "$0")/.."

COPIA=$(mktemp -d)
PID=""
limpiar() {
	[ -n "$PID" ] && kill "$PID" 2>/dev/null || true
	rm -rf "$COPIA"
}
trap limpiar EXIT

sqlite3 pb_data/data.db ".backup '$COPIA/data.db'"
sqlite3 pb_data/auxiliary.db ".backup '$COPIA/auxiliary.db'"
./pocketbase migrate up --dir "$COPIA" --migrationsDir pb_migrations >/dev/null

# Superusuario temporal, solo en la copia. La contraseña no se muestra.
head -c 24 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 20 >"$COPIA/.supass"
./pocketbase superuser upsert prueba-su@local.test "$(cat "$COPIA/.supass")" --dir "$COPIA" >/dev/null

AVISOS_URL=http://127.0.0.1:8098 AVISOS_SECRETO=prueba-secreto \
	./pocketbase serve --dir "$COPIA" --migrationsDir pb_migrations --hooksDir pb_hooks --http 127.0.0.1:8099 >"$COPIA/serve.log" 2>&1 &
PID=$!
for _ in $(seq 1 30); do
	curl -sf 127.0.0.1:8099/api/health >/dev/null && break
	sleep 0.5
done

# -E -s y no -I: así cada script encuentra tests/copia.py, que está al lado.
python3 -E -s tests/reglas_posts.py "$COPIA/.supass"
python3 -E -s tests/avisos_pb.py "$COPIA/.supass"
