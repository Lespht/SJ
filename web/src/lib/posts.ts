import { pb, type Post } from './pb.svelte.js';

export const categoriasPlan = [
	{ valor: 'cita', label: 'Cita' },
	{ valor: 'viaje', label: 'Viaje' },
	{ valor: 'regalo', label: 'Regalo' },
	{ valor: 'comida', label: 'Comida' },
	{ valor: 'otro', label: 'Otro' }
] as const;

export function crearPlan(datos: Pick<Post, 'titulo' | 'texto' | 'categoria' | 'autor'>) {
	return pb.collection('posts').create<Post>({ ...datos, tipo: 'plan', hecho: false });
}

export class ErrorFotosPlan extends Error {
	constructor(
		public readonly plan: Post,
		public readonly reintentar: () => Promise<Post>,
		cause: unknown
	) {
		super('El plan quedó hecho, pero no se pudieron subir todas las fotos.', { cause });
	}
}

export class ErrorFotosMomento extends Error {
	constructor(
		public readonly momento: Post,
		public readonly reintentar: () => Promise<Post>,
		cause: unknown
	) {
		super('Se creó el momento, pero no se pudieron subir todas las fotos.', { cause });
	}
}

export async function crearMomento(archivos: File[], texto: string, fecha: string, autor: string) {
	if (!archivos.length) throw new Error('Elegí al menos una foto.');
	const cuando = `${fecha} 12:00:00.000Z`;
	const momento = await pb.collection('posts').create<Post>({
		tipo: 'momento',
		texto,
		fecha: cuando,
		autor
	});
	return subirFotos(
		momento,
		archivos,
		{ fecha: cuando, autor, descripcion: texto },
		ErrorFotosMomento
	);
}

export async function completarPlan(plan: Post, archivos: File[], fecha: string, autor: string) {
	const cuando = `${fecha} 12:00:00.000Z`;
	const actualizado = await pb
		.collection('posts')
		.update<Post>(plan.id, { hecho: true, fecha: cuando });
	return subirFotos(actualizado, archivos, { fecha: cuando, autor }, ErrorFotosPlan);
}

async function subirFotos(
	post: Post,
	archivos: File[],
	datos: { fecha: string; autor: string; descripcion?: string },
	ErrorFotos: typeof ErrorFotosMomento | typeof ErrorFotosPlan
): Promise<Post> {
	for (const [i, imagen] of archivos.entries()) {
		const form = new FormData();
		form.append('imagen', imagen);
		form.append('post', post.id);
		form.append('autor', datos.autor);
		form.append('fecha', datos.fecha);
		if (datos.descripcion !== undefined) form.append('descripcion', datos.descripcion);
		try {
			await pb.collection('fotos').create(form);
		} catch (cause) {
			throw new ErrorFotos(
				post,
				() => subirFotos(post, archivos.slice(i), datos, ErrorFotos),
				cause
			);
		}
	}
	return post;
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
