<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { scale } from 'svelte/transition';
	import { avisoChoque, diaDe, fechaCortaDia, hoyLocal, planesDelDia } from '#lib/calendario.js';
	import Calendario from '#lib/Calendario.svelte';
	import { fotosDe } from '#lib/feed.svelte.js';
	import Icono from '#lib/Icono.svelte';
	import { nombre, obtenerTokenArchivo, pb, sesion, urlFoto, type Post } from '#lib/pb.svelte.js';
	import {
		archivar,
		borrarPost,
		categoriasPlan,
		completarPlan,
		crearPlan,
		ErrorFotosPlan,
		fijarFecha
	} from '#lib/posts.js';
	import { descargarIcs } from '#lib/ics.js';

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
	let diaNuevo = $state('');
	let horaNueva = $state('');
	let editandoFecha = $state<string>();
	let diaEditado = $state('');
	let horaEditada = $state('');
	let completando = $state<string>();
	let archivos = $state<FileList>();
	let fecha = $state('');
	let animar = $state<string>();
	let calendario = $state<ReturnType<typeof Calendario>>();
	const vistaCalendario = $derived(page.url.searchParams.get('vista') === 'calendario');

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

	function cambiarVista(verCalendario: boolean) {
		if (vistaCalendario === verCalendario) return;
		const url = new URL(page.url.href);
		if (verCalendario) url.searchParams.set('vista', 'calendario');
		else url.searchParams.delete('vista');
		return goto(url, { replace: true, reset: false });
	}

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
			await crearPlan({
				titulo,
				texto,
				categoria,
				autor: sesion.usuario.id,
				dia: diaNuevo,
				hora: horaNueva
			});
			titulo = '';
			texto = '';
			diaNuevo = '';
			horaNueva = '';
			calendario?.recargar();
			await cargar();
		} catch (err) {
			error = err instanceof Error ? err.message : 'No se pudo guardar el plan.';
		} finally {
			ocupado = false;
		}
	}

	function abrirFecha(plan: Post) {
		completando = undefined;
		diaEditado = diaDe(plan.fecha);
		horaEditada = plan.hora ?? '';
		editandoFecha = plan.id;
	}

	async function guardarFecha(plan: Post, dia: string, hora: string) {
		if (ocupado) return;
		ocupado = true;
		error = '';
		try {
			const actualizado = await fijarFecha(plan, dia, hora);
			planes = planes.map((item) =>
				item.id === plan.id ? { ...item, fecha: actualizado.fecha, hora: actualizado.hora } : item
			);
			editandoFecha = undefined;
			calendario?.recargar();
		} catch (err) {
			error = err instanceof Error ? err.message : 'No se pudo guardar la fecha.';
		} finally {
			ocupado = false;
		}
	}

	function abrirFormulario(plan: Post) {
		editandoFecha = undefined;
		fecha = diaDe(plan.fecha) || hoyLocal();
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
			if (editandoFecha === plan.id) editandoFecha = undefined;
		} catch (err) {
			error = err instanceof Error ? err.message : 'No se pudo quitar el plan.';
		} finally {
			ocupado = false;
		}
	}
</script>

{#snippet avisoFecha(dia: string, excluirId?: string)}
	{#await dia && planesDelDia(dia, excluirId).then(avisoChoque, () => '') then aviso}
		{#if aviso}<p class="aviso" role="status">{aviso}</p>{/if}
	{/await}
{/snippet}

<h1>Planes</h1>

<form class="tarjeta nueva" onsubmit={agregar}>
	<input placeholder="¿Qué quieren hacer?" bind:value={titulo} required maxlength="200" />
	<select bind:value={categoria} aria-label="Categoría">
		{#each categoriasPlan as c (c.valor)}
			<option value={c.valor}>{c.label}</option>
		{/each}
	</select>
	<textarea placeholder="Detalles (opcional)" bind:value={texto} rows="2" maxlength="2000"
	></textarea>
	<div class="campos-fecha">
		<label>Día (opcional)<input type="date" bind:value={diaNuevo} disabled={ocupado} /></label>
		<label>
			Hora (opcional)<input type="time" bind:value={horaNueva} disabled={!diaNuevo || ocupado} />
		</label>
		{@render avisoFecha(diaNuevo)}
	</div>
	<button disabled={ocupado || cargando}>Agregar</button>
</form>

<div class="vistas" role="group" aria-label="Vista de planes">
	<button
		class:fantasma={vistaCalendario}
		aria-pressed={!vistaCalendario}
		onclick={() => cambiarVista(false)}
	>
		Lista
	</button>
	<button
		class:fantasma={!vistaCalendario}
		aria-pressed={vistaCalendario}
		onclick={() => cambiarVista(true)}
	>
		Calendario
	</button>
</div>

{#if error}<p class="error" role="alert">{error}</p>{/if}

{#if vistaCalendario}
	<Calendario hoy={hoyLocal()} bind:this={calendario} />
{:else}
	<div class="filtros">
		<button class:activo={filtro === ''} onclick={() => (filtro = '')}>Todas</button>
		{#each categoriasPlan as c (c.valor)}
			<button class:activo={filtro === c.valor} onclick={() => (filtro = c.valor)}>
				{c.label}
			</button>
		{/each}
		<label class="hechas"><input type="checkbox" bind:checked={verHechos} /> Ver hechos</label>
	</div>

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
								{#if plan.fecha}<p class="suave">{fechaCortaDia(plan.fecha)}</p>{/if}
								<button class="fantasma" disabled={ocupado} onclick={() => quitar(plan, archivar)}>
									Archivar
								</button>
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
							{#if plan.fecha}
								<p class="suave">
									{fechaCortaDia(plan.fecha)}{plan.hora ? ` · ${plan.hora}` : ''}
								</p>
							{/if}
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
							{:else if editandoFecha === plan.id}
								<form
									class="completar"
									onsubmit={(e) => {
										e.preventDefault();
										void guardarFecha(plan, diaEditado, horaEditada);
									}}
								>
									<div class="campos-fecha">
										<label>
											Día (opcional)<input type="date" bind:value={diaEditado} disabled={ocupado} />
										</label>
										<label>
											Hora (opcional)<input
												type="time"
												bind:value={horaEditada}
												disabled={!diaEditado || ocupado}
											/>
										</label>
										{@render avisoFecha(diaEditado, plan.id)}
									</div>
									<div class="acciones">
										<button disabled={ocupado}>Guardar</button>
										{#if plan.fecha}
											<button
												type="button"
												class="fantasma"
												disabled={ocupado}
												onclick={() => guardarFecha(plan, '', '')}
											>
												Quitar fecha
											</button>
										{/if}
										<button
											type="button"
											class="fantasma"
											disabled={ocupado}
											onclick={() => (editandoFecha = undefined)}
										>
											Cancelar
										</button>
									</div>
								</form>
							{:else}
								<div class="acciones">
									<button disabled={ocupado} onclick={() => abrirFormulario(plan)}>
										Lo hicimos
									</button>
									<button class="fantasma" disabled={ocupado} onclick={() => abrirFecha(plan)}>
										{plan.fecha ? 'Cambiar fecha' : 'Ponerle fecha'}
									</button>
									{#if plan.fecha}
										<button class="fantasma" onclick={() => descargarIcs(plan)}>
											Agregar a mi calendario
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</li>
			{:else}
				<li class="suave">No hay planes acá todavía.</li>
			{/each}
		{/if}
	</ul>
{/if}

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
	.campos-fecha {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.aviso {
		grid-column: 1 / -1;
		color: var(--acento);
		margin: 0;
	}
	.vistas {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 1rem;
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
