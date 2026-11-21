import { afterEach, expect, it, vi } from 'vitest';
import {
	aFechaGuardada,
	avisoChoque,
	cargarMes,
	diaDe,
	fechaCortaDia,
	fechaLarga,
	hoyLocal,
	marcasPorDia,
	planesDelDia,
	semanasDelMes
} from './calendario';
import { fechaCorta, pb, type Post } from './pb.svelte';

afterEach(() => vi.restoreAllMocks());

it('guarda el día a mediodía UTC y lo recupera sin conversión horaria', () => {
	expect(aFechaGuardada('2026-11-28')).toBe('2026-11-28 12:00:00.000Z');
	expect(diaDe('2026-11-28 12:00:00.000Z')).toBe('2026-11-28');
	expect(diaDe('')).toBe('');
});

it('toma el día local aunque en UTC ya sea el siguiente', () => {
	expect(hoyLocal(new Date(2026, 10, 21, 23, 30))).toBe('2026-11-21');
});

it('no avisa cuando el día está libre', () => {
	expect(avisoChoque([])).toBe('');
});

it('nombra el plan que ya tienen ese día', () => {
	expect(avisoChoque([{ titulo: 'Cena' }])).toBe('Ese día ya tienen «Cena».');
});

it('nombra el primer plan y cuenta los demás', () => {
	expect(avisoChoque([{ titulo: 'Cena' }, { titulo: 'Cine' }, { titulo: 'Playa' }])).toBe(
		'Ese día ya tienen «Cena» y 2 más.'
	);
});

it('consulta un día UTC que cruza de mes y excluye el plan editado', async () => {
	const planes = [{ id: 'p2', titulo: 'Cena' } as Post];
	const listar = vi.spyOn(pb.collection('posts'), 'getFullList').mockResolvedValue(planes);

	await expect(planesDelDia('2026-11-30', 'p1')).resolves.toBe(planes);
	expect(listar).toHaveBeenCalledExactlyOnceWith({
		filter: expect.stringMatching(
			/^tipo = 'plan' && archivado = false && fecha >= ["']2026-11-30 00:00:00\.000Z["'] && fecha < ["']2026-12-01 00:00:00\.000Z["'] && id != ["']p1["']$/
		),
		requestKey: 'choque'
	});
});

it('cruza de año y usa una exclusión vacía cuando no se edita un plan', async () => {
	const listar = vi.spyOn(pb.collection('posts'), 'getFullList').mockResolvedValue([]);

	await planesDelDia('2026-12-31');
	expect(listar).toHaveBeenCalledExactlyOnceWith({
		filter: expect.stringMatching(
			/^tipo = 'plan' && archivado = false && fecha >= ["']2026-12-31 00:00:00\.000Z["'] && fecha < ["']2027-01-01 00:00:00\.000Z["'] && id != (?:""|'')$/
		),
		requestKey: 'choque'
	});
});

it('arma semanas de lunes a domingo y completa con huecos fuera del mes', () => {
	const semanas = semanasDelMes(2026, 11);

	expect(semanas).toHaveLength(6);
	expect(semanas[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
	expect(semanas[5]).toEqual(['2026-11-30', null, null, null, null, null, null]);
});

it('incluye el día bisiesto y llega hasta el 31 de diciembre', () => {
	expect(semanasDelMes(2028, 2).flat()).toContain('2028-02-29');
	expect(semanasDelMes(2026, 12).flat().filter(Boolean).at(-1)).toBe('2026-12-31');
});

it('distingue lo pendiente de lo hecho y omite planes sin fecha', () => {
	const pendiente = { tipo: 'plan', hecho: false, fecha: '2026-11-28 12:00:00.000Z' } as Post;
	const planHecho = { ...pendiente, hecho: true };
	const momento = { tipo: 'momento', fecha: '2026-11-03 12:00:00.000Z' } as Post;
	const sinFecha = { ...pendiente, fecha: '' };

	expect(marcasPorDia([pendiente, planHecho, momento, sinFecha])).toEqual(
		new Map([
			['2026-11-28', { pendiente: [pendiente], hecho: [planHecho] }],
			['2026-11-03', { pendiente: [], hecho: [momento] }]
		])
	);
});

it('consulta todos los posts fechados del mes hasta el comienzo del año siguiente', async () => {
	const listar = vi.spyOn(pb.collection('posts'), 'getFullList').mockResolvedValue([]);

	await cargarMes(2026, 12);
	expect(listar).toHaveBeenCalledExactlyOnceWith({
		filter: expect.stringMatching(
			/^archivado = false && fecha >= ["']2026-12-01 00:00:00\.000Z["'] && fecha < ["']2027-01-01 00:00:00\.000Z["']$/
		),
		sort: 'fecha',
		requestKey: 'mes'
	});
});

it('muestra el día guardado como un día del calendario local', () => {
	expect(fechaCortaDia('2026-11-28 12:00:00.000Z')).toBe(fechaCorta('2026-11-28T12:00:00'));
});

it('formatea el día con el día de la semana y el mes sin comas ni puntos', () => {
	expect(fechaLarga('2026-11-28')).toBe('sáb 28 nov');
	expect(fechaLarga('2027-01-01')).toBe('vie 1 ene');
});
