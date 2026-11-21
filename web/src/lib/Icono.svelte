<script lang="ts" module>
	// Íconos de línea (24×24, trazo 1.7). Sin emojis en la interfaz.
	const TRAZOS = {
		mas: '<path d="M12 5v14M5 12h14"/>',
		inicio: '<path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z"/>',
		planes: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
		perfil: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5"/>',
		juegos:
			'<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/>',
		mensajes: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
		cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
		recargar: '<path d="M20 11a8 8 0 1 0-2 6M20 5v6h-6"/>',
		editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
		borrar: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
		salir: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
		paleta:
			'<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.2-1.6-1.2-2.8 0-1 .8-1.7 1.8-1.7h2.1a4 4 0 0 0 4-4C20.5 6.8 16.7 3.5 12 3.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.3" r="1"/><circle cx="14.5" cy="7.3" r="1"/>',
		// Figuras del memotest (cuando no alcanzan las fotos).
		luna: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
		sol: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
		flor: '<circle cx="12" cy="10" r="2"/><path d="M12 8c0-3 3-3 3-1s-3 3-3 3M12 8c0-3-3-3-3-1s3 3 3 3M14 10c3 0 3 3 1 3s-3-3-3-3M10 10c-3 0-3 3-1 3s3-3 3-3M12 12v9M12 17c-2 0-3.5-1-4-2.5M12 18c2 0 3.5-1 4-2.5"/>',
		taza: '<path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 11h1.5a2 2 0 0 1 0 4H16M8 3.5c0 1.5 1 1.5 1 3M12 3.5c0 1.5 1 1.5 1 3"/>',
		nota: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
		hoja: '<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z"/><path d="M5 19 13 11"/>',
		estrella:
			'<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
		corazon:
			'<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'
	} as const;

	export type NombreIcono = keyof typeof TRAZOS;
</script>

<script lang="ts">
	let { nombre, tam = 24 }: { nombre: NombreIcono; tam?: number } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width={tam}
	height={tam}
	fill="none"
	stroke="currentColor"
	stroke-width="1.7"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<!-- Trazos fijos definidos arriba, nunca datos del usuario. -->
	{@html TRAZOS[nombre]}
</svg>
