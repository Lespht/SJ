<script lang="ts">
	import { pb, sesion, nombre, fechaCorta, type Puntaje } from '#lib/pb.svelte.js';

	// Memotest: encontrar los pares. Menos intentos = más puntos.
	const JUEGO = 'memoria';
	const EMOJIS = ['💖', '🌹', '🍓', '🐱', '🌙', '🎵', '🍕', '✈️'];

	type Carta = { id: number; emoji: string; visible: boolean; encontrada: boolean };

	let cartas = $state<Carta[]>([]);
	let elegidas = $state<number[]>([]);
	let intentos = $state(0);
	let bloqueado = $state(false);
	let guardado = $state(false);
	let mejores = $state<Puntaje[]>([]);

	const terminado = $derived(cartas.length > 0 && cartas.every((c) => c.encontrada));
	const puntos = $derived(Math.max(10, 200 - (intentos - EMOJIS.length) * 10));

	$effect(() => {
		nuevaPartida();
		cargarMejores();
	});

	$effect(() => {
		if (terminado && !guardado) guardar();
	});

	function mezclar<T>(arr: T[]) {
		const a = [...arr];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}

	function nuevaPartida() {
		cartas = mezclar([...EMOJIS, ...EMOJIS]).map((emoji, id) => ({
			id,
			emoji,
			visible: false,
			encontrada: false
		}));
		elegidas = [];
		intentos = 0;
		guardado = false;
	}

	function elegir(i: number) {
		const c = cartas[i];
		if (bloqueado || c.visible || c.encontrada) return;
		c.visible = true;
		elegidas.push(i);
		if (elegidas.length < 2) return;

		intentos++;
		const [a, b] = elegidas;
		if (cartas[a].emoji === cartas[b].emoji) {
			cartas[a].encontrada = cartas[b].encontrada = true;
			elegidas = [];
		} else {
			bloqueado = true;
			setTimeout(() => {
				cartas[a].visible = cartas[b].visible = false;
				elegidas = [];
				bloqueado = false;
			}, 800);
		}
	}

	async function guardar() {
		if (!sesion.usuario) return;
		guardado = true;
		await pb.collection('puntajes').create({ juego: JUEGO, puntos, autor: sesion.usuario.id });
		await cargarMejores();
	}

	async function cargarMejores() {
		const res = await pb.collection('puntajes').getList<Puntaje>(1, 5, {
			filter: pb.filter('juego = {:juego}', { juego: JUEGO }),
			sort: '-puntos,created',
			expand: 'autor'
		});
		mejores = res.items;
	}
</script>

<h1>Juegos</h1>

<div class="layout">
	<section>
		<div class="cabecera">
			<h2>Memotest</h2>
			<span class="suave">Intentos: {intentos}</span>
			<button class="fantasma" onclick={nuevaPartida}>Reiniciar</button>
		</div>

		<div class="tablero">
			{#each cartas as c, i (c.id)}
				<button
					class="carta"
					class:dada-vuelta={c.visible || c.encontrada}
					class:encontrada={c.encontrada}
					onclick={() => elegir(i)}
					aria-label={c.visible || c.encontrada ? c.emoji : 'Carta oculta'}
				>
					<span>{c.visible || c.encontrada ? c.emoji : ''}</span>
				</button>
			{/each}
		</div>

		{#if terminado}
			<div class="tarjeta fin">
				<strong>{puntos} puntos en {intentos} intentos</strong>
				<button onclick={nuevaPartida}>Jugar de nuevo</button>
			</div>
		{/if}
	</section>

	<aside class="tarjeta">
		<h2>Mejores puntajes</h2>
		<ol>
			{#each mejores as p (p.id)}
				<li>
					<strong>{p.puntos}</strong> — {nombre(p.expand?.autor)}
					<small class="suave">{fechaCorta(p.created)}</small>
				</li>
			{:else}
				<p class="suave">Nadie jugó todavía.</p>
			{/each}
		</ol>
	</aside>
</div>

<style>
	h2 {
		font-size: 1.1rem;
		margin: 0;
	}
	.layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
		align-items: start;
	}
	@media (max-width: 700px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	.cabecera {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}
	.cabecera button {
		margin-left: auto;
	}
	.tablero {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		max-width: 420px;
	}
	.carta {
		aspect-ratio: 1;
		font-size: clamp(1.5rem, 7vw, 2.2rem);
		padding: 0;
		background: var(--fondo-elevado);
		border: 1.5px dashed var(--texto-suave);
		border-radius: 4px;
		transition:
			transform 0.2s,
			background 0.2s;
	}
	.carta.dada-vuelta {
		background: var(--fondo-elevado);
		border: 1.5px solid var(--borde);
		box-shadow: var(--sombra-polaroid);
		transform: rotateY(180deg);
	}
	.carta.dada-vuelta span {
		display: inline-block;
		transform: rotateY(180deg);
	}
	.carta.encontrada {
		background: var(--acento-suave);
		border-color: var(--acento);
	}
	.fin {
		margin-top: 1rem;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
		max-width: 420px;
	}
	ol {
		padding-left: 1.2rem;
		margin: 0.5rem 0 0;
	}
	li {
		margin-bottom: 0.3rem;
	}
	li small {
		display: block;
	}
</style>
