import { describe, expect, it, vi, afterEach } from 'vitest';
import {
	pb,
	nombre,
	fechaCorta,
	fechaRelativa,
	urlFoto,
	obtenerTokenArchivo,
	type Foto
} from './pb.svelte';

// Tests de caracterización: fijan lo que hacen hoy estas funciones antes del rediseño.

describe('nombre', () => {
	it('usa el name si existe', () => {
		expect(nombre({ name: 'Sofi', email: 'sofi@ejemplo.test' } as never)).toBe('Sofi');
	});

	it('sin name, usa la parte del email antes de la @', () => {
		expect(nombre({ name: '', email: 'jose@ejemplo.test' } as never)).toBe('jose');
	});

	it('sin usuario devuelve "?"', () => {
		expect(nombre(null)).toBe('?');
		expect(nombre(undefined)).toBe('?');
	});
});

describe('fechaCorta', () => {
	it('formatea la fecha de PocketBase (con espacio) como día, mes corto y año', () => {
		expect(fechaCorta('2026-11-13 12:00:00.000Z')).toBe('13 nov 2026');
	});

	it('vacía devuelve cadena vacía', () => {
		expect(fechaCorta('')).toBe('');
	});
});

describe('fechaRelativa', () => {
	const ahora = new Date('2026-11-21T15:00:00');

	it('dice hoy, ayer y hace N días durante la última semana', () => {
		expect(fechaRelativa('2026-11-21 12:00:00.000Z', ahora)).toBe('hoy');
		expect(fechaRelativa('2026-11-20 12:00:00.000Z', ahora)).toBe('ayer');
		expect(fechaRelativa('2026-11-18 12:00:00.000Z', ahora)).toBe('hace 3 días');
	});

	it('después de una semana muestra la fecha corta', () => {
		expect(fechaRelativa('2026-11-08 12:00:00.000Z', ahora)).toBe('8 nov 2026');
	});

	it('vacía devuelve cadena vacía', () => {
		expect(fechaRelativa('', ahora)).toBe('');
	});
});

describe('urlFoto', () => {
	const foto = {
		id: 'abc123',
		collectionId: 'col1',
		collectionName: 'fotos',
		imagen: 'playa.jpg'
	} as Foto;

	it('incluye el token de archivo', () => {
		const url = urlFoto(foto, 'tok');
		expect(url).toContain('/api/files/col1/abc123/playa.jpg');
		expect(url).toContain('token=tok');
		expect(url).not.toContain('thumb=');
	});

	it('agrega la miniatura si se pide', () => {
		expect(urlFoto(foto, 'tok', '400x400')).toContain('thumb=400x400');
	});
});

describe('obtenerTokenArchivo', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('reutiliza el token mientras no vence (90 s) y pide uno nuevo después', async () => {
		vi.useFakeTimers();
		const getToken = vi
			.spyOn(pb.files, 'getToken')
			.mockResolvedValueOnce('t1')
			.mockResolvedValueOnce('t2');

		expect(await obtenerTokenArchivo()).toBe('t1');
		vi.advanceTimersByTime(60_000);
		expect(await obtenerTokenArchivo()).toBe('t1');
		vi.advanceTimersByTime(31_000);
		expect(await obtenerTokenArchivo()).toBe('t2');
		expect(getToken).toHaveBeenCalledTimes(2);
	});

	it('comparte la solicitud de token entre la lista y el calendario', async () => {
		vi.useFakeTimers();
		vi.advanceTimersByTime(5 * 60_000);
		const getToken = vi.spyOn(pb.files, 'getToken').mockResolvedValue('de-prueba');

		const lista = obtenerTokenArchivo();
		const calendario = obtenerTokenArchivo();

		await expect(Promise.all([lista, calendario])).resolves.toEqual(['de-prueba', 'de-prueba']);
		expect(getToken).toHaveBeenCalledOnce();
	});
});

describe('red bloqueada en tests', () => {
	it('cualquier fetch falla', () => {
		expect(() => fetch('http://127.0.0.1:8090/api/health')).toThrow(/no pueden usar la red/);
	});
});
