import { pb, type Post } from './pb.svelte.js';

export function cargarAportes(yo: string): Promise<Post[]> {
	return pb.collection('posts').getFullList<Post>({
		filter: pb.filter('archivado = false && (autor = {:yo} || fotos_via_post.autor ?= {:yo})', {
			yo
		}),
		sort: '-fecha,-created',
		expand: 'fotos_via_post',
		requestKey: 'aportes'
	});
}
