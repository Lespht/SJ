import { afterEach, expect, it, vi } from 'vitest';
import { archivar, borrarPost, completarPlan, crearPlan, restaurar } from './posts';
import { pb, type Foto, type Post } from './pb.svelte';

const plan = { id: 'plan1', tipo: 'plan' } as Post;
const fecha = '2026-11-21';
const fechaGuardada = '2026-11-21 12:00:00.000Z';

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

it('crea el plan como pendiente', async () => {
	const crear = vi.spyOn(pb.collection('posts'), 'create').mockResolvedValue(plan);
	const datos = { titulo: 'Paseo', texto: 'En la tarde', categoria: 'cita', autor: 'u1' } as const;

	await expect(crearPlan(datos)).resolves.toBe(plan);
	expect(crear).toHaveBeenCalledExactlyOnceWith({ ...datos, tipo: 'plan', hecho: false });
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
