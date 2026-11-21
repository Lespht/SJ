import { prefersReducedMotion } from 'svelte/motion';
import { novedades } from './novedades.svelte.js';
import { pb, type Foto, type Post } from './pb.svelte.js';

export const feed = $state({ version: 0 });

export function refrescarInicio(): void {
	novedades.hay = false;
	feed.version += 1;
	window.scrollTo({ top: 0, behavior: prefersReducedMotion.current ? 'auto' : 'smooth' });
}

export const EXPAND_POST =
	'autor,fotos_via_post,fotos_via_post.notas_via_foto,fotos_via_post.notas_via_foto.autor,' +
	'posts_via_respuesta_a,posts_via_respuesta_a.autor,posts_via_respuesta_a.fotos_via_post,respuesta_a.autor';

export async function cargarFeed(pagina: number): Promise<{ items: Post[]; hayMas: boolean }> {
	const { items, page, totalPages } = await pb.collection('posts').getList<Post>(pagina, 10, {
		filter: "archivado = false && respuesta_a = '' && (tipo = 'momento' || hecho = true)",
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

export function respuestaDe(post: Post): Post | undefined {
	const respuesta = post.expand?.posts_via_respuesta_a;
	return Array.isArray(respuesta) ? respuesta[0] : respuesta;
}

export function fotosDelHilo(post: Post): Foto[] {
	const respuesta = respuestaDe(post);
	return respuesta && !respuesta.archivado
		? [...fotosDe(post), ...fotosDe(respuesta)]
		: fotosDe(post);
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
