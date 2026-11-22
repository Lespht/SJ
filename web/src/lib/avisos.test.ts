import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { activarAvisos, desactivarAvisos, estadoAvisos } from './avisos';
import { pb } from './pb.svelte';

const endpoint = 'https://push.example.test/dispositivo';
const suscripcion = {
	endpoint,
	toJSON: () => ({ keys: { p256dh: 'publica-_', auth: 'auth-_' } }),
	unsubscribe: vi.fn()
};
const getSubscription = vi.fn();
const subscribe = vi.fn();
const requestPermission = vi.fn();
const registration = { active: {}, pushManager: { getSubscription, subscribe } };

beforeEach(() => {
	vi.stubEnv('VITE_VAPID_PUBLICA', 'AQID-_8');
	vi.stubGlobal('PushManager', class {});
	vi.stubGlobal('Notification', { permission: 'granted', requestPermission });
	vi.stubGlobal('navigator', {
		serviceWorker: {
			getRegistration: vi.fn().mockResolvedValue(registration),
			ready: Promise.resolve(registration)
		}
	});
	requestPermission.mockResolvedValue('granted');
	getSubscription.mockResolvedValue(null);
	subscribe.mockResolvedValue(suscripcion);
	suscripcion.unsubscribe.mockResolvedValue(true);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetAllMocks();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

function registros(items: { id: string }[]) {
	return vi.spyOn(pb.collection('suscripciones'), 'getList').mockResolvedValue({
		page: 1,
		perPage: 1,
		totalItems: items.length,
		totalPages: items.length,
		items
	});
}

it('si falta la clave muestra sin-clave y no pide permiso', async () => {
	vi.stubEnv('VITE_VAPID_PUBLICA', '');

	await expect(estadoAvisos()).resolves.toBe('sin-clave');
	await expect(activarAvisos('u1')).resolves.toBe('sin-clave');
	expect(requestPermission).not.toHaveBeenCalled();
});

it('si el usuario deniega el permiso devuelve bloqueado sin suscribir ni crear', async () => {
	vi.stubGlobal('Notification', { permission: 'default', requestPermission });
	requestPermission.mockResolvedValue('denied');
	const crear = vi.spyOn(pb.collection('suscripciones'), 'create');

	await expect(activarAvisos('u1')).resolves.toBe('bloqueado');
	expect(requestPermission).toHaveBeenCalledOnce();
	expect(subscribe).not.toHaveBeenCalled();
	expect(crear).not.toHaveBeenCalled();
});

it('suscribe el dispositivo y guarda las claves de la suscripción nueva', async () => {
	const listar = registros([]);
	const crear = vi.spyOn(pb.collection('suscripciones'), 'create').mockResolvedValue({ id: 's1' });

	await expect(activarAvisos('u1')).resolves.toBe('activo');
	expect(subscribe).toHaveBeenCalledExactlyOnceWith({
		userVisibleOnly: true,
		applicationServerKey: new Uint8Array([1, 2, 3, 251, 255])
	});
	expect(listar).toHaveBeenCalledExactlyOnceWith(1, 1, {
		filter: pb.filter('endpoint = {:endpoint}', { endpoint })
	});
	expect(crear).toHaveBeenCalledExactlyOnceWith({
		usuario: 'u1',
		endpoint,
		p256dh: 'publica-_',
		auth: 'auth-_'
	});
});

it('reutiliza la suscripción y no duplica un endpoint ya guardado', async () => {
	getSubscription.mockResolvedValue(suscripcion);
	registros([{ id: 's1' }]);
	const crear = vi.spyOn(pb.collection('suscripciones'), 'create');

	await expect(activarAvisos('u1')).resolves.toBe('activo');
	await expect(estadoAvisos()).resolves.toBe('activo');
	expect(subscribe).not.toHaveBeenCalled();
	expect(crear).not.toHaveBeenCalled();
});

it('borra el registro del endpoint y cancela la suscripción del navegador', async () => {
	getSubscription.mockResolvedValue(suscripcion);
	const listar = registros([{ id: 's1' }]);
	const borrar = vi.spyOn(pb.collection('suscripciones'), 'delete').mockResolvedValue(true);

	await desactivarAvisos();
	expect(listar).toHaveBeenCalledExactlyOnceWith(1, 1, {
		filter: pb.filter('endpoint = {:endpoint}', { endpoint })
	});
	expect(borrar).toHaveBeenCalledExactlyOnceWith('s1');
	expect(suscripcion.unsubscribe).toHaveBeenCalledOnce();
});

it('permite reintentar el alta si el endpoint todavía no está guardado', async () => {
	getSubscription.mockResolvedValue(suscripcion);
	registros([]);

	await expect(estadoAvisos()).resolves.toBe('inactivo');
});
