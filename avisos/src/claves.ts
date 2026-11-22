// Genera, una sola vez, el par VAPID y la clave compartida con PocketBase, y los guarda en avisos/.env
// (solo lo lee el dueño). Muestra únicamente la clave pública, que va en web/src/lib/avisos.ts.
import { randomBytes } from 'node:crypto';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { generateVAPIDKeys } from 'web-push';

const archivo = new URL('../.env', import.meta.url);
if (existsSync(archivo) && statSync(archivo).size > 0) {
	console.error('avisos/.env ya existe: no se pisan claves. Si querés otras, borralo primero.');
	process.exit(1);
}
const { publicKey, privateKey } = generateVAPIDKeys();
const secreto = randomBytes(32).toString('base64url');
writeFileSync(
	archivo,
	`VAPID_PUBLICA=${publicKey}\nVAPID_PRIVADA=${privateKey}\nAVISOS_SECRETO=${secreto}\n`,
	{ mode: 0o600 }
);
console.log(`Listo. Clave pública:\n${publicKey}`);
