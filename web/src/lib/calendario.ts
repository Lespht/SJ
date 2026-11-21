import { pb, type Post } from './pb.svelte.js';

export function hoyLocal(ahora = new Date()): string {
	return new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function aFechaGuardada(dia: string): string {
	return dia ? `${dia} 12:00:00.000Z` : '';
}

export function diaDe(iso: string): string {
	return iso.slice(0, 10);
}

export async function planesDelDia(dia: string, excluirId?: string): Promise<Post[]> {
	const siguiente = new Date(`${dia}T00:00:00Z`);
	siguiente.setUTCDate(siguiente.getUTCDate() + 1);
	return pb.collection('posts').getFullList<Post>({
		filter: pb.filter(
			"tipo = 'plan' && archivado = false && fecha >= {:desde} && fecha < {:hasta} && id != {:excluir}",
			{
				desde: `${dia} 00:00:00.000Z`,
				hasta: `${diaDe(siguiente.toISOString())} 00:00:00.000Z`,
				excluir: excluirId ?? ''
			}
		),
		requestKey: 'choque'
	});
}

export function avisoChoque(planes: Pick<Post, 'titulo'>[]): string {
	if (!planes.length) return '';
	const otros = planes.length - 1;
	return `Ese día ya tienen «${planes[0].titulo}»${otros ? ` y ${otros} más` : ''}.`;
}
