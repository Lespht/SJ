<script lang="ts">
	import { onMount } from 'svelte';
	import Avatar from '#lib/Avatar.svelte';
	import { fotosDe } from '#lib/feed.svelte.js';
	import Icono from '#lib/Icono.svelte';
	import {
		fechaCorta,
		nombre,
		obtenerTokenArchivo,
		pb,
		sesion,
		urlFoto,
		type Acento,
		type Modo,
		type Post
	} from '#lib/pb.svelte.js';
	import { guardarAjustes, temaDe } from '#lib/perfil.svelte.js';
	import { borrarPost, restaurar } from '#lib/posts.js';

	const modos = [
		{ valor: 'sistema', etiqueta: 'Sistema' },
		{ valor: 'claro', etiqueta: 'Claro' },
		{ valor: 'oscuro', etiqueta: 'Oscuro' }
	] as const;
	const acentos = [
		{ valor: 'verde', etiqueta: 'Verde' },
		{ valor: 'azul', etiqueta: 'Azul' },
		{ valor: 'vino', etiqueta: 'Vino' },
		{ valor: 'ambar', etiqueta: 'Ámbar' },
		{ valor: 'grafito', etiqueta: 'Grafito' }
	] as const;
	const tema = $derived(temaDe(sesion.usuario));
	let borradorNombre = $state<string>();
	let subiendoAvatar = $state(false);
	let errorPerfil = $state('');

	let archivados = $state<Post[]>([]);
	const urls = new Map<string, string>();
	let cargando = $state(true);
	let ocupado = $state(false);
	let confirmar = $state<string>();
	let error = $state('');

	onMount(async () => {
		try {
			const posts = await pb.collection('posts').getFullList<Post>({
				filter: 'archivado = true',
				sort: '-archivado_en',
				expand: 'autor,fotos_via_post'
			});
			const fotos = posts.flatMap((post) => fotosDe(post).slice(0, 1));
			if (fotos.length) {
				const token = await obtenerTokenArchivo().catch(() => null);
				if (token) for (const foto of fotos) urls.set(foto.id, urlFoto(foto, token, '400x400'));
			}
			archivados = posts;
		} catch {
			error = 'No se pudo cargar el archivo.';
		} finally {
			cargando = false;
		}
	});

	async function cambiarFoto(input: HTMLInputElement) {
		const avatar = input.files?.[0];
		input.value = '';
		if (!avatar || !sesion.usuario || subiendoAvatar) return;
		subiendoAvatar = true;
		errorPerfil = '';
		try {
			await guardarAjustes(sesion.usuario.id, { avatar });
		} catch {
			errorPerfil = 'No se pudo cambiar la foto de perfil.';
		} finally {
			subiendoAvatar = false;
		}
	}

	async function guardarNombre(valor: string) {
		const usuario = sesion.usuario;
		if (!usuario || borradorNombre === undefined) return;
		const name = valor.trim();
		errorPerfil = '';
		try {
			if (name !== (usuario.name ?? '')) await guardarAjustes(usuario.id, { name });
			if (borradorNombre === valor) borradorNombre = undefined;
		} catch {
			errorPerfil = 'No se pudo guardar el nombre.';
		}
	}

	async function elegirTema(cambio: { modo: Modo } | { acento: Acento }) {
		if (!sesion.usuario) return;
		if ('modo' in cambio ? cambio.modo === tema.modo : cambio.acento === tema.acento) return;
		errorPerfil = '';
		try {
			await guardarAjustes(sesion.usuario.id, cambio);
		} catch {
			errorPerfil = 'No se pudo guardar la apariencia.';
		}
	}

	async function quitar(post: Post, accion: (post: Post) => Promise<unknown>) {
		if (ocupado) return;
		ocupado = true;
		error = '';
		try {
			await accion(post);
			archivados = archivados.filter((item) => item.id !== post.id);
			confirmar = undefined;
		} catch (err) {
			error = err instanceof Error ? err.message : 'No se pudo actualizar el archivo.';
		} finally {
			ocupado = false;
		}
	}
</script>

<h1>Perfil</h1>

<section class="ajustes tarjeta" aria-label="Ajustes de perfil">
	<div class="identidad">
		<Avatar usuario={sesion.usuario} tam={80} />
		<div>
			<strong>{nombre(sesion.usuario)}</strong>
			<p class="suave">{sesion.usuario?.email}</p>
			<label class="cambiar-foto" class:subiendo={subiendoAvatar}>
				<input
					class="oculto"
					type="file"
					accept="image/*"
					disabled={subiendoAvatar}
					onchange={(e) => cambiarFoto(e.currentTarget)}
				/>
				{subiendoAvatar ? 'Guardando foto…' : 'Cambiar foto'}
			</label>
		</div>
	</div>

	<label class="nombre">
		Cómo te ven
		<input
			type="text"
			autocomplete="nickname"
			maxlength="40"
			value={borradorNombre ?? sesion.usuario?.name ?? ''}
			oninput={(e) => (borradorNombre = e.currentTarget.value)}
			onblur={(e) => guardarNombre(e.currentTarget.value)}
			onkeydown={(e) => {
				if (e.key === 'Enter' && !e.isComposing) {
					e.preventDefault();
					e.currentTarget.blur();
				}
			}}
		/>
	</label>

	<fieldset>
		<legend>Modo</legend>
		<div class="segmentos">
			{#each modos as { valor, etiqueta } (valor)}
				<button
					type="button"
					aria-pressed={tema.modo === valor}
					onclick={() => elegirTema({ modo: valor })}
				>
					{etiqueta}
				</button>
			{/each}
		</div>
	</fieldset>

	<fieldset>
		<legend>Acento</legend>
		<div class="acentos">
			{#each acentos as { valor, etiqueta } (valor)}
				<button
					type="button"
					class="muestra"
					data-acento={valor}
					aria-label={etiqueta}
					aria-pressed={tema.acento === valor}
					onclick={() => elegirTema({ acento: valor })}
				></button>
			{/each}
		</div>
	</fieldset>

	{#if errorPerfil}<p class="error" role="alert">{errorPerfil}</p>{/if}
</section>

<button class="fantasma salir" onclick={() => pb.authStore.clear()}>
	<Icono nombre="salir" tam={20} />
	Cerrar sesión
</button>

<p><a href="/fotos">Álbum</a></p>

<section aria-labelledby="titulo-archivo" aria-busy={cargando}>
	<h2 id="titulo-archivo">Archivo</h2>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#if cargando}
		<div class="polaroid esqueleto" aria-hidden="true"></div>
	{:else if archivados.length}
		<ul>
			{#each archivados as post (post.id)}
				{@const foto = fotosDe(post)[0]}
				{@const miniatura = foto && urls.get(foto.id)}
				<li class="polaroid">
					{#if foto && miniatura}
						<img src={miniatura} alt={foto.descripcion} loading="lazy" />
					{/if}
					<div class="texto">
						{#if post.titulo || post.texto}<p>{post.titulo || post.texto}</p>{/if}
						<p class="suave">Archivado el {fechaCorta(post.archivado_en)}</p>
						<div class="acciones">
							<button disabled={ocupado} onclick={() => quitar(post, restaurar)}>Restaurar</button>
							{#if post.autor === sesion.usuario?.id}
								{#if confirmar === post.id}
									<button
										class="peligro"
										disabled={ocupado}
										onclick={() => quitar(post, borrarPost)}
									>
										¿Seguro? Borrar
									</button>
								{:else}
									<button class="fantasma" disabled={ocupado} onclick={() => (confirmar = post.id)}>
										Borrar para siempre
									</button>
								{/if}
							{/if}
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{:else if !error}
		<p class="suave">No hay nada archivado.</p>
	{/if}
</section>

<style>
	.ajustes {
		display: grid;
		gap: 1rem;
		margin-top: 0;
	}
	.identidad {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		overflow-wrap: anywhere;
	}
	.identidad p,
	.ajustes .error {
		margin: 0;
	}
	.cambiar-foto {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-height: 36px;
		color: var(--acento);
		font-weight: 600;
		cursor: pointer;
	}
	.cambiar-foto:focus-within {
		outline: 2px solid var(--acento);
		outline-offset: 2px;
	}
	.cambiar-foto.subiendo {
		color: var(--texto-suave);
		cursor: wait;
	}
	.oculto {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		border: 0;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.nombre {
		display: grid;
		gap: 0.3rem;
	}
	fieldset {
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: 0.3rem;
		padding: 0;
	}
	.segmentos {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.2rem;
		padding: 0.2rem;
		border: 1px solid var(--borde);
		border-radius: 12px;
	}
	.segmentos button {
		padding-inline: 0.25rem;
		background: transparent;
		color: var(--texto-suave);
	}
	.segmentos button[aria-pressed='true'] {
		background: var(--acento-suave);
		color: var(--acento);
	}
	.acentos {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.muestra {
		display: grid;
		width: 44px;
		height: 44px;
		place-items: center;
		padding: 0;
		border-radius: 50%;
		background: transparent;
	}
	.muestra::before {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		background: var(--acento);
		content: '';
	}
	.muestra[aria-pressed='true']::before {
		outline: 2px solid var(--texto);
		outline-offset: 3px;
	}
	.salir {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding-left: 0;
		margin-top: 1rem;
	}
	section {
		margin-top: 1.5rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.75rem;
	}
	li {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}
	img {
		width: min(25%, 100px);
		aspect-ratio: 1;
		object-fit: cover;
	}
	.texto {
		min-width: 0;
		padding: 0.15rem 0.25rem;
		overflow-wrap: anywhere;
	}
	.texto p {
		margin: 0 0 0.35rem;
		white-space: pre-wrap;
	}
	.acciones {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.peligro {
		background: var(--peligro);
	}
	.esqueleto {
		min-height: 7rem;
	}
</style>
