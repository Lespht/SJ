<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ClientResponseError } from 'pocketbase';
	import { cargarPost, fotosDe } from '#lib/feed.svelte.js';
	import { obtenerTokenArchivo, urlFoto, type Post } from '#lib/pb.svelte.js';
	import PostTarjeta, { esqueletoPost } from '#lib/PostTarjeta.svelte';

	let reintento = $state(0);
	let cambio = $state.raw<{ original: Post; actualizado: Post }>();
	const id = $derived(page.params.id);

	async function cargar(id: string) {
		const token = await obtenerTokenArchivo();
		const post = await cargarPost(id);
		const urls = new Map(fotosDe(post).map((foto) => [foto.id, urlFoto(foto, token, '800x0')]));
		return { post, urls };
	}

	async function cambiarPost(original: Post, actualizado: Post, urls: Map<string, string>) {
		const nuevas = fotosDe(actualizado).filter((foto) => !urls.has(foto.id));
		if (nuevas.length) {
			const token = await obtenerTokenArchivo().catch(() => null);
			if (token) for (const foto of nuevas) urls.set(foto.id, urlFoto(foto, token, '800x0'));
		}
		if (id === original.id) cambio = { original, actualizado };
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
			{@const actual = cambio?.original === post ? cambio.actualizado : post}
			{#if actual.archivado}<p class="suave">Está en el archivo.</p>{/if}
			<div>
				<PostTarjeta
					post={actual}
					{urls}
					alCambiar={(actualizado) => cambiarPost(post, actualizado, urls)}
					alQuitar={() => goto('/')}
				/>
			</div>
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
