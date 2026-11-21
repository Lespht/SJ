import { pb, type Foto } from './pb.svelte.js';

export async function cargarFeed(pagina: number): Promise<{ items: Foto[]; hayMas: boolean }> {
	const { items, page, totalPages } = await pb.collection('fotos').getList<Foto>(pagina, 10, {
		sort: '-fecha,-created',
		expand: 'autor,notas_via_foto,notas_via_foto.autor'
	});
	return { items, hayMas: page < totalPages };
}
