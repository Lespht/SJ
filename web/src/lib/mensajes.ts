import { pb, type Usuario } from './pb.svelte.js';

/** ¿Hay algún mensaje del otro posterior a la última vez que abrí el chat? */
export async function hayNoLeidos(usuario: Usuario) {
	const desde = usuario.mensajes_vistos;
	const filter = desde
		? pb.filter('autor != {:yo} && created > {:desde}', { yo: usuario.id, desde })
		: pb.filter('autor != {:yo}', { yo: usuario.id });
	const { items } = await pb
		.collection('mensajes')
		.getList(1, 1, { filter, skipTotal: true, fields: 'id' });
	return items.length > 0;
}

/**
 * Marca el chat como visto hasta ahora. El SDK actualiza solo la sesión guardada
 * cuando se edita el usuario logueado, así que `sesion.usuario` queda al día.
 */
export function marcarLeidos(usuario: Usuario) {
	return pb
		.collection('users')
		.update<Usuario>(usuario.id, { mensajes_vistos: new Date().toISOString() });
}

/** Con el chat abierto, lo que llega del otro ya está leído (NOS-52). Lo mío no cambia nada. */
export async function leerSiEsDelOtro(mensaje: { autor: string }, usuario: Usuario) {
	if (mensaje.autor !== usuario.id) await marcarLeidos(usuario);
}
