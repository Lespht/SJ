import { fechaCorta, pb, type Post } from './pb.svelte.js';

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

function inicioDeMes(anio: number, mes: number): Date {
	const fecha = new Date(0);
	fecha.setUTCFullYear(anio, mes - 1, 1);
	return fecha;
}

export function semanasDelMes(anio: number, mes: number): (string | null)[][] {
	const inicio = inicioDeMes(anio, mes);
	const fin = inicioDeMes(anio, mes + 1);
	fin.setUTCDate(0);
	const dias = fin.getUTCDate();
	const huecos = (inicio.getUTCDay() + 6) % 7;
	const prefijo = inicio.toISOString().slice(0, 7);

	return Array.from({ length: Math.ceil((huecos + dias) / 7) }, (_, semana) =>
		Array.from({ length: 7 }, (_, columna) => {
			const dia = semana * 7 + columna - huecos + 1;
			return dia < 1 || dia > dias ? null : `${prefijo}-${String(dia).padStart(2, '0')}`;
		})
	);
}

export function cargarMes(anio: number, mes: number): Promise<Post[]> {
	const desde = diaDe(inicioDeMes(anio, mes).toISOString());
	const hasta = diaDe(inicioDeMes(anio, mes + 1).toISOString());
	return pb.collection('posts').getFullList<Post>({
		filter: pb.filter('archivado = false && fecha >= {:desde} && fecha < {:hasta}', {
			desde: `${desde} 00:00:00.000Z`,
			hasta: `${hasta} 00:00:00.000Z`
		}),
		sort: 'fecha',
		requestKey: 'mes'
	});
}

export function marcasPorDia(posts: Post[]): Map<string, { pendiente: Post[]; hecho: Post[] }> {
	const marcas = new Map<string, { pendiente: Post[]; hecho: Post[] }>();
	for (const post of posts) {
		const dia = diaDe(post.fecha);
		if (!dia) continue;
		const marca = marcas.get(dia) ?? { pendiente: [], hecho: [] };
		marca[post.tipo === 'plan' && !post.hecho ? 'pendiente' : 'hecho'].push(post);
		marcas.set(dia, marca);
	}
	return marcas;
}

export function fechaCortaDia(iso: string): string {
	return fechaCorta(`${diaDe(iso)}T12:00:00`);
}

export function fechaLarga(dia: string): string {
	return new Date(`${dia}T12:00:00`)
		.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
		.replace(/[,.]/g, '');
}
