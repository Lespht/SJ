import { afterEach, expect, it, vi } from 'vitest';
import { aFechaGuardada, avisoChoque, diaDe, hoyLocal, planesDelDia } from './calendario';
import { pb, type Post } from './pb.svelte';

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
