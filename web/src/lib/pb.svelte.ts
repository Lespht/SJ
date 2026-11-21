import PocketBase, { type RecordModel } from 'pocketbase';

// Mismo origen: en producción la sirve PocketBase y en dev el proxy de Vite.
export const pb = new PocketBase('/');

export type Usuario = RecordModel & { name?: string; email: string; avatar?: string };

export type Foto = RecordModel & {
	imagen: string;
	descripcion: string;
	fecha: string;
	autor: string;
	expand?: { autor?: Usuario; notas_via_foto?: Nota[] };
};

/** Nota de una persona sobre una foto (una por persona por foto). */
export type Nota = RecordModel & {
	foto: string;
	autor: string;
	texto: string;
	expand?: { autor?: Usuario };
};

export type Idea = RecordModel & {
	titulo: string;
	detalle: string;
	categoria: '' | 'cita' | 'viaje' | 'regalo' | 'comida' | 'otro';
	hecha: boolean;
	autor: string;
	expand?: { autor?: Usuario };
};

export type Mensaje = RecordModel & {
	texto: string;
	autor: string;
	expand?: { autor?: Usuario };
};

export type Puntaje = RecordModel & {
	juego: string;
	puntos: number;
	autor: string;
	expand?: { autor?: Usuario };
};

/** Usuario logueado, reactivo. */
export const sesion = $state<{ usuario: Usuario | null }>({
	usuario: pb.authStore.isValid ? (pb.authStore.record as Usuario) : null
});

pb.authStore.onChange(() => {
	sesion.usuario = pb.authStore.isValid ? (pb.authStore.record as Usuario) : null;
});

/**
 * Renueva el token al abrir la app. Solo cierra la sesión si el servidor dice que el
 * token ya no sirve (401/403/404). Sin red o con el servidor caído, la sesión se mantiene.
 */
export async function renovarSesion() {
	if (!pb.authStore.isValid) return;
	try {
		await pb.collection('users').authRefresh();
	} catch (e) {
		const status = (e as { status?: number }).status ?? 0;
		if ([401, 403, 404].includes(status)) pb.authStore.clear();
	}
}

export function nombre(u?: Usuario | null) {
	if (!u) return '?';
	return u.name || u.email.split('@')[0];
}

/**
 * Las fotos están protegidas: hace falta un token de archivo (dura unos minutos).
 * Lo pedimos una vez y lo reutilizamos.
 */
let tokenArchivo: { valor: string; vence: number } | null = null;

export async function obtenerTokenArchivo() {
	if (!tokenArchivo || Date.now() > tokenArchivo.vence) {
		tokenArchivo = { valor: await pb.files.getToken(), vence: Date.now() + 90_000 };
	}
	return tokenArchivo.valor;
}

export function urlFoto(foto: Foto, token: string, thumb?: string) {
	return pb.files.getURL(foto, foto.imagen, { token, ...(thumb ? { thumb } : {}) });
}

export function fechaCorta(iso: string) {
	if (!iso) return '';
	return new Date(iso.replace(' ', 'T')).toLocaleDateString('es', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
}
