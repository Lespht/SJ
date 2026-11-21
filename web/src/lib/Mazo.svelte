<script lang="ts">
	import { untrack } from 'svelte';

	// Mazo de polaroids: las fotos de un post apiladas. Se arrastra la de adelante hacia un
	// costado y se va al fondo del mazo. Detrás asoman los bordes de las siguientes.
	type FotoMazo = { id: string; src: string; alt: string };

	let { fotos }: { fotos: FotoMazo[] } = $props();

	const UMBRAL_PX = 80;
	const UMBRAL_VELOCIDAD = 0.5; // px/ms: un gesto rápido cuenta aunque sea corto
	const DURACION_MS = 260;

	// orden[0] es la foto de adelante. Se toma una vez: si el feed vuelve a renderizar
	// (al cargar otra página), el mazo no debe volver a su orden inicial.
	let orden = $state(untrack(() => fotos.map((_, i) => i)));
	let dx = $state(0);
	let arrastrando = $state(false);
	let saliendo = $state(false);
	let ancho = $state(0);

	let inicio = { x: 0, t: 0, id: -1 };

	const varias = $derived(fotos.length > 1);
	const posicion = $derived(new Map(orden.map((indice, pos) => [indice, pos])));

	function sinMovimiento() {
		return matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function alFondo() {
		orden = [...orden.slice(1), orden[0]];
	}

	function alFrente() {
		orden = [orden[orden.length - 1], ...orden.slice(0, -1)];
	}

	function soltarHacia(lado: 1 | -1) {
		if (sinMovimiento()) {
			alFondo();
			dx = 0;
			return;
		}
		saliendo = true;
		dx = lado * (ancho * 1.15 || 400);
		setTimeout(() => {
			alFondo();
			saliendo = false;
			dx = 0;
		}, DURACION_MS);
	}

	function abajo(e: PointerEvent) {
		if (!varias || saliendo) return;
		arrastrando = true;
		inicio = { x: e.clientX, t: e.timeStamp, id: e.pointerId };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function mover(e: PointerEvent) {
		if (!arrastrando || e.pointerId !== inicio.id) return;
		dx = e.clientX - inicio.x;
	}

	function arriba(e: PointerEvent) {
		if (!arrastrando || e.pointerId !== inicio.id) return;
		arrastrando = false;
		const velocidad = Math.abs(dx) / Math.max(1, e.timeStamp - inicio.t);
		if (Math.abs(dx) > UMBRAL_PX || (Math.abs(dx) > 20 && velocidad > UMBRAL_VELOCIDAD)) {
			soltarHacia(dx > 0 ? 1 : -1);
		} else {
			dx = 0; // vuelve a su lugar
		}
	}

	function teclas(e: KeyboardEvent) {
		if (!varias || saliendo) return;
		if (e.key === 'ArrowRight') {
			e.preventDefault();
			soltarHacia(1);
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			alFrente();
		}
	}

	/** Transformación de cada carta según su lugar en el mazo. */
	function estilo(pos: number) {
		if (pos === 0) {
			return `transform: translateX(${dx}px) rotate(${dx * 0.04}deg); z-index: ${fotos.length};`;
		}
		// Asoman hasta dos cartas detrás; el resto queda escondido exactamente debajo.
		const giro = pos === 1 ? 3 : pos === 2 ? -4 : 0;
		const corrimiento = pos === 1 ? 6 : pos === 2 ? -6 : 0;
		const visible = pos <= 2 ? 1 : 0;
		return `transform: translateX(${corrimiento}px) rotate(${giro}deg); z-index: ${fotos.length - pos}; opacity: ${visible};`;
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (las flechas pasan de foto) -->
<div
	class="mazo"
	class:varias
	bind:clientWidth={ancho}
	role={varias ? 'group' : undefined}
	aria-roledescription={varias ? 'mazo de fotos' : undefined}
	aria-label={varias ? `Foto ${orden[0] + 1} de ${fotos.length}. Flechas para pasar.` : undefined}
	tabindex={varias ? 0 : undefined}
	onkeydown={teclas}
>
	{#each fotos as foto, i (foto.id)}
		{@const pos = posicion.get(i) ?? 0}
		<div
			class="carta polaroid"
			class:frente={pos === 0}
			class:suelta={pos === 0 && arrastrando}
			style={estilo(pos)}
			aria-hidden={pos !== 0}
			onpointerdown={pos === 0 ? abajo : undefined}
			onpointermove={pos === 0 ? mover : undefined}
			onpointerup={pos === 0 ? arriba : undefined}
			onpointercancel={pos === 0 ? arriba : undefined}
		>
			<img
				src={foto.src}
				alt={foto.alt}
				loading="lazy"
				draggable="false"
				onload={(e) => e.currentTarget.classList.add('cargada')}
			/>
			{#if varias && pos === 0}
				<span class="contador">{orden[0] + 1}/{fotos.length}</span>
			{/if}
		</div>
	{/each}
</div>

<style>
	.mazo {
		display: grid;
		/* Deja lugar para los bordes que asoman detrás. */
		padding: 0 6px;
	}
	.mazo:focus-visible {
		outline: 2px solid var(--acento);
		outline-offset: 6px;
		border-radius: 4px;
	}
	.carta {
		grid-area: 1 / 1;
		position: relative;
		padding: 8px 8px 30px;
		transition:
			transform 260ms cubic-bezier(0.2, 0.7, 0.2, 1),
			opacity 260ms;
		will-change: transform;
	}
	.varias .frente {
		cursor: grab;
		touch-action: pan-y; /* el scroll vertical sigue funcionando; lo horizontal es nuestro */
	}
	.suelta {
		transition: none;
		cursor: grabbing;
	}
	img {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 5;
		object-fit: cover;
		user-select: none;
		opacity: 0;
		transition: opacity 300ms;
	}
	img:global(.cargada) {
		opacity: 1;
	}
	.contador {
		position: absolute;
		right: 12px;
		bottom: 7px;
		font-size: 0.75rem;
		color: var(--texto-suave);
		font-variant-numeric: tabular-nums;
	}
</style>
