<script lang="ts">
	import { pb, sesion, nombre } from '#lib/pb.svelte.js';
	import Icono from '#lib/Icono.svelte';

	// Mínimo por ahora: quién sos y cerrar sesión. La personalización llega en NOS-13.
</script>

<h1>{nombre(sesion.usuario)}</h1>
<p class="suave">{sesion.usuario?.email}</p>

<button class="fantasma salir" onclick={() => pb.authStore.clear()}>
	<Icono nombre="salir" tam={20} />
	Cerrar sesión
</button>

<style>
	h1 {
		margin-bottom: 0;
	}
	.salir {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding-left: 0;
		margin-top: 1rem;
	}
</style>
