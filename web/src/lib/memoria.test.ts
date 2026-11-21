import { describe, expect, it } from 'vitest';
import { armarCartas, PARES, puntosPor } from './memoria';

const fotos = (n: number) =>
	Array.from({ length: n }, (_, i) => ({ id: `f${i}`, src: `/foto${i}.jpg`, alt: '' }));
const sinMezclar = <T>(a: T[]) => a;

describe('armarCartas', () => {
	it('con 8 fotos o más usa solo fotos: 16 cartas, cada foto dos veces', () => {
		const cartas = armarCartas(fotos(10), sinMezclar);
		expect(cartas).toHaveLength(PARES * 2);
		expect(cartas.every((c) => c.cara.tipo === 'foto')).toBe(true);
		const claves = cartas.map((c) => c.clave);
		for (const clave of new Set(claves)) expect(claves.filter((k) => k === clave)).toHaveLength(2);
		expect(new Set(claves).size).toBe(PARES);
	});

	it('con menos de 8 fotos completa con figuras dibujadas', () => {
		const cartas = armarCartas(fotos(3), sinMezclar);
		expect(cartas).toHaveLength(PARES * 2);
		expect(cartas.filter((c) => c.cara.tipo === 'foto')).toHaveLength(6);
		expect(cartas.filter((c) => c.cara.tipo === 'figura')).toHaveLength(10);
	});

	it('sin fotos juega solo con figuras', () => {
		const cartas = armarCartas([], sinMezclar);
		expect(new Set(cartas.map((c) => c.clave)).size).toBe(PARES);
	});

	it('cada carta tiene un id único y empieza tapada', () => {
		const cartas = armarCartas(fotos(8), sinMezclar);
		expect(new Set(cartas.map((c) => c.id)).size).toBe(16);
		expect(cartas.every((c) => !c.visible && !c.encontrada)).toBe(true);
	});
});

describe('puntosPor', () => {
	it('200 con el mínimo de intentos, 10 menos por intento extra, nunca menos de 10', () => {
		expect(puntosPor(PARES)).toBe(200);
		expect(puntosPor(PARES + 3)).toBe(170);
		expect(puntosPor(100)).toBe(10);
	});
});
