// Qué responde el servicio a cada pedido, sin sockets: main.ts lo conecta con http.
import { timingSafeEqual } from 'node:crypto';
import { leerPedido, type Aviso, type Suscripcion } from './avisos.ts';

export type Dependencias = {
	/** La clave compartida con PocketBase (AVISOS_SECRETO). */
	secreto: string;
	entregar: (suscripciones: Suscripcion[], aviso: Aviso) => Promise<string[]>;
	informarVencidas: (endpoints: string[]) => Promise<unknown>;
};
export type PedidoHttp = { metodo: string; ruta: string; clave: string; cuerpo: unknown };
/** `despues` es la entrega en segundo plano (los tests la esperan; main.ts no). */
export type Respuesta = { estado: number; despues: Promise<void> };

const nada = Promise.resolve();

function mismaClave(a: string, b: string): boolean {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

export function atender(pedido: PedidoHttp, deps: Dependencias): Respuesta {
	if (pedido.metodo !== 'POST' || pedido.ruta !== '/enviar') return { estado: 404, despues: nada };
	if (!mismaClave(pedido.clave, deps.secreto)) return { estado: 401, despues: nada };
	const valido = leerPedido(pedido.cuerpo);
	if (!valido) return { estado: 400, despues: nada };

	// Se contesta enseguida: quien manda un mensaje no espera a Apple ni a Google.
	const despues = deps
		.entregar(valido.suscripciones, valido.aviso)
		.then((vencidas) => (vencidas.length ? deps.informarVencidas(vencidas) : undefined))
		.then(
			() => undefined,
			(error) => console.error('Falló la entrega de avisos:', error)
		);
	return { estado: 202, despues };
}
