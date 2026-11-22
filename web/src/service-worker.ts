/// <reference lib="webworker" />

const worker = globalThis as unknown as ServiceWorkerGlobalScope;

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
	evento.waitUntil(
		worker.registration.showNotification(
			typeof aviso?.titulo === 'string' && aviso.titulo.trim() ? aviso.titulo : 'Nosotros',
			{
				body: typeof aviso?.cuerpo === 'string' ? aviso.cuerpo : undefined,
				icon: '/icono-192.png',
				data: { url: destino(aviso?.url) }
			}
		)
	);
});

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
