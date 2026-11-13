<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { pb, sesion, nombre } from '#lib/pb.svelte.js';
	import type { LayoutProps } from './$types';
	import './app.css';

	let { children }: LayoutProps = $props();

	const secciones = [
		{ href: '/', label: 'Inicio', icono: '🏠' },
		{ href: '/fotos', label: 'Fotos', icono: '📷' },
		{ href: '/ideas', label: 'Ideas', icono: '💡' },
		{ href: '/mensajes', label: 'Mensajes', icono: '💬' },
		{ href: '/juegos', label: 'Juegos', icono: '🎲' }
	];

	const enLogin = $derived(page.url.pathname === '/login');

	// Guardia simple: sin sesión → login. Con sesión en /login → inicio.
	$effect(() => {
		if (!sesion.usuario && !enLogin) goto('/login', { replaceState: true });
		if (sesion.usuario && enLogin) goto('/', { replaceState: true });
	});

	// Renueva el token al abrir la app; si ya no es válido, cierra sesión.
	$effect(() => {
		if (pb.authStore.isValid) {
			pb.collection('users')
				.authRefresh()
				.catch(() => pb.authStore.clear());
		}
	});

	function activa(href: string) {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}

	function salir() {
		pb.authStore.clear();
	}
</script>

<svelte:head>
	<title>Nosotros</title>
</svelte:head>

{#if enLogin}
	{@render children()}
{:else if sesion.usuario}
	<header class="barra">
		<a href="/" class="marca">💞 Nosotros</a>
		<nav class="nav-escritorio">
			{#each secciones as s (s.href)}
				<a href={s.href} class:activa={activa(s.href)}>{s.label}</a>
			{/each}
		</nav>
		<button class="fantasma" onclick={salir} title="Cerrar sesión">
			{nombre(sesion.usuario)} · salir
		</button>
	</header>

	<main>
		{@render children()}
	</main>

	<nav class="nav-movil">
		{#each secciones as s (s.href)}
			<a href={s.href} class:activa={activa(s.href)}>
				<span>{s.icono}</span>
				<small>{s.label}</small>
			</a>
		{/each}
	</nav>
{/if}

<style>
	.barra {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: var(--fondo-elevado);
		border-bottom: 1px solid var(--borde);
	}
	.marca {
		font-weight: 700;
		text-decoration: none;
		color: var(--texto);
	}
	.nav-escritorio {
		display: flex;
		gap: 0.25rem;
		margin-right: auto;
	}
	.nav-escritorio a {
		padding: 0.4rem 0.75rem;
		border-radius: 999px;
		text-decoration: none;
		color: var(--texto-suave);
	}
	.nav-escritorio a.activa {
		background: var(--acento-suave);
		color: var(--acento);
	}
	main {
		max-width: 960px;
		margin: 0 auto;
		padding: 1rem 1rem 6rem;
	}
	.nav-movil {
		display: none;
	}

	@media (max-width: 700px) {
		.nav-escritorio {
			display: none;
		}
		.barra button {
			margin-left: auto;
		}
		.nav-movil {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			display: flex;
			justify-content: space-around;
			padding: 0.4rem 0 calc(0.4rem + env(safe-area-inset-bottom, 0px));
			background: var(--fondo-elevado);
			border-top: 1px solid var(--borde);
		}
		.nav-movil a {
			display: flex;
			flex-direction: column;
			align-items: center;
			text-decoration: none;
			color: var(--texto-suave);
			font-size: 1.3rem;
		}
		.nav-movil small {
			font-size: 0.7rem;
		}
		.nav-movil a.activa {
			color: var(--acento);
		}
	}
</style>
