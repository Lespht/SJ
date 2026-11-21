import { aFechaGuardada, hoyLocal } from './calendario.js';
import { EXPAND_POST, fotosDe } from './feed.svelte.js';
import { pb, type Foto, type Post } from './pb.svelte.js';

export const categoriasPlan = [
	{ valor: 'cita', label: 'Cita' },
	{ valor: 'viaje', label: 'Viaje' },
	{ valor: 'regalo', label: 'Regalo' },
	{ valor: 'comida', label: 'Comida' },
	{ valor: 'otro', label: 'Otro' }
] as const;

export function crearPlan({
	dia = '',
	hora = '',
	...datos
}: Pick<Post, 'titulo' | 'texto' | 'categoria' | 'autor'> & { dia?: string; hora?: string }) {
	return pb.collection('posts').create<Post>({
		...datos,
		tipo: 'plan',
		hecho: false,
		fecha: aFechaGuardada(dia),
		hora: dia ? hora : ''
	});
}

export function fijarFecha(plan: Post, dia: string, hora: string): Promise<Post> {
	return pb.collection('posts').update<Post>(plan.id, {
		fecha: aFechaGuardada(dia),
		hora: dia ? hora : ''
	});
}

export function editarPost(
	post: Post,
	{
		titulo,
		texto,
		categoria,
		dia,
		hora
	}: Partial<Pick<Post, 'titulo' | 'texto' | 'categoria' | 'hora'>> & {
		dia?: string;
	}
): Promise<Post> {
	const datos: Partial<Pick<Post, 'titulo' | 'texto' | 'categoria' | 'fecha' | 'hora'>> = {};
	if (texto !== undefined) datos.texto = texto;
	if (dia !== undefined) datos.fecha = aFechaGuardada(dia);
	if (post.tipo === 'plan') {
		if (titulo !== undefined) datos.titulo = titulo;
		if (categoria !== undefined) datos.categoria = categoria;
		if (hora !== undefined || dia === '') datos.hora = (dia ?? post.fecha) ? hora : '';
	}
	return pb.collection('posts').update<Post>(post.id, datos, { expand: EXPAND_POST });
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
	const cuando = aFechaGuardada(fecha);
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
	const cuando = aFechaGuardada(fecha);
	const actualizado = await pb
		.collection('posts')
		.update<Post>(plan.id, { hecho: true, fecha: cuando });
	return subirFotos(actualizado, archivos, { fecha: cuando, autor }, ErrorFotosPlan);
}

export function agregarFotos(post: Post, archivos: File[], autor: string): Promise<Post> {
	const fecha = post.fecha || aFechaGuardada(hoyLocal());
	const ErrorFotos = post.tipo === 'momento' ? ErrorFotosMomento : ErrorFotosPlan;
	return subirFotos(post, archivos, { fecha, autor }, ErrorFotos);
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

/**
 * Por qué no se puede borrar un post ('' si se puede). Misma regla que la base: un momento lo
 * borra su autor; un plan, solo quien lo creó y si no tiene fotos del otro. Necesita las fotos
 * expandidas (fotos_via_post).
 */
export function motivoParaNoBorrar(post: Post, yo: string): string {
	if (post.autor !== yo) return 'Solo quien lo subió puede borrarlo.';
	if (post.tipo === 'plan' && fotosDe(post).some((foto) => foto.autor !== yo)) {
		return 'Tiene fotos del otro: que saque las suyas, o archivalo.';
	}
	return '';
}

/** Borra una foto. Si era la última de un momento, el momento se va con ella; un plan queda. */
export async function borrarFoto(foto: Foto, post: Post): Promise<{ postBorrado: boolean }> {
	await pb.collection('fotos').delete(foto.id);
	const quedan = fotosDe(post).filter((otra) => otra.id !== foto.id).length;
	if (post.tipo !== 'momento' || quedan > 0) return { postBorrado: false };
	await pb.collection('posts').delete(post.id);
	return { postBorrado: true };
}
