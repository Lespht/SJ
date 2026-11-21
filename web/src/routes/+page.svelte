<script lang="ts">
	import { onMount } from 'svelte';
	import { cargarFeed, fotosDe, planPendienteAlAzar } from '#lib/feed.js';
	import {
		fechaCorta,
		nombre,
		obtenerTokenArchivo,
		pb,
		urlFoto,
		type Post,
		type Usuario
	} from '#lib/pb.svelte.js';

	let posts = $state<Post[]>([]);
	let pendiente = $state<{ titulo: string; autor: string }>();
	const fotosVisibles = $state<Record<string, number>>({});
	// URL fija por foto: el token de archivo cambia cada 90 s, y si las URLs dependieran
	// del token actual, cargar otra página haría bajar de nuevo todas las fotos ya vistas.
	const urls = new Map<string, string>();
	let pagina = 1;
	let hayMas = $state(false);
	let cargando = $state(true);
	let error = $state(false);
	let centinela = $state<HTMLDivElement>();

	onMount(() => {
		cargarInicio();
	});

	$effect(() => {
		if (!centinela || cargando || error || !hayMas) return;

		const observador = new IntersectionObserver(
			(entradas) => {
				if (entradas.some((entrada) => entrada.isIntersecting) && !cargando && !error && hayMas) {
					cargarPagina();
				}
			},
			{ rootMargin: '600px 0px' }
		);
		observador.observe(centinela);
		return () => observador.disconnect();
	});

	async function cargarInicio() {
		// PocketBase cancela las consultas simultáneas al mismo endpoint de posts.
		const plan = await planPendienteAlAzar().catch(() => null);
		void cargarPagina();
		if (!plan) return;
		const autor = await pb
			.collection('users')
			.getOne<Usuario>(plan.autor)
			.catch(() => undefined);
		pendiente = { titulo: plan.titulo, autor: nombre(autor) };
	}

	async function cargarPagina() {
		cargando = true;
		error = false;
		try {
			const token = await obtenerTokenArchivo();
			const { items, hayMas: quedanPosts } = await cargarFeed(pagina);
			const ids = new Set(posts.map((post) => post.id));
			const nuevos = items.filter((post) => !ids.has(post.id));
			for (const post of nuevos) {
				for (const foto of post.expand?.fotos_via_post ?? []) {
					if (!urls.has(foto.id)) urls.set(foto.id, urlFoto(foto, token, '800x0'));
				}
			}
			posts = [...posts, ...nuevos];
			hayMas = quedanPosts;
			pagina += 1;
		} catch {
			error = true;
		} finally {
			cargando = false;
		}
	}
</script>

{#if pendiente}
	<aside class="pendiente">
		<h2 class="titulo">{pendiente.titulo}</h2>
		<p class="suave">Idea de {pendiente.autor}</p>
		<a href="/ideas">Ver planes</a>
	</aside>
{/if}

<div class="feed" aria-busy={cargando}>
	{#each posts as post (post.id)}
		{@const fotos = fotosDe(post)}
		{@const notas = fotos
			.flatMap((foto) => foto.expand?.notas_via_foto ?? [])
			.sort((a, b) => a.created.localeCompare(b.created))}
		<article class="polaroid">
			{#if fotos.length}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex (permite recorrer el carrusel con el teclado) -->
				<div
					class:carrusel={fotos.length > 1}
					role={fotos.length > 1 ? 'region' : undefined}
					aria-label={fotos.length > 1 ? 'Fotos del post' : undefined}
					tabindex={fotos.length > 1 ? 0 : undefined}
					onscroll={({ currentTarget }) => {
						fotosVisibles[post.id] = Math.round(
							currentTarget.scrollLeft / currentTarget.clientWidth
						);
					}}
				>
					{#each fotos as foto (foto.id)}
						<img
							class="imagen"
							src={urls.get(foto.id)}
							alt={foto.descripcion}
							loading="lazy"
							onload={(e) => e.currentTarget.classList.add('cargada')}
						/>
					{/each}
				</div>
				{#if fotos.length > 1}
					{@const visible = fotosVisibles[post.id] ?? 0}
					<div class="puntos" role="img" aria-label={`Foto ${visible + 1} de ${fotos.length}`}>
						{#each fotos as foto, i (foto.id)}
							<span class:activo={i === visible}></span>
						{/each}
					</div>
				{/if}
			{/if}
			<div class="pie">
				{#if post.tipo === 'plan'}<h2 class="titulo">{post.titulo}</h2>{/if}
				{#if post.texto}<p class="texto">{post.texto}</p>{/if}
				<p class="suave">{nombre(post.expand?.autor)}, {fechaCorta(post.fecha)}</p>
				{#each notas as nota (nota.id)}
					<p><b>{nombre(nota.expand?.autor)}</b> {nota.texto}</p>
				{/each}
			</div>
		</article>
	{/each}

	{#if cargando}
		{#each Array(posts.length ? 1 : 3) as _}
			<div class="polaroid" aria-hidden="true">
				<div class="imagen brillo"></div>
				<div class="pie">
					<div class="linea brillo"></div>
					<div class="linea brillo"></div>
				</div>
			</div>
		{/each}
	{:else if error}
		<div>
			<p class="error" role="alert">No se pudieron cargar las fotos.</p>
			<button type="button" onclick={cargarPagina}>Reintentar</button>
		</div>
	{:else if !posts.length}
		<p class="suave">Todavía no hay fotos. <a href="/fotos">Subir la primera</a></p>
	{/if}
</div>

{#if hayMas}
	<div class="centinela" bind:this={centinela} aria-hidden="true"></div>
{/if}

<style>
	.pendiente {
		margin-bottom: 1.5rem;
		padding: 1rem;
		overflow-wrap: anywhere;
	}
	.pendiente p {
		margin: 0.25rem 0 0.5rem;
	}
	.feed {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1.5rem;
	}
	.polaroid:nth-child(odd) {
		transform: rotate(-0.8deg);
	}
	.polaroid:nth-child(even) {
		transform: rotate(0.7deg);
	}
	.carrusel {
		display: flex;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
	}
	.carrusel .imagen {
		flex: 0 0 100%;
		scroll-snap-align: start;
	}
	.puntos {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.4rem;
		padding-top: 0.65rem;
	}
	.puntos span {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: var(--borde);
	}
	.puntos .activo {
		background: var(--acento);
	}
	.imagen {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 5;
	}
	img {
		object-fit: cover;
		opacity: 0;
		transition: opacity 300ms;
	}
	img:global(.cargada) {
		opacity: 1;
	}
	.pie {
		display: grid;
		gap: 0.25rem;
		padding: 0.65rem 0.4rem 0;
		overflow-wrap: anywhere;
	}
	.pie p {
		margin: 0;
	}
	.titulo {
		margin: 0;
		font-family: var(--fuente-titulo);
		font-size: 1.125rem;
	}
	.texto {
		white-space: pre-wrap;
	}
	.brillo {
		background: linear-gradient(100deg, var(--fondo) 25%, var(--borde) 50%, var(--fondo) 75%);
		background-size: 200% 100%;
		animation: brillo 1.8s ease-in-out infinite;
	}
	.linea {
		width: 65%;
		height: 1.6875rem;
		border-radius: 4px;
	}
	.linea:last-child {
		width: 40%;
		height: 1.5rem;
	}
	.centinela {
		height: 1px;
	}
	@keyframes brillo {
		from {
			background-position: 150% 0;
		}
		to {
			background-position: -50% 0;
		}
	}
</style>
