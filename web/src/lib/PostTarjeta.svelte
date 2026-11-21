<script module lang="ts">
	export { esqueletoPost };
</script>

<script lang="ts">
	import Avatar from './Avatar.svelte';
	import { fechaCortaDia } from './calendario.js';
	import { fotosDe } from './feed.svelte.js';
	import Mazo from './Mazo.svelte';
	import { fechaRelativa, nombre, type Post } from './pb.svelte.js';

	let { post, urls }: { post: Post; urls: Map<string, string> } = $props();

	const pendiente = $derived(post.tipo === 'plan' && !post.hecho);
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

<article class="post">
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
	<div
		class="pie"
		class:polaroid={!fotos.length && !pendiente}
		class:pendiente={!fotos.length && pendiente}
	>
		{#if post.tipo === 'plan'}<h2 class="titulo">{post.titulo}</h2>{/if}
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
	@keyframes brillo {
		from {
			background-position: 150% 0;
		}
		to {
			background-position: -50% 0;
		}
	}
</style>
