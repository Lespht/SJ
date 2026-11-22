<script lang="ts">
	// Hoja para "Crear un plan con estas fotos" (NOS-44): arreglar una salida que quedó partida.
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fly } from 'svelte/transition';
	import type { Post } from './pb.svelte.js';
	import { categoriasPlan } from './posts.js';

	let {
		fotos,
		crear,
		cerrar
	}: {
		/** Cuántas fotos se van a mover, para el texto. */
		fotos: number;
		/** Si falla, la hoja muestra el error y sigue abierta. */
		crear: (datos: { titulo: string; categoria: Post['categoria'] }) => Promise<unknown>;
		cerrar: () => void;
	} = $props();

	let titulo = $state('');
	let categoria = $state<Post['categoria']>('cita');
	let ocupado = $state(false);
	let error = $state('');
	let dialogo: HTMLDialogElement;

	onMount(() => {
		const foco = document.activeElement;
		dialogo.showModal();
		return () => {
			dialogo.close();
			if (foco instanceof HTMLElement && foco.isConnected) foco.focus({ preventScroll: true });
		};
	});

	async function enviar(evento: SubmitEvent) {
		evento.preventDefault();
		if (ocupado || !titulo.trim()) return;
		ocupado = true;
		error = '';
		try {
			await crear({ titulo: titulo.trim(), categoria });
			cerrar();
		} catch (fallo) {
			error = fallo instanceof Error ? fallo.message : 'No se pudo crear el plan.';
			ocupado = false;
		}
	}

	function pedirCierre() {
		if (!ocupado) cerrar();
	}
</script>

<dialog
	bind:this={dialogo}
	aria-labelledby="crear-plan-titulo"
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
	<form
		class="hoja"
		aria-busy={ocupado}
		onsubmit={enviar}
		transition:fly|global={{ y: '100%', duration: prefersReducedMotion.current ? 0 : 220 }}
	>
		<h2 id="crear-plan-titulo">Crear un plan con estas fotos</h2>
		<p class="suave">
			Queda como un plan hecho, con la fecha del momento más viejo y
			{fotos === 1 ? 'la foto' : `las ${fotos} fotos`} como principales.
		</p>
		<label>
			¿Qué hicieron?<input bind:value={titulo} required maxlength="200" disabled={ocupado} />
		</label>
		<label>
			Categoría
			<select bind:value={categoria} disabled={ocupado}>
				{#each categoriasPlan as c (c.valor)}
					<option value={c.valor}>{c.label}</option>
				{/each}
			</select>
		</label>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<button disabled={ocupado || !titulo.trim()}>{ocupado ? 'Creando…' : 'Crear plan'}</button>
		<button type="button" class="fantasma" disabled={ocupado} onclick={pedirCierre}>
			Cancelar
		</button>
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
		display: grid;
		gap: 0.6rem;
		width: min(100%, 480px);
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
	label {
		display: grid;
		gap: 0.25rem;
	}
	button {
		min-height: 44px;
		margin: 0;
	}
</style>
