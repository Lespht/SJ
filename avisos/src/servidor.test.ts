import { expect, it, vi } from 'vitest';
import { atender } from './servidor.ts';

const pedido = {
	suscripciones: [{ endpoint: 'https://push.test/a', p256dh: 'pa', auth: 'aa' }],
	aviso: { titulo: 'Sofi', cuerpo: 'Hola', url: '/mensajes' }
};

function preparar(vencidas: string[] = []) {
	const entregar = vi.fn().mockResolvedValue(vencidas);
	const informarVencidas = vi.fn().mockResolvedValue(undefined);
	return { secreto: 'clave', entregar, informarVencidas };
}

it('sin la clave compartida responde 401 y no manda nada', async () => {
	const deps = preparar();
	const r = atender({ metodo: 'POST', ruta: '/enviar', clave: 'otra', cuerpo: pedido }, deps);
	expect(r.estado).toBe(401);
	await r.despues;
	expect(deps.entregar).not.toHaveBeenCalled();
});

it('fuera de POST /enviar responde 404', () => {
	const deps = preparar();
	expect(
		atender({ metodo: 'GET', ruta: '/enviar', clave: 'clave', cuerpo: null }, deps).estado
	).toBe(404);
});

it('un pedido con otra forma responde 400', () => {
	const deps = preparar();
	const r = atender({ metodo: 'POST', ruta: '/enviar', clave: 'clave', cuerpo: { x: 1 } }, deps);
	expect(r.estado).toBe(400);
});

it('responde 202 al instante y entrega después', async () => {
	const deps = preparar();
	const r = atender({ metodo: 'POST', ruta: '/enviar', clave: 'clave', cuerpo: pedido }, deps);
	expect(r.estado).toBe(202);
	await r.despues;
	expect(deps.entregar).toHaveBeenCalledExactlyOnceWith(pedido.suscripciones, pedido.aviso);
	expect(deps.informarVencidas).not.toHaveBeenCalled();
});

it('si hubo celulares vencidos, se los informa a PocketBase', async () => {
	const deps = preparar(['https://push.test/a']);
	await atender({ metodo: 'POST', ruta: '/enviar', clave: 'clave', cuerpo: pedido }, deps).despues;
	expect(deps.informarVencidas).toHaveBeenCalledExactlyOnceWith(['https://push.test/a']);
});
