export const UMBRAL_RECARGA = 60;

export function desplazamiento(dy: number): number {
	return dy <= 0 ? 0 : Math.min(dy * 0.5, 90);
}

export function alcanzaUmbral(dy: number): boolean {
	return desplazamiento(dy) >= UMBRAL_RECARGA;
}
