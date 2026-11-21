<script lang="ts">
	import { pb, sesion, nombre, type Idea } from '#lib/pb.svelte.js';

	const categorias = [
		{ valor: 'cita', label: '🌹 Cita' },
		{ valor: 'viaje', label: '✈️ Viaje' },
		{ valor: 'regalo', label: '🎁 Regalo' },
		{ valor: 'comida', label: '🍝 Comida' },
		{ valor: 'otro', label: '✨ Otro' }
	] as const;

	let ideas = $state<Idea[]>([]);
	let filtro = $state<string>('');
	let verHechas = $state(false);

	let titulo = $state('');
	let detalle = $state('');
	let categoria = $state<Idea['categoria']>('cita');
	let error = $state('');

	const visibles = $derived(
		ideas.filter((i) => (verHechas || !i.hecha) && (!filtro || i.categoria === filtro))
	);

	$effect(() => {
		cargar();
	});

	async function cargar() {
		ideas = await pb
			.collection('ideas')
			.getFullList<Idea>({ sort: 'hecha,-created', expand: 'autor' });
	}

	async function agregar(e: SubmitEvent) {
		e.preventDefault();
		if (!sesion.usuario) return;
		error = '';
		try {
			await pb.collection('ideas').create({
				titulo,
				detalle,
				categoria,
				hecha: false,
				autor: sesion.usuario.id
			});
			titulo = '';
			detalle = '';
			await cargar();
		} catch (err) {
			error = err instanceof Error ? err.message : 'No se pudo guardar.';
		}
	}

	async function alternar(i: Idea) {
		await pb.collection('ideas').update(i.id, { hecha: !i.hecha });
		i.hecha = !i.hecha;
	}

	async function borrar(i: Idea) {
		await pb.collection('ideas').delete(i.id);
		ideas = ideas.filter((x) => x.id !== i.id);
	}

	function etiqueta(valor: string) {
		return categorias.find((c) => c.valor === valor)?.label ?? '';
	}
</script>

<h1>💡 Ideas</h1>

<form class="tarjeta nueva" onsubmit={agregar}>
	<input placeholder="¿Qué se les ocurrió?" bind:value={titulo} required maxlength="200" />
	<select bind:value={categoria}>
		{#each categorias as c (c.valor)}
			<option value={c.valor}>{c.label}</option>
		{/each}
	</select>
	<textarea placeholder="Detalles (opcional)" bind:value={detalle} rows="2" maxlength="2000"
	></textarea>
	<button>Agregar</button>
	{#if error}<p class="error">{error}</p>{/if}
</form>

<div class="filtros">
	<button class:activo={filtro === ''} onclick={() => (filtro = '')}>Todas</button>
	{#each categorias as c (c.valor)}
		<button class:activo={filtro === c.valor} onclick={() => (filtro = c.valor)}>{c.label}</button>
	{/each}
	<label class="hechas"><input type="checkbox" bind:checked={verHechas} /> Ver hechas</label>
</div>

<ul>
	{#each visibles as i (i.id)}
		<li class="tarjeta" class:hecha={i.hecha}>
			<input type="checkbox" checked={i.hecha} onchange={() => alternar(i)} aria-label="Hecha" />
			<div class="texto">
				<strong>{i.titulo}</strong>
				{#if i.detalle}<p>{i.detalle}</p>{/if}
				<small class="suave">{etiqueta(i.categoria)} · de {nombre(i.expand?.autor)}</small>
			</div>
			{#if i.autor === sesion.usuario?.id}
				<button class="fantasma" onclick={() => borrar(i)} aria-label="Borrar">✕</button>
			{/if}
		</li>
	{:else}
		<p class="suave">No hay ideas acá todavía.</p>
	{/each}
</ul>

<style>
	.nueva {
		display: grid;
		grid-template-columns: 1fr 160px;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.nueva textarea {
		grid-column: 1 / -1;
		resize: vertical;
	}
	.nueva button,
	.nueva .error {
		grid-column: 1 / -1;
		margin: 0;
	}
	.filtros {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		margin-bottom: 1rem;
	}
	.filtros button {
		background: var(--fondo-elevado);
		color: var(--texto-suave);
		border: 1px solid var(--borde);
		border-radius: 999px;
		padding: 0.3rem 0.8rem;
		font-weight: normal;
	}
	.filtros button.activo {
		background: var(--acento-suave);
		color: var(--acento);
		border-color: var(--acento);
	}
	.hechas {
		margin-left: auto;
		display: flex;
		gap: 0.3rem;
		align-items: center;
		font-size: 0.9rem;
	}
	.hechas input {
		width: auto;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}
	li {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}
	li > input {
		width: 1.2rem;
		height: 1.2rem;
		margin-top: 0.2rem;
		flex-shrink: 0;
		accent-color: var(--acento);
	}
	.texto {
		flex: 1;
		min-width: 0;
	}
	.texto p {
		margin: 0.2rem 0;
		white-space: pre-wrap;
	}
	li.hecha strong {
		text-decoration: line-through;
		opacity: 0.6;
	}
</style>
