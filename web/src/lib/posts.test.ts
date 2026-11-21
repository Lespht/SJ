import { afterEach, expect, it, vi } from 'vitest';
import {
	agregarFotos,
	archivar,
	borrarFoto,
	borrarPost,
	completarPlan,
	crearMomento,
	crearPlan,
	editarPost,
	ErrorFotosMomento,
	ErrorFotosPlan,
	fijarFecha,
	motivoParaNoBorrar,
	restaurar
} from './posts';
import { EXPAND_POST, fotosDe } from './feed.svelte';
import { pb, type Foto, type Post } from './pb.svelte';

const plan = { id: 'plan1', tipo: 'plan' } as Post;
const fecha = '2026-11-21';
const fechaGuardada = '2026-11-21 12:00:00.000Z';

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

it('edita únicamente el texto y la fecha de un momento', async () => {
	const momento = { id: 'm1', tipo: 'momento' } as Post;
	const actualizar = vi.spyOn(pb.collection('posts'), 'update').mockResolvedValue(momento);

	await expect(
		editarPost(momento, { texto: 'hola', dia: '2026-11-20', titulo: 'x', categoria: 'cita' })
	).resolves.toBe(momento);
	expect(actualizar).toHaveBeenCalledExactlyOnceWith(
		momento.id,
		{ texto: 'hola', fecha: '2026-11-20 12:00:00.000Z' },
		{ expand: EXPAND_POST }
	);
});

it('edita el título, el día y la hora de un plan', async () => {
	const actualizar = vi.spyOn(pb.collection('posts'), 'update').mockResolvedValue(plan);

	await editarPost(plan, { titulo: 'Cena', dia: '2026-11-28', hora: '21:00' });
	expect(actualizar).toHaveBeenCalledExactlyOnceWith(
		plan.id,
		{ titulo: 'Cena', fecha: '2026-11-28 12:00:00.000Z', hora: '21:00' },
		{ expand: EXPAND_POST }
	);
});

it('borra también la hora si se quita el día del plan', async () => {
	const actualizar = vi.spyOn(pb.collection('posts'), 'update').mockResolvedValue(plan);

	await editarPost(plan, { dia: '', hora: '21:00' });
	expect(actualizar).toHaveBeenCalledExactlyOnceWith(
		plan.id,
		{ fecha: '', hora: '' },
		{ expand: EXPAND_POST }
	);
});

it('agrega las fotos al mismo post con el usuario que las sube y la fecha del post', async () => {
	const salida = { ...plan, fecha: fechaGuardada };
	const subir = vi.spyOn(pb.collection('fotos'), 'create').mockResolvedValue({ id: 'f1' } as Foto);
	const archivos = ['una.jpg', 'dos.jpg'].map((nombre) => new File(['foto'], nombre));

	await expect(agregarFotos(salida, archivos, 'u1')).resolves.toBe(salida);
	expect(subir.mock.calls.map(([form]) => Object.fromEntries(form as FormData))).toEqual(
		archivos.map((imagen) => ({ imagen, post: salida.id, autor: 'u1', fecha: fechaGuardada }))
	);
});

it('reintenta desde la foto que falló y usa hoy para un plan sin fecha', async () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(2026, 10, 21, 17, 0));
	const salida = { ...plan, fecha: '' };
	const subir = vi
		.spyOn(pb.collection('fotos'), 'create')
		.mockResolvedValue({ id: 'f1' } as Foto)
		.mockResolvedValueOnce({ id: 'f1' } as Foto)
		.mockRejectedValueOnce(new Error('Falló la segunda foto'));
	const archivos = ['una.jpg', 'dos.jpg'].map((nombre) => new File(['foto'], nombre));

	const fallo = await agregarFotos(salida, archivos, 'u1').catch((error: unknown) => error);
	if (!(fallo instanceof ErrorFotosPlan))
		throw new Error('Faltó el error de subida', { cause: fallo });
	await expect(fallo.reintentar()).resolves.toBe(salida);
	expect(subir.mock.calls.map(([form]) => Object.fromEntries(form as FormData))).toEqual(
		[archivos[0], archivos[1], archivos[1]].map((imagen) => ({
			imagen,
			post: salida.id,
			autor: 'u1',
			fecha: fechaGuardada
		}))
	);
});

it('crea un solo momento y le vincula sus dos fotos', async () => {
	const momento = { id: 'm1', tipo: 'momento' } as Post;
	const crear = vi.spyOn(pb.collection('posts'), 'create').mockResolvedValue(momento);
	const subir = vi.spyOn(pb.collection('fotos'), 'create').mockResolvedValue({ id: 'f1' } as Foto);
	const archivos = ['una.jpg', 'dos.jpg'].map((nombre) => new File(['foto'], nombre));

	await expect(crearMomento(archivos, 'Una tarde', fecha, 'u1')).resolves.toBe(momento);
	expect(crear).toHaveBeenCalledExactlyOnceWith({
		tipo: 'momento',
		texto: 'Una tarde',
		fecha: fechaGuardada,
		autor: 'u1'
	});
	expect(crear).toHaveBeenCalledBefore(subir);
	expect(subir).toHaveBeenCalledTimes(2);
	for (const [i, imagen] of archivos.entries()) {
		expect(Object.fromEntries(subir.mock.calls[i][0] as FormData)).toEqual({
			imagen,
			post: momento.id,
			autor: 'u1',
			fecha: fechaGuardada,
			descripcion: 'Una tarde'
		});
	}
});

it('rechaza compartir un momento sin fotos antes de llamar a la API', async () => {
	const crear = vi.spyOn(pb.collection('posts'), 'create');
	const subir = vi.spyOn(pb.collection('fotos'), 'create');

	await expect(crearMomento([], 'Una tarde', fecha, 'u1')).rejects.toThrow(
		'Elegí al menos una foto.'
	);
	expect(crear).not.toHaveBeenCalled();
	expect(subir).not.toHaveBeenCalled();
});

it('reanuda la subida del mismo momento desde la foto que falló', async () => {
	const momento = { id: 'm1', tipo: 'momento' } as Post;
	const crear = vi.spyOn(pb.collection('posts'), 'create').mockResolvedValue(momento);
	const subir = vi
		.spyOn(pb.collection('fotos'), 'create')
		.mockResolvedValue({ id: 'f1' } as Foto)
		.mockResolvedValueOnce({ id: 'f1' } as Foto)
		.mockRejectedValueOnce(new Error('Falló la segunda foto'));
	const archivos = ['una.jpg', 'dos.jpg'].map((nombre) => new File(['foto'], nombre));

	const fallo = await crearMomento(archivos, '', fecha, 'u1').catch((err: unknown) => err);
	if (!(fallo instanceof ErrorFotosMomento))
		throw new Error('Faltó el error de subida', { cause: fallo });
	await expect(fallo.reintentar()).resolves.toBe(momento);
	expect(crear).toHaveBeenCalledTimes(1);
	expect(subir.mock.calls.map(([form]) => (form as FormData).get('imagen'))).toEqual([
		archivos[0],
		archivos[1],
		archivos[1]
	]);
});

it('crea el plan como pendiente', async () => {
	const crear = vi.spyOn(pb.collection('posts'), 'create').mockResolvedValue(plan);
	const datos = { titulo: 'Paseo', texto: 'En la tarde', categoria: 'cita', autor: 'u1' } as const;

	await expect(crearPlan(datos)).resolves.toBe(plan);
	expect(crear).toHaveBeenCalledExactlyOnceWith({
		...datos,
		tipo: 'plan',
		hecho: false,
		fecha: '',
		hora: ''
	});
});

it('crea un plan pendiente con el día y la hora elegidos', async () => {
	const crear = vi.spyOn(pb.collection('posts'), 'create').mockResolvedValue(plan);
	const datos = { titulo: 'Cena', texto: '', categoria: 'comida', autor: 'u1' } as const;

	await expect(crearPlan({ ...datos, dia: '2026-11-28', hora: '21:00' })).resolves.toBe(plan);
	expect(crear).toHaveBeenCalledExactlyOnceWith({
		...datos,
		tipo: 'plan',
		hecho: false,
		fecha: '2026-11-28 12:00:00.000Z',
		hora: '21:00'
	});
});

it('crea el plan sin hora si no eligieron un día', async () => {
	const crear = vi.spyOn(pb.collection('posts'), 'create').mockResolvedValue(plan);
	const datos = { titulo: 'Cena', texto: '', categoria: 'comida', autor: 'u1' } as const;

	await crearPlan({ ...datos, hora: '21:00' });
	expect(crear).toHaveBeenCalledExactlyOnceWith({
		...datos,
		tipo: 'plan',
		hecho: false,
		fecha: '',
		hora: ''
	});
});

it('fija el día del plan sin exigir hora', async () => {
	const actualizar = vi.spyOn(pb.collection('posts'), 'update').mockResolvedValue(plan);

	await expect(fijarFecha(plan, '2026-11-28', '')).resolves.toBe(plan);
	expect(actualizar).toHaveBeenCalledExactlyOnceWith(plan.id, {
		fecha: '2026-11-28 12:00:00.000Z',
		hora: ''
	});
});

it('borra la hora cuando se quita el día del plan', async () => {
	const actualizar = vi.spyOn(pb.collection('posts'), 'update').mockResolvedValue(plan);

	await fijarFecha(plan, '', '21:00');
	expect(actualizar).toHaveBeenCalledExactlyOnceWith(plan.id, { fecha: '', hora: '' });
});

it('completa el plan antes de subir sus dos fotos con la misma fecha', async () => {
	const actualizar = vi.spyOn(pb.collection('posts'), 'update').mockResolvedValue(plan);
	const subir = vi.spyOn(pb.collection('fotos'), 'create').mockResolvedValue({ id: 'f1' } as Foto);
	const archivos = ['una.jpg', 'dos.jpg'].map((nombre) => new File(['foto'], nombre));

	await completarPlan(plan, archivos, fecha, 'u2');

	expect(actualizar).toHaveBeenCalledExactlyOnceWith(plan.id, {
		hecho: true,
		fecha: fechaGuardada
	});
	expect(subir).toHaveBeenCalledTimes(2);
	expect(actualizar).toHaveBeenCalledBefore(subir);
	for (const [i, archivo] of archivos.entries()) {
		const form = subir.mock.calls[i][0] as FormData;
		expect(Object.fromEntries(form)).toEqual({
			imagen: archivo,
			post: plan.id,
			autor: 'u2',
			fecha: fechaGuardada
		});
	}
});

it('completa el plan sin subir fotos si el lote está vacío', async () => {
	const actualizar = vi.spyOn(pb.collection('posts'), 'update').mockResolvedValue(plan);
	const subir = vi.spyOn(pb.collection('fotos'), 'create');

	await completarPlan(plan, [], fecha, 'u2');

	expect(actualizar).toHaveBeenCalledExactlyOnceWith(plan.id, {
		hecho: true,
		fecha: fechaGuardada
	});
	expect(subir).not.toHaveBeenCalled();
});

it('informa que el plan quedó hecho si una foto falla durante la subida', async () => {
	const hecho = { ...plan, hecho: true, fecha: fechaGuardada };
	vi.spyOn(pb.collection('posts'), 'update').mockResolvedValue(hecho);
	const problema = new Error('No se pudo subir la segunda foto');
	const subir = vi
		.spyOn(pb.collection('fotos'), 'create')
		.mockResolvedValueOnce({ id: 'f1' } as Foto)
		.mockRejectedValueOnce(problema);
	const archivos = ['una.jpg', 'dos.jpg', 'tres.jpg'].map((nombre) => new File(['foto'], nombre));

	await expect(completarPlan(plan, archivos, fecha, 'u2')).rejects.toMatchObject({
		plan: hecho,
		cause: problema
	});
	expect(subir).toHaveBeenCalledTimes(2);
});

it('guarda la fecha al archivar y la vacía al restaurar', async () => {
	const ahora = new Date('2026-11-22T00:30:00.000Z');
	vi.useFakeTimers();
	vi.setSystemTime(ahora);
	const actualizar = vi.spyOn(pb.collection('posts'), 'update').mockResolvedValue(plan);

	await archivar(plan);
	await restaurar(plan);

	expect(actualizar).toHaveBeenNthCalledWith(1, plan.id, {
		archivado: true,
		archivado_en: ahora.toISOString()
	});
	expect(actualizar).toHaveBeenNthCalledWith(2, plan.id, { archivado: false, archivado_en: '' });
});

it('borra el post por id', async () => {
	const borrar = vi.spyOn(pb.collection('posts'), 'delete').mockResolvedValue(true);
	await borrarPost(plan);
	expect(borrar).toHaveBeenCalledExactlyOnceWith(plan.id);
});

function conFotos(post: Partial<Post>, autores: string[]): Post {
	const fotos = autores.map(
		(autor, i) => ({ id: `f${i}`, autor, created: `${i}` }) as unknown as Foto
	);
	return { autor: 'yo', ...post, expand: { fotos_via_post: fotos } } as Post;
}

it('deja borrar un momento propio aunque tenga fotos', () => {
	expect(motivoParaNoBorrar(conFotos({ tipo: 'momento' }, ['yo', 'yo']), 'yo')).toBe('');
});

it('deja borrar un plan propio sin fotos o solo con fotos propias', () => {
	expect(motivoParaNoBorrar(conFotos({ tipo: 'plan' }, []), 'yo')).toBe('');
	expect(motivoParaNoBorrar(conFotos({ tipo: 'plan' }, ['yo']), 'yo')).toBe('');
});

it('no deja borrar un plan propio que tiene fotos del otro, aunque esté archivado', () => {
	const motivo = 'Tiene fotos del otro: que saque las suyas, o archivalo.';
	expect(motivoParaNoBorrar(conFotos({ tipo: 'plan' }, ['yo', 'otro']), 'yo')).toBe(motivo);
	expect(motivoParaNoBorrar(conFotos({ tipo: 'plan', archivado: true }, ['otro']), 'yo')).toBe(
		motivo
	);
});

it('no deja borrar lo que subió el otro', () => {
	expect(motivoParaNoBorrar(conFotos({ tipo: 'momento', autor: 'otro' }, []), 'yo')).toBe(
		'Solo quien lo subió puede borrarlo.'
	);
});

it('borra una foto y deja el momento si le quedan otras', async () => {
	const momento = conFotos({ id: 'm1', tipo: 'momento' }, ['yo', 'yo']);
	const borrarF = vi.spyOn(pb.collection('fotos'), 'delete').mockResolvedValue(true);
	const borrarP = vi.spyOn(pb.collection('posts'), 'delete').mockResolvedValue(true);

	await expect(borrarFoto(fotosDe(momento)[0], momento)).resolves.toEqual({ postBorrado: false });
	expect(borrarF).toHaveBeenCalledExactlyOnceWith('f0');
	expect(borrarP).not.toHaveBeenCalled();
});

it('al borrar la última foto de un momento, borra también el momento', async () => {
	const momento = conFotos({ id: 'm1', tipo: 'momento' }, ['yo']);
	const borrarF = vi.spyOn(pb.collection('fotos'), 'delete').mockResolvedValue(true);
	const borrarP = vi.spyOn(pb.collection('posts'), 'delete').mockResolvedValue(true);

	await expect(borrarFoto(fotosDe(momento)[0], momento)).resolves.toEqual({ postBorrado: true });
	expect(borrarF).toHaveBeenCalledBefore(borrarP);
	expect(borrarP).toHaveBeenCalledExactlyOnceWith('m1');
});

it('un plan sin fotos sigue existiendo al sacarle la última foto', async () => {
	const salida = conFotos({ id: 'p1', tipo: 'plan', hecho: true }, ['yo']);
	vi.spyOn(pb.collection('fotos'), 'delete').mockResolvedValue(true);
	const borrarP = vi.spyOn(pb.collection('posts'), 'delete').mockResolvedValue(true);

	await expect(borrarFoto(fotosDe(salida)[0], salida)).resolves.toEqual({ postBorrado: false });
	expect(borrarP).not.toHaveBeenCalled();
});
