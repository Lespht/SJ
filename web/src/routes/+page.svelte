<script lang="ts">
	import { onMount } from 'svelte';
	import { cargarFeed } from '#lib/feed.js';
	import { fechaCorta, nombre, obtenerTokenArchivo, urlFoto, type Foto } from '#lib/pb.svelte.js';

	let fotos = $state<Foto[]>([]);
	// URL fija por foto: el token de archivo cambia cada 90 s, y si las URLs dependieran
	// del token actual, cargar otra página haría bajar de nuevo todas las fotos ya vistas.
	const urls = new Map<string, string>();
	let pagina = 1;
	let hayMas = $state(false);
	let cargando = $state(true);
	let error = $state(false);
	let centinela = $state<HTMLDivElement>();

	onMount(() => {
		cargarPagina();
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

	async function cargarPagina() {
		cargando = true;
		error = false;
		try {
			const token = await obtenerTokenArchivo();
			const { items, hayMas: quedanFotos } = await cargarFeed(pagina);
			const nuevas = items.filter((foto) => !urls.has(foto.id));
			for (const foto of nuevas) urls.set(foto.id, urlFoto(foto, token, '800x0'));
			fotos = [...fotos, ...nuevas];
			hayMas = quedanFotos;
			pagina += 1;
		} catch {
			error = true;
		} finally {
			cargando = false;
		}
	}
</script>

<div class="feed" aria-busy={cargando}>
	{#each fotos as f (f.id)}
		{@const notas = [...(f.expand?.notas_via_foto ?? [])].sort((a, b) =>
			a.created.localeCompare(b.created)
		)}
		<article class="polaroid">
			<img
				class="imagen"
				src={urls.get(f.id)}
				alt={f.descripcion}
				loading="lazy"
				onload={(e) => e.currentTarget.classList.add('cargada')}
			/>
			<div class="pie">
				{#if f.descripcion}<p class="descripcion">{f.descripcion}</p>{/if}
				<p class="suave">{nombre(f.expand?.autor)}, {fechaCorta(f.fecha)}</p>
				{#each notas as nota (nota.id)}
					<p><b>{nombre(nota.expand?.autor)}</b> {nota.texto}</p>
				{/each}
			</div>
		</article>
	{/each}

	{#if cargando}
		{#each Array(fotos.length ? 1 : 3) as _}
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
	{:else if !fotos.length}
		<p class="suave">Todavía no hay fotos. <a href="/fotos">Subir la primera</a></p>
	{/if}
</div>

{#if hayMas}
	<div class="centinela" bind:this={centinela} aria-hidden="true"></div>
{/if}

<style>
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
	.descripcion {
		font-family: var(--fuente-titulo);
		font-size: 1.125rem;
		font-weight: 600;
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
