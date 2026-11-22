import { pb, sesion, type Foto, type Nota, type Post } from './pb.svelte.js';

export async function guardarNota(
	foto: Pick<Foto, 'id'>,
	miNota: Nota | undefined,
	texto: string
): Promise<Nota | undefined> {
	const limpio = texto.trim();
	const autor = sesion.usuario?.id;
	if (!limpio || !autor) return;

	const notas = pb.collection('notas');
	const expand = { expand: 'autor' };
	return miNota
		? notas.update<Nota>(miNota.id, { texto: limpio }, expand)
		: notas.create<Nota>({ foto: foto.id, autor, texto: limpio }, expand);
}

export async function borrarNota(nota: Nota): Promise<void> {
	await pb.collection('notas').delete(nota.id);
}

export function reemplazarNotas(post: Post, fotoId: string, notas: Nota[]): Post {
	const fotos = post.expand?.fotos_via_post;
	if (!fotos?.some((foto) => foto.id === fotoId)) return post;

	return {
		...post,
		expand: {
			...post.expand,
			fotos_via_post: fotos.map((foto) =>
				foto.id === fotoId ? { ...foto, expand: { ...foto.expand, notas_via_foto: notas } } : foto
			)
		}
	};
}
