import { afterEach, expect, it, vi } from 'vitest';
import {
	crearPlanConFotos,
	ErrorMover,
	guardarVariosEnPlan,
	motivoParaNoMover,
	moverFotosA,
	seleccionable
} from './juntar';
import { EXPAND_POST } from './feed.svelte';
import { pb, type Foto, type Post } from './pb.svelte';

afterEach(() => vi.restoreAllMocks());

function momento(id: string, fecha: string, fotos: string[], extra: Partial<Post> = {}): Post {
	const lista = fotos.map((f, i) => ({ id: f, created: `${i}` }) as unknown as Foto);
	return {
		id,
		tipo: 'momento',
		autor: 'yo',
		texto: '',
		fecha,
		...extra,
		expand: { fotos_via_post: lista, ...extra.expand }
	} as Post;
}

const plan = { id: 'p1', tipo: 'plan', hecho: true } as Post;

it('solo se seleccionan momentos propios', () => {
	expect(seleccionable(momento('m1', '', []), 'yo')).toBe(true);
	expect(seleccionable(momento('m1', '', [], { autor: 'otro' }), 'yo')).toBe(false);
	expect(seleccionable({ ...plan, autor: 'yo' } as Post, 'yo')).toBe(false);
});

it('no deja mover las fotos de un momento que tiene respuesta', () => {
	const conRespuesta = momento('m1', '', [], {
		texto: 'el gato',
		expand: { posts_via_respuesta_a: [{ id: 'r1' } as Post] }
	});
	expect(motivoParaNoMover(conRespuesta)).toBe(
		'«el gato» tiene una respuesta: guardalo en el plan en vez de mover sus fotos.'
	);
	expect(motivoParaNoMover(momento('m2', '', []))).toBe('');
});

it('mueve las fotos de cada momento al plan y borra el momento cuando queda vacío', async () => {
	const mover = vi.spyOn(pb.collection('fotos'), 'update').mockResolvedValue({} as Foto);
	const borrar = vi.spyOn(pb.collection('posts'), 'delete').mockResolvedValue(true);

	await expect(
		moverFotosA([momento('m1', '', ['f1', 'f2']), momento('m2', '', ['f3'])], plan)
	).resolves.toEqual({ movidas: 3 });
	expect(mover.mock.calls).toEqual([
		['f1', { post: 'p1' }],
		['f2', { post: 'p1' }],
		['f3', { post: 'p1' }]
	]);
	expect(borrar.mock.calls).toEqual([['m1'], ['m2']]);
	expect(mover.mock.invocationCallOrder[1]).toBeLessThan(borrar.mock.invocationCallOrder[0]);
});

it('si falla a mitad de camino, dice cuántas fotos movió y no borra el momento a medias', async () => {
	vi.spyOn(pb.collection('fotos'), 'update')
		.mockResolvedValueOnce({} as Foto)
		.mockRejectedValueOnce(new Error('sin red'));
	const borrar = vi.spyOn(pb.collection('posts'), 'delete').mockResolvedValue(true);

	const fallo = await moverFotosA([momento('m1', '', ['f1', 'f2'])], plan).catch((e) => e);
	expect(fallo).toBeInstanceOf(ErrorMover);
	expect(fallo.message).toBe('Se movieron 1 de 2 fotos.');
	expect(fallo.plan).toBe(plan);
	expect(borrar).not.toHaveBeenCalled();
});

it('crea un plan hecho con la fecha del momento más viejo y le pasa las fotos', async () => {
	const nuevo = { id: 'p2', tipo: 'plan' } as Post;
	const crear = vi.spyOn(pb.collection('posts'), 'create').mockResolvedValue(nuevo);
	const mover = vi.spyOn(pb.collection('fotos'), 'update').mockResolvedValue({} as Foto);
	vi.spyOn(pb.collection('posts'), 'delete').mockResolvedValue(true);

	await expect(
		crearPlanConFotos(
			[
				momento('m1', '2026-11-13 12:00:00.000Z', ['f1']),
				momento('m2', '2026-11-12 12:00:00.000Z', ['f2'])
			],
			{ titulo: 'Cumple de Mati', categoria: 'cita' },
			'yo'
		)
	).resolves.toBe(nuevo);
	expect(crear).toHaveBeenCalledExactlyOnceWith({
		tipo: 'plan',
		hecho: true,
		titulo: 'Cumple de Mati',
		texto: '',
		categoria: 'cita',
		fecha: '2026-11-12 12:00:00.000Z',
		autor: 'yo'
	});
	expect(crear.mock.invocationCallOrder[0]).toBeLessThan(mover.mock.invocationCallOrder[0]);
});

it('guarda varios momentos en un plan, uno por uno', async () => {
	const actualizar = vi.spyOn(pb.collection('posts'), 'update').mockResolvedValue({} as Post);

	await guardarVariosEnPlan([momento('m1', '', []), momento('m2', '', [])], plan);
	expect(actualizar.mock.calls).toEqual([
		['m1', { descartada_en: 'p1' }, { expand: EXPAND_POST }],
		['m2', { descartada_en: 'p1' }, { expand: EXPAND_POST }]
	]);
});
