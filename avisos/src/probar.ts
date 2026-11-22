// Prueba de punta a punta en DESARROLLO: manda un aviso "[prueba]" a todos los celulares/navegadores
// suscritos en la base local, a través del servicio (que tiene que estar corriendo).
//   pnpm probar
import { DatabaseSync } from 'node:sqlite';

const base = new DatabaseSync(new URL('../../server/pb_data/data.db', import.meta.url), {
	readOnly: true
});
const suscripciones = base.prepare('SELECT endpoint, p256dh, auth FROM suscripciones').all();
if (!suscripciones.length) {
	console.error('No hay suscripciones: activá las notificaciones en Perfil → Ajustes.');
	process.exit(1);
}

const r = await fetch(`http://127.0.0.1:${process.env.PUERTO ?? 8091}/enviar`, {
	method: 'POST',
	headers: {
		'content-type': 'application/json',
		'x-avisos-clave': process.env.AVISOS_SECRETO ?? ''
	},
	body: JSON.stringify({
		suscripciones,
		aviso: {
			titulo: '[prueba] Nosotros',
			cuerpo: 'Si ves esto, los avisos funcionan.',
			url: '/perfil'
		}
	})
});
console.log(
	`El servicio respondió ${r.status} (202 = lo está entregando) a ${suscripciones.length} suscripción(es).`
);
