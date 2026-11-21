import { expect, it } from 'vitest';
import { alcanzaUmbral, desplazamiento } from './tirar';

it.each([
	[-10, 0],
	[0, 0],
	[100, 50],
	[400, 90]
])('convierte %d px de gesto en %d px de desplazamiento', (dy, esperado) => {
	expect(desplazamiento(dy)).toBe(esperado);
});

it.each([
	[119, false],
	[120, true]
])('indica si %d px de gesto alcanzan el umbral', (dy, esperado) => {
	expect(alcanzaUmbral(dy)).toBe(esperado);
});
