import { pb, type Foto, type Post } from './pb.svelte.js';

export const feed = $state({ version: 0 });

export async function cargarFeed(pagina: number): Promise<{ items: Post[]; hayMas: boolean }> {
	const { items, page, totalPages } = await pb.collection('posts').getList<Post>(pagina, 10, {
		filter: "archivado = false && (tipo = 'momento' || hecho = true)",
		sort: '-fecha,-created',
		expand: 'autor,fotos_via_post,fotos_via_post.notas_via_foto,fotos_via_post.notas_via_foto.autor'
	});
	return { items, hayMas: page < totalPages };
}

export function fotosDe(post: Post): Foto[] {
	return [...(post.expand?.fotos_via_post ?? [])].sort((a, b) =>
		a.created.localeCompare(b.created)
	);
}

export async function planPendienteAlAzar(): Promise<Post | null> {
	const { items } = await pb.collection('posts').getList<Post>(1, 1, {
		filter: "tipo = 'plan' && hecho = false && archivado = false",
		sort: '@random'
	});
	return items[0] ?? null;
}
