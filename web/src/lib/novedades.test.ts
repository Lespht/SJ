import { afterEach, expect, it, vi } from 'vitest';
import { escucharNovedades, esNovedad, novedades } from './novedades.svelte';
import { pb, type Foto, type Post } from './pb.svelte';

afterEach(() => {
	novedades.hay = false;
	vi.restoreAllMocks();
});

it.each([
	['create', 'otro', true],
	['create', 'yo', false],
	['update', 'otro', false],
	['delete', 'otro', false]
])('filtra el evento %s de %s', (accion, autor, esperado) => {
	expect(esNovedad(accion, { autor }, 'yo')).toBe(esperado);
});

it('escucha posts y fotos y marca solo las creaciones del otro', async () => {
	const quitar = vi.fn(async () => {});
	const posts = vi.spyOn(pb.collection('posts'), 'subscribe').mockResolvedValue(quitar);
	const fotos = vi.spyOn(pb.collection('fotos'), 'subscribe').mockResolvedValue(quitar);
	const detener = escucharNovedades('yo');

	expect(posts).toHaveBeenCalledExactlyOnceWith('*', expect.any(Function));
	expect(fotos).toHaveBeenCalledExactlyOnceWith('*', expect.any(Function));
	posts.mock.calls[0][1]({ action: 'create', record: { autor: 'yo' } as Post });
	expect(novedades.hay).toBe(false);
	posts.mock.calls[0][1]({ action: 'create', record: { autor: 'otro' } as Post });
	expect(novedades.hay).toBe(true);
	novedades.hay = false;
	fotos.mock.calls[0][1]({ action: 'create', record: { autor: 'otro' } as Foto });
	expect(novedades.hay).toBe(true);
	detener();
	await Promise.resolve();
	expect(quitar).toHaveBeenCalledTimes(2);
});

it('limpia las suscripciones activas y pendientes e ignora eventos tardíos', async () => {
	const quitarPosts = vi.fn(async () => {});
	const quitarFotos = vi.fn(async () => {});
	let confirmarFotos!: (quitar: () => Promise<void>) => void;
	const posts = vi.spyOn(pb.collection('posts'), 'subscribe').mockResolvedValue(quitarPosts);
	const fotos = vi.spyOn(pb.collection('fotos'), 'subscribe').mockReturnValue(
		new Promise((resolve) => {
			confirmarFotos = resolve;
		})
	);
	const detener = escucharNovedades('yo');

	await Promise.resolve();
	detener();
	expect(quitarPosts).toHaveBeenCalledOnce();
	expect(quitarFotos).not.toHaveBeenCalled();
	posts.mock.calls[0][1]({ action: 'create', record: { autor: 'otro' } as Post });
	fotos.mock.calls[0][1]({ action: 'create', record: { autor: 'otro' } as Foto });
	expect(novedades.hay).toBe(false);
	confirmarFotos(quitarFotos);
	await Promise.resolve();
	expect(quitarFotos).toHaveBeenCalledOnce();
});

it('espera la baja anterior antes de volver a escuchar los mismos temas con otro usuario', async () => {
	let confirmarBaja!: () => void;
	const baja = new Promise<void>((resolve) => {
		confirmarBaja = resolve;
	});
	const posts = vi
		.spyOn(pb.collection('posts'), 'subscribe')
		.mockResolvedValueOnce(() => baja)
		.mockResolvedValue(async () => {});
	const fotos = vi.spyOn(pb.collection('fotos'), 'subscribe').mockResolvedValue(async () => {});
	const detenerAnterior = escucharNovedades('yo');
	await Promise.resolve();

	detenerAnterior();
	const detenerNueva = escucharNovedades('otro');
	try {
		expect(posts).toHaveBeenCalledOnce();
		expect(fotos).toHaveBeenCalledOnce();
	} finally {
		confirmarBaja();
	}
	await vi.waitFor(() => {
		expect(posts).toHaveBeenCalledTimes(2);
		expect(fotos).toHaveBeenCalledTimes(2);
	});
	detenerNueva();
});
