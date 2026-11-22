// Lógica del service worker para los avisos (NOS-37). Sin imports: el service worker no carga la app.

/** Pausa de vibración: si otro aviso llegó hace menos de esto, el nuevo aparece sin vibrar ni sonar. */
const PAUSA = 60_000;

/** `previas`: las notificaciones que siguen a la vista; cada una guarda en `data.enviado` cuándo llegó. */
export function silenciar(
	previas: { data?: { enviado?: number } | null }[],
	ahora: number
): boolean {
	return previas.some(
		({ data }) => typeof data?.enviado === 'number' && ahora - data.enviado < PAUSA
	);
}
