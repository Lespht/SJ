import { describe, expect, it, vi } from 'vitest';
import { WebPushError } from 'web-push';
import { entregar, leerPedido, type Mandar } from './avisos.ts';

const a = { endpoint: 'https://push.test/a', p256dh: 'pa', auth: 'aa' };
const b = { endpoint: 'https://push.test/b', p256dh: 'pb', auth: 'ab' };
const aviso = { titulo: 'Sofi', cuerpo: 'Hola', url: '/mensajes' };

function fallo(estado: number) {
	return new WebPushError('falló', estado, {}, '', 'x');
}

describe('entregar', () => {
	it('manda el aviso a cada celular, con sus claves', async () => {
		const mandar = vi.fn<Mandar>().mockResolvedValue(undefined);

		await expect(entregar([a, b], aviso, mandar)).resolves.toEqual([]);
		expect(mandar.mock.calls.map(([s, contenido]) => [s, JSON.parse(contenido)])).toEqual([
			[{ endpoint: a.endpoint, keys: { p256dh: 'pa', auth: 'aa' } }, aviso],
			[{ endpoint: b.endpoint, keys: { p256dh: 'pb', auth: 'ab' } }, aviso]
		]);
	});

	it('un celular que ya no existe (404 o 410) queda como vencido; los demás errores no', async () => {
		const mandar = vi
			.fn<Mandar>()
			.mockRejectedValueOnce(fallo(410))
			.mockRejectedValueOnce(fallo(500))
			.mockRejectedValueOnce(fallo(404));
		const c = { ...a, endpoint: 'https://push.test/c' };

		await expect(entregar([a, b, c], aviso, mandar)).resolves.toEqual([a.endpoint, c.endpoint]);
	});
});

describe('registro de cada aviso (NOS-53)', () => {
	it('deja una línea con el título, cuántos se entregaron y qué respondió cada servicio push', async () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const mandar = vi
			.fn<Mandar>()
			.mockResolvedValueOnce({ statusCode: 201 })
			.mockRejectedValueOnce(fallo(403));

		await entregar([a, b], aviso, mandar);
		expect(log).toHaveBeenCalledExactlyOnceWith('Aviso «Sofi» → 1 de 2 entregado (201, 403)');
		vi.restoreAllMocks();
	});
});

describe('leerPedido', () => {
	it('acepta suscripciones y un aviso con título', () => {
		expect(leerPedido({ suscripciones: [a], aviso })).toEqual({ suscripciones: [a], aviso });
	});

	it('rechaza lo que no tiene la forma esperada', () => {
		expect(leerPedido(null)).toBeNull();
		expect(leerPedido({ suscripciones: [a] })).toBeNull();
		expect(leerPedido({ suscripciones: [{ endpoint: 'x' }], aviso })).toBeNull();
		expect(leerPedido({ suscripciones: [a], aviso: { cuerpo: 'sin título' } })).toBeNull();
	});
});
