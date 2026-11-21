<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ClientResponseError } from 'pocketbase';
	import { cargarPost, fotosDe } from '#lib/feed.svelte.js';
	import { obtenerTokenArchivo, urlFoto } from '#lib/pb.svelte.js';
	import PostTarjeta, { esqueletoPost } from '#lib/PostTarjeta.svelte';

	let reintento = $state(0);
	const id = $derived(page.params.id);

	async function cargar(id: string) {
		const token = await obtenerTokenArchivo();
		const post = await cargarPost(id);
		const urls = new Map(fotosDe(post).map((foto) => [foto.id, urlFoto(foto, token, '800x0')]));
		return { post, urls };
	}

	function volver() {
		if (history.length > 1) history.back();
		else void goto('/');
	}
</script>

<button class="fantasma volver" onclick={volver}>‹ Volver</button>

{#if id}
	{#key `${id}:${reintento}`}
		{#await cargar(id)}
			<div aria-busy="true">{@render esqueletoPost()}</div>
		{:then { post, urls }}
			{#if post.archivado}<p class="suave">Está en el archivo.</p>{/if}
			<div><PostTarjeta {post} {urls} /></div>
		{:catch error}
			{#if error instanceof ClientResponseError && error.status === 404}
				<p>Este recuerdo ya no está.</p>
				<a href="/">Ir al inicio</a>
			{:else}
				<p class="error" role="alert">No se pudo cargar.</p>
				<button onclick={() => (reintento += 1)}>Reintentar</button>
			{/if}
		{/await}
	{/key}
{/if}

<style>
	.volver {
		margin-bottom: 0.75rem;
		padding-inline: 0;
	}
</style>
