<script lang="ts">
	import {
		pb,
		sesion,
		nombre,
		fechaCorta,
		obtenerTokenArchivo,
		urlFoto,
		type Foto,
		type Nota
	} from '#lib/pb.svelte.js';

	const POR_PAGINA = 30;

	let fotos = $state<Foto[]>([]);
	let token = $state('');
	let pagina = $state(1);
	let hayMas = $state(false);

	let archivos = $state<FileList | null>(null);
	let descripcion = $state('');
	let fecha = $state(new Date().toISOString().slice(0, 10));
	let subiendo = $state(false);
	let error = $state('');

	let abierta = $state<Foto | null>(null);
	let confirmarBorrado = $state(false);

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
		token = tk;
		fotos = p === 1 ? res.items : [...fotos, ...res.items];
		pagina = p;
		hayMas = p < res.totalPages;
	}

	async function subir(e: SubmitEvent) {
		e.preventDefault();
		if (!archivos?.length || !sesion.usuario) return;
		subiendo = true;
		error = '';
		try {
			// Una foto = un registro. Se pueden elegir varias a la vez.
			for (const archivo of archivos) {
				const form = new FormData();
				form.append('imagen', archivo);
				form.append('descripcion', descripcion);
				form.append('fecha', `${fecha} 12:00:00.000Z`);
				form.append('autor', sesion.usuario.id);
				await pb.collection('fotos').create(form);
			}
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
		await pb.collection('fotos').delete(f.id);
		abierta = null;
		confirmarBorrado = false;
		fotos = fotos.filter((x) => x.id !== f.id);
	}

	function cerrar() {
		abierta = null;
		confirmarBorrado = false;
		borradorNota = null;
		errorNota = '';
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && cerrar()} />

<h1>📷 Fotos</h1>

<form class="tarjeta subir" onsubmit={subir}>
	<input type="file" accept="image/*" multiple bind:files={archivos} required />
	<input type="text" placeholder="Descripción (opcional)" bind:value={descripcion} maxlength="500" />
	<input type="date" bind:value={fecha} />
	<button disabled={subiendo || !archivos?.length}>
		{subiendo ? 'Subiendo…' : `Subir${archivos && archivos.length > 1 ? ` (${archivos.length})` : ''}`}
	</button>
	{#if error}<p class="error">{error}</p>{/if}
</form>

{#if fotos.length}
	<div class="galeria">
		{#each fotos as f (f.id)}
			<button class="miniatura" onclick={() => (abierta = f)}>
				<img src={urlFoto(f, token, '400x400')} alt={f.descripcion} loading="lazy" />
			</button>
		{/each}
	</div>
	{#if hayMas}
		<p class="centrado"><button class="fantasma" onclick={() => cargar(pagina + 1)}>Ver más</button></p>
	{/if}
{:else}
	<p class="suave">Todavía no hay fotos.</p>
{/if}

{#if abierta}
	<div class="visor" role="presentation" onclick={cerrar}>
		<figure role="presentation" onclick={(e) => e.stopPropagation()}>
			<img src={urlFoto(abierta, token, '1600x0')} alt={abierta.descripcion} />
			<figcaption>
				<div>
					{#if abierta.descripcion}<strong>{abierta.descripcion}</strong><br />{/if}
					<span class="suave">
						{fechaCorta(abierta.fecha)} · subida por {nombre(abierta.expand?.autor)}
					</span>
				</div>
				<div class="acciones">
					<a href={urlFoto(abierta, token)} target="_blank" rel="noopener">Original</a>
					{#if abierta.autor === sesion.usuario?.id}
						{#if confirmarBorrado}
							<button class="peligro" onclick={() => abierta && borrar(abierta)}>¿Seguro? Borrar</button>
						{:else}
							<button class="fantasma" onclick={() => (confirmarBorrado = true)}>Borrar</button>
						{/if}
					{/if}
					<button class="fantasma" onclick={cerrar}>Cerrar</button>
				</div>

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
										<button class="mini" onclick={() => (borradorNota = n.texto)} title="Editar">✏️</button>
										<button class="mini" onclick={() => borrarNota(n)} title="Borrar">🗑</button>
									</div>
								{/if}
							</div>
						{/if}
					{/each}

					{#if borradorNota !== null}
						<form class="nota-form" onsubmit={guardarNota}>
							<!-- svelte-ignore a11y_autofocus -->
							<textarea bind:value={borradorNota} maxlength="500" rows="2" placeholder="Tu nota…" autofocus
							></textarea>
							<div class="nota-acciones">
								<button disabled={guardandoNota || !borradorNota.trim()}>
									{guardandoNota ? 'Guardando…' : 'Guardar'}
								</button>
								<button type="button" class="fantasma" onclick={() => (borradorNota = null)}>Cancelar</button>
							</div>
						</form>
					{:else if !miNota}
						<button class="fantasma dejar" onclick={() => (borradorNota = '')}>+ Dejar una nota</button>
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
	.miniatura {
		padding: 0;
		background: none;
		border-radius: 10px;
		overflow: hidden;
	}
	.miniatura img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		display: block;
		transition: transform 0.2s;
	}
	.miniatura:hover img {
		transform: scale(1.04);
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
		color: white;
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
		background: none;
		padding: 0 0.25rem;
		font-size: 0.85rem;
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
