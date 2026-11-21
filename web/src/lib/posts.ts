import { pb, type Post } from './pb.svelte.js';

export function crearPlan(datos: Pick<Post, 'titulo' | 'texto' | 'categoria' | 'autor'>) {
	return pb.collection('posts').create<Post>({ ...datos, tipo: 'plan', hecho: false });
}

export class ErrorFotosPlan extends Error {
	constructor(
		public readonly plan: Post,
		cause: unknown
	) {
		super('El plan quedó hecho, pero no se pudieron subir todas las fotos.', { cause });
	}
}

export async function completarPlan(plan: Post, archivos: File[], fecha: string, autor: string) {
	const cuando = `${fecha} 12:00:00.000Z`;
	const actualizado = await pb
		.collection('posts')
		.update<Post>(plan.id, { hecho: true, fecha: cuando });

	try {
		for (const imagen of archivos) {
			const form = new FormData();
			form.append('imagen', imagen);
			form.append('post', plan.id);
			form.append('autor', autor);
			form.append('fecha', cuando);
			await pb.collection('fotos').create(form);
		}
	} catch (cause) {
		throw new ErrorFotosPlan(actualizado, cause);
	}
	return actualizado;
}

export function archivar(post: Post) {
	return pb.collection('posts').update<Post>(post.id, {
		archivado: true,
		archivado_en: new Date().toISOString()
	});
}

export function restaurar(post: Post) {
	return pb.collection('posts').update<Post>(post.id, { archivado: false, archivado_en: '' });
}

export function borrarPost(post: Post) {
	return pb.collection('posts').delete(post.id);
}
