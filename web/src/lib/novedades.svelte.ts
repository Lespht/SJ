import { pb } from './pb.svelte.js';

export const novedades = $state({ hay: false });
let limpiezaEnCurso: Promise<void> | undefined;

export function esNovedad(accion: string, registro: { autor: string }, yo: string): boolean {
	return accion === 'create' && registro.autor !== yo;
}

export function escucharNovedades(yo: string): () => void {
	let cancelado = false;
	const desuscripciones: (() => Promise<void>)[] = [];

	async function suscribir() {
		if (cancelado) return;
		await Promise.all(
			['posts', 'fotos'].map((coleccion) =>
				pb
					.collection(coleccion)
					.subscribe<{ autor: string }>('*', ({ action, record }) => {
						if (!cancelado && esNovedad(action, record, yo)) novedades.hay = true;
					})
					.then((quitar) => {
						if (cancelado) return quitar();
						desuscripciones.push(quitar);
					})
					.catch(() => {})
			)
		);
	}

	// El SDK agrupa altas y bajas en la misma microtarea, incluso si cambió el usuario.
	const altas = limpiezaEnCurso ? limpiezaEnCurso.then(suscribir) : suscribir();

	return () => {
		if (cancelado) return;
		cancelado = true;
		const bajas = desuscripciones.map((quitar) => quitar().catch(() => {}));
		const limpieza = Promise.all([altas, ...bajas]).then(() => {
			if (limpiezaEnCurso === limpieza) limpiezaEnCurso = undefined;
		});
		limpiezaEnCurso = limpieza;
	};
}
