<script lang="ts">
	import { ClientResponseError } from 'pocketbase';
	import {
		pb,
		sesion,
		nombre,
		fechaCorta,
		obtenerTokenArchivo,
		urlFoto,
		type Foto,
		type Nota,
		type Post
	} from '#lib/pb.svelte.js';
	import Icono from '#lib/Icono.svelte';
	import { borrarPost } from '#lib/posts.js';

	const POR_PAGINA = 30;

	let fotos = $state<Foto[]>([]);
	const urls = new Map<string, { miniatura: string; ampliada: string; original: string }>();
	let pagina = $state(1);
	let hayMas = $state(false);

	let archivos = $state<FileList | null>(null);
	let descripcion = $state('');
	let fecha = $state(new Date().toISOString().slice(0, 10));
	let subiendo = $state(false);
	let error = $state('');
	let subidaPendiente:
		| {
				archivos: FileList;
				texto: string;
				fecha: string;
				autor: string;
				post: string;
				siguiente: number;
		  }
		| undefined;

	let abierta = $state<Foto | null>(null);
	let confirmarBorrado = $state(false);
	let borrando = $state(false);
	let errorBorrado = $state('');

	// Notas: null = no se está editando; '' o texto = formulario abierto.
	let borradorNota = $state<string | null>(null);
	let guardandoNota = $state(false);
	let errorNota = $state('');

	const notas = $derived(
		[...(abierta?.expand?.notas_via_foto ?? [])].sort((a, b) => a.created.localeCompare(b.created))
	);
	const miNota = $derived(notas.find((n) => n.autor === sesion.usuario?.id));

	/** Reemplaza las notas de la foto abierta (y en la galería) sin recargar todo. */
	function actualizarNotas(fotoId: string, cambiar: (ns: Nota[]) => Nota[]) {
		const aplicar = (f: Foto): Foto =>
			f.id === fotoId
				? { ...f, expand: { ...f.expand, notas_via_foto: cambiar(f.expand?.notas_via_foto ?? []) } }
				: f;
		fotos = fotos.map(aplicar);
		if (abierta) abierta = aplicar(abierta);
	}

	async function guardarNota(e: SubmitEvent) {
		e.preventDefault();
		const texto = borradorNota?.trim();
		if (!abierta || !sesion.usuario || !texto) return;
		const fotoId = abierta.id;
		guardandoNota = true;
		errorNota = '';
		try {
			const nota = miNota
				? await pb.collection('notas').update<Nota>(miNota.id, { texto }, { expand: 'autor' })
				: await pb
						.collection('notas')
						.create<Nota>({ foto: fotoId, autor: sesion.usuario.id, texto }, { expand: 'autor' });
			actualizarNotas(fotoId, (ns) => [...ns.filter((n) => n.id !== nota.id), nota]);
			borradorNota = null;
		} catch (err) {
			errorNota = err instanceof Error ? err.message : 'No se pudo guardar la nota.';
		} finally {
			guardandoNota = false;
		}
	}

	async function borrarNota(n: Nota) {
		errorNota = '';
		try {
			await pb.collection('notas').delete(n.id);
			actualizarNotas(n.foto, (ns) => ns.filter((x) => x.id !== n.id));
			borradorNota = null;
		} catch (err) {
			errorNota = err instanceof Error ? err.message : 'No se pudo borrar la nota.';
		}
	}

	$effect(() => {
		cargar(1);
	});

	async function cargar(p: number) {
		const [res, tk] = await Promise.all([
			pb.collection('fotos').getList<Foto>(p, POR_PAGINA, {
				sort: '-fecha,-created',
				// Las notas vienen en la misma consulta (relación inversa), sin pedidos extra.
				expand: 'autor,notas_via_foto,notas_via_foto.autor'
			}),
			obtenerTokenArchivo()
		]);
		for (const foto of res.items) {
			if (urls.has(foto.id)) continue;
			urls.set(foto.id, {
				miniatura: urlFoto(foto, tk, '400x400'),
				ampliada: urlFoto(foto, tk, '1600x0'),
				original: urlFoto(foto, tk)
			});
		}
		fotos = p === 1 ? res.items : [...fotos, ...res.items];
		pagina = p;
		hayMas = p < res.totalPages;
	}

	async function subir(e: SubmitEvent) {
		e.preventDefault();
		if (subiendo || !archivos?.length || !sesion.usuario) return;
		const datos = {
			archivos,
			texto: descripcion,
			fecha: `${fecha} 12:00:00.000Z`,
			autor: sesion.usuario.id
		};
		subiendo = true;
		error = '';
		try {
			let lote = subidaPendiente;
			if (
				!lote ||
				lote.archivos !== datos.archivos ||
				lote.texto !== datos.texto ||
				lote.fecha !== datos.fecha ||
				lote.autor !== datos.autor
			) {
				const post = await pb.collection('posts').create<Post>({
					tipo: 'momento',
					texto: datos.texto,
					fecha: datos.fecha,
					autor: datos.autor
				});
				lote = subidaPendiente = { ...datos, post: post.id, siguiente: 0 };
			}
			for (; lote.siguiente < lote.archivos.length; lote.siguiente += 1) {
				const form = new FormData();
				form.append('imagen', lote.archivos[lote.siguiente]);
				form.append('descripcion', lote.texto);
				form.append('fecha', lote.fecha);
				form.append('autor', lote.autor);
				form.append('post', lote.post);
				await pb.collection('fotos').create(form);
			}
			subidaPendiente = undefined;
			descripcion = '';
			archivos = null;
			(e.target as HTMLFormElement).reset();
			await cargar(1);
		} catch (err) {
			error = err instanceof Error ? err.message : 'No se pudo subir la foto.';
		} finally {
			subiendo = false;
		}
	}

	async function borrar(f: Foto) {
		if (borrando || f.autor !== sesion.usuario?.id) return;
		borrando = true;
		errorBorrado = '';
		try {
			await pb.collection('fotos').delete(f.id);
			cerrar();
			fotos = fotos.filter((foto) => foto.id !== f.id);
			urls.delete(f.id);
			if (!f.post) return;

			try {
				const post = await pb
					.collection('posts')
					.getOne<Post>(f.post, { expand: 'fotos_via_post' });
				if (
					post.tipo === 'momento' &&
					post.autor === f.autor &&
					!post.expand?.fotos_via_post?.length
				) {
					await borrarPost(post);
				}
			} catch (err) {
				if (!(err instanceof ClientResponseError && err.status === 404)) {
					errorBorrado = 'Se borró la foto, pero no se pudo limpiar el momento.';
				}
			}
		} catch {
			errorBorrado = 'No se pudo borrar la foto.';
		} finally {
			borrando = false;
		}
	}

	function cerrar() {
		abierta = null;
		confirmarBorrado = false;
		borradorNota = null;
		errorNota = '';
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && cerrar()} />

<h1>Fotos</h1>

<form class="tarjeta subir" onsubmit={subir}>
	<input type="file" accept="image/*" multiple bind:files={archivos} required disabled={subiendo} />
	<input
		type="text"
		placeholder="Descripción (opcional)"
		bind:value={descripcion}
		maxlength="500"
		disabled={subiendo}
	/>
	<input type="date" bind:value={fecha} disabled={subiendo} />
	<button disabled={subiendo || !archivos?.length}>
		{subiendo
			? 'Subiendo…'
			: `Subir${archivos && archivos.length > 1 ? ` (${archivos.length})` : ''}`}
	</button>
	{#if error}<p class="error">{error}</p>{/if}
</form>

{#if errorBorrado && !abierta}<p class="error" role="alert">{errorBorrado}</p>{/if}

{#if fotos.length}
	<div class="galeria">
		{#each fotos as f (f.id)}
			<button class="miniatura polaroid" onclick={() => (abierta = f)}>
				<img src={urls.get(f.id)?.miniatura} alt={f.descripcion} loading="lazy" />
			</button>
		{/each}
	</div>
	{#if hayMas}
		<p class="centrado">
			<button class="fantasma" onclick={() => cargar(pagina + 1)}>Ver más</button>
		</p>
	{/if}
{:else}
	<p class="suave">Todavía no hay fotos.</p>
{/if}

{#if abierta}
	<div class="visor" role="presentation" onclick={cerrar}>
		<figure role="presentation" onclick={(e) => e.stopPropagation()}>
			<img src={urls.get(abierta.id)?.ampliada} alt={abierta.descripcion} />
			<figcaption>
				<div>
					{#if abierta.descripcion}<strong>{abierta.descripcion}</strong><br />{/if}
					<span class="suave">
						{fechaCorta(abierta.fecha)} · subida por {nombre(abierta.expand?.autor)}
					</span>
				</div>
				<div class="acciones">
					<a href={urls.get(abierta.id)?.original} target="_blank" rel="noopener">Original</a>
					{#if abierta.autor === sesion.usuario?.id}
						{#if confirmarBorrado}
							<button
								class="peligro"
								disabled={borrando}
								onclick={() => abierta && borrar(abierta)}
							>
								¿Seguro? Borrar
							</button>
						{:else}
							<button class="fantasma" onclick={() => (confirmarBorrado = true)}>Borrar</button>
						{/if}
					{/if}
					<button class="fantasma" onclick={cerrar}>Cerrar</button>
				</div>
				{#if errorBorrado}<p class="error" role="alert">{errorBorrado}</p>{/if}

				<section class="notas">
					{#each notas as n (n.id)}
						{@const mia = n.autor === sesion.usuario?.id}
						{#if mia && borradorNota !== null}
							<!-- se está editando: el formulario de abajo la reemplaza -->
						{:else}
							<div class="burbuja" class:mia>
								{#if !mia}<small class="quien">{nombre(n.expand?.autor)}</small>{/if}
								<p>{n.texto}</p>
								{#if mia}
									<div class="nota-acciones">
										<button
											class="mini"
											onclick={() => (borradorNota = n.texto)}
											aria-label="Editar nota"
										>
											<Icono nombre="editar" tam={16} />
										</button>
										<button class="mini" onclick={() => borrarNota(n)} aria-label="Borrar nota">
											<Icono nombre="borrar" tam={16} />
										</button>
									</div>
								{/if}
							</div>
						{/if}
					{/each}

					{#if borradorNota !== null}
						<form class="nota-form" onsubmit={guardarNota}>
							<!-- svelte-ignore a11y_autofocus -->
							<textarea
								bind:value={borradorNota}
								maxlength="500"
								rows="2"
								placeholder="Tu nota…"
								autofocus></textarea>
							<div class="nota-acciones">
								<button disabled={guardandoNota || !borradorNota.trim()}>
									{guardandoNota ? 'Guardando…' : 'Guardar'}
								</button>
								<button type="button" class="fantasma" onclick={() => (borradorNota = null)}>
									Cancelar
								</button>
							</div>
						</form>
					{:else if !miNota}
						<button class="fantasma dejar" onclick={() => (borradorNota = '')}>
							Dejar una nota
						</button>
					{/if}
					{#if errorNota}<p class="error">{errorNota}</p>{/if}
				</section>
			</figcaption>
		</figure>
	</div>
{/if}

<style>
	.subir {
		display: grid;
		grid-template-columns: 2fr 2fr 1fr auto;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}
	.subir .error {
		grid-column: 1 / -1;
		margin: 0;
	}
	@media (max-width: 700px) {
		.subir {
			grid-template-columns: 1fr;
		}
	}
	.galeria {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.5rem;
	}
	.galeria {
		gap: 1rem;
	}
	.miniatura {
		padding: 6px 6px 12px;
		color: inherit;
		transition: transform 0.2s;
	}
	.miniatura:nth-child(odd) {
		transform: rotate(-0.8deg);
	}
	.miniatura:nth-child(even) {
		transform: rotate(0.7deg);
	}
	.miniatura:hover {
		transform: rotate(0deg) translateY(-2px);
	}
	.miniatura img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		display: block;
	}
	.centrado {
		text-align: center;
	}
	.visor {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: rgb(0 0 0 / 0.85);
		display: grid;
		place-items: center;
		padding: 1rem;
	}
	figure {
		margin: 0;
		max-width: 100%;
		max-height: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	figure img {
		max-width: 100%;
		max-height: 78dvh;
		object-fit: contain;
		border-radius: 8px;
	}
	figcaption {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		color: #eee;
	}
	figcaption .suave {
		color: #bbb;
	}
	.acciones {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.acciones .fantasma {
		color: #ddd;
	}
	.peligro {
		background: var(--peligro);
	}
	figure {
		overflow-y: auto;
	}
	.notas {
		flex-basis: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	/* Mismo estilo que las burbujas de mensajes. */
	.burbuja {
		max-width: 75%;
		align-self: flex-start;
		background: var(--fondo);
		color: var(--texto);
		border: 1px solid var(--borde);
		border-radius: 16px 16px 16px 4px;
		padding: 0.5rem 0.75rem;
	}
	.burbuja.mia {
		align-self: flex-end;
		background: var(--acento);
		border-color: var(--acento);
		color: var(--sobre-acento);
		border-radius: 16px 16px 4px 16px;
	}
	.burbuja p {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.quien {
		font-weight: 600;
		color: var(--acento);
	}
	.nota-acciones {
		display: flex;
		justify-content: flex-end;
		gap: 0.25rem;
		margin-top: 0.25rem;
	}
	.mini {
		display: inline-grid;
		place-items: center;
		background: none;
		color: inherit;
		padding: 0.15rem 0.25rem;
	}
	.nota-form {
		align-self: stretch;
	}
	.nota-form textarea {
		width: 100%;
		resize: vertical;
	}
	.nota-form .fantasma,
	.dejar {
		color: #ddd;
	}
	.dejar {
		align-self: flex-start;
	}
	.notas .error {
		margin: 0;
	}
</style>
