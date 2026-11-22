<script lang="ts">
	import { onMount } from 'svelte';
	import { cargarAportes } from '#lib/aportes.js';
	import Avatar from '#lib/Avatar.svelte';
	import {
		activarAvisos,
		desactivarAvisos,
		estadoAvisos,
		requiereInstalarAvisos,
		type EstadoAvisos
	} from '#lib/avisos.js';
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
	import { goto } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import CrearPlanConFotos from '#lib/CrearPlanConFotos.svelte';
	import ElegirPlan from '#lib/ElegirPlan.svelte';
	import { feed } from '#lib/feed.svelte.js';
	import {
		crearPlanConFotos,
		guardarVariosEnPlan,
		motivoParaNoMover,
		moverFotosA,
		seleccionable
	} from '#lib/juntar.js';

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
	const usuarioId = $derived(sesion.usuario?.id);
	let revisionAportes = $state(0);
	let borradorNombre = $state<string>();
	let subiendoAvatar = $state(false);
	let errorPerfil = $state('');
	let avisos = $state<EstadoAvisos>();
	let cambiandoAvisos = $state(false);
	let errorAvisos = $state('');

	let archivados = $state<Post[]>([]);
	const urls = new Map<string, string>();
	let cargando = $state(true);
	let ocupado = $state(false);
	let confirmar = $state<string>();
	let error = $state('');

	// Seleccionar varios (NOS-44): momentos propios → guardarlos en un plan, mover sus fotos a un
	// plan o crear un plan con ellas.
	let aportes = $state.raw<Post[]>([]);
	let seleccionando = $state(false);
	const elegidos = new SvelteSet<string>();
	let accion = $state<'guardar' | 'mover' | 'crear'>();
	let avisoSeleccion = $state('');
	const momentosElegidos = $derived(aportes.filter((post) => elegidos.has(post.id)));
	const fotosElegidas = $derived(
		momentosElegidos.reduce((suma, momento) => suma + fotosDe(momento).length, 0)
	);

	function dejarDeSeleccionar() {
		seleccionando = false;
		elegidos.clear();
		avisoSeleccion = '';
	}

	function alternar(post: Post) {
		if (elegidos.has(post.id)) elegidos.delete(post.id);
		else elegidos.add(post.id);
		avisoSeleccion = '';
	}

	function pedir(nueva: 'guardar' | 'mover' | 'crear') {
		avisoSeleccion = '';
		if (nueva !== 'guardar') {
			const motivo = momentosElegidos.map(motivoParaNoMover).find(Boolean);
			if (motivo) {
				avisoSeleccion = motivo;
				return;
			}
		}
		accion = nueva;
	}

	/** Después de juntar: se recargan Mis aportes y el feed (lo movido ya no está donde estaba). */
	function terminar(planId?: string) {
		dejarDeSeleccionar();
		revisionAportes += 1;
		feed.version += 1;
		if (planId) void goto(`/post/${planId}`);
	}

	/** Si falla a mitad de camino, recarga para que reintentar siga con lo que falta. */
	async function conRecarga<T>(hacer: () => Promise<T>): Promise<T> {
		try {
			return await hacer();
		} catch (fallo) {
			elegidos.clear();
			revisionAportes += 1;
			feed.version += 1;
			throw fallo;
		}
	}

	async function cargarCuadros(yo?: string) {
		if (!yo) return [];
		const posts = await cargarAportes(yo);
		aportes = posts;
		const cuadros = posts.map((post) => ({ post, foto: fotosDe(post)[0] }));
		const token = cuadros.some(({ foto }) => foto)
			? await obtenerTokenArchivo().catch(() => null)
			: null;
		return cuadros.map(({ post, foto }) => ({
			post,
			miniatura: foto && token ? urlFoto(foto, token, '300x300') : undefined
		}));
	}

	onMount(async () => {
		try {
			const posts = await pb.collection('posts').getFullList<Post>({
				filter: 'archivado = true',
				sort: '-archivado_en',
				expand: 'autor,fotos_via_post',
				requestKey: 'archivo'
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

	onMount(() => {
		void leerAvisos();
	});

	async function leerAvisos() {
		errorAvisos = '';
		try {
			avisos = await estadoAvisos();
		} catch {
			errorAvisos = 'No se pudo consultar el estado de las notificaciones.';
		}
	}

	async function cambiarAvisos() {
		if (!usuarioId || cambiandoAvisos) return;
		cambiandoAvisos = true;
		errorAvisos = '';
		try {
			if (avisos === 'activo') {
				await desactivarAvisos();
				avisos = 'inactivo';
			} else {
				avisos = await activarAvisos(usuarioId);
			}
		} catch {
			errorAvisos =
				avisos === 'activo'
					? 'No se pudieron desactivar las notificaciones.'
					: 'No se pudieron activar las notificaciones.';
		} finally {
			cambiandoAvisos = false;
		}
	}

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
			if (accion === restaurar) revisionAportes += 1;
		} catch (err) {
			error = err instanceof Error ? err.message : 'No se pudo actualizar el archivo.';
		} finally {
			ocupado = false;
		}
	}
</script>

<header class="identidad">
	<Avatar usuario={sesion.usuario} tam={64} />
	<div>
		<h1>{nombre(sesion.usuario)}</h1>
		<p class="suave">{sesion.usuario?.email}</p>
	</div>
</header>

<section class="aportes" aria-labelledby="titulo-aportes">
	<div class="titulo-aportes">
		<h2 id="titulo-aportes">Mis aportes</h2>
		{#if aportes.some((post) => usuarioId && seleccionable(post, usuarioId))}
			<button
				class="fantasma"
				onclick={() => (seleccionando ? dejarDeSeleccionar() : (seleccionando = true))}
			>
				{seleccionando ? 'Listo' : 'Seleccionar'}
			</button>
		{/if}
	</div>
	{#if seleccionando}
		<p class="suave ayuda">Tocá tus momentos para juntarlos en un plan.</p>
	{/if}
	{#key revisionAportes}
		{#await cargarCuadros(usuarioId)}
			<div class="grilla-aportes" role="status" aria-label="Cargando tus aportes">
				{#each [1, 2, 3, 4, 5, 6] as cuadro (cuadro)}
					<div class="cuadro cuadro-esqueleto" aria-hidden="true"></div>
				{/each}
			</div>
		{:then cuadros}
			{#if cuadros.length}
				<div class="grilla-aportes">
					{#each cuadros as { post, miniatura } (post.id)}
						{@const esPlan = post.tipo === 'plan'}
						{@const texto =
							(esPlan ? post.titulo : post.texto).trim() || (esPlan ? 'Plan' : 'Momento')}
						{#if seleccionando}
							{@const elegible = !!usuarioId && seleccionable(post, usuarioId)}
							<button
								type="button"
								class="cuadro"
								class:plan={esPlan}
								class:elegido={elegidos.has(post.id)}
								disabled={!elegible}
								aria-pressed={elegible ? elegidos.has(post.id) : undefined}
								aria-label={texto}
								onclick={() => alternar(post)}
							>
								{#if miniatura}
									<img src={miniatura} alt="" loading="lazy" />
								{:else}
									<span class="cuadro-texto">{texto}</span>
								{/if}
								{#if elegidos.has(post.id)}<span class="marca" aria-hidden="true">✓</span>{/if}
							</button>
						{:else}
							<a class="cuadro" class:plan={esPlan} href={`/post/${post.id}`} aria-label={texto}>
								{#if miniatura}
									<img src={miniatura} alt="" loading="lazy" />
								{:else}
									<span class="cuadro-texto">{texto}</span>
								{/if}
							</a>
						{/if}
					{/each}
				</div>
			{:else}
				<p class="suave">Todavía no aportaste nada.</p>
			{/if}
		{:catch}
			<p class="error" role="alert">No se pudieron cargar tus aportes.</p>
			<button onclick={() => (revisionAportes += 1)}>Reintentar</button>
		{/await}
	{/key}
</section>

{#if seleccionando}
	<div class="barra-seleccion" role="region" aria-label="Acciones con lo elegido">
		<p aria-live="polite">
			{elegidos.size === 1 ? '1 elegido' : `${elegidos.size} elegidos`}
		</p>
		{#if avisoSeleccion}<p class="error" role="alert">{avisoSeleccion}</p>{/if}
		<div class="acciones-seleccion">
			<button class="fantasma" disabled={!elegidos.size} onclick={() => pedir('guardar')}>
				Guardar en un plan
			</button>
			<button class="fantasma" disabled={!fotosElegidas} onclick={() => pedir('mover')}>
				Mover fotos a un plan
			</button>
			<button disabled={!fotosElegidas} onclick={() => pedir('crear')}>Crear un plan</button>
		</div>
	</div>
{/if}

{#if accion === 'guardar'}
	<ElegirPlan
		elegir={async (plan) => {
			await conRecarga(() => guardarVariosEnPlan(momentosElegidos, plan));
			terminar();
		}}
		cerrar={() => (accion = undefined)}
	/>
{:else if accion === 'mover'}
	<ElegirPlan
		titulo="Mover las fotos a un plan"
		elegir={async (plan) => {
			await conRecarga(() => moverFotosA(momentosElegidos, plan));
			terminar(plan.id);
		}}
		cerrar={() => (accion = undefined)}
	/>
{:else if accion === 'crear' && usuarioId}
	{@const yo = usuarioId}
	<CrearPlanConFotos
		fotos={fotosElegidas}
		crear={async (datos) => {
			const plan = await conRecarga(() => crearPlanConFotos(momentosElegidos, datos, yo));
			terminar(plan.id);
		}}
		cerrar={() => (accion = undefined)}
	/>
{/if}

<details class="plegable">
	<summary>Ajustes <span class="indicador" aria-hidden="true">›</span></summary>
	<div class="ajustes">
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

		<fieldset class="notificaciones" aria-busy={cambiandoAvisos}>
			<legend>Notificaciones</legend>
			{#if avisos === 'activo' || avisos === 'inactivo'}
				{#if avisos === 'activo'}<p class="suave">Activadas en este celular</p>{/if}
				<button type="button" disabled={cambiandoAvisos} onclick={cambiarAvisos}>
					{avisos === 'activo' ? 'Desactivar' : 'Activar'}
				</button>
			{:else if avisos === 'bloqueado'}
				<p class="suave">Las bloqueaste en el navegador; se cambian desde sus ajustes.</p>
			{:else if avisos === 'no-soportado'}
				<p class="suave">
					{requiereInstalarAvisos()
						? 'Agregá Nosotros a la pantalla de inicio para recibir avisos'
						: 'Este navegador no recibe avisos'}
				</p>
			{:else if avisos === 'sin-clave'}
				<p class="suave">Todavía no disponibles.</p>
			{:else if errorAvisos}
				<button type="button" onclick={leerAvisos}>Reintentar</button>
			{:else}
				<p class="suave">Consultando el estado…</p>
			{/if}
			{#if errorAvisos}<p class="error" role="alert">{errorAvisos}</p>{/if}
		</fieldset>

		{#if errorPerfil}<p class="error" role="alert">{errorPerfil}</p>{/if}
		<a href="/fotos">Álbum</a>
		<button class="fantasma salir" onclick={() => pb.authStore.clear()}>
			<Icono nombre="salir" tam={20} />
			Cerrar sesión
		</button>
	</div>
</details>

<details class="plegable">
	<summary>
		Archivo ({archivados.length}) <span class="indicador" aria-hidden="true">›</span>
	</summary>
	<div class="archivo" aria-busy={cargando}>
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
								<button disabled={ocupado} onclick={() => quitar(post, restaurar)}>
									Restaurar
								</button>
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
										<button
											class="fantasma"
											disabled={ocupado}
											onclick={() => (confirmar = post.id)}
										>
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
	</div>
</details>

<style>
	.ajustes {
		display: grid;
		gap: 1rem;
		justify-items: start;
	}
	.nombre,
	.segmentos {
		width: 100%;
	}
	.ajustes fieldset {
		justify-self: stretch;
	}
	.identidad {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		overflow-wrap: anywhere;
	}
	.identidad p,
	.identidad h1,
	.ajustes .error {
		margin: 0;
	}
	.aportes {
		margin: 1.5rem 0;
	}
	.aportes h2 {
		margin: 0 0 0.65rem;
	}
	.grilla-aportes {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.35rem;
	}
	.cuadro {
		position: relative;
		display: grid;
		aspect-ratio: 1;
		place-items: center;
		overflow: hidden;
		border-radius: 8px;
		background: var(--fondo-elevado);
		color: var(--texto);
		text-decoration: none;
	}
	.cuadro img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.cuadro-texto {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
		overflow-wrap: anywhere;
		margin-inline: 0.5rem;
		font-size: 0.85rem;
		text-align: center;
	}
	.cuadro.plan::after {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		width: 28px;
		height: 9px;
		background: color-mix(in oklab, var(--acento) 45%, transparent);
		transform: rotate(-3deg);
		pointer-events: none;
		content: '';
	}
	.titulo-aportes {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.titulo-aportes button {
		min-height: 44px;
		padding-inline: 0;
	}
	.ayuda {
		margin: -0.25rem 0 0.65rem;
	}
	button.cuadro {
		width: 100%;
		padding: 0;
		border: 0;
		cursor: pointer;
	}
	button.cuadro:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.cuadro.elegido {
		outline: 3px solid var(--acento);
		outline-offset: -3px;
	}
	.marca {
		position: absolute;
		right: 0.4rem;
		bottom: 0.4rem;
		display: grid;
		width: 1.6rem;
		height: 1.6rem;
		place-items: center;
		border-radius: 50%;
		background: var(--acento);
		color: var(--sobre-acento);
		font-weight: 700;
	}
	/* Encima de la barra flotante, con lo elegido y las tres acciones. */
	.barra-seleccion {
		position: fixed;
		right: 16px;
		bottom: calc(var(--alto-nav) + 8px);
		left: 16px;
		z-index: 11;
		display: grid;
		gap: 0.4rem;
		max-width: 420px;
		margin-inline: auto;
		padding: 0.75rem;
		border: 1px solid var(--borde);
		border-radius: 16px;
		background: var(--fondo-elevado);
		box-shadow: var(--sombra-polaroid);
	}
	.barra-seleccion p {
		margin: 0;
		font-weight: 600;
	}
	.barra-seleccion .error {
		font-weight: 400;
	}
	.acciones-seleccion {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
	}
	.acciones-seleccion button {
		min-height: 44px;
		margin: 0;
		padding-inline: 0.5rem;
	}
	.acciones-seleccion button:last-child {
		grid-column: 1 / -1;
	}
	.cuadro-esqueleto {
		background: var(--borde);
	}
	.plegable {
		border-top: 1px solid var(--borde);
	}
	.plegable:last-child {
		border-bottom: 1px solid var(--borde);
	}
	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 44px;
		padding: 0.5rem 0.25rem;
		font-weight: 600;
		list-style: none;
		cursor: pointer;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary .indicador {
		color: var(--texto-suave);
		font-size: 1.25rem;
	}
	.plegable[open] .indicador {
		transform: rotate(90deg);
	}
	@media (prefers-reduced-motion: no-preference) {
		summary .indicador {
			transition: transform 160ms ease;
		}
	}
	.ajustes,
	.archivo {
		padding: 0.5rem 0.25rem 1rem;
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
	.notificaciones p {
		margin: 0 0 0.4rem;
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
	}
	.archivo ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.75rem;
	}
	.archivo li {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}
	.archivo img {
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
