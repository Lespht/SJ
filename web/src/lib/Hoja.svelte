<script lang="ts">
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fly } from 'svelte/transition';
	import Icono from './Icono.svelte';
	import {
		categoriasPlan,
		completarPlan,
		crearMomento,
		crearPlan,
		ErrorFotosMomento,
		ErrorFotosPlan
	} from './posts.js';
	import type { Post } from './pb.svelte.js';

	let {
		autor,
		cerrar,
		compartir,
		respuestaA
	}: {
		autor: string;
		cerrar: () => void;
		compartir: () => void;
		respuestaA?: { id: string; nombre: string };
	} = $props();

	const hoy = new Date();
	let fecha = $state(
		new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
	);
	let modo = $state<'momento' | 'plan'>('momento');
	let titulo = $state('');
	let textoMomento = $state('');
	let textoPlan = $state('');
	let categoria = $state<Post['categoria']>('cita');
	let hecho = $state(false);
	let fotos = $state<{ archivo: File; src: string }[]>([]);
	let subiendo = $state(false);
	let error = $state('');
	let reintentar = $state<() => Promise<Post>>();
	let dialogo: HTMLDialogElement;

	onMount(() => {
		const modal = dialogo;
		const foco = document.activeElement;
		const raiz = document.documentElement;
		const overflow = raiz.style.overflow;
		raiz.style.overflow = 'hidden';
		modal.showModal();
		return () => {
			for (const foto of fotos) URL.revokeObjectURL(foto.src);
			raiz.style.overflow = overflow;
			modal.close();
			if (foco instanceof HTMLElement && foco.isConnected) foco.focus({ preventScroll: true });
		};
	});

	function pedirCierre() {
		if (!subiendo) cerrar();
	}

	function elegir(evento: Event & { currentTarget: HTMLInputElement }) {
		const input = evento.currentTarget;
		for (const archivo of input.files ?? [])
			fotos.push({ archivo, src: URL.createObjectURL(archivo) });
		input.value = '';
	}

	function quitar(src: string) {
		URL.revokeObjectURL(src);
		fotos = fotos.filter((foto) => foto.src !== src);
	}

	async function guardar(evento: SubmitEvent) {
		evento.preventDefault();
		if (subiendo || (modo === 'momento' ? !fotos.length : !titulo.trim())) return;
		subiendo = true;
		error = '';
		try {
			const archivos = fotos.map((foto) => foto.archivo);
			if (reintentar) {
				await reintentar();
			} else if (modo === 'momento') {
				await crearMomento(archivos, textoMomento, fecha, autor, respuestaA?.id);
			} else {
				const plan = await crearPlan({ titulo: titulo.trim(), texto: textoPlan, categoria, autor });
				if (hecho) {
					const fechaElegida = fecha;
					const usuario = autor;
					reintentar = () => completarPlan(plan, archivos, fechaElegida, usuario);
					await reintentar();
				}
			}
			compartir();
		} catch (err) {
			if (err instanceof ErrorFotosMomento || err instanceof ErrorFotosPlan)
				reintentar = err.reintentar;
			error = err instanceof Error ? err.message : 'No se pudo compartir.';
		} finally {
			subiendo = false;
		}
	}
</script>

{#snippet selectorFotos()}
	<div class="fotos" class:con-fotos={fotos.length > 0}>
		{#each fotos as foto (foto.src)}
			<div class="miniatura polaroid">
				<img src={foto.src} alt={foto.archivo.name} />
				<button
					type="button"
					class="quitar"
					aria-label={'Quitar ' + foto.archivo.name}
					onclick={() => quitar(foto.src)}
				>
					<Icono nombre="cerrar" tam={16} />
				</button>
			</div>
		{/each}
		<label class="elegir">
			<input
				class="oculto"
				type="file"
				accept="image/*"
				multiple
				aria-label={fotos.length ? 'Agregar más fotos' : 'Elegir fotos'}
				onchange={elegir}
			/>
			<Icono nombre="mas" tam={24} />
			{#if !fotos.length}<span>Elegir fotos</span>{/if}
		</label>
	</div>
{/snippet}

{#snippet campoFecha()}
	<label class="campo">Fecha <input type="date" required bind:value={fecha} /></label>
{/snippet}

<svelte:window
	onkeydown={(evento) => {
		if (evento.key !== 'Escape' || !dialogo.open) return;
		evento.preventDefault();
		pedirCierre();
	}}
/>

<dialog
	bind:this={dialogo}
	aria-labelledby="titulo-hoja"
	oncancel={(evento) => {
		evento.preventDefault();
		pedirCierre();
	}}
>
	<button
		type="button"
		class="fondo"
		tabindex="-1"
		aria-label="Cerrar hoja"
		disabled={subiendo}
		onclick={pedirCierre}
	></button>
	<form
		class="hoja"
		onsubmit={guardar}
		aria-busy={subiendo}
		transition:fly|global={{ y: '100%', duration: prefersReducedMotion.current ? 0 : 280 }}
	>
		<div class="cabecera">
			<h2 id="titulo-hoja">{respuestaA ? `Responder a ${respuestaA.nombre}` : 'Compartir'}</h2>
			<button
				type="button"
				class="icono cerrar"
				aria-label="Cerrar"
				disabled={subiendo}
				onclick={pedirCierre}
			>
				<Icono nombre="cerrar" />
			</button>
		</div>

		<fieldset class="campos" disabled={subiendo || !!reintentar}>
			{#if !respuestaA}
				<div class="segmentos" role="group" aria-label="Tipo de publicación">
					<button
						type="button"
						aria-pressed={modo === 'momento'}
						onclick={() => (modo = 'momento')}
					>
						Momento
					</button>
					<button type="button" aria-pressed={modo === 'plan'} onclick={() => (modo = 'plan')}>
						Plan
					</button>
				</div>
			{/if}

			{#if modo === 'momento'}
				{@render selectorFotos()}
				<textarea
					aria-label="¿Qué está pasando?"
					placeholder="¿Qué está pasando?"
					bind:value={textoMomento}
					rows="2"
					maxlength="500"></textarea>
				{@render campoFecha()}
			{:else}
				<input
					aria-label="Título"
					placeholder="Título"
					bind:value={titulo}
					maxlength="200"
					required
				/>
				<textarea
					aria-label="Detalle opcional"
					placeholder="Detalle (opcional)"
					bind:value={textoPlan}
					rows="2"
					maxlength="2000"></textarea>
				<div class="chips" role="group" aria-label="Categoría">
					{#each categoriasPlan as opcion (opcion.valor)}
						<button
							type="button"
							aria-pressed={categoria === opcion.valor}
							onclick={() => (categoria = opcion.valor)}
						>
							{opcion.label}
						</button>
					{/each}
				</div>
				<label class="hecho">
					<span>Ya lo hicimos</span>
					<input type="checkbox" role="switch" bind:checked={hecho} />
				</label>
				{#if hecho}
					{@render selectorFotos()}
					{@render campoFecha()}
				{/if}
			{/if}
		</fieldset>

		<button
			class="publicar"
			disabled={subiendo || (modo === 'momento' ? !fotos.length : !titulo.trim())}
		>
			{subiendo
				? 'Compartiendo…'
				: respuestaA
					? 'Responder'
					: modo === 'momento'
						? 'Compartir'
						: 'Guardar plan'}
		</button>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</form>
</dialog>

<style>
	dialog {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		overflow: hidden;
		border: 0;
		background: transparent;
		color: var(--texto);
	}

	dialog[open] {
		display: grid;
		align-items: end;
		justify-items: center;
	}

	dialog::backdrop {
		background: rgb(0 0 0 / 0.55);
	}

	.fondo {
		position: absolute;
		inset: 0;
		width: 100%;
		padding: 0;
		background: transparent;
	}

	.hoja {
		position: relative;
		width: min(100%, var(--ancho));
		max-height: 94dvh;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0.85rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
		border-radius: 1.25rem 1.25rem 0 0;
		background: var(--fondo);
	}

	.cabecera,
	.hecho {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.cabecera h2 {
		margin: 0;
		font-size: 1.4rem;
	}

	.cabecera .cerrar {
		min-width: 44px;
		min-height: 44px;
	}

	.campos {
		display: grid;
		min-width: 0;
		gap: 0.75rem;
		margin: 0.4rem 0 1rem;
		padding: 0;
		border: 0;
	}

	.segmentos {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.25rem;
		padding: 0.25rem;
		border: 1px solid var(--borde);
		border-radius: 12px;
	}

	.segmentos button,
	.chips button {
		background: transparent;
		color: var(--texto-suave);
	}

	.segmentos button[aria-pressed='true'],
	.chips button[aria-pressed='true'] {
		background: var(--acento-suave);
		color: var(--acento);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.chips button {
		padding: 0.35rem 0.7rem;
		border: 1px solid var(--borde);
		border-radius: 999px;
	}

	.elegir {
		position: relative;
		display: flex;
		min-height: 4.5rem;
		gap: 0.4rem;
		align-items: center;
		justify-content: center;
		border: 1px dashed var(--acento);
		border-radius: 0.55rem;
		background: var(--acento-suave);
		color: var(--acento);
		font-weight: 600;
		cursor: pointer;
	}

	.elegir:focus-within {
		outline: 2px solid var(--acento);
		outline-offset: 2px;
	}

	.oculto {
		position: absolute;
		width: 1px;
		height: 1px;
		border: 0;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.con-fotos {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
		gap: 0.45rem;
	}

	.con-fotos .elegir {
		aspect-ratio: 1;
		min-height: 0;
	}

	.miniatura {
		position: relative;
		aspect-ratio: 1;
		min-width: 0;
		padding: 4px;
	}

	.miniatura img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.quitar {
		position: absolute;
		top: 4px;
		right: 4px;
		display: grid;
		width: 32px;
		height: 32px;
		place-items: center;
		padding: 0;
		border-radius: 50%;
		background: var(--fondo-elevado);
		color: var(--texto);
	}

	.campo {
		display: grid;
		gap: 0.25rem;
		color: var(--texto-suave);
	}

	.hecho input {
		position: relative;
		appearance: none;
		width: 44px;
		height: 26px;
		margin: 0;
		padding: 0;
		border-radius: 999px;
		cursor: pointer;
	}

	.hecho input::before {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--texto-suave);
		content: '';
	}

	.hecho input:checked {
		background: var(--acento-suave);
		border-color: var(--acento);
	}

	.hecho input:checked::before {
		left: 21px;
		background: var(--acento);
	}

	textarea {
		resize: vertical;
	}

	.publicar {
		width: 100%;
	}

	.error {
		margin: 0.5rem 0 0;
	}
</style>
