import { afterEach, describe, expect, it, vi } from 'vitest';
import { hayNoLeidos, leerSiEsDelOtro, marcarLeidos } from './mensajes';
import { pb, type Usuario } from './pb.svelte';

afterEach(() => {
	vi.restoreAllMocks();
});

const yo = { id: 'u1', email: 'yo@ejemplo.test' } as Usuario;

function simularMensajes(cantidad: number) {
	return vi.spyOn(pb.collection('mensajes'), 'getList').mockResolvedValue({
		page: 1,
		perPage: 1,
		totalItems: -1,
		totalPages: -1,
		items: Array.from({ length: cantidad }, (_, i) => ({ id: `m${i}` }) as never)
	});
}

describe('hayNoLeidos', () => {
	it('busca un mensaje del otro posterior a la última vez que vi el chat', async () => {
		const getList = simularMensajes(1);
		const usuario = { ...yo, mensajes_vistos: '2026-11-21 10:00:00.000Z' };

		await expect(hayNoLeidos(usuario)).resolves.toBe(true);
		expect(getList).toHaveBeenCalledExactlyOnceWith(1, 1, {
			filter: pb.filter('autor != {:yo} && created > {:desde}', {
				yo: 'u1',
				desde: '2026-11-21 10:00:00.000Z'
			}),
			skipTotal: true,
			fields: 'id'
		});
	});

	it('si nunca vi el chat, cualquier mensaje del otro cuenta', async () => {
		const getList = simularMensajes(0);

		await expect(hayNoLeidos(yo)).resolves.toBe(false);
		expect(getList.mock.calls[0][2]?.filter).toBe(pb.filter('autor != {:yo}', { yo: 'u1' }));
	});
});

describe('marcarLeidos', () => {
	it('guarda "ahora" en mi propio usuario', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-11-21T18:00:00.000Z'));
		const update = vi.spyOn(pb.collection('users'), 'update').mockResolvedValue(yo);

		await marcarLeidos(yo);
		expect(update).toHaveBeenCalledExactlyOnceWith('u1', {
			mensajes_vistos: '2026-11-21T18:00:00.000Z'
		});
		vi.useRealTimers();
	});
});

describe('leerSiEsDelOtro', () => {
	it('con el chat abierto, un mensaje del otro lo deja leído; uno mío no cambia nada', async () => {
		const update = vi.spyOn(pb.collection('users'), 'update').mockResolvedValue(yo);

		await leerSiEsDelOtro({ autor: 'u1' }, yo);
		expect(update).not.toHaveBeenCalled();

		await leerSiEsDelOtro({ autor: 'u2' }, yo);
		expect(update).toHaveBeenCalledExactlyOnceWith('u1', { mensajes_vistos: expect.any(String) });
	});
});
