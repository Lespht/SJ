// Servicio de avisos (NOS-36): escucha solo en localhost; PocketBase le pide mandar avisos.
//   VAPID_PUBLICA, VAPID_PRIVADA  par de claves (pnpm claves); la privada nunca sale del servidor
//   AVISOS_SECRETO                 clave compartida con PocketBase (cabecera X-Avisos-Clave)
//   PB_URL                         default http://127.0.0.1:8090
//   PUERTO                         default 8091
import { createServer } from 'node:http';
import { sendNotification } from 'web-push';
import { entregar } from './avisos.ts';
import { atender } from './servidor.ts';

function requerida(nombre: string): string {
	const valor = process.env[nombre];
	if (!valor) {
		console.error(`Falta la variable ${nombre}.`);
		process.exit(1);
	}
	return valor;
}

const publica = requerida('VAPID_PUBLICA');
const privada = requerida('VAPID_PRIVADA');
const secreto = requerida('AVISOS_SECRETO');
const pbUrl = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const puerto = Number(process.env.PUERTO ?? 8091);
const MAXIMO = 64 * 1024;

const opciones = {
	vapidDetails: {
		subject: 'https://nosotros-js.duckdns.org',
		publicKey: publica,
		privateKey: privada
	},
	TTL: 24 * 60 * 60 // un aviso que no llega en un día ya no sirve
};

const deps = {
	secreto,
	entregar: (
		suscripciones: Parameters<typeof entregar>[0],
		aviso: Parameters<typeof entregar>[1]
	) => entregar(suscripciones, aviso, (s, contenido) => sendNotification(s, contenido, opciones)),
	informarVencidas: async (endpoints: string[]) => {
		const r = await fetch(`${pbUrl}/api/avisos/vencidas`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-avisos-clave': secreto },
			body: JSON.stringify({ endpoints })
		});
		if (!r.ok)
			throw new Error(`PocketBase respondió ${r.status} al borrar suscripciones vencidas.`);
	}
};

createServer(async (req, res) => {
	let cuerpo: unknown = null;
	try {
		const partes: Buffer[] = [];
		let largo = 0;
		for await (const parte of req) {
			largo += parte.length;
			if (largo > MAXIMO) throw new Error('demasiado grande');
			partes.push(parte);
		}
		if (largo) cuerpo = JSON.parse(Buffer.concat(partes).toString('utf8'));
	} catch {
		res.writeHead(400).end();
		return;
	}
	const clave = req.headers['x-avisos-clave'];
	const { estado } = atender(
		{
			metodo: req.method ?? '',
			ruta: new URL(req.url ?? '/', 'http://localhost').pathname,
			clave: typeof clave === 'string' ? clave : '',
			cuerpo
		},
		deps
	);
	res.writeHead(estado).end();
}).listen(puerto, '127.0.0.1', () => console.log(`Avisos escuchando en 127.0.0.1:${puerto}`));
