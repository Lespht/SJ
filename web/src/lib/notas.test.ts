import { afterEach, expect, it, vi } from 'vitest';
import { borrarNota, guardarNota, reemplazarNotas } from './notas';
import { pb, sesion, type Foto, type Nota, type Post, type Usuario } from './pb.svelte';

const foto = { id: 'f1' } as Foto;
const nota = { id: 'n1', foto: 'f1', autor: 'u1', texto: 'Hola' } as Nota;

afterEach(() => {
	vi.restoreAllMocks();
	sesion.usuario = null;
});

it('crea la nota con la foto, el usuario actual y el texto recortado', async () => {
	sesion.usuario = { id: 'u1' } as Usuario;
	const crear = vi.spyOn(pb.collection('notas'), 'create').mockResolvedValue(nota);

	await expect(guardarNota(foto, undefined, '  Hola \n')).resolves.toBe(nota);
	expect(crear).toHaveBeenCalledExactlyOnceWith(
		{ foto: 'f1', autor: 'u1', texto: 'Hola' },
		{ expand: 'autor' }
	);
});

it('al editar manda solo el texto y trae el autor', async () => {
	sesion.usuario = { id: 'u1' } as Usuario;
	const actualizada = { ...nota, texto: 'Hola de nuevo' };
	const editar = vi.spyOn(pb.collection('notas'), 'update').mockResolvedValue(actualizada);

	await expect(guardarNota(foto, nota, ' Hola de nuevo ')).resolves.toBe(actualizada);
	expect(editar).toHaveBeenCalledExactlyOnceWith(
		'n1',
		{ texto: 'Hola de nuevo' },
		{ expand: 'autor' }
	);
});

it('omite el texto vacío tanto al crear como al editar', async () => {
	sesion.usuario = { id: 'u1' } as Usuario;
	const crear = vi.spyOn(pb.collection('notas'), 'create');
	const editar = vi.spyOn(pb.collection('notas'), 'update');

	await expect(guardarNota(foto, undefined, ' \n ')).resolves.toBeUndefined();
	await expect(guardarNota(foto, nota, '  ')).resolves.toBeUndefined();
	expect(crear).not.toHaveBeenCalled();
	expect(editar).not.toHaveBeenCalled();
});

it('borra la nota por su ID', async () => {
	const borrar = vi.spyOn(pb.collection('notas'), 'delete').mockResolvedValue(true);

	await borrarNota(nota);
	expect(borrar).toHaveBeenCalledExactlyOnceWith('n1');
});

it('reemplaza las notas de una foto y conserva las otras fotos y el resto del post', () => {
	const primera = { ...foto, expand: { notas_via_foto: [nota] } };
	const segunda = {
		id: 'f2',
		expand: { notas_via_foto: [{ ...nota, id: 'n2', foto: 'f2' }] }
	} as Foto;
	const autor = { id: 'u1' } as Usuario;
	const post = {
		id: 'p1',
		texto: 'El post',
		expand: { autor, fotos_via_post: [primera, segunda] }
	} as Post;
	const nuevas = [{ ...nota, texto: 'Corregida' }];

	const actualizado = reemplazarNotas(post, foto.id, nuevas);

	expect(actualizado).toEqual({
		...post,
		expand: {
			...post.expand,
			fotos_via_post: [{ ...primera, expand: { notas_via_foto: nuevas } }, segunda]
		}
	});
	expect(actualizado.expand?.fotos_via_post?.[1]).toBe(segunda);
	expect(actualizado.expand?.autor).toBe(autor);
	expect(primera.expand.notas_via_foto).toEqual([nota]);
});
