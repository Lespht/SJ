import { afterEach, expect, it, vi } from 'vitest';
import { cargarAportes } from './aportes';
import { pb, type Post } from './pb.svelte';

afterEach(() => vi.restoreAllMocks());

it('pide los aportes propios y los posts con fotos propias, sin incluir archivados', async () => {
	const posts = [
		{ id: 'p1', tipo: 'momento' },
		{ id: 'p2', tipo: 'plan' }
	] as Post[];
	const listar = vi.spyOn(pb.collection('posts'), 'getFullList').mockResolvedValue(posts);

	await expect(cargarAportes('u1')).resolves.toBe(posts);
	expect(listar).toHaveBeenCalledExactlyOnceWith({
		filter: expect.stringMatching(
			/^archivado = false && \(autor = ["']u1["'] \|\| fotos_via_post\.autor \?= ["']u1["']\)$/
		),
		sort: '-fecha,-created',
		expand: 'fotos_via_post',
		requestKey: 'aportes'
	});
});
