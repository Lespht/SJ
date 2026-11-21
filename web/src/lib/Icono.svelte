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
		editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
		borrar: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
		salir: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>'
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
