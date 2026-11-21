<script lang="ts">
	import { getContext } from 'svelte';
	import Avatar from '#lib/Avatar.svelte';
	import { diaDe, fechaLarga, hoyLocal } from '#lib/calendario.js';
	import { cargarFeed, feed, fotosDe, planPendienteAlAzar, proximoPlan } from '#lib/feed.svelte.js';
	import Mazo from '#lib/Mazo.svelte';
	import {
		fechaRelativa,
		nombre,
		obtenerTokenArchivo,
		urlFoto,
		type Post
	} from '#lib/pb.svelte.js';

	let posts = $state<Post[]>([]);
	let proximo = $state<Post | null>();
	let sugerencia = $state<Post | null | 'error'>();
	let eligiendo = $state(false);
	// URL fija por foto: el token de archivo cambia cada 90 s, y si las URLs dependieran
	// del token actual, cargar otra página haría bajar de nuevo todas las fotos ya vistas.
	const urls = new Map<string, string>();
	let pagina = 1;
	let hayMas = $state(false);
	let cargando = $state(true);
	let error = $state(false);
	let centinela = $state<HTMLDivElement>();
	let solicitud: Promise<void> | undefined;
	const abrirHoja = getContext<() => void>('abrirHoja');

	$effect(() => {
		void reiniciar(feed.version);
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

	async function reiniciar(version: number) {
		pagina = 1;
		posts = [];
		proximo = undefined;
		sugerencia = undefined;
		eligiendo = false;
		hayMas = false;
		cargando = true;
		error = false;
		await solicitud;
		if (version === feed.version) solicitud = cargarInicio(version);
	}

	async function cargarInicio(version: number) {
		// PocketBase cancela las consultas simultáneas al mismo endpoint de posts.
		const plan = await proximoPlan(hoyLocal()).catch(() => null);
		if (version !== feed.version) return;
		proximo = plan;
		await pedirPagina(version);
	}

	async function elegirPlan() {
		if (eligiendo) return;
		const version = feed.version;
		eligiendo = true;
		const plan = await planPendienteAlAzar().catch(() => 'error' as const);
		if (version !== feed.version) return;
		sugerencia = plan;
		eligiendo = false;
	}

	function cargarPagina() {
		if (!cargando) solicitud = pedirPagina(feed.version);
	}

	async function pedirPagina(version: number) {
		cargando = true;
		error = false;
		try {
			const token = await obtenerTokenArchivo();
			if (version !== feed.version) return;
			const { items, hayMas: quedanPosts } = await cargarFeed(pagina);
			if (version !== feed.version) return;
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
			if (version === feed.version) error = true;
		} finally {
			if (version === feed.version) cargando = false;
		}
	}
</script>

<aside class="tarjeta planes">
	<div aria-busy={proximo === undefined}>
		{#if proximo}
			<p class="suave">
				Próximo · {fechaLarga(diaDe(proximo.fecha))}{proximo.hora ? ` · ${proximo.hora}` : ''}
			</p>
			<h2 class="titulo">{proximo.titulo}</h2>
		{:else if proximo === null}
			<p class="suave">No tienen nada con fecha.</p>
		{:else}
			<div class="linea fecha-esqueleto" aria-hidden="true"></div>
		{/if}
	</div>
	<div class="enlaces-planes">
		<a href="/ideas?vista=calendario">Calendario</a>
		<a class="secundario" href="/ideas">Todos los planes</a>
	</div>
	<div class="azar">
		<div role="status">
			{#if sugerencia === 'error'}
				<p class="error">No se pudo elegir uno.</p>
			{:else if sugerencia === null}
				<p class="suave">No hay planes pendientes.</p>
			{:else if sugerencia}
				<p>«{sugerencia.titulo}» · idea de {nombre(sugerencia.expand?.autor)}</p>
			{/if}
		</div>
		<button class="fantasma" disabled={eligiendo} onclick={elegirPlan}>
			{sugerencia && sugerencia !== 'error' ? 'Otra' : '¿No saben qué hacer?'}
		</button>
	</div>
</aside>

<div class="feed" aria-busy={cargando}>
	{#each posts as post (post.id)}
		{@const fotos = fotosDe(post)}
		{@const notas = fotos
			.flatMap((foto) => foto.expand?.notas_via_foto ?? [])
			.sort((a, b) => a.created.localeCompare(b.created))}
		<article class="post">
			<header class="autor">
				<Avatar usuario={post.expand?.autor} />
				<span class="quien">{nombre(post.expand?.autor)}</span>
				<span class="suave">{fechaRelativa(post.fecha || post.created)}</span>
			</header>
			{#if fotos.length}
				<Mazo
					fotos={fotos.map((foto) => ({
						id: foto.id,
						src: urls.get(foto.id) ?? '',
						alt: foto.descripcion
					}))}
				/>
			{/if}
			<div class="pie" class:polaroid={!fotos.length}>
				{#if post.tipo === 'plan'}<h2 class="titulo">{post.titulo}</h2>{/if}
				{#if post.texto}<p class="texto">{post.texto}</p>{/if}
				{#each notas as nota (nota.id)}
					<p><b>{nombre(nota.expand?.autor)}</b> {nota.texto}</p>
				{/each}
			</div>
		</article>
	{/each}

	{#if cargando}
		{#each Array(posts.length ? 1 : 3) as _}
			<div class="polaroid esqueleto" aria-hidden="true">
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
		<p class="suave">
			Todavía no hay fotos. <button class="subir" onclick={abrirHoja}>Subir la primera</button>
		</p>
	{/if}
</div>

{#if hayMas}
	<div class="centinela" bind:this={centinela} aria-hidden="true"></div>
{/if}

<style>
	.subir {
		padding: 0;
		background: none;
		color: var(--acento);
		font-weight: inherit;
		text-decoration: underline;
	}
	.planes {
		margin-bottom: 1.5rem;
		overflow-wrap: anywhere;
	}
	.planes p {
		margin: 0 0 0.25rem;
	}
	.fecha-esqueleto {
		background: var(--fondo);
	}
	.enlaces-planes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.enlaces-planes a {
		padding: 0.6rem 1rem;
		border: 1px solid var(--acento);
		border-radius: 10px;
		background: var(--acento);
		color: var(--sobre-acento);
		font-weight: 600;
		text-decoration: none;
	}
	.enlaces-planes .secundario {
		border-color: var(--borde);
		background: transparent;
		color: var(--texto);
	}
	.azar {
		margin-top: 0.75rem;
		border-top: 1px solid var(--borde);
		padding-top: 0.5rem;
	}
	.azar button {
		padding-inline: 0;
		color: var(--acento);
	}
	.feed {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 3rem;
	}
	/* Giro alterno de cada post, como fotos sueltas sobre la mesa. */
	.post:nth-child(odd) :global(.mazo),
	.esqueleto:nth-child(odd) {
		transform: rotate(-0.8deg);
	}
	.post:nth-child(even) :global(.mazo),
	.esqueleto:nth-child(even) {
		transform: rotate(0.7deg);
	}
	.autor {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.25rem;
		/* Las polaroids de atrás del mazo están giradas: sin este aire tapan la inicial. */
		margin-bottom: 0.75rem;
		font-size: 0.9rem;
	}
	.quien {
		font-weight: 600;
	}
	.post {
		display: grid;
		gap: 0.6rem;
	}
	.pie.polaroid {
		padding: 1rem;
	}
	.imagen {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 5;
	}
	.pie {
		display: grid;
		gap: 0.25rem;
		padding: 0 0.75rem;
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
