import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// En desarrollo, Vite reenvía la API a PocketBase (puerto 8090),
// así el frontend siempre habla con "/" igual que en producción.
const POCKETBASE = 'http://127.0.0.1:8090';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// SPA compilada directo a la carpeta que sirve PocketBase.
			// PocketBase devuelve index.html para cualquier ruta (--indexFallback).
			adapter: adapter({
				pages: '../server/pb_public',
				fallback: 'index.html'
			})
		})
	],
	server: {
		// Solo local. Para probar desde el celular en la LAN: `pnpm dev --host`.
		proxy: {
			'/api': { target: POCKETBASE, changeOrigin: true },
			'/_': { target: POCKETBASE, changeOrigin: true }
		}
	}
});
