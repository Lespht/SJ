import { pb } from './pb.svelte.js';

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
	if (!import.meta.env.VITE_VAPID_PUBLICA) return 'sin-clave';
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
			applicationServerKey: clavePublica(import.meta.env.VITE_VAPID_PUBLICA)
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
