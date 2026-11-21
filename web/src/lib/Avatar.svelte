<script lang="ts">
	import { nombre, pb, type Usuario } from './pb.svelte.js';

	let { usuario, tam = 30 }: { usuario?: Usuario | null; tam?: number } = $props();

	const id = $derived(usuario?.id);
	const coleccion = $derived(usuario?.collectionId || usuario?.collectionName);
	const archivo = $derived(usuario?.avatar);
	const src = $derived(
		id && coleccion && archivo
			? pb.files.getURL({ id, collectionId: coleccion }, archivo, { thumb: '96x96' })
			: ''
	);
	let fallida = $state('');
</script>

<span class="avatar" style:--tam={`${tam}px`} aria-hidden="true">
	{#if src && src !== fallida}
		<img {src} alt="" onerror={() => (fallida = src)} />
	{:else}
		{nombre(usuario).charAt(0)}
	{/if}
</span>

<style>
	.avatar {
		display: inline-grid;
		width: var(--tam);
		height: var(--tam);
		flex: none;
		place-items: center;
		overflow: hidden;
		border-radius: 50%;
		background: var(--acento-suave);
		color: var(--acento);
		font-family: var(--fuente-titulo);
		font-size: calc(var(--tam) * 0.46);
		font-weight: 700;
		text-transform: uppercase;
	}

	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
