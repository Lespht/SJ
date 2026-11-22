// Entrega de avisos Web Push (NOS-36). PocketBase pasa las suscripciones del destinatario y el aviso;
// este módulo no conoce la base.
import { WebPushError, type PushSubscription } from 'web-push';

export type Suscripcion = { endpoint: string; p256dh: string; auth: string };
export type Aviso = { titulo: string; cuerpo?: string; url?: string };
export type Pedido = { suscripciones: Suscripcion[]; aviso: Aviso };
/** Manda un aviso cifrado a un celular (en producción, `sendNotification` de web-push). */
export type Mandar = (suscripcion: PushSubscription, contenido: string) => Promise<unknown>;

const esTexto = (valor: unknown): valor is string => typeof valor === 'string' && valor !== '';

/** Valida el cuerpo de POST /enviar; null si no tiene la forma esperada. */
export function leerPedido(cuerpo: unknown): Pedido | null {
	if (!cuerpo || typeof cuerpo !== 'object') return null;
	const { suscripciones, aviso } = cuerpo as Record<string, unknown>;
	if (!Array.isArray(suscripciones) || !aviso || typeof aviso !== 'object') return null;
	const valida = (s: Record<string, unknown>) =>
		esTexto(s?.endpoint) && esTexto(s.p256dh) && esTexto(s.auth);
	if (!suscripciones.every(valida)) return null;
	const { titulo, cuerpo: texto, url } = aviso as Record<string, unknown>;
	if (!esTexto(titulo)) return null;
	return {
		suscripciones: suscripciones.map(({ endpoint, p256dh, auth }) => ({ endpoint, p256dh, auth })),
		aviso: { titulo, ...(esTexto(texto) && { cuerpo: texto }), ...(esTexto(url) && { url }) }
	};
}

/**
 * Manda el aviso a cada celular y devuelve los endpoints que ya no existen (404 o 410: el celular
 * desinstaló la app o revocó el permiso), para que PocketBase borre esas suscripciones.
 */
export async function entregar(
	suscripciones: Suscripcion[],
	aviso: Aviso,
	mandar: Mandar
): Promise<string[]> {
	const contenido = JSON.stringify(aviso);
	const resultados = await Promise.allSettled(
		suscripciones.map(({ endpoint, p256dh, auth }) =>
			mandar({ endpoint, keys: { p256dh, auth } }, contenido)
		)
	);
	return suscripciones
		.filter((_, i) => {
			const r = resultados[i];
			if (r.status === 'fulfilled') return false;
			const estado = r.reason instanceof WebPushError ? r.reason.statusCode : 0;
			if (estado !== 404 && estado !== 410)
				console.error('No se pudo entregar un aviso:', r.reason);
			return estado === 404 || estado === 410;
		})
		.map(({ endpoint }) => endpoint);
}
