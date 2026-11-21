<script module lang="ts">
	export { esqueletoPost };
</script>

<script lang="ts">
	import Avatar from './Avatar.svelte';
	import { fechaCortaDia } from './calendario.js';
	import Confirmar from './Confirmar.svelte';
	import { fotosDe } from './feed.svelte.js';
	import Icono from './Icono.svelte';
	import Mazo from './Mazo.svelte';
	import { fechaRelativa, nombre, sesion, type Post } from './pb.svelte.js';
	import { archivar, borrarPost, categoriasPlan, motivoParaNoBorrar } from './posts.js';

	let {
		post,
		urls,
		alQuitar
	}: {
		post: Post;
		urls: Map<string, string>;
		/** Se llama cuando el post se borró o se archivó desde su menú. */
		alQuitar?: () => void;
	} = $props();

	const esMio = $derived(!!sesion.usuario && post.autor === sesion.usuario.id);
	let menuAbierto = $state(false);
	let confirmando = $state(false);
	let menu = $state<HTMLElement>();

	const nombreCorto = $derived.by(() => {
		if (post.tipo === 'plan') return post.titulo;
		const texto = post.texto.trim();
		if (!texto) return 'este momento';
		return texto.length > 40 ? `${texto.slice(0, 40)}…` : texto;
	});

	$effect(() => {
		if (!menuAbierto) return;
		const cerrarFuera = (evento: PointerEvent) => {
			if (menu && !menu.contains(evento.target as Node)) menuAbierto = false;
		};
		const cerrarConEscape = (evento: KeyboardEvent) => {
			if (evento.key === 'Escape') menuAbierto = false;
		};
		window.addEventListener('pointerdown', cerrarFuera);
		window.addEventListener('keydown', cerrarConEscape);
		return () => {
			window.removeEventListener('pointerdown', cerrarFuera);
			window.removeEventListener('keydown', cerrarConEscape);
		};
	});

	function quitarCon(accion: (post: Post) => Promise<unknown>) {
		return async () => {
			await accion(post);
			alQuitar?.();
		};
	}

	const esPlan = $derived(post.tipo === 'plan');
	const pendiente = $derived(esPlan && !post.hecho);
	const categoria = $derived(categoriasPlan.find(({ valor }) => valor === post.categoria)?.label);
	const fotos = $derived(fotosDe(post));
	const notas = $derived(
		fotos
			.flatMap((foto) => foto.expand?.notas_via_foto ?? [])
			.sort((a, b) => a.created.localeCompare(b.created))
	);
</script>

{#snippet esqueletoPost()}
	<div class="polaroid esqueleto" aria-hidden="true">
		<div class="imagen brillo"></div>
		<div class="pie">
			<div class="linea brillo"></div>
			<div class="linea brillo"></div>
		</div>
	</div>
{/snippet}

<article class="post" class:momento={!esPlan}>
	<header class="autor">
		<Avatar usuario={post.expand?.autor} />
		<span class="quien">{nombre(post.expand?.autor)}</span>
		<span class="suave">
			{#if pendiente}
				{post.fecha
					? fechaCortaDia(post.fecha) + (post.hora ? ` · ${post.hora}` : '')
					: 'Sin fecha'}
			{:else}
				{fechaRelativa(post.fecha || post.created)}
			{/if}
		</span>
		{#if esMio}
			<div class="opciones" bind:this={menu}>
				<button
					type="button"
					class="fantasma boton-opciones"
					aria-label="Opciones"
					aria-haspopup="menu"
					aria-expanded={menuAbierto}
					onclick={() => (menuAbierto = !menuAbierto)}
				>
					<Icono nombre="opciones" />
				</button>
				{#if menuAbierto}
					<div class="menu" role="menu">
						<button
							type="button"
							class="fantasma"
							role="menuitem"
							onclick={() => {
								menuAbierto = false;
								confirmando = true;
							}}
						>
							<Icono nombre="borrar" tam={18} /> Borrar
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</header>
	{#if confirmando && sesion.usuario}
		<Confirmar
			titulo={nombreCorto}
			motivo={motivoParaNoBorrar(post, sesion.usuario.id)}
			archivar={post.archivado ? undefined : quitarCon(archivar)}
			borrar={quitarCon(borrarPost)}
			cerrar={() => (confirmando = false)}
		/>
	{/if}
	{#if fotos.length}
		<div class="marco-mazo">
			<Mazo
				fotos={fotos.map((foto) => ({
					id: foto.id,
					src: urls.get(foto.id) ?? '',
					alt: foto.descripcion
				}))}
			/>
			{#if esPlan}<span class="cinta" aria-hidden="true"></span>{/if}
		</div>
	{/if}
	<div
		class="pie"
		class:polaroid={!fotos.length && !pendiente}
		class:pendiente={!fotos.length && pendiente}
	>
		{#if esPlan}
			<h2 class="titulo">{post.titulo}</h2>
			<span class="etiqueta-plan">Plan{categoria ? ` · ${categoria}` : ''}</span>
		{/if}
		{#if post.texto}<p class="texto">{post.texto}</p>{/if}
		{#each notas as nota (nota.id)}
			<p><b>{nombre(nota.expand?.autor)}</b> {nota.texto}</p>
		{/each}
	</div>
</article>

<style>
	/* Giro alterno de cada post, como fotos sueltas sobre la mesa. */
	.post:nth-child(odd) :global(.mazo),
	.esqueleto:nth-child(odd) {
		transform: rotate(-0.8deg);
	}
	.post:nth-child(even) :global(.mazo),
	.esqueleto:nth-child(even) {
		transform: rotate(0.7deg);
	}
	.momento:nth-child(odd) :global(.mazo) {
		transform: rotate(-1.2deg) scale(0.92);
	}
	.momento:nth-child(even) :global(.mazo) {
		transform: rotate(1.2deg) scale(0.92);
	}
	.marco-mazo {
		position: relative;
		isolation: isolate;
	}
	.cinta {
		position: absolute;
		top: -9px;
		left: 50%;
		z-index: 1;
		width: 76px;
		height: 20px;
		background: color-mix(in oklab, var(--acento) 45%, transparent);
		transform: translateX(-50%) rotate(-3deg);
		pointer-events: none;
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
	.opciones {
		position: relative;
		margin-left: auto;
	}
	.boton-opciones {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 0;
		color: var(--texto-suave);
	}
	.menu {
		position: absolute;
		top: 100%;
		right: 0;
		z-index: 5;
		display: grid;
		min-width: 10rem;
		padding: 0.25rem;
		border: 1px solid var(--borde);
		border-radius: 12px;
		background: var(--fondo-elevado);
		box-shadow: var(--sombra-polaroid);
	}
	.menu button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
		padding: 0 0.75rem;
		color: var(--peligro);
		text-align: left;
	}
	.post {
		display: grid;
		gap: 0.6rem;
	}
	.pie.polaroid,
	.pie.pendiente {
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
	.etiqueta-plan {
		justify-self: start;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		background: color-mix(in oklab, var(--acento) 15%, transparent);
		color: var(--acento);
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.texto {
		white-space: pre-wrap;
	}
	.momento .texto {
		font-style: italic;
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
	@keyframes brillo {
		from {
			background-position: 150% 0;
		}
		to {
			background-position: -50% 0;
		}
	}
</style>
