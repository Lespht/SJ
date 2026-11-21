import { afterEach, expect, it, vi } from 'vitest';
import { pb, type Usuario } from './pb.svelte';
import { guardarAjustes, temaDe } from './perfil.svelte';

const usuario: Usuario = {
	id: 'u1',
	collectionId: 'users',
	collectionName: 'users',
	email: 'ana@example.test'
};

afterEach(() => vi.restoreAllMocks());

it('usa sistema y verde cuando faltan preferencias o están vacías', () => {
	expect(temaDe(null)).toEqual({ modo: 'sistema', acento: 'verde' });
	expect(temaDe(usuario)).toEqual({ modo: 'sistema', acento: 'verde' });
	expect(temaDe({ ...usuario, modo: '', acento: '' })).toEqual({
		modo: 'sistema',
		acento: 'verde'
	});
});

it('envía solo los campos que se guardan', async () => {
	const actualizar = vi.spyOn(pb.collection('users'), 'update').mockResolvedValue(usuario);

	await guardarAjustes(usuario.id, { name: 'Ana' });
	await guardarAjustes(usuario.id, { acento: 'vino' });
	const avatar = new File(['foto'], 'avatar.png', { type: 'image/png' });
	await guardarAjustes(usuario.id, { avatar });

	expect(actualizar.mock.calls).toEqual([
		[usuario.id, { name: 'Ana' }],
		[usuario.id, { acento: 'vino' }],
		[usuario.id, { avatar }]
	]);
});

it('aplica el tema al instante para el usuario actual y revierte si falla el guardado', async () => {
	const fallo = new Error('Sin conexión');
	vi.spyOn(pb.collection('users'), 'update').mockRejectedValueOnce(fallo);

	const guardado = guardarAjustes(usuario.id, { modo: 'oscuro', acento: 'azul' });
	expect(temaDe(usuario)).toEqual({ modo: 'oscuro', acento: 'azul' });
	expect(temaDe({ ...usuario, id: 'u2' })).toEqual({ modo: 'sistema', acento: 'verde' });
	await expect(guardado).rejects.toBe(fallo);
	expect(temaDe(usuario)).toEqual({ modo: 'sistema', acento: 'verde' });
});
