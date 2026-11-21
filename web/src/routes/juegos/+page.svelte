<script lang="ts">
	import Icono from '#lib/Icono.svelte';
	import { armarCartas, puntosPor, type Carta, type FotoJuego } from '#lib/memoria.js';
	import {
		pb,
		sesion,
		nombre,
		fechaCorta,
		obtenerTokenArchivo,
		urlFoto,
		type Foto,
		type Puntaje
	} from '#lib/pb.svelte.js';

	// Memotest con fotos de ustedes: encontrar los pares. Menos intentos = más puntos.
	const JUEGO = 'memoria';

	let cartas = $state<Carta[]>([]);
	let elegidas = $state<number[]>([]);
	let intentos = $state(0);
	let bloqueado = $state(false);
	let guardado = $state(false);
	let preparando = $state(true);
	let mejores = $state<Puntaje[]>([]);

	const terminado = $derived(cartas.length > 0 && cartas.every((c) => c.encontrada));
	const puntos = $derived(puntosPor(intentos));

	$effect(() => {
		nuevaPartida();
		cargarMejores();
	});

	$effect(() => {
		if (terminado && !guardado) guardar();
	});

	/** 8 fotos al azar del álbum. Si falla la red, se juega con figuras. */
	async function fotosAlAzar(): Promise<FotoJuego[]> {
		try {
			const [res, token] = await Promise.all([
				pb.collection('fotos').getList<Foto>(1, 8, { sort: '@random' }),
				obtenerTokenArchivo()
			]);
			return res.items.map((f) => ({
				id: f.id,
				src: urlFoto(f, token, '400x400'),
				alt: f.descripcion
			}));
		} catch {
			return [];
		}
	}

	async function nuevaPartida() {
		preparando = true;
		const fotos = await fotosAlAzar();
		cartas = armarCartas(fotos);
		elegidas = [];
		intentos = 0;
		guardado = false;
		preparando = false;
	}

	function elegir(i: number) {
		const c = cartas[i];
		if (bloqueado || c.visible || c.encontrada) return;
		c.visible = true;
		elegidas.push(i);
		if (elegidas.length < 2) return;

		intentos++;
		const [a, b] = elegidas;
		if (cartas[a].clave === cartas[b].clave) {
			cartas[a].encontrada = cartas[b].encontrada = true;
			elegidas = [];
		} else {
			bloqueado = true;
			setTimeout(() => {
				cartas[a].visible = cartas[b].visible = false;
				elegidas = [];
				bloqueado = false;
			}, 900);
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
			<button class="fantasma" onclick={nuevaPartida} disabled={preparando}>Otra partida</button>
		</div>

		<div class="tablero" aria-busy={preparando}>
			{#if preparando}
				{#each Array(16) as _, i (i)}
					<div class="carta esqueleto" aria-hidden="true"></div>
				{/each}
			{:else}
				{#each cartas as c, i (c.id)}
					{@const vista = c.visible || c.encontrada}
					<button
						class="carta"
						class:dada-vuelta={vista}
						class:encontrada={c.encontrada}
						onclick={() => elegir(i)}
						aria-label={vista
							? c.cara.tipo === 'foto'
								? c.cara.foto.alt || 'Foto'
								: c.cara.figura
							: 'Carta tapada'}
					>
						<span class="cara">
							{#if c.cara.tipo === 'foto'}
								<img src={c.cara.foto.src} alt="" draggable="false" />
							{:else}
								<Icono nombre={c.cara.figura} tam={34} />
							{/if}
						</span>
					</button>
				{/each}
			{/if}
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
		padding: 0;
		color: var(--acento);
		background: var(--fondo-elevado);
		border: 1.5px dashed var(--texto-suave);
		border-radius: 4px;
		overflow: hidden;
		transition:
			transform 0.3s,
			border-color 0.2s;
	}
	.cara {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		visibility: hidden;
		transform: rotateY(180deg);
	}
	.cara img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		user-select: none;
	}
	/* Dada vuelta: una polaroid chiquita con la foto o la figura. */
	.carta.dada-vuelta {
		padding: 4px 4px 10px;
		border: 1.5px solid var(--borde);
		box-shadow: var(--sombra-polaroid);
		transform: rotateY(180deg);
	}
	.carta.dada-vuelta .cara {
		visibility: visible;
	}
	.carta.encontrada {
		border-color: var(--acento);
	}
	.esqueleto {
		background: linear-gradient(100deg, var(--fondo) 25%, var(--borde) 50%, var(--fondo) 75%);
		background-size: 200% 100%;
		animation: brillo 1.8s ease-in-out infinite;
	}
	@keyframes brillo {
		from {
			background-position: 150% 0;
		}
		to {
			background-position: -50% 0;
		}
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
