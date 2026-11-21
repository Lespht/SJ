<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { setContext } from 'svelte';
	import { feed, refrescarInicio } from '#lib/feed.svelte.js';
	import Hoja from '#lib/Hoja.svelte';
	import BotonMensajes from '#lib/BotonMensajes.svelte';
	import { escucharNovedades, novedades } from '#lib/novedades.svelte.js';
	import { sesion, renovarSesion } from '#lib/pb.svelte.js';
	import { temaDe } from '#lib/perfil.svelte.js';
	import Icono, { type NombreIcono } from '#lib/Icono.svelte';
	import type { LayoutProps } from './$types';
	import '@fontsource-variable/onest';
	import '@fontsource-variable/bricolage-grotesque';
	import './app.css';

	let { children }: LayoutProps = $props();
	let compartiendo = $state(false);

	function abrirHoja() {
		compartiendo = true;
	}

	setContext('abrirHoja', abrirHoja);

	function alCompartir() {
		compartiendo = false;
		feed.version += 1;
		if (page.url.pathname !== '/') void goto('/');
	}

	const secciones: { href: string; label: string; icono: NombreIcono }[] = [
		{ href: '/', label: 'Inicio', icono: 'inicio' },
		{ href: '/ideas', label: 'Planes', icono: 'planes' },
		{ href: '/perfil', label: 'Perfil', icono: 'perfil' }
	];

	const enLogin = $derived(page.url.pathname === '/login');
	const usuarioId = $derived(sesion.usuario?.id);
	const tema = $derived(temaDe(sesion.usuario));

	$effect(() => {
		const raiz = document.documentElement;
		if (sesion.usuario) {
			raiz.dataset.modo = tema.modo;
			raiz.dataset.acento = tema.acento;
		} else {
			delete raiz.dataset.modo;
			delete raiz.dataset.acento;
		}
	});

	// Guardia simple: sin sesión → login. Con sesión en /login → inicio.
	$effect(() => {
		if (!sesion.usuario && !enLogin) goto('/login', { replaceState: true });
		if (sesion.usuario && enLogin) goto('/', { replaceState: true });
	});

	// Renueva el token al abrir la app (sin red, la sesión se mantiene).
	$effect(() => {
		renovarSesion();
	});

	$effect(() => {
		novedades.hay = false;
		if (usuarioId) return escucharNovedades(usuarioId);
	});

	function activa(href: string) {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}

	function tocarInicio(evento: MouseEvent, desdeMarca = false) {
		if (evento.button !== 0 || evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey)
			return;
		if (activa('/')) {
			evento.preventDefault();
			refrescarInicio();
		} else if (desdeMarca) {
			novedades.hay = false;
		}
	}
</script>

<svelte:head>
	<title>Nosotros</title>
	{#if tema.modo === 'sistema'}
		<meta name="theme-color" content="#eef0ec" media="(prefers-color-scheme: light)" />
		<meta name="theme-color" content="#121513" media="(prefers-color-scheme: dark)" />
	{:else}
		<meta name="theme-color" content={tema.modo === 'oscuro' ? '#121513' : '#eef0ec'} />
	{/if}
</svelte:head>

{#if enLogin}
	{@render children()}
{:else if sesion.usuario}
	<header class="cabecera">
		<div class="lado">
			<button
				type="button"
				class="boton-icono"
				aria-label="Compartir"
				aria-haspopup="dialog"
				onclick={abrirHoja}
			>
				<Icono nombre="mas" />
			</button>
		</div>
		<a
			href="/"
			class="marca"
			aria-label={novedades.hay ? 'Nosotros (hay novedades)' : 'Nosotros'}
			onclick={(evento) => tocarInicio(evento, true)}
		>
			Nosotros
			{#if novedades.hay}
				<svg
					class="borde-novedades"
					viewBox="0 0 120 40"
					preserveAspectRatio="none"
					aria-hidden="true"
				>
					<rect x="1" y="1" width="118" height="38" rx="12" pathLength="100" />
				</svg>
			{/if}
		</a>
		<div class="lado derecha">
			<a href="/juegos" class="boton-icono" class:activo={activa('/juegos')} aria-label="Juegos">
				<Icono nombre="juegos" />
			</a>
			<BotonMensajes activo={activa('/mensajes')} />
		</div>
	</header>

	<main>
		{@render children()}
	</main>

	<nav class="barra">
		{#each secciones as s (s.href)}
			<a
				href={s.href}
				class:activa={activa(s.href)}
				aria-current={activa(s.href) ? 'page' : undefined}
				onclick={s.href === '/' ? tocarInicio : undefined}
			>
				<Icono nombre={s.icono} />
				<small>{s.label}</small>
			</a>
		{/each}
	</nav>
	{#if compartiendo}
		<Hoja autor={sesion.usuario.id} cerrar={() => (compartiendo = false)} compartir={alCompartir} />
	{/if}
{/if}

<style>
	.cabecera {
		position: sticky;
		top: 0;
		z-index: 10;
		height: var(--alto-cabecera);
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: 0 0.5rem;
		background: var(--fondo);
		border-bottom: 1px solid var(--borde);
	}
	.lado {
		display: flex;
	}
	.derecha {
		justify-content: flex-end;
	}
	.marca {
		position: relative;
		font-family: var(--fuente-titulo);
		font-size: 1.4rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		color: var(--texto);
		text-decoration: none;
	}
	.borde-novedades {
		position: absolute;
		inset: -2px -8px;
		width: calc(100% + 16px);
		height: calc(100% + 4px);
		pointer-events: none;
	}
	.borde-novedades rect {
		fill: none;
		stroke: var(--acento);
		stroke-width: 2px;
		stroke-dasharray: 100;
		stroke-dashoffset: 0;
		vector-effect: non-scaling-stroke;
		animation: recorrer-novedades 1.2s ease-out both;
	}
	@keyframes recorrer-novedades {
		from {
			stroke-dashoffset: 100;
		}
		to {
			stroke-dashoffset: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.borde-novedades rect {
			animation: none;
		}
	}
	.boton-icono {
		width: 44px;
		height: 44px;
		display: grid;
		place-items: center;
		color: var(--texto);
		border-radius: 50%;
	}
	button.boton-icono {
		background: transparent;
		padding: 0;
	}
	.boton-icono.activo {
		color: var(--acento);
	}
	main {
		max-width: var(--ancho);
		margin: 0 auto;
		padding: 1rem 1rem calc(var(--alto-nav) + 1rem);
		/* Una polaroid que sale volando del mazo no debe ensanchar la página. */
		overflow-x: clip;
	}
	.barra {
		position: fixed;
		bottom: var(--separacion-barra);
		left: 16px;
		right: 16px;
		z-index: 10;
		max-width: 420px;
		height: var(--alto-barra);
		margin-inline: auto;
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		padding-inline: 0.5rem;
		border: 1px solid var(--borde);
		border-radius: 999px;
		background: var(--fondo-elevado);
		background: color-mix(in oklab, var(--fondo-elevado) 80%, transparent);
		-webkit-backdrop-filter: blur(12px);
		backdrop-filter: blur(12px);
		box-shadow: var(--sombra-polaroid);
	}
	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		.barra {
			background: var(--fondo-elevado);
		}
	}
	.barra a {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: 0;
		text-decoration: none;
		color: var(--texto-suave);
	}
	.barra small {
		font-size: 0.7rem;
	}
	.barra a.activa {
		color: var(--texto);
	}
	.barra a.activa :global(svg) {
		stroke-width: 2.2;
	}
</style>
