import { pb, type Foto, type Post } from './pb.svelte.js';

export const feed = $state({ version: 0 });

export const EXPAND_POST =
	'autor,fotos_via_post,fotos_via_post.notas_via_foto,fotos_via_post.notas_via_foto.autor';

export async function cargarFeed(pagina: number): Promise<{ items: Post[]; hayMas: boolean }> {
	const { items, page, totalPages } = await pb.collection('posts').getList<Post>(pagina, 10, {
		filter: "archivado = false && (tipo = 'momento' || hecho = true)",
		sort: '-fecha,-created',
		expand: EXPAND_POST
	});
	return { items, hayMas: page < totalPages };
}

export function cargarPost(id: string): Promise<Post> {
	return pb.collection('posts').getOne<Post>(id, { expand: EXPAND_POST });
}

export function fotosDe(post: Post): Foto[] {
	return [...(post.expand?.fotos_via_post ?? [])].sort((a, b) =>
		a.created.localeCompare(b.created)
	);
}

export async function proximoPlan(hoy: string): Promise<Post | null> {
	const { items } = await pb.collection('posts').getList<Post>(1, 1, {
		filter: pb.filter("tipo = 'plan' && hecho = false && archivado = false && fecha >= {:desde}", {
			desde: `${hoy} 00:00:00.000Z`
		}),
		sort: 'fecha'
	});
	return items[0] ?? null;
}

export async function planPendienteAlAzar(): Promise<Post | null> {
	const { items } = await pb.collection('posts').getList<Post>(1, 1, {
		filter: "tipo = 'plan' && hecho = false && archivado = false",
		sort: '@random',
		expand: 'autor',
		requestKey: 'azar'
	});
	return items[0] ?? null;
}
