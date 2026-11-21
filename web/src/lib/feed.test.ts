import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	cargarFeed,
	cargarPost,
	EXPAND_POST,
	fotosDe,
	planPendienteAlAzar,
	proximoPlan
} from './feed.svelte';
import { pb, type Foto, type Post } from './pb.svelte';

afterEach(() => {
	vi.restoreAllMocks();
});

function simularPagina(page: number, totalPages: number, items: Post[] = [], perPage = 10) {
	return vi.spyOn(pb.collection('posts'), 'getList').mockResolvedValue({
		page,
		perPage,
		totalItems: items.length,
		totalPages,
		items
	});
}

describe('cargarFeed', () => {
	it('pide momentos y planes hechos sin archivar, con sus fotos y notas', async () => {
		const items = [{ id: 'p1', tipo: 'momento' } as Post];
		const getList = simularPagina(1, 2, items);

		await expect(cargarFeed(1)).resolves.toEqual({ items, hayMas: true });
		expect(getList).toHaveBeenCalledExactlyOnceWith(1, 10, {
			filter: "archivado = false && (tipo = 'momento' || hecho = true)",
			sort: '-fecha,-created',
			expand:
				'autor,fotos_via_post,fotos_via_post.notas_via_foto,fotos_via_post.notas_via_foto.autor'
		});
	});

	it('indica que no hay más posts en la última página', async () => {
		simularPagina(2, 2);
		await expect(cargarFeed(2)).resolves.toMatchObject({ hayMas: false });
	});
});

describe('cargarPost', () => {
	it('pide un post por ID con el mismo expand que el feed', async () => {
		const post = { id: 'p1', tipo: 'momento' } as Post;
		const getOne = vi.spyOn(pb.collection('posts'), 'getOne').mockResolvedValue(post);

		await expect(cargarPost('p1')).resolves.toBe(post);
		expect(getOne).toHaveBeenCalledExactlyOnceWith('p1', { expand: EXPAND_POST });
	});

	it('incluye el autor, las fotos y las notas con sus autores', () => {
		expect(EXPAND_POST).toBe(
			'autor,fotos_via_post,fotos_via_post.notas_via_foto,fotos_via_post.notas_via_foto.autor'
		);
	});
});

describe('fotosDe', () => {
	it('ordena las fotos por creación ascendente sin modificar el expand', () => {
		const primera: Foto = {
			id: 'f1',
			collectionId: 'fotos',
			collectionName: 'fotos',
			created: '2026-11-20 12:00:00.000Z',
			imagen: 'recuerdo.png',
			descripcion: '',
			fecha: '2026-11-20 12:00:00.000Z',
			autor: 'u1',
			post: 'p1'
		};
		const segunda = { ...primera, id: 'f2', created: '2026-11-21 12:00:00.000Z' };
		const fotos = [segunda, primera];
		const post = { expand: { fotos_via_post: fotos } } as Post;

		expect(fotosDe(post)).toEqual([primera, segunda]);
		expect(fotos).toEqual([segunda, primera]);
	});

	it('devuelve una lista vacía cuando no hay expand', () => {
		expect(fotosDe({ id: 'p1' } as Post)).toEqual([]);
	});
});

describe('proximoPlan', () => {
	it('pide el primer plan pendiente no archivado desde hoy y devuelve null si no hay', async () => {
		const getList = simularPagina(1, 0, [], 1);

		await expect(proximoPlan('2026-11-21')).resolves.toBeNull();
		expect(getList).toHaveBeenCalledExactlyOnceWith(1, 1, {
			filter: expect.stringMatching(
				/^tipo = 'plan' && hecho = false && archivado = false && fecha >= ["']2026-11-21 00:00:00\.000Z["']$/
			),
			sort: 'fecha'
		});
	});

	it('devuelve el plan que encontró', async () => {
		const plan = { id: 'p1', tipo: 'plan', fecha: '2026-11-28 12:00:00.000Z' } as Post;
		simularPagina(1, 1, [plan], 1);

		await expect(proximoPlan('2026-11-21')).resolves.toBe(plan);
	});
});

describe('planPendienteAlAzar', () => {
	it('pide un plan pendiente sin archivar al azar y devuelve el primer resultado', async () => {
		const plan = { id: 'p1', tipo: 'plan' } as Post;
		const getList = simularPagina(1, 1, [plan], 1);

		await expect(planPendienteAlAzar()).resolves.toBe(plan);
		expect(getList).toHaveBeenCalledExactlyOnceWith(1, 1, {
			filter: "tipo = 'plan' && hecho = false && archivado = false",
			sort: '@random',
			expand: 'autor',
			requestKey: 'azar'
		});
	});

	it('devuelve null cuando no hay planes pendientes', async () => {
		simularPagina(1, 0, [], 1);
		await expect(planPendienteAlAzar()).resolves.toBeNull();
	});
});
