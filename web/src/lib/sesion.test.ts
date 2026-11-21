import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ClientResponseError } from 'pocketbase';
import { pb, renovarSesion } from './pb.svelte';

// JWT sin firmar con vencimiento lejano: authStore.isValid solo mira `exp`.
function tokenFalso() {
	const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
	return `${b64({ alg: 'none' })}.${b64({ exp: 4102444800, type: 'auth' })}.firma`;
}

describe('renovarSesion', () => {
	beforeEach(() => {
		pb.authStore.save(tokenFalso(), { id: 'u1', collectionName: 'users' } as never);
	});
	afterEach(() => {
		vi.restoreAllMocks();
		pb.authStore.clear();
	});

	function fallaCon(status: number) {
		vi.spyOn(pb.collection('users'), 'authRefresh').mockRejectedValue(
			new ClientResponseError({ status })
		);
	}

	it('sin red (status 0) mantiene la sesión', async () => {
		fallaCon(0);
		await renovarSesion();
		expect(pb.authStore.isValid).toBe(true);
	});

	it('si el servidor falla (5xx) mantiene la sesión', async () => {
		fallaCon(502);
		await renovarSesion();
		expect(pb.authStore.isValid).toBe(true);
	});

	it('si el token ya no sirve (401/403/404) cierra la sesión', async () => {
		for (const status of [401, 403, 404]) {
			pb.authStore.save(tokenFalso(), { id: 'u1', collectionName: 'users' } as never);
			fallaCon(status);
			await renovarSesion();
			expect(pb.authStore.isValid, `status ${status}`).toBe(false);
			vi.restoreAllMocks();
		}
	});

	it('sin sesión no llama al servidor', async () => {
		pb.authStore.clear();
		const refresh = vi.spyOn(pb.collection('users'), 'authRefresh');
		await renovarSesion();
		expect(refresh).not.toHaveBeenCalled();
	});
});
