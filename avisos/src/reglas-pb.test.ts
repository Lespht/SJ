// Prueba la lógica pura de los hooks de PocketBase (server/pb_hooks/avisos_reglas.js, CommonJS).
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const r = createRequire(import.meta.url)('../../server/pb_hooks/avisos_reglas.js');

const MIN = 60_000;

describe('textos', () => {
	it('un mensaje lleva el nombre y el texto, cortado si es largo', () => {
		expect(r.avisoMensaje('Sofi', 'hola')).toEqual({
			titulo: 'Sofi',
			cuerpo: 'hola',
			url: '/mensajes'
		});
		const largo = r.avisoMensaje('Sofi', 'a'.repeat(150)).cuerpo;
		expect(largo).toHaveLength(100);
		expect(largo.endsWith('…')).toBe(true);
	});

	it('un post nuevo se anuncia según lo que es', () => {
		const url = '/post/p1';
		expect(r.avisoPostNuevo('Sofi', { id: 'p1', tipo: 'momento', texto: 'mar' })).toEqual({
			titulo: 'Sofi compartió un momento',
			cuerpo: 'mar',
			url
		});
		expect(
			r.avisoPostNuevo('Sofi', { id: 'p1', tipo: 'momento', texto: '', respuesta_a: 'm0' })
		).toEqual({ titulo: 'Sofi respondió a tu momento', url });
		expect(
			r.avisoPostNuevo('Sofi', { id: 'p1', tipo: 'plan', titulo: 'Cine', hecho: false })
		).toEqual({ titulo: 'Sofi propuso un plan', cuerpo: '«Cine»', url });
		expect(
			r.avisoPostNuevo('Sofi', { id: 'p1', tipo: 'plan', titulo: 'Cine', hecho: true })
		).toEqual({
			titulo: 'Sofi compartió un plan hecho',
			cuerpo: '«Cine»',
			url
		});
	});

	it('plan hecho, fotos sumadas y recordatorio', () => {
		expect(r.avisoPlanHecho({ id: 'p1', titulo: 'Cine' })).toEqual({
			titulo: '«Cine» quedó hecho',
			url: '/post/p1'
		});
		expect(r.avisoFotos('Sofi', { id: 'p1', tipo: 'plan', titulo: 'Cine' })).toEqual({
			titulo: 'Sofi sumó fotos a «Cine»',
			url: '/post/p1'
		});
		expect(r.avisoFotos('Sofi', { id: 'm1', tipo: 'momento' }).titulo).toBe(
			'Sofi sumó fotos a un momento'
		);
		expect(r.avisoRecordatorio({ id: 'p1', titulo: 'Cine', hora: '21:00' })).toEqual({
			titulo: 'Hoy: «Cine»',
			cuerpo: 'A las 21:00',
			url: '/post/p1'
		});
		expect(r.avisoRecordatorio({ id: 'p1', titulo: 'Cine', hora: '' })).toEqual({
			titulo: 'Hoy: «Cine»',
			url: '/post/p1'
		});
	});
});

describe('cuándo se avisa', () => {
	it('solo avisa cuando un plan pasa de pendiente a hecho', () => {
		expect(r.seCompleto(false, true)).toBe(true);
		expect(r.seCompleto(true, true)).toBe(false);
		expect(r.seCompleto(false, false)).toBe(false);
	});

	it('las fotos de un post recién creado no avisan aparte; las sumadas, una vez cada 30 min', () => {
		const ahora = Date.parse('2026-11-22T12:00:00Z');
		const hace = (min: number) => ahora - min * MIN;
		expect(r.avisarFotos(hace(2), 0, ahora)).toBe(false);
		expect(r.avisarFotos(hace(60), 0, ahora)).toBe(true);
		expect(r.avisarFotos(hace(60), hace(10), ahora)).toBe(false);
		expect(r.avisarFotos(hace(60), hace(31), ahora)).toBe(true);
	});

	it('el día del recordatorio es el de El Salvador (UTC−6)', () => {
		expect(r.diaElSalvador(Date.parse('2026-11-22T15:00:00Z'))).toBe('2026-11-22');
		expect(r.diaElSalvador(Date.parse('2026-11-23T03:00:00Z'))).toBe('2026-11-22');
	});
});
