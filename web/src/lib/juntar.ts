// Juntar lo que quedó partido (NOS-44): desde Mis aportes se eligen varios momentos propios y se
// guardan en un plan (descartadas), se mueven sus fotos a un plan, o se crea un plan con ellas.
import { aFechaGuardada, hoyLocal } from './calendario.js';
import { fotosDe, respuestaDe } from './feed.svelte.js';
import { pb, type Post } from './pb.svelte.js';
import { guardarEnPlan } from './posts.js';

/** Se pueden elegir los momentos propios (los planes y lo del otro, no). */
export function seleccionable(post: Post, yo: string): boolean {
	return post.tipo === 'momento' && post.autor === yo;
}

/**
 * Por qué no se pueden mover las fotos de un momento ('' si se puede). Si tiene respuesta, vaciarlo
 * lo borraría y la respuesta quedaría suelta; como descartada sí viaja con ella.
 */
export function motivoParaNoMover(momento: Post): string {
	if (!respuestaDe(momento)) return '';
	const nombre = momento.texto.trim() || 'Este momento';
	return `«${nombre}» tiene una respuesta: guardalo en el plan en vez de mover sus fotos.`;
}

/** Falla a mitad de camino: lo movido ya quedó en el plan; reintentar sigue con lo que falta. */
export class ErrorMover extends Error {
	constructor(
		public readonly plan: Post,
		movidas: number,
		total: number,
		cause: unknown
	) {
		super(`Se movieron ${movidas} de ${total} fotos.`, { cause });
	}
}

/**
 * Pasa las fotos de cada momento al plan (con sus notas, que van con la foto) y borra cada momento
 * recién cuando quedó vacío.
 */
export async function moverFotosA(momentos: Post[], plan: Post): Promise<{ movidas: number }> {
	const total = momentos.reduce((suma, momento) => suma + fotosDe(momento).length, 0);
	let movidas = 0;
	try {
		for (const momento of momentos) {
			for (const foto of fotosDe(momento)) {
				await pb.collection('fotos').update(foto.id, { post: plan.id });
				movidas += 1;
			}
			await pb.collection('posts').delete(momento.id);
		}
	} catch (cause) {
		throw new ErrorMover(plan, movidas, total, cause);
	}
	return { movidas };
}

/** Crea un plan ya hecho, con la fecha del momento más viejo, y le pasa las fotos. */
export async function crearPlanConFotos(
	momentos: Post[],
	datos: { titulo: string; categoria: Post['categoria'] },
	autor: string
): Promise<Post> {
	const fechas = momentos.map((momento) => momento.fecha).filter(Boolean);
	const fecha = fechas.length ? fechas.sort()[0] : aFechaGuardada(hoyLocal());
	const plan = await pb.collection('posts').create<Post>({
		tipo: 'plan',
		hecho: true,
		titulo: datos.titulo,
		texto: '',
		categoria: datos.categoria,
		fecha,
		autor
	});
	await moverFotosA(momentos, plan);
	return plan;
}

export async function guardarVariosEnPlan(momentos: Post[], plan: Post): Promise<void> {
	for (const momento of momentos) await guardarEnPlan(momento, plan);
}
