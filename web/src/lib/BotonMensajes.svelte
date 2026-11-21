<script lang="ts">
	// Botón de mensajes de la cabecera, con un punto si hay algo del otro sin leer.
	// Estar en /mensajes cuenta como leer: se marca al entrar y con cada mensaje nuevo.
	import { onMount } from 'svelte';
	import Icono from './Icono.svelte';
	import { hayNoLeidos, marcarLeidos } from './mensajes.js';
	import { pb, sesion, type Mensaje } from './pb.svelte.js';

	let { activo }: { activo: boolean } = $props();

	let noLeidos = $state(false);

	function leer() {
		noLeidos = false;
		if (sesion.usuario) marcarLeidos(sesion.usuario).catch(() => {});
	}

	onMount(() => {
		if (sesion.usuario && !activo) {
			hayNoLeidos(sesion.usuario)
				.then((hay) => (noLeidos = hay && !activo))
				.catch(() => {});
		}

		let cancelado = false;
		let desuscribir: (() => Promise<void>) | undefined;
		pb.collection('mensajes')
			.subscribe<Mensaje>('*', (e) => {
				if (e.action !== 'create' || e.record.autor === sesion.usuario?.id) return;
				if (activo) leer();
				else noLeidos = true;
			})
			.then((quitar) => {
				if (cancelado) quitar();
				else desuscribir = quitar;
			})
			.catch(() => {});

		return () => {
			cancelado = true;
			desuscribir?.();
		};
	});

	$effect(() => {
		if (activo) leer();
	});
</script>

<a
	href="/mensajes"
	class="boton-icono"
	class:activo
	aria-label={noLeidos ? 'Mensajes (hay sin leer)' : 'Mensajes'}
>
	<Icono nombre="mensajes" />
	{#if noLeidos}<span class="punto" aria-hidden="true"></span>{/if}
</a>

<style>
	.boton-icono {
		position: relative;
		width: 44px;
		height: 44px;
		display: grid;
		place-items: center;
		color: var(--texto);
		border-radius: 50%;
	}
	.activo {
		color: var(--acento);
	}
	.punto {
		position: absolute;
		top: 9px;
		right: 8px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--acento);
		border: 2px solid var(--fondo);
		animation: aparecer 220ms ease-out;
	}
	@keyframes aparecer {
		from {
			transform: scale(0);
		}
	}
</style>
