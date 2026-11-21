import { pb } from './pb.svelte.js';

/** Registro único de la colección `chat` (lo crea la migración 1795283000_chat_tema.js). */
export const ID_CHAT = 'chatprincipal01';

/**
 * Temas del chat, compartidos por los dos. `color` es el de tus burbujas (texto blanco encima);
 * el fondo del chat toma un tinte suave de ese color. `null` = el acento de cada uno.
 */
export const TEMAS = [
	{ id: 'polaroid', nombre: 'Polaroid', color: null },
	{ id: 'atardecer', nombre: 'Atardecer', color: '#B85A33' },
	{ id: 'mar', nombre: 'Mar', color: '#26648A' },
	{ id: 'noche', nombre: 'Noche', color: '#423D78' },
	{ id: 'lavanda', nombre: 'Lavanda', color: '#7454A3' }
] as const;

export type Tema = (typeof TEMAS)[number]['id'];

export function temaValido(valor: string): Tema {
	return TEMAS.some((t) => t.id === valor) ? (valor as Tema) : 'polaroid';
}

export async function cargarTema(): Promise<Tema> {
	try {
		const chat = await pb.collection('chat').getOne<{ tema: string }>(ID_CHAT);
		return temaValido(chat.tema);
	} catch {
		return 'polaroid';
	}
}

export function cambiarTema(tema: Tema) {
	return pb.collection('chat').update(ID_CHAT, { tema });
}
