import { expect, it } from 'vitest';
import { aFechaGuardada, diaDe, hoyLocal } from './calendario';

it('guarda el día a mediodía UTC y lo recupera sin conversión horaria', () => {
	expect(aFechaGuardada('2026-11-28')).toBe('2026-11-28 12:00:00.000Z');
	expect(diaDe('2026-11-28 12:00:00.000Z')).toBe('2026-11-28');
	expect(diaDe('')).toBe('');
});

it('toma el día local aunque en UTC ya sea el siguiente', () => {
	expect(hoyLocal(new Date(2026, 10, 21, 23, 30))).toBe('2026-11-21');
});
