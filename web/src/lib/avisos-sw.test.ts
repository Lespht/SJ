import { expect, it } from 'vitest';
import { silenciar } from './avisos-sw';

const ahora = Date.parse('2026-11-22T12:00:00Z');

it('vibra si no hay avisos, o si el último llegó hace más de un minuto', () => {
	expect(silenciar([], ahora)).toBe(false);
	expect(silenciar([{ data: { enviado: ahora - 61_000 } }], ahora)).toBe(false);
	expect(silenciar([{ data: null }], ahora)).toBe(false);
});

it('llega sin vibrar si otro aviso llegó hace menos de un minuto', () => {
	expect(
		silenciar([{ data: { enviado: ahora - 61_000 } }, { data: { enviado: ahora - 20_000 } }], ahora)
	).toBe(true);
});
