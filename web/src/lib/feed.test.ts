import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	cargarFeed,
	cargarPost,
	descartadasDe,
	EXPAND_POST,
	feed,
	fotosDe,
	fotosDelHilo,
	planPendienteAlAzar,
	proximoPlan,
	refrescarInicio
} from './feed.svelte';
import { novedades } from './novedades.svelte';
import { pb, type Foto, type Post } from './pb.svelte';

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it('apaga las novedades al recargar Inicio y subir al principio', () => {
	const scrollTo = vi.fn();
	vi.stubGlobal('window', { scrollTo });
	const version = feed.version;
	novedades.hay = true;

	refrescarInicio();

	expect(novedades.hay).toBe(false);
	expect(feed.version).toBe(version + 1);
	expect(scrollTo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ top: 0 }));
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
	it('pide momentos y planes hechos sin archivar ni descartados, con sus fotos y notas', async () => {
		const items = [{ id: 'p1', tipo: 'momento' } as Post];
		const getList = simularPagina(1, 2, items);

		await expect(cargarFeed(1)).resolves.toEqual({ items, hayMas: true });
		expect(getList).toHaveBeenCalledExactlyOnceWith(1, 10, {
			filter:
				"archivado = false && descartada_en = '' && (respuesta_a = '' || respuesta_a.archivado = true) && " +
				"(tipo = 'momento' || hecho = true)",
			sort: '-fecha,-created',
			expand: EXPAND_POST
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
		expect(EXPAND_POST.split(',')).toEqual(
			expect.arrayContaining([
				'autor',
				'fotos_via_post',
				'fotos_via_post.notas_via_foto',
				'fotos_via_post.notas_via_foto.autor',
				'posts_via_respuesta_a',
				'posts_via_respuesta_a.autor',
				'posts_via_respuesta_a.fotos_via_post',
				'respuesta_a.autor',
				'posts_via_descartada_en',
				'posts_via_descartada_en.fotos_via_post',
				'descartada_en'
			])
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

describe('descartadasDe', () => {
	const foto = (id: string, created: string) => ({ id, created }) as unknown as Foto;
	const momento = (id: string, fecha: string, archivado = false, fotos: Foto[] = []) =>
		({
			id,
			tipo: 'momento',
			fecha,
			archivado,
			expand: { fotos_via_post: fotos }
		}) as unknown as Post;

	it('devuelve las descartadas sin archivar, de la más vieja a la más nueva', () => {
		const vieja = momento('m1', '2026-11-20 12:00:00.000Z');
		const nueva = momento('m2', '2026-11-21 12:00:00.000Z');
		const archivada = momento('m3', '2026-11-19 12:00:00.000Z', true);
		const plan = {
			tipo: 'plan',
			expand: { posts_via_descartada_en: [nueva, archivada, vieja] }
		} as unknown as Post;

		expect(descartadasDe(plan)).toEqual([vieja, nueva]);
		expect(descartadasDe({ tipo: 'plan' } as Post)).toEqual([]);
	});

	it('suma la primera foto de cada descartada a las fotos del hilo', () => {
		const propia = foto('f1', '1');
		const d1 = momento('m1', '2026-11-20 12:00:00.000Z', false, [
			foto('d1b', '2'),
			foto('d1a', '1')
		]);
		const plan = {
			tipo: 'plan',
			expand: { fotos_via_post: [propia], posts_via_descartada_en: [d1] }
		} as unknown as Post;

		expect(fotosDelHilo(plan).map((f) => f.id)).toEqual(['f1', 'd1a']);
	});
});
