<script module lang="ts">
	export { esqueletoPost };
</script>

<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import Avatar from './Avatar.svelte';
	import { fechaCortaDia } from './calendario.js';
	import Confirmar from './Confirmar.svelte';
	import EditarPost from './EditarPost.svelte';
	import { descartadasDe, feed, fotosDe, respuestaDe } from './feed.svelte.js';
	import Hoja from './Hoja.svelte';
	import Icono from './Icono.svelte';
	import Mazo from './Mazo.svelte';
	import { borrarNota, guardarNota, reemplazarNotas } from './notas.js';
	import { fechaRelativa, nombre, sesion, type Foto, type Nota, type Post } from './pb.svelte.js';
	import { archivar, borrarPost, categoriasPlan, motivoParaNoBorrar } from './posts.js';

	let {
		post,
		urls,
		alQuitar,
		alCambiar,
		alResponder,
		notasPorFoto = false
	}: {
		post: Post;
		urls: Map<string, string>;
		/** Se llama cuando el post se borró o se archivó desde su menú. */
		alQuitar?: () => void;
		alCambiar?: (post: Post) => void;
		alResponder?: () => void;
		notasPorFoto?: boolean;
	} = $props();

	const esMio = $derived(!!sesion.usuario && post.autor === sesion.usuario.id);
	let menuAbierto = $state(false);
	let confirmando = $state(false);
	let editando = $state(false);
	let respondiendo = $state(false);
	let menu = $state<HTMLElement>();
	let botonOpciones = $state<HTMLButtonElement>();

	const nombreCorto = $derived.by(() => {
		if (post.tipo === 'plan') return post.titulo;
		const texto = post.texto.trim();
		if (!texto) return 'este momento';
		return texto.length > 40 ? `${texto.slice(0, 40)}…` : texto;
	});

	$effect(() => {
		if (!menuAbierto) return;
		const cerrarFuera = (evento: PointerEvent) => {
			if (menu && !menu.contains(evento.target as Node)) menuAbierto = false;
		};
		const cerrarConEscape = (evento: KeyboardEvent) => {
			if (evento.key === 'Escape') menuAbierto = false;
		};
		window.addEventListener('pointerdown', cerrarFuera);
		window.addEventListener('keydown', cerrarConEscape);
		return () => {
			window.removeEventListener('pointerdown', cerrarFuera);
			window.removeEventListener('keydown', cerrarConEscape);
		};
	});

	function quitarCon(accion: (post: Post) => Promise<unknown>) {
		return async () => {
			await accion(post);
			alQuitar?.();
		};
	}

	const esPlan = $derived(post.tipo === 'plan');
	const respuesta = $derived(respuestaDe(post));
	const respuestaVisible = $derived(respuesta && !respuesta.archivado ? respuesta : undefined);
	const puedeResponder = $derived(
		!!sesion.usuario && !esMio && !esPlan && !post.respuesta_a && !respuesta
	);
	const descartadas = $derived(esPlan ? descartadasDe(post) : []);
	const pendiente = $derived(esPlan && !post.hecho);
	const categoria = $derived(categoriasPlan.find(({ valor }) => valor === post.categoria)?.label);
	const fotos = $derived(fotosDe(post));
	let arriba = $state<string>();
	const fotoArriba = $derived(notasPorFoto ? fotos.find((foto) => foto.id === arriba) : undefined);
	const borradores = new SvelteMap<string, string>();
	let guardandoNota = $state(false);
	let errorNota = $state<{ foto: string; mensaje: string }>();
	const notas = $derived(
		(notasPorFoto ? (fotoArriba ? [fotoArriba] : []) : fotos)
			.flatMap((foto) => foto.expand?.notas_via_foto ?? [])
			.sort((a, b) => a.created.localeCompare(b.created))
	);
	const miNota = $derived(notas.find((nota) => nota.autor === sesion.usuario?.id));

	async function enviarNota(evento: SubmitEvent, foto: Foto) {
		evento.preventDefault();
		const texto = borradores.get(foto.id);
		if (guardandoNota || !texto?.trim() || !sesion.usuario) return;
		guardandoNota = true;
		errorNota = undefined;
		try {
			const nota = await guardarNota(foto, miNota, texto);
			if (!nota) return;
			actualizarNota(foto.id, nota.id, nota);
			borradores.delete(foto.id);
		} catch {
			errorNota = { foto: foto.id, mensaje: 'No se pudo guardar la nota.' };
		} finally {
			guardandoNota = false;
		}
	}

	async function quitarNota(nota: Nota) {
		if (guardandoNota || nota.autor !== sesion.usuario?.id) return;
		guardandoNota = true;
		errorNota = undefined;
		try {
			await borrarNota(nota);
			actualizarNota(nota.foto, nota.id);
		} catch {
			errorNota = { foto: nota.foto, mensaje: 'No se pudo borrar la nota.' };
		} finally {
			guardandoNota = false;
		}
	}

	function actualizarNota(fotoId: string, notaId: string, nota?: Nota) {
		const foto = fotos.find((foto) => foto.id === fotoId);
		if (!foto) return;
		const otras = (foto.expand?.notas_via_foto ?? []).filter(({ id }) => id !== notaId);
		alCambiar?.(reemplazarNotas(post, fotoId, nota ? [...otras, nota] : otras));
	}
</script>

{#snippet esqueletoPost()}
	<div class="polaroid esqueleto" aria-hidden="true">
		<div class="imagen brillo"></div>
		<div class="pie">
			<div class="linea brillo"></div>
			<div class="linea brillo"></div>
		</div>
	</div>
{/snippet}

<article class="post" class:momento={!esPlan} class:con-respuesta={!!respuestaVisible}>
	<header class="autor">
		<Avatar usuario={post.expand?.autor} />
		<span class="quien">{nombre(post.expand?.autor)}</span>
		<span class="suave">
			{#if pendiente}
				{post.fecha
					? fechaCortaDia(post.fecha) + (post.hora ? ` · ${post.hora}` : '')
					: 'Sin fecha'}
			{:else}
				{fechaRelativa(post.fecha || post.created)}
			{/if}
		</span>
		{#if sesion.usuario && (esMio || esPlan)}
			<div class="opciones" bind:this={menu}>
				<button
					type="button"
					class="fantasma boton-opciones"
					bind:this={botonOpciones}
					aria-label="Opciones"
					aria-haspopup="menu"
					aria-expanded={menuAbierto}
					onclick={() => (menuAbierto = !menuAbierto)}
				>
					<Icono nombre="opciones" />
				</button>
				{#if menuAbierto}
					<div class="menu" role="menu">
						<button
							type="button"
							class="fantasma"
							role="menuitem"
							onclick={() => {
								menuAbierto = false;
								botonOpciones?.focus();
								editando = true;
							}}
						>
							<Icono nombre="editar" tam={18} /> Editar
						</button>
						{#if esMio}
							<button
								type="button"
								class="fantasma peligro"
								role="menuitem"
								onclick={() => {
									menuAbierto = false;
									confirmando = true;
								}}
							>
								<Icono nombre="borrar" tam={18} /> Borrar
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</header>
	{#if confirmando && sesion.usuario}
		<Confirmar
			titulo={nombreCorto}
			motivo={motivoParaNoBorrar(post, sesion.usuario.id)}
			archivar={post.archivado ? undefined : quitarCon(archivar)}
			borrar={quitarCon(borrarPost)}
			cerrar={() => (confirmando = false)}
		/>
	{/if}
	{#if editando && sesion.usuario && (esMio || esPlan)}
		<EditarPost
			{post}
			cerrar={() => (editando = false)}
			alGuardar={(actualizado) => alCambiar?.(actualizado)}
			alQuitar={() => alQuitar?.()}
		/>
	{/if}
	{#if fotos.length}
		<div class="marco-mazo">
			{#key fotos.map((foto) => foto.id).join(',')}
				<Mazo
					bind:arriba
					fotos={fotos.map((foto) => ({
						id: foto.id,
						src: urls.get(foto.id) ?? '',
						alt: foto.descripcion
					}))}
				/>
			{/key}
			{#if esPlan}<span class="cinta" aria-hidden="true"></span>{/if}
		</div>
	{/if}
	{#if fotoArriba}
		{@const foto = fotoArriba}
		{@const borrador = borradores.get(foto.id)}
		<section class="notas-foto" aria-label="Notas de la foto">
			{#each notas as nota (nota.id)}
				{#if nota.id !== miNota?.id || borrador === undefined}
					<div class="nota">
						<p><b>{nombre(nota.expand?.autor)}</b> {nota.texto}</p>
						{#if nota.id === miNota?.id}
							<div class="acciones-nota">
								<button
									class="fantasma"
									aria-label="Editar nota"
									disabled={guardandoNota}
									onclick={() => borradores.set(foto.id, nota.texto)}
								>
									<Icono nombre="editar" tam={18} />
								</button>
								<button
									class="fantasma"
									aria-label="Borrar nota"
									disabled={guardandoNota}
									onclick={() => quitarNota(nota)}
								>
									<Icono nombre="borrar" tam={18} />
								</button>
							</div>
						{/if}
					</div>
				{/if}
			{/each}
			{#if borrador !== undefined && sesion.usuario}
				<form onsubmit={(evento) => enviarNota(evento, foto)}>
					<textarea
						aria-label="Tu nota"
						placeholder="Tu nota…"
						rows="2"
						maxlength="500"
						disabled={guardandoNota}
						bind:value={
							() => borradores.get(foto.id) ?? '', (texto) => borradores.set(foto.id, texto)
						}></textarea>
					<div class="acciones-nota">
						<button disabled={guardandoNota || !borrador.trim()}>Guardar</button>
						<button
							type="button"
							class="fantasma"
							disabled={guardandoNota}
							onclick={() => {
								borradores.delete(foto.id);
								errorNota = undefined;
							}}
						>
							Cancelar
						</button>
					</div>
				</form>
			{:else if !miNota && sesion.usuario}
				<button
					class="fantasma escribir-nota"
					disabled={guardandoNota}
					onclick={() => borradores.set(foto.id, '')}
				>
					Escribir una nota
				</button>
			{/if}
			{#if errorNota?.foto === foto.id}
				<p class="error" role="alert">{errorNota.mensaje}</p>
			{/if}
		</section>
	{/if}
	<div
		class="pie"
		class:polaroid={!fotos.length && !pendiente}
		class:pendiente={!fotos.length && pendiente}
	>
		{#if esPlan}
			<h2 class="titulo">{post.titulo}</h2>
			<span class="etiqueta-plan">Plan{categoria ? ` · ${categoria}` : ''}</span>
		{/if}
		{#if post.texto}<p class="texto">{post.texto}</p>{/if}
		{#if !notasPorFoto}
			{#each notas as nota (nota.id)}
				<p><b>{nombre(nota.expand?.autor)}</b> {nota.texto}</p>
			{/each}
		{/if}
		{#if post.descartada_en}
			<a class="guardado suave" href={`/post/${post.descartada_en}`}>
				Una de las descartadas de «{post.expand?.descartada_en?.titulo ?? 'un plan'}»
			</a>
		{/if}
	</div>
	{#if descartadas.length}
		<div class="descartadas">
			<span class="suave">Las descartadas ({descartadas.length})</span>
			<div class="tira-descartadas">
				{#each descartadas as momento (momento.id)}
					{@const foto = fotosDe(momento)[0]}
					{@const texto = momento.texto.trim() || 'Momento'}
					<a href={`/post/${momento.id}`} aria-label={foto ? undefined : texto}>
						{#if foto}
							<img src={urls.get(foto.id) ?? ''} alt={texto} loading="lazy" />
						{/if}
					</a>
				{/each}
			</div>
		</div>
	{/if}
	{#if respuestaVisible}
		{@const fotosRespuesta = fotosDe(respuestaVisible)}
		<a class="respuesta polaroid" href={`/post/${respuestaVisible.id}`}>
			<span class="respuesta-autor">
				<span aria-hidden="true">↩</span>
				{nombre(respuestaVisible.expand?.autor)}
			</span>
			{#if fotosRespuesta.length}
				<div inert>
					{#key fotosRespuesta.map((foto) => foto.id).join(',')}
						<Mazo
							fotos={fotosRespuesta.map((foto) => ({
								id: foto.id,
								src: urls.get(foto.id) ?? '',
								alt: foto.descripcion
							}))}
						/>
					{/key}
				</div>
			{/if}
			{#if respuestaVisible.texto}<p class="texto">{respuestaVisible.texto}</p>{/if}
		</a>
	{:else if puedeResponder}
		<button class="fantasma responder" onclick={() => (respondiendo = true)}>Responder</button>
	{/if}
	{#if respondiendo && sesion.usuario}
		<Hoja
			autor={sesion.usuario.id}
			respuestaA={{ id: post.id, nombre: nombre(post.expand?.autor) }}
			cerrar={() => (respondiendo = false)}
			compartir={() => {
				respondiendo = false;
				feed.version += 1;
				alResponder?.();
			}}
		/>
	{/if}
</article>

<style>
	/* Giro alterno de cada post, como fotos sueltas sobre la mesa. */
	.post:nth-child(odd) > .marco-mazo :global(.mazo),
	.esqueleto:nth-child(odd) {
		transform: rotate(-0.8deg);
	}
	.post:nth-child(even) > .marco-mazo :global(.mazo),
	.esqueleto:nth-child(even) {
		transform: rotate(0.7deg);
	}
	.momento:nth-child(odd) > .marco-mazo :global(.mazo) {
		transform: rotate(-1.2deg) scale(0.92);
	}
	.momento:nth-child(even) > .marco-mazo :global(.mazo) {
		transform: rotate(1.2deg) scale(0.92);
	}
	.marco-mazo {
		position: relative;
		isolation: isolate;
	}
	.cinta {
		position: absolute;
		top: -9px;
		left: 50%;
		z-index: 1;
		width: 76px;
		height: 20px;
		background: color-mix(in oklab, var(--acento) 45%, transparent);
		transform: translateX(-50%) rotate(-3deg);
		pointer-events: none;
	}
	.autor {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.25rem;
		/* Las polaroids de atrás del mazo están giradas: sin este aire tapan la inicial. */
		margin-bottom: 0.75rem;
		font-size: 0.9rem;
	}
	.quien {
		font-weight: 600;
	}
	.opciones {
		position: relative;
		margin-left: auto;
	}
	.boton-opciones {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 0;
		color: var(--texto-suave);
	}
	.menu {
		position: absolute;
		top: 100%;
		right: 0;
		z-index: 5;
		display: grid;
		min-width: 10rem;
		padding: 0.25rem;
		border: 1px solid var(--borde);
		border-radius: 12px;
		background: var(--fondo-elevado);
		box-shadow: var(--sombra-polaroid);
	}
	.menu button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
		padding: 0 0.75rem;
		color: var(--texto);
		text-align: left;
	}
	.menu .peligro {
		color: var(--peligro);
	}
	.post {
		display: grid;
		gap: 0.6rem;
	}
	.pie.polaroid,
	.pie.pendiente {
		padding: 1rem;
	}
	.imagen {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 5;
	}
	.pie {
		display: grid;
		gap: 0.25rem;
		padding: 0 0.75rem;
		overflow-wrap: anywhere;
	}
	.pie p {
		margin: 0;
	}
	.titulo {
		margin: 0;
		font-family: var(--fuente-titulo);
		font-size: 1.125rem;
	}
	.guardado {
		font-size: 0.85rem;
	}
	/* Las descartadas: un agregado, no lo principal; miniaturas chicas en una tira. */
	.descartadas {
		display: grid;
		gap: 0.4rem;
		margin: 0 0.75rem;
		padding-top: 0.6rem;
		border-top: 1px dashed var(--borde);
		font-size: 0.85rem;
	}
	.tira-descartadas {
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
		padding-bottom: 0.2rem;
	}
	.tira-descartadas a {
		flex: none;
		width: 52px;
		height: 52px;
		overflow: hidden;
		border: 3px solid var(--fondo-elevado);
		border-radius: 3px;
		background: var(--fondo-elevado);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
	}
	.tira-descartadas img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.etiqueta-plan {
		justify-self: start;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		background: color-mix(in oklab, var(--acento) 15%, transparent);
		color: var(--acento);
		font-size: 0.65rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.texto {
		white-space: pre-wrap;
	}
	.notas-foto {
		display: grid;
		gap: 0.5rem;
	}
	.nota {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.nota p {
		flex: 1;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.notas-foto p {
		margin: 0;
	}
	.notas-foto textarea {
		width: 100%;
		resize: vertical;
	}
	.acciones-nota {
		display: flex;
		justify-content: end;
		gap: 0.25rem;
	}
	.escribir-nota {
		justify-self: start;
		color: var(--acento);
	}
	.momento .texto {
		font-style: italic;
	}
	.con-respuesta > .pie {
		padding-bottom: 1.5rem;
	}
	.respuesta {
		display: grid;
		justify-self: end;
		gap: 0.4rem;
		width: 80%;
		margin: -1.5rem 0.25rem 0 0;
		color: var(--texto);
		text-decoration: none;
		overflow-wrap: anywhere;
		transform: rotate(1.2deg);
	}
	.post:nth-child(even) .respuesta {
		transform: rotate(-1.2deg);
	}
	.respuesta-autor {
		color: var(--texto-suave);
		font-size: 0.85rem;
	}
	.respuesta p {
		margin: 0;
	}
	.responder {
		justify-self: start;
		color: var(--acento);
		padding-inline: 0.75rem;
	}
	.brillo {
		background: linear-gradient(100deg, var(--fondo) 25%, var(--borde) 50%, var(--fondo) 75%);
		background-size: 200% 100%;
		animation: brillo 1.8s ease-in-out infinite;
	}
	.linea {
		width: 65%;
		height: 1.6875rem;
		border-radius: 4px;
	}
	.linea:last-child {
		width: 40%;
		height: 1.5rem;
	}
	@keyframes brillo {
		from {
			background-position: 150% 0;
		}
		to {
			background-position: -50% 0;
		}
	}
</style>
