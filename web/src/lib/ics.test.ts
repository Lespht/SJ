import { expect, it } from 'vitest';
import { generarIcs, nombreIcs } from './ics';

const ahora = new Date(Date.UTC(2026, 10, 21, 15, 4, 5));
const base = { id: 'p1', titulo: 'Cena', texto: '', fecha: '2026-11-28 12:00:00.000Z', hora: '' };

function lineas(ics: string) {
	return ics.replace(/\r\n /g, '').split('\r\n');
}

it('arma un evento de todo el día cuando el plan no tiene hora', () => {
	const ics = generarIcs(base, ahora);
	expect(lineas(ics)).toEqual([
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Nosotros//ES',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		'UID:p1@nosotros',
		'DTSTAMP:20261121T150405Z',
		'DTSTART;VALUE=DATE:20261128',
		'DTEND;VALUE=DATE:20261129',
		'SUMMARY:Cena',
		'END:VEVENT',
		'END:VCALENDAR',
		''
	]);
});

it('usa la hora local del celular y dura dos horas cuando el plan tiene hora', () => {
	const ics = lineas(generarIcs({ ...base, hora: '21:00' }, ahora));
	expect(ics).toContain('DTSTART:20261128T210000');
	expect(ics).toContain('DURATION:PT2H');
	expect(ics.some((l) => l.startsWith('DTEND'))).toBe(false);
});

it('el día siguiente cruza de año', () => {
	const ics = lineas(generarIcs({ ...base, fecha: '2026-12-31 12:00:00.000Z' }, ahora));
	expect(ics).toContain('DTEND;VALUE=DATE:20270101');
});

it('escapa los caracteres especiales y agrega los detalles', () => {
	const ics = lineas(
		generarIcs({ ...base, titulo: 'Cena; vino, y \\ postre', texto: 'Llevar:\nflores' }, ahora)
	);
	expect(ics).toContain('SUMMARY:Cena\\; vino\\, y \\\\ postre');
	expect(ics).toContain('DESCRIPTION:Llevar:\\nflores');
});

it('pliega las líneas largas sin pasar de 75 bytes ni cortar un carácter', () => {
	const titulo = 'Cumpleaños de mamá en el café ñandú '.repeat(5);
	const ics = generarIcs({ ...base, titulo }, ahora);
	const codificador = new TextEncoder();
	for (const linea of ics.split('\r\n')) {
		expect(codificador.encode(linea).length).toBeLessThanOrEqual(75);
		expect(linea).not.toContain('�');
	}
	expect(lineas(ics)).toContain(`SUMMARY:${titulo}`);
	expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
});

it('nombra el archivo con el título, sin acentos ni símbolos', () => {
	expect(nombreIcs('Cena en lo de Mati!')).toBe('cena-en-lo-de-mati.ics');
	expect(nombreIcs('Cumpleaños de mamá')).toBe('cumpleanos-de-mama.ics');
	expect(nombreIcs('¡¿?!')).toBe('plan.ics');
});
