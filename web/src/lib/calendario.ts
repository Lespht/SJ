export function hoyLocal(ahora = new Date()): string {
	return new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function aFechaGuardada(dia: string): string {
	return dia ? `${dia} 12:00:00.000Z` : '';
}

export function diaDe(iso: string): string {
	return iso.slice(0, 10);
}
