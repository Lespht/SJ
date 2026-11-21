import { afterEach, describe, expect, it, vi } from 'vitest';
import { cargarFeed } from './feed';
import { pb, type Foto } from './pb.svelte';

describe('cargarFeed', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});
	function simularPagina(page: number, totalPages: number, items: Foto[] = []) {
		return vi.spyOn(pb.collection('fotos'), 'getList').mockResolvedValue({
			page,
			perPage: 10,
			totalItems: 11,
			totalPages,
			items
		});
	}

	it('pide diez fotos ordenadas por fecha y creación con sus autores y notas', async () => {
		const items = [{ id: 'f1', descripcion: 'Un recuerdo' } as Foto];
		const getList = simularPagina(1, 2, items);

		await expect(cargarFeed(1)).resolves.toEqual({ items, hayMas: true });
		expect(getList).toHaveBeenCalledExactlyOnceWith(1, 10, {
			sort: '-fecha,-created',
			expand: 'autor,notas_via_foto,notas_via_foto.autor'
		});
	});

	it('indica que no hay más fotos en la última página', async () => {
		simularPagina(2, 2);

		await expect(cargarFeed(2)).resolves.toMatchObject({ hayMas: false });
	});
});
