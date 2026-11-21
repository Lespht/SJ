<script lang="ts">
	import { pb } from '#lib/pb.svelte.js';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let cargando = $state(false);

	async function entrar(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		cargando = true;
		try {
			await pb.collection('users').authWithPassword(email, password);
			// el layout redirige solo al detectar la sesión
		} catch {
			error = 'Email o contraseña incorrectos.';
		} finally {
			cargando = false;
		}
	}
</script>

<div class="centro">
	<form class="polaroid" onsubmit={entrar}>
		<h1>Nosotros</h1>
		<label>
			Email
			<input type="email" bind:value={email} autocomplete="username" required />
		</label>
		<label>
			Contraseña
			<input type="password" bind:value={password} autocomplete="current-password" required />
		</label>
		{#if error}<p class="error">{error}</p>{/if}
		<button disabled={cargando}>{cargando ? 'Entrando…' : 'Entrar'}</button>
	</form>
</div>

<style>
	.centro {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1rem;
	}
	form {
		width: 100%;
		max-width: 360px;
		display: grid;
		gap: 0.9rem;
		padding: 1.5rem 1.25rem 2rem;
		transform: rotate(-0.6deg);
	}
	h1 {
		text-align: center;
		font-size: 2rem;
		font-weight: 700;
		letter-spacing: -0.03em;
	}
	label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.9rem;
	}
</style>
