import { pb, type Acento, type Modo, type Usuario } from './pb.svelte.js';

type Ajustes = { name?: string; avatar?: File; modo?: Modo; acento?: Acento };
type Pendiente<T> = { usuario: string; valor: T; turno: symbol };

const vistaPrevia = $state<{ modo?: Pendiente<Modo>; acento?: Pendiente<Acento> }>({});
let cola = Promise.resolve();

export function temaDe(usuario: Usuario | null): { modo: Modo; acento: Acento } {
	const { modo, acento } = vistaPrevia;
	return {
		modo: (modo?.usuario === usuario?.id && modo?.valor) || usuario?.modo || 'sistema',
		acento: (acento?.usuario === usuario?.id && acento?.valor) || usuario?.acento || 'verde'
	};
}

export function guardarAjustes(usuario: string, cambios: Ajustes) {
	const turno = Symbol();
	if (cambios.modo) vistaPrevia.modo = { usuario, valor: cambios.modo, turno };
	if (cambios.acento) vistaPrevia.acento = { usuario, valor: cambios.acento, turno };

	// Cada respuesta reemplaza el usuario de la sesión. Guardar en orden evita aplicar datos viejos.
	const guardado = cola
		.then(() => pb.collection('users').update<Usuario>(usuario, cambios))
		.finally(() => {
			if (vistaPrevia.modo?.turno === turno) delete vistaPrevia.modo;
			if (vistaPrevia.acento?.turno === turno) delete vistaPrevia.acento;
		});
	cola = guardado.then(
		() => undefined,
		() => undefined
	);
	return guardado;
}
