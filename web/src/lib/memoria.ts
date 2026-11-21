import type { NombreIcono } from './Icono.svelte';

// Memotest con fotos de ustedes: cada partida toma hasta 8 fotos del álbum.
// Si no alcanzan, se completa con figuras dibujadas.
export const PARES = 8;

export const FIGURAS: NombreIcono[] = [
	'luna',
	'sol',
	'flor',
	'taza',
	'nota',
	'hoja',
	'estrella',
	'corazon'
];

export type FotoJuego = { id: string; src: string; alt: string };
export type Cara = { tipo: 'foto'; foto: FotoJuego } | { tipo: 'figura'; figura: NombreIcono };
export type Carta = {
	id: number;
	/** Dos cartas son pareja si tienen la misma clave. */
	clave: string;
	cara: Cara;
	visible: boolean;
	encontrada: boolean;
};

export function mezclar<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export function armarCartas(fotos: FotoJuego[], barajar: <T>(a: T[]) => T[] = mezclar): Carta[] {
	const caras: { clave: string; cara: Cara }[] = fotos
		.slice(0, PARES)
		.map((foto) => ({ clave: `foto:${foto.id}`, cara: { tipo: 'foto', foto } }));
	for (const figura of FIGURAS) {
		if (caras.length >= PARES) break;
		caras.push({ clave: `figura:${figura}`, cara: { tipo: 'figura', figura } });
	}
	return barajar([...caras, ...caras]).map((c, id) => ({
		id,
		...c,
		visible: false,
		encontrada: false
	}));
}

/** Menos intentos = más puntos. */
export function puntosPor(intentos: number) {
	return Math.max(10, 200 - (intentos - PARES) * 10);
}
