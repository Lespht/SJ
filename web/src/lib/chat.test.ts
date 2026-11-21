import { afterEach, describe, expect, it, vi } from 'vitest';
import { cambiarTema, cargarTema, ID_CHAT, TEMAS, temaValido } from './chat';
import { pb } from './pb.svelte';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('temas del chat', () => {
	it('hay 5 temas y polaroid es el primero (el de siempre)', () => {
		expect(TEMAS.map((t) => t.id)).toEqual(['polaroid', 'atardecer', 'mar', 'noche', 'lavanda']);
	});

	it('un tema desconocido o vacío vuelve a polaroid', () => {
		expect(temaValido('mar')).toBe('mar');
		expect(temaValido('')).toBe('polaroid');
		expect(temaValido('inventado')).toBe('polaroid');
	});

	it('cargarTema lee el registro único del chat', async () => {
		const getOne = vi
			.spyOn(pb.collection('chat'), 'getOne')
			.mockResolvedValue({ id: ID_CHAT, tema: 'noche' } as never);
		await expect(cargarTema()).resolves.toBe('noche');
		expect(getOne).toHaveBeenCalledExactlyOnceWith(ID_CHAT);
	});

	it('si no se puede leer, usa polaroid', async () => {
		vi.spyOn(pb.collection('chat'), 'getOne').mockRejectedValue(new Error('sin red'));
		await expect(cargarTema()).resolves.toBe('polaroid');
	});

	it('cambiarTema actualiza solo el tema del registro único', async () => {
		const update = vi.spyOn(pb.collection('chat'), 'update').mockResolvedValue({} as never);
		await cambiarTema('lavanda');
		expect(update).toHaveBeenCalledExactlyOnceWith(ID_CHAT, { tema: 'lavanda' });
	});
});
