import { pb } from './pb.svelte.js';

// Clave pública VAPID del servicio de avisos (NOS-36). Es pública: va en el código para que todo build
// la lleve. La privada vive solo en avisos/.env y en el servidor. VITE_VAPID_PUBLICA la reemplaza (tests).
const vapidPublica = (): string =>
	import.meta.env.VITE_VAPID_PUBLICA ??
	'BEks531UkRc_ETtI4ObRFJnXvDf2KRNoqnVUdjHwerOiaqo4ZJmnmAWoBEE7PpTw0QoZwn65uBSD9tCW54FJTvU';

export type EstadoAvisos = 'no-soportado' | 'sin-clave' | 'bloqueado' | 'activo' | 'inactivo';

export function requiereInstalarAvisos(): boolean {
	return (
		typeof navigator !== 'undefined' &&
		/iPhone/i.test(navigator.userAgent) &&
		(navigator as Navigator & { standalone?: boolean }).standalone !== true
	);
}

export function soportaAvisos(): boolean {
	return (
		typeof navigator !== 'undefined' &&
		!requiereInstalarAvisos() &&
		!!navigator.serviceWorker &&
		typeof PushManager !== 'undefined' &&
		typeof Notification !== 'undefined'
	);
}

function estadoPrevio(): EstadoAvisos | undefined {
	if (!soportaAvisos()) return 'no-soportado';
	if (!vapidPublica()) return 'sin-clave';
	if (Notification.permission === 'denied') return 'bloqueado';
}

async function registroDe(endpoint: string) {
	const { items } = await pb.collection('suscripciones').getList(1, 1, {
		filter: pb.filter('endpoint = {:endpoint}', { endpoint })
	});
	return items[0];
}

function clavePublica(clave: string): Uint8Array<ArrayBuffer> {
	const base64 = clave.replace(/-/g, '+').replace(/_/g, '/');
	const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
	return Uint8Array.from(atob(base64 + relleno), (caracter) => caracter.charCodeAt(0));
}

export async function estadoAvisos(): Promise<EstadoAvisos> {
	const estado = estadoPrevio();
	if (estado) return estado;
	if (Notification.permission !== 'granted') return 'inactivo';

	const registro = await navigator.serviceWorker.getRegistration();
	const suscripcion = await registro?.pushManager.getSubscription();
	return suscripcion && (await registroDe(suscripcion.endpoint)) ? 'activo' : 'inactivo';
}

export async function activarAvisos(usuarioId: string): Promise<EstadoAvisos> {
	const estado = estadoPrevio();
	if (estado) return estado;

	const permiso = await Notification.requestPermission();
	if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueado' : 'inactivo';

	const registro = await navigator.serviceWorker.getRegistration();
	if (!registro) throw new Error('Todavía no se inició el servicio de avisos.');
	const { pushManager } = registro.active ? registro : await navigator.serviceWorker.ready;
	const suscripcion =
		(await pushManager.getSubscription()) ??
		(await pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: clavePublica(vapidPublica())
		}));
	const { endpoint } = suscripcion;
	if (!(await registroDe(endpoint))) {
		const { p256dh, auth } = suscripcion.toJSON().keys ?? {};
		if (!p256dh || !auth) throw new Error('No se pudieron leer las claves de la suscripción.');
		await pb.collection('suscripciones').create({ usuario: usuarioId, endpoint, p256dh, auth });
	}
	return 'activo';
}

export async function desactivarAvisos(): Promise<void> {
	if (!soportaAvisos()) return;
	const registro = await navigator.serviceWorker.getRegistration();
	const suscripcion = await registro?.pushManager.getSubscription();
	if (!suscripcion) return;

	const guardada = await registroDe(suscripcion.endpoint);
	if (guardada) await pb.collection('suscripciones').delete(guardada.id);
	await suscripcion.unsubscribe();
}

/** Al abrir una pantalla, se cierran los avisos que llevaban a ella (por ejemplo, Mensajes). */
export async function limpiarAvisos(ruta: string): Promise<void> {
	if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
	const registro = await navigator.serviceWorker.getRegistration();
	for (const aviso of (await registro?.getNotifications()) ?? []) {
		const url = aviso.data?.url;
		if (typeof url === 'string' && new URL(url, 'http://x').pathname === ruta) aviso.close();
	}
}
