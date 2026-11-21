<script lang="ts">
	import { untrack } from 'svelte';
	import {
		cargarMes,
		fechaCortaDia,
		marcasPorDia,
		semanasDelMes,
		separarDia
	} from './calendario.js';
	import { fotosDe } from './feed.svelte.js';
	import { descargarIcs } from './ics.js';
	import { obtenerTokenArchivo, urlFoto } from './pb.svelte.js';

	let { hoy }: { hoy: string } = $props();
	const diasSemana = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
	const formatoMes = new Intl.DateTimeFormat('es', { month: 'long', timeZone: 'UTC' });
	let mesVisible = $state(untrack(() => new Date(`${hoy.slice(0, 7)}-01T00:00:00Z`)));
	let seleccionado = $state<string>();
	let momentosAbiertos = $state(false);
	let consulta = $state(untrack(consultarMes));

	const anio = $derived(mesVisible.getUTCFullYear());
	const tituloMes = $derived(formatoMes.format(mesVisible));
	const dias = $derived(semanasDelMes(anio, mesVisible.getUTCMonth() + 1).flat());

	async function consultarMes() {
		const posts = await cargarMes(mesVisible.getUTCFullYear(), mesVisible.getUTCMonth() + 1);
		const fotos = posts.flatMap((post) => {
			if (post.tipo !== 'momento') return [];
			const foto = fotosDe(post)[0];
			return foto ? [{ id: post.id, foto }] : [];
		});
		const token = fotos.length ? await obtenerTokenArchivo().catch(() => null) : null;
		const miniaturas = new Map(
			token ? fotos.map(({ id, foto }) => [id, urlFoto(foto, token, '100x100')]) : []
		);
		return { posts, miniaturas };
	}

	export function recargar() {
		consulta = consultarMes();
	}

	function moverMes(paso: number) {
		const siguiente = new Date(mesVisible);
		siguiente.setUTCMonth(siguiente.getUTCMonth() + paso);
		mesVisible = siguiente;
		seleccionarDia();
		recargar();
	}

	function seleccionarDia(dia?: string) {
		if (dia !== seleccionado) momentosAbiertos = false;
		seleccionado = dia;
	}

	function etiquetaDia(dia: string, pendientes: number, hechos: number) {
		const partes = [`${Number(dia.slice(8))} de ${tituloMes}`];
		if (pendientes === 1) partes.push('1 plan pendiente');
		if (pendientes > 1) partes.push(`${pendientes} planes pendientes`);
		if (hechos === 1) partes.push('1 hecho');
		if (hechos > 1) partes.push(`${hechos} hechos`);
		return partes.join(', ');
	}
</script>

<section class="polaroid calendario" aria-labelledby="titulo-mes">
	<header>
		<button class="fantasma mes" aria-label="Mes anterior" onclick={() => moverMes(-1)}>‹</button>
		<h2 id="titulo-mes">{tituloMes} {anio}</h2>
		<button class="fantasma mes" aria-label="Mes siguiente" onclick={() => moverMes(1)}>›</button>
	</header>

	<div class="grilla semana" aria-hidden="true">
		{#each diasSemana as letra, i (i)}
			<span>{letra}</span>
		{/each}
	</div>

	{#await consulta}
		<div class="grilla" role="status" aria-label="Cargando mes">
			{#each dias as dia, i (i)}
				<span class:esqueleto={dia} aria-hidden="true"></span>
			{/each}
		</div>
	{:then { posts, miniaturas }}
		{@const marcas = marcasPorDia(posts)}
		<div class="grilla">
			{#each dias as dia, i (i)}
				{#if dia}
					{@const pendientes = marcas.get(dia)?.pendiente.length ?? 0}
					{@const hechos = marcas.get(dia)?.hecho.length ?? 0}
					<button
						class="dia"
						class:hoy={dia === hoy}
						aria-current={dia === hoy ? 'date' : undefined}
						aria-pressed={dia === seleccionado}
						aria-label={etiquetaDia(dia, pendientes, hechos)}
						onclick={() => seleccionarDia(dia)}
					>
						{Number(dia.slice(8))}
						<span class="marcas" aria-hidden="true">
							{#if pendientes}<span class="punto punteado"></span>{/if}
							{#if hechos}<span class="punto lleno"></span>{/if}
						</span>
					</button>
				{:else}
					<span aria-hidden="true"></span>
				{/if}
			{/each}
		</div>

		{#if seleccionado}
			{@const marca = marcas.get(seleccionado)}
			<div class="detalle">
				<h3>{fechaCortaDia(seleccionado)}</h3>
				{#if marca}
					{@const { planes, momentos } = separarDia(marca)}
					<ul>
						{#each planes as plan (plan.id)}
							<li>
								<a class="fila" href={`/post/${plan.id}`}>
									<span>
										<strong>{plan.titulo}</strong>
										<span class="estado suave">
											{plan.hora ? `${plan.hora} · ` : ''}{plan.hecho ? 'Hecho' : 'Pendiente'}
										</span>
									</span>
									<span class="indicador" aria-hidden="true">›</span>
								</a>
								{#if !plan.hecho}
									<button class="fantasma exportar" onclick={() => descargarIcs(plan)}>
										Agregar a mi calendario
									</button>
								{/if}
							</li>
						{/each}
						{#if momentos.length === 1}
							<li>
								<a class="fila" href={`/post/${momentos[0].id}`}>
									<strong>Momentos (1)</strong>
									<span class="indicador" aria-hidden="true">›</span>
								</a>
							</li>
						{:else if momentos.length > 1}
							<li>
								<button
									class="fantasma fila"
									aria-expanded={momentosAbiertos}
									onclick={() => (momentosAbiertos = !momentosAbiertos)}
								>
									<strong>Momentos ({momentos.length})</strong>
									<span class="indicador" aria-hidden="true">›</span>
								</button>
								{#if momentosAbiertos}
									<div class="tira">
										{#each momentos as momento (momento.id)}
											{@const url = miniaturas.get(momento.id)}
											{@const texto = momento.texto.trim() || 'Momento'}
											<a
												class="miniatura"
												href={`/post/${momento.id}`}
												aria-label={url ? undefined : texto}
											>
												{#if url}
													<img src={url} alt={texto} loading="lazy" />
												{:else}
													<svg
														viewBox="0 0 24 24"
														width="24"
														height="24"
														fill="none"
														stroke="currentColor"
														stroke-width="1.7"
														aria-hidden="true"
													>
														<rect x="4" y="4" width="16" height="16" rx="2" />
														<circle cx="9" cy="9" r="1.25" />
														<path d="m4 17 5-4 4 3 3-4 4 5" />
													</svg>
												{/if}
											</a>
										{/each}
									</div>
								{/if}
							</li>
						{/if}
					</ul>
				{:else}
					<p class="suave">Nada ese día.</p>
				{/if}
			</div>
		{/if}
	{:catch}
		<p class="error" role="alert">No se pudo cargar el mes.</p>
	{/await}
</section>

<style>
	.calendario {
		min-width: 0;
	}

	header {
		display: grid;
		grid-template-columns: 44px 1fr 44px;
		align-items: center;
		text-align: center;
		margin-bottom: 0.5rem;
	}

	h2,
	h3 {
		margin: 0;
	}

	.mes {
		padding: 0;
		min-height: 44px;
		font-size: 1.55rem;
	}

	.grilla {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0.2rem;
	}

	.semana {
		text-align: center;
		color: var(--texto-suave);
		font-size: 0.85rem;
		margin-bottom: 0.3rem;
	}

	.dia,
	.esqueleto {
		min-height: 44px;
		border-radius: 10px;
	}

	.dia {
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 0.15rem;
		padding: 0;
		background: transparent;
		color: var(--texto);
	}

	.dia:hover,
	.dia[aria-pressed='true'] {
		background: var(--acento-suave);
		color: var(--acento);
	}

	.hoy {
		box-shadow: inset 0 0 0 1px var(--acento);
	}

	.marcas {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		height: 0.5rem;
	}

	.punto {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
	}

	.punteado {
		border: 2px dotted var(--acento);
	}

	.lleno {
		background: var(--acento);
	}

	.esqueleto {
		background: var(--fondo);
	}

	.detalle {
		border-top: 1px solid var(--borde);
		margin-top: 0.75rem;
		padding-top: 0.75rem;
	}

	.detalle p,
	.detalle ul {
		margin: 0.5rem 0 0;
	}

	.detalle ul {
		list-style: none;
		padding: 0;
	}

	.detalle li {
		padding: 0.5rem 0;
		overflow-wrap: anywhere;
	}

	.detalle li + li {
		border-top: 1px solid var(--borde);
	}

	.detalle .fila {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		min-height: 44px;
		color: var(--texto);
		text-align: left;
		text-decoration: none;
	}

	.detalle .fila:hover {
		color: var(--acento);
	}

	.fila.fantasma,
	.exportar {
		padding-inline: 0;
	}

	.estado {
		display: block;
		font-size: 0.85rem;
	}

	.indicador {
		color: var(--texto-suave);
		font-size: 1.25rem;
	}

	.fila[aria-expanded='true'] .indicador {
		transform: rotate(90deg);
	}

	.tira {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding: 0.25rem;
	}

	.miniatura {
		display: grid;
		grid-template: 100% / 100%;
		flex: none;
		width: 100px;
		height: 100px;
		place-items: center;
		overflow: hidden;
		border-radius: 8px;
		background: var(--fondo);
		color: var(--texto-suave);
	}

	.miniatura img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
