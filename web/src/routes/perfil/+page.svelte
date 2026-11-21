<script lang="ts">
	import { onMount } from 'svelte';
	import { fotosDe } from '#lib/feed.js';
	import Icono from '#lib/Icono.svelte';
	import {
		fechaCorta,
		nombre,
		obtenerTokenArchivo,
		pb,
		sesion,
		urlFoto,
		type Post
	} from '#lib/pb.svelte.js';
	import { borrarPost, restaurar } from '#lib/posts.js';

	let archivados = $state<Post[]>([]);
	const urls = new Map<string, string>();
	let cargando = $state(true);
	let ocupado = $state(false);
	let confirmar = $state<string>();
	let error = $state('');

	onMount(async () => {
		try {
			const posts = await pb.collection('posts').getFullList<Post>({
				filter: 'archivado = true',
				sort: '-archivado_en',
				expand: 'autor,fotos_via_post'
			});
			const fotos = posts.flatMap((post) => fotosDe(post).slice(0, 1));
			if (fotos.length) {
				const token = await obtenerTokenArchivo().catch(() => null);
				if (token) for (const foto of fotos) urls.set(foto.id, urlFoto(foto, token, '400x400'));
			}
			archivados = posts;
		} catch {
			error = 'No se pudo cargar el archivo.';
		} finally {
			cargando = false;
		}
	});

	async function quitar(post: Post, accion: (post: Post) => Promise<unknown>) {
		if (ocupado) return;
		ocupado = true;
		error = '';
		try {
			await accion(post);
			archivados = archivados.filter((item) => item.id !== post.id);
			confirmar = undefined;
		} catch (err) {
			error = err instanceof Error ? err.message : 'No se pudo actualizar el archivo.';
		} finally {
			ocupado = false;
		}
	}
</script>

<h1>{nombre(sesion.usuario)}</h1>
<p class="suave">{sesion.usuario?.email}</p>

<button class="fantasma salir" onclick={() => pb.authStore.clear()}>
	<Icono nombre="salir" tam={20} />
	Cerrar sesión
</button>

<section aria-labelledby="titulo-archivo" aria-busy={cargando}>
	<h2 id="titulo-archivo">Archivo</h2>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#if cargando}
		<div class="polaroid esqueleto" aria-hidden="true"></div>
	{:else if archivados.length}
		<ul>
			{#each archivados as post (post.id)}
				{@const foto = fotosDe(post)[0]}
				{@const miniatura = foto && urls.get(foto.id)}
				<li class="polaroid">
					{#if foto && miniatura}
						<img src={miniatura} alt={foto.descripcion} loading="lazy" />
					{/if}
					<div class="texto">
						{#if post.titulo || post.texto}<p>{post.titulo || post.texto}</p>{/if}
						<p class="suave">Archivado el {fechaCorta(post.archivado_en)}</p>
						<div class="acciones">
							<button disabled={ocupado} onclick={() => quitar(post, restaurar)}>Restaurar</button>
							{#if post.autor === sesion.usuario?.id}
								{#if confirmar === post.id}
									<button
										class="peligro"
										disabled={ocupado}
										onclick={() => quitar(post, borrarPost)}
									>
										¿Seguro? Borrar
									</button>
								{:else}
									<button class="fantasma" disabled={ocupado} onclick={() => (confirmar = post.id)}>
										Borrar para siempre
									</button>
								{/if}
							{/if}
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{:else if !error}
		<p class="suave">No hay nada archivado.</p>
	{/if}
</section>

<style>
	h1 {
		margin-bottom: 0;
	}
	.salir {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding-left: 0;
		margin-top: 1rem;
	}
	section {
		margin-top: 1.5rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.75rem;
	}
	li {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}
	img {
		width: min(25%, 100px);
		aspect-ratio: 1;
		object-fit: cover;
	}
	.texto {
		min-width: 0;
		padding: 0.15rem 0.25rem;
		overflow-wrap: anywhere;
	}
	.texto p {
		margin: 0 0 0.35rem;
		white-space: pre-wrap;
	}
	.acciones {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.peligro {
		background: var(--peligro);
	}
	.esqueleto {
		min-height: 7rem;
	}
</style>
