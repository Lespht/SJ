<script lang="ts">
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { scale } from 'svelte/transition';
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
	import { archivar, borrarPost, completarPlan, crearPlan, ErrorFotosPlan } from '#lib/posts.js';

	const categorias = [
		{ valor: 'cita', label: 'Cita' },
		{ valor: 'viaje', label: 'Viaje' },
		{ valor: 'regalo', label: 'Regalo' },
		{ valor: 'comida', label: 'Comida' },
		{ valor: 'otro', label: 'Otro' }
	] as const;

	let planes = $state<Post[]>([]);
	const urls = new Map<string, string>();
	let filtro = $state('');
	let verHechos = $state(false);
	let cargando = $state(true);
	let ocupado = $state(false);
	let error = $state('');
	let titulo = $state('');
	let texto = $state('');
	let categoria = $state<Post['categoria']>('cita');
	let completando = $state<string>();
	let archivos = $state<FileList>();
	let fecha = $state('');
	let animar = $state<string>();

	const visibles = $derived(
		planes.filter((plan) => (verHechos || !plan.hecho) && (!filtro || plan.categoria === filtro))
	);

	onMount(async () => {
		try {
			await cargar();
		} catch {
			error = 'No se pudieron cargar los planes.';
		} finally {
			cargando = false;
		}
	});

	async function cargar() {
		const resultados = await pb.collection('posts').getFullList<Post>({
			filter: "tipo = 'plan' && archivado = false",
			sort: 'hecho,-created',
			expand: 'autor,fotos_via_post'
		});
		const primerasFotos = resultados.flatMap((plan) => fotosDe(plan).slice(0, 1));
		const nuevas = primerasFotos.filter((foto) => !urls.has(foto.id));
		if (nuevas.length) {
			const token = await obtenerTokenArchivo().catch(() => null);
			if (token) for (const foto of nuevas) urls.set(foto.id, urlFoto(foto, token, '400x400'));
		}
		planes = resultados;
	}

	async function agregar(e: SubmitEvent) {
		e.preventDefault();
		if (ocupado || !sesion.usuario) return;
		ocupado = true;
		error = '';
		try {
			await crearPlan({ titulo, texto, categoria, autor: sesion.usuario.id });
			titulo = '';
			texto = '';
			await cargar();
		} catch (err) {
			error = err instanceof Error ? err.message : 'No se pudo guardar el plan.';
		} finally {
			ocupado = false;
		}
	}

	function abrirFormulario(plan: Post) {
		const hoy = new Date();
		fecha = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
		archivos = undefined;
		completando = plan.id;
	}

	async function guardar(e: SubmitEvent, plan: Post) {
		e.preventDefault();
		if (ocupado || !sesion.usuario) return;
		ocupado = true;
		error = '';
		try {
			let actualizado: Post;
			try {
				actualizado = await completarPlan(
					plan,
					Array.from(archivos ?? []),
					fecha,
					sesion.usuario.id
				);
			} catch (err) {
				if (!(err instanceof ErrorFotosPlan)) throw err;
				actualizado = err.plan;
				error = err.message;
			}

			completando = undefined;
			archivos = undefined;
			animar = plan.id;
			verHechos = true;
			try {
				await cargar();
			} catch {
				planes = planes.map((item) =>
					item.id === plan.id
						? { ...item, hecho: actualizado.hecho, fecha: actualizado.fecha }
						: item
				);
				error ||= 'El plan quedó hecho. No se pudo actualizar la lista.';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'No se pudo completar el plan.';
		} finally {
			ocupado = false;
		}
	}

	async function quitar(plan: Post, accion: (post: Post) => Promise<unknown>) {
		if (ocupado) return;
		ocupado = true;
		error = '';
		try {
			await accion(plan);
			planes = planes.filter((item) => item.id !== plan.id);
			if (completando === plan.id) completando = undefined;
		} catch (err) {
			error = err instanceof Error ? err.message : 'No se pudo quitar el plan.';
		} finally {
			ocupado = false;
		}
	}
</script>

<h1>Planes</h1>

<form class="tarjeta nueva" onsubmit={agregar}>
	<input placeholder="¿Qué quieren hacer?" bind:value={titulo} required maxlength="200" />
	<select bind:value={categoria} aria-label="Categoría">
		{#each categorias as c (c.valor)}
			<option value={c.valor}>{c.label}</option>
		{/each}
	</select>
	<textarea placeholder="Detalles (opcional)" bind:value={texto} rows="2" maxlength="2000"
	></textarea>
	<button disabled={ocupado || cargando}>Agregar</button>
</form>

<div class="filtros">
	<button class:activo={filtro === ''} onclick={() => (filtro = '')}>Todas</button>
	{#each categorias as c (c.valor)}
		<button class:activo={filtro === c.valor} onclick={() => (filtro = c.valor)}>{c.label}</button>
	{/each}
	<label class="hechas"><input type="checkbox" bind:checked={verHechos} /> Ver hechos</label>
</div>

{#if error}<p class="error" role="alert">{error}</p>{/if}

<ul aria-busy={cargando}>
	{#if cargando}
		{#each [1, 2, 3] as n (n)}
			<li class="pendiente esqueleto" aria-hidden="true"></li>
		{/each}
	{:else}
		{#each visibles as plan (plan.id)}
			{@const foto = fotosDe(plan)[0]}
			{@const miniatura = foto && urls.get(foto.id)}
			<li>
				{#if plan.hecho}
					<div
						class="polaroid"
						in:scale={{
							start: 0.97,
							duration: animar === plan.id && !prefersReducedMotion.current ? 250 : 0
						}}
						onintroend={() => {
							if (animar === plan.id) animar = undefined;
						}}
					>
						{#if foto && miniatura}
							<img src={miniatura} alt={foto.descripcion} loading="lazy" />
						{/if}
						<div class="texto">
							<h2>{plan.titulo}</h2>
							{#if plan.fecha}<p class="suave">{fechaCorta(plan.fecha)}</p>{/if}
							<button disabled={ocupado} onclick={() => quitar(plan, archivar)}>Archivar</button>
						</div>
					</div>
				{:else}
					<div class="pendiente texto">
						<div class="encabezado">
							<h2>{plan.titulo}</h2>
							{#if plan.autor === sesion.usuario?.id}
								<button
									class="icono"
									disabled={ocupado}
									onclick={() => quitar(plan, borrarPost)}
									aria-label="Borrar plan"
								>
									<Icono nombre="cerrar" tam={18} />
								</button>
							{/if}
						</div>
						{#if plan.texto}<p>{plan.texto}</p>{/if}
						<p class="suave">Idea de {nombre(plan.expand?.autor)}</p>
						{#if completando === plan.id}
							<form class="completar" onsubmit={(e) => guardar(e, plan)}>
								<label>
									Fotos (opcional)<input
										type="file"
										accept="image/*"
										multiple
										bind:files={archivos}
										disabled={ocupado}
									/>
								</label>
								<label>
									Fecha<input type="date" bind:value={fecha} required disabled={ocupado} />
								</label>
								<div class="acciones">
									<button disabled={ocupado}>Guardar</button>
									<button
										type="button"
										class="fantasma"
										disabled={ocupado}
										onclick={() => (completando = undefined)}
									>
										Cancelar
									</button>
								</div>
							</form>
						{:else}
							<button disabled={ocupado} onclick={() => abrirFormulario(plan)}>Lo hicimos</button>
						{/if}
					</div>
				{/if}
			</li>
		{:else}
			<li class="suave">No hay planes acá todavía.</li>
		{/each}
	{/if}
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
	.nueva button {
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
		background: transparent;
		color: var(--texto-suave);
		border: 1px solid var(--borde);
		border-radius: 999px;
		padding: 0.3rem 0.8rem;
		font-weight: 500;
	}
	.filtros button.activo {
		background: var(--texto);
		color: var(--fondo);
		border-color: var(--texto);
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
		gap: 0.75rem;
	}
	.texto {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.texto h2,
	.texto p {
		margin: 0 0 0.35rem;
	}

	.texto p {
		white-space: pre-wrap;
	}

	.encabezado {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.encabezado button {
		flex-shrink: 0;
	}

	.polaroid img {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		margin-bottom: 0.65rem;
	}

	.polaroid .texto {
		padding: 0 0.45rem;
	}

	.completar {
		display: grid;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.acciones {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.esqueleto {
		min-height: 7rem;
		background: var(--fondo-elevado);
	}

	@media (max-width: 420px) {
		.nueva {
			grid-template-columns: 1fr;
		}
	}
</style>
