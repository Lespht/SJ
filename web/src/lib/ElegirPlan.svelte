<script lang="ts">
	// Hoja para elegir un plan hecho (guardar un momento como descartada; NOS-44 la reusa).
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fly } from 'svelte/transition';
	import { fechaCortaDia } from './calendario.js';
	import type { Post } from './pb.svelte.js';
	import { cargarPlanesHechos } from './posts.js';

	let {
		titulo = 'Guardar en un plan',
		elegir,
		cerrar
	}: {
		titulo?: string;
		/** Hace la acción con el plan elegido; si falla, la hoja muestra el error y sigue abierta. */
		elegir: (plan: Post) => Promise<unknown>;
		cerrar: () => void;
	} = $props();

	let ocupado = $state(false);
	let error = $state('');
	let pedido = $state(cargarPlanesHechos());
	let dialogo: HTMLDialogElement;

	onMount(() => {
		const foco = document.activeElement;
		dialogo.showModal();
		return () => {
			dialogo.close();
			if (foco instanceof HTMLElement && foco.isConnected) foco.focus({ preventScroll: true });
		};
	});

	async function tocar(plan: Post) {
		if (ocupado) return;
		ocupado = true;
		error = '';
		try {
			await elegir(plan);
			cerrar();
		} catch {
			error = 'No se pudo guardar en ese plan.';
			ocupado = false;
		}
	}

	function pedirCierre() {
		if (!ocupado) cerrar();
	}
</script>

<dialog
	bind:this={dialogo}
	aria-labelledby="elegir-plan-titulo"
	oncancel={(evento) => {
		evento.preventDefault();
		pedirCierre();
	}}
>
	<button
		type="button"
		class="fondo"
		tabindex="-1"
		aria-label="Cancelar"
		disabled={ocupado}
		onclick={pedirCierre}
	></button>
	<div
		class="hoja"
		aria-busy={ocupado}
		transition:fly|global={{ y: '100%', duration: prefersReducedMotion.current ? 0 : 220 }}
	>
		<h2 id="elegir-plan-titulo">{titulo}</h2>
		<p class="suave">Solo planes que ya hicieron.</p>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		{#await pedido}
			<p class="suave" role="status">Cargando planes…</p>
		{:then planes}
			{#if planes.length}
				<ul>
					{#each planes as plan (plan.id)}
						<li>
							<button
								type="button"
								class="fantasma plan"
								disabled={ocupado}
								onclick={() => tocar(plan)}
							>
								<strong>{plan.titulo}</strong>
								{#if plan.fecha}<span class="suave">{fechaCortaDia(plan.fecha)}</span>{/if}
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p>Todavía no hay planes hechos.</p>
			{/if}
		{:catch}
			<p class="error" role="alert">No se pudieron cargar los planes.</p>
			<button type="button" onclick={() => (pedido = cargarPlanesHechos())}>Reintentar</button>
		{/await}
		<button type="button" class="fantasma cancelar" disabled={ocupado} onclick={pedirCierre}>
			Cancelar
		</button>
	</div>
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
		display: grid;
		gap: 0.5rem;
		width: min(100%, 480px);
		max-height: 80dvh;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 1.1rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
		border-radius: 1.25rem 1.25rem 0 0;
		background: var(--fondo);
	}
	h2,
	p {
		margin: 0;
	}
	h2 {
		font-size: 1.2rem;
	}
	ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li + li {
		border-top: 1px solid var(--borde);
	}
	.plan {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		min-height: 48px;
		padding-inline: 0;
		color: var(--texto);
		text-align: left;
		overflow-wrap: anywhere;
	}
	.plan span {
		flex: none;
	}
	.cancelar {
		min-height: 44px;
	}
</style>
