<script lang="ts">
	// Hoja de confirmación para borrar (los diálogos del navegador se ven mal en la app instalada).
	// Si se puede archivar, ofrece "Archivar mejor": el archivo es para lo que no querés ver pero
	// tampoco perder. Si no se puede borrar, explica por qué y deja solo archivar.
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fly } from 'svelte/transition';

	let {
		titulo,
		motivo = '',
		archivar,
		borrar,
		cerrar
	}: {
		/** Qué se borra, tal como lo ve la persona ("el gato otra vez en mi silla", "esta foto"). */
		titulo: string;
		/** Si no se puede borrar, por qué (ver motivoParaNoBorrar). */
		motivo?: string;
		archivar?: () => Promise<unknown>;
		borrar: () => Promise<unknown>;
		cerrar: () => void;
	} = $props();

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

	async function hacer(accion: () => Promise<unknown>, falla: string) {
		if (ocupado) return;
		ocupado = true;
		error = '';
		try {
			await accion();
			cerrar();
		} catch {
			error = falla;
			ocupado = false;
		}
	}

	function pedirCierre() {
		if (!ocupado) cerrar();
	}
</script>

<dialog
	bind:this={dialogo}
	aria-labelledby="confirmar-titulo"
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
		{#if motivo}
			<h2 id="confirmar-titulo">No se puede borrar «{titulo}»</h2>
			<p class="suave">{motivo}</p>
		{:else}
			<h2 id="confirmar-titulo">¿Borrar «{titulo}»?</h2>
			<p class="suave">No se puede deshacer.</p>
		{/if}
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<div class="acciones">
			{#if archivar}
				<button
					type="button"
					class:fantasma={!motivo}
					disabled={ocupado}
					onclick={() => hacer(archivar, 'No se pudo archivar.')}
				>
					{motivo ? 'Archivar' : 'Archivar mejor'}
				</button>
			{/if}
			{#if !motivo}
				<button
					type="button"
					class="borrar"
					disabled={ocupado}
					onclick={() => hacer(borrar, 'No se pudo borrar.')}
				>
					Borrar
				</button>
			{/if}
		</div>
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
		padding: 1.1rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
		border-radius: 1.25rem 1.25rem 0 0;
		background: var(--fondo);
		overflow-wrap: anywhere;
	}
	h2 {
		margin: 0;
		font-size: 1.2rem;
	}
	p {
		margin: 0;
	}
	.acciones {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	.acciones button {
		margin: 0;
		min-height: 44px;
	}
	.borrar {
		background: var(--peligro);
		border-color: var(--peligro);
		color: var(--fondo);
	}
	.cancelar {
		min-height: 44px;
	}
</style>
