<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { diaDe, fechaLarga, hoyLocal } from '#lib/calendario.js';
	import {
		cargarFeed,
		feed,
		fotosDelHilo,
		planPendienteAlAzar,
		proximoPlan,
		refrescarInicio,
		respuestaDe
	} from '#lib/feed.svelte.js';
	import Icono from '#lib/Icono.svelte';
	import { nombre, obtenerTokenArchivo, urlFoto, type Post } from '#lib/pb.svelte.js';
	import PostTarjeta, { esqueletoPost } from '#lib/PostTarjeta.svelte';
	import { alcanzaUmbral, desplazamiento, UMBRAL_RECARGA } from '#lib/tirar.js';

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
	let inicioTiro: { x: number; y: number } | undefined;
	let distanciaTiro = $state(0);
	let recargandoPorTiro = $state(false);
	const avance = $derived(desplazamiento(distanciaTiro));
	const abrirHoja = getContext<() => void>('abrirHoja');

	onMount(() => {
		const controlador = new AbortController();
		const opciones = { passive: true, signal: controlador.signal };
		window.addEventListener('touchstart', iniciarTiro, opciones);
		window.addEventListener('touchmove', moverTiro, opciones);
		window.addEventListener('touchend', soltarTiro, opciones);
		window.addEventListener('touchcancel', cancelarTiro, opciones);
		return () => controlador.abort();
	});

	function iniciarTiro(evento: TouchEvent) {
		cancelarTiro();
		if (recargandoPorTiro || window.scrollY !== 0 || evento.touches.length !== 1) return;
		const toque = evento.touches[0];
		inicioTiro = { x: toque.clientX, y: toque.clientY };
	}

	function medirTiro(toque?: Touch) {
		if (!inicioTiro || !toque) return 0;
		const dy = toque.clientY - inicioTiro.y;
		return dy > Math.abs(toque.clientX - inicioTiro.x) ? dy : 0;
	}

	function moverTiro(evento: TouchEvent) {
		if (window.scrollY > 0 || evento.touches.length !== 1) {
			cancelarTiro();
			return;
		}
		distanciaTiro = medirTiro(evento.touches[0]);
	}

	function cancelarTiro() {
		inicioTiro = undefined;
		distanciaTiro = 0;
	}

	function soltarTiro(evento: TouchEvent) {
		const debeRecargar = window.scrollY <= 0 && alcanzaUmbral(medirTiro(evento.changedTouches[0]));
		cancelarTiro();
		if (debeRecargar) {
			recargandoPorTiro = true;
			refrescarInicio();
		}
	}

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

	async function cambiarPost(actualizado: Post) {
		const nuevas = fotosDelHilo(actualizado).filter((foto) => !urls.has(foto.id));
		if (nuevas.length) {
			const token = await obtenerTokenArchivo().catch(() => null);
			if (token) for (const foto of nuevas) urls.set(foto.id, urlFoto(foto, token, '800x0'));
		}
		posts = posts.map((post) => (post.id === actualizado.id ? actualizado : post));
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
				for (const foto of fotosDelHilo(post)) {
					if (!urls.has(foto.id)) urls.set(foto.id, urlFoto(foto, token, '800x0'));
				}
			}
			posts = [...posts, ...nuevos];
			hayMas = quedanPosts;
			pagina += 1;
		} catch {
			if (version === feed.version) error = true;
		} finally {
			if (version === feed.version) {
				cargando = false;
				recargandoPorTiro = false;
			}
		}
	}
</script>

<div
	class="indicador-recarga"
	class:tirando={avance > 0}
	class:recargando={recargandoPorTiro && cargando}
	style:--avance={`${recargandoPorTiro ? UMBRAL_RECARGA : avance}px`}
	style:--opacidad={recargandoPorTiro ? 1 : Math.min(avance / UMBRAL_RECARGA, 1)}
	style:--umbral={`${UMBRAL_RECARGA}px`}
	aria-hidden="true"
>
	<span><Icono nombre="recargar" tam={20} /></span>
</div>

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
			<div class="fecha-esqueleto" aria-hidden="true"></div>
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
		<PostTarjeta
			{post}
			{urls}
			alCambiar={cambiarPost}
			alQuitar={() => {
				posts = posts.filter((otro) => otro.id !== post.id);
				if (respuestaDe(post)) feed.version += 1;
			}}
		/>
	{/each}

	{#if cargando}
		{#each Array(posts.length ? 1 : 3) as _}
			{@render esqueletoPost()}
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
	.indicador-recarga {
		position: fixed;
		top: var(--alto-cabecera);
		left: 50%;
		z-index: 9;
		display: grid;
		width: 36px;
		height: 36px;
		place-items: center;
		border: 1px solid var(--borde);
		border-radius: 50%;
		background: var(--fondo-elevado);
		color: var(--acento);
		box-shadow: var(--sombra-polaroid);
		pointer-events: none;
		opacity: var(--opacidad);
		transform: translate(-50%, var(--avance));
		transition:
			transform 160ms ease,
			opacity 160ms ease;
	}
	.indicador-recarga.tirando {
		transition: none;
	}
	.indicador-recarga span {
		display: grid;
	}
	.indicador-recarga.recargando span {
		animation: giro-recarga 700ms linear infinite;
	}
	@keyframes giro-recarga {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.indicador-recarga {
			opacity: 0;
			transform: translate(-50%, var(--umbral));
			transition: none;
		}
		.indicador-recarga.tirando,
		.indicador-recarga.recargando {
			opacity: 1;
		}
		.indicador-recarga.recargando span {
			animation: none;
		}
	}

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
		width: 40%;
		height: 1.5rem;
		border-radius: 4px;
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
	.titulo {
		margin: 0;
		font-family: var(--fuente-titulo);
		font-size: 1.125rem;
	}
	.centinela {
		height: 1px;
	}
</style>
