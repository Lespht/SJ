import type { Post } from './pb.svelte.js';

type PlanIcs = Pick<Post, 'id' | 'titulo' | 'texto' | 'fecha' | 'hora'>;

/**
 * Evento iCalendar (RFC 5545) de un plan con fecha. Sin hora es de todo el día; con hora
 * queda en la hora local del celular (sin zona) y dura dos horas.
 */
export function generarIcs(plan: PlanIcs, ahora: Date): string {
	const dia = plan.fecha.slice(0, 10).replaceAll('-', '');
	const cuando = plan.hora
		? [`DTSTART:${dia}T${plan.hora.replace(':', '')}00`, 'DURATION:PT2H']
		: [`DTSTART;VALUE=DATE:${dia}`, `DTEND;VALUE=DATE:${diaSiguiente(plan.fecha)}`];
	const lineas = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Nosotros//ES',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:${plan.id}@nosotros`,
		`DTSTAMP:${ahora.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
		...cuando,
		`SUMMARY:${escapar(plan.titulo)}`,
		...(plan.texto ? [`DESCRIPTION:${escapar(plan.texto)}`] : []),
		'END:VEVENT',
		'END:VCALENDAR'
	];
	return lineas.map(plegar).join('\r\n') + '\r\n';
}

export function nombreIcs(titulo: string): string {
	const base = titulo
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return `${base || 'plan'}.ics`;
}

/** Baja el .ics; el celular lo abre con su app de calendario. */
export function descargarIcs(plan: PlanIcs): void {
	const blob = new Blob([generarIcs(plan, new Date())], { type: 'text/calendar;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const enlace = document.createElement('a');
	enlace.href = url;
	enlace.download = nombreIcs(plan.titulo);
	enlace.click();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function diaSiguiente(fecha: string): string {
	const d = new Date(`${fecha.slice(0, 10)}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + 1);
	return d.toISOString().slice(0, 10).replaceAll('-', '');
}

function escapar(texto: string): string {
	return texto.replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n');
}

/** Líneas de hasta 75 bytes; las siguientes empiezan con un espacio. No corta caracteres. */
function plegar(linea: string): string {
	const partes: string[] = [];
	let actual = '';
	let bytes = 0;
	for (const caracter of linea) {
		const tam = new TextEncoder().encode(caracter).length;
		const limite = partes.length ? 74 : 75;
		if (bytes + tam > limite) {
			partes.push(actual);
			actual = '';
			bytes = 0;
		}
		actual += caracter;
		bytes += tam;
	}
	partes.push(actual);
	return partes.join('\r\n ');
}
