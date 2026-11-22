/// <reference lib="webworker" />
import { silenciar } from '#lib/avisos-sw.js';

const worker = globalThis as unknown as ServiceWorkerGlobalScope;

// Sin caché offline no hay nada que esperar: la versión nueva toma el control enseguida tras un deploy,
// en vez de quedar en espera hasta que se cierren todas las ventanas de la app.
worker.addEventListener('install', () => void worker.skipWaiting());
worker.addEventListener('activate', (evento) => evento.waitUntil(worker.clients.claim()));

function destino(url: unknown): string {
	const inicio = new URL('/', worker.location.origin);
	if (typeof url === 'string') {
		try {
			const pagina = new URL(url, inicio);
			if (pagina.origin === inicio.origin && /^https?:$/.test(pagina.protocol)) return pagina.href;
		} catch {
			// Con una URL inválida se abre el inicio.
		}
	}
	return inicio.href;
}

worker.addEventListener('push', (evento) => {
	let aviso: { titulo?: unknown; cuerpo?: unknown; url?: unknown } | null = null;
	try {
		aviso = evento.data?.json() ?? null;
	} catch {
		// Un aviso sin JSON válido también se muestra con el nombre de la app.
	}
	evento.waitUntil(mostrar(aviso));
});

async function mostrar(aviso: { titulo?: unknown; cuerpo?: unknown; url?: unknown } | null) {
	const ahora = Date.now();
	// Se apilan como en cualquier app, pero solo vibra uno por minuto (NOS-37).
	const previas = await worker.registration.getNotifications();
	await worker.registration.showNotification(
		typeof aviso?.titulo === 'string' && aviso.titulo.trim() ? aviso.titulo : 'Nosotros',
		{
			body: typeof aviso?.cuerpo === 'string' ? aviso.cuerpo : undefined,
			icon: '/icono-192.png',
			silent: silenciar(previas, ahora),
			data: { url: destino(aviso?.url), enviado: ahora }
		}
	);
}

worker.addEventListener('notificationclick', (evento) => {
	evento.notification.close();
	const url = destino(evento.notification.data?.url);
	evento.waitUntil(abrir(url));
});

async function abrir(url: string) {
	const ventanas = await worker.clients.matchAll({ type: 'window', includeUncontrolled: true });
	const ventana = ventanas.find((cliente) => cliente.url === url) ?? ventanas[0];
	if (ventana) {
		await ventana.focus();
		if (ventana.url === url || (await ventana.navigate(url))) return;
	}
	await worker.clients.openWindow(url);
}
