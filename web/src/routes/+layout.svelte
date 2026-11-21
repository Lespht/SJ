<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { sesion, renovarSesion } from '#lib/pb.svelte.js';
	import Icono, { type NombreIcono } from '#lib/Icono.svelte';
	import type { LayoutProps } from './$types';
	import '@fontsource-variable/onest';
	import '@fontsource-variable/bricolage-grotesque';
	import './app.css';

	let { children }: LayoutProps = $props();

	const secciones: { href: string; label: string; icono: NombreIcono }[] = [
		{ href: '/', label: 'Inicio', icono: 'inicio' },
		{ href: '/ideas', label: 'Planes', icono: 'planes' },
		{ href: '/perfil', label: 'Perfil', icono: 'perfil' }
	];

	const enLogin = $derived(page.url.pathname === '/login');

	// Guardia simple: sin sesión → login. Con sesión en /login → inicio.
	$effect(() => {
		if (!sesion.usuario && !enLogin) goto('/login', { replaceState: true });
		if (sesion.usuario && enLogin) goto('/', { replaceState: true });
	});

	// Renueva el token al abrir la app (sin red, la sesión se mantiene).
	$effect(() => {
		renovarSesion();
	});

	function activa(href: string) {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<title>Nosotros</title>
	<meta name="theme-color" content="#eef0ec" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#121513" media="(prefers-color-scheme: dark)" />
</svelte:head>

{#if enLogin}
	{@render children()}
{:else if sesion.usuario}
	<header class="cabecera">
		<div class="lado">
			<!-- Registro rápido: por ahora lleva a subir fotos (NOS-11 lo reemplaza). -->
			<a href="/fotos" class="boton-icono" aria-label="Agregar">
				<Icono nombre="mas" />
			</a>
		</div>
		<a href="/" class="marca">Nosotros</a>
		<div class="lado derecha">
			<a href="/juegos" class="boton-icono" class:activo={activa('/juegos')} aria-label="Juegos">
				<Icono nombre="juegos" />
			</a>
			<a
				href="/mensajes"
				class="boton-icono"
				class:activo={activa('/mensajes')}
				aria-label="Mensajes"
			>
				<Icono nombre="mensajes" />
			</a>
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
			>
				<Icono nombre={s.icono} />
				<small>{s.label}</small>
			</a>
		{/each}
	</nav>
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
		font-family: var(--fuente-titulo);
		font-size: 1.4rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		color: var(--texto);
		text-decoration: none;
	}
	.boton-icono {
		width: 44px;
		height: 44px;
		display: grid;
		place-items: center;
		color: var(--texto);
		border-radius: 50%;
	}
	.boton-icono.activo {
		color: var(--acento);
	}
	main {
		max-width: var(--ancho);
		margin: 0 auto;
		padding: 1rem 1rem calc(var(--alto-nav) + 1rem);
	}
	.barra {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 10;
		height: var(--alto-nav);
		display: flex;
		justify-content: center;
		gap: clamp(1.5rem, 12vw, 5rem);
		padding: 0.4rem 0 env(safe-area-inset-bottom, 0px);
		background: var(--fondo);
		border-top: 1px solid var(--borde);
	}
	.barra a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-width: 56px;
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
