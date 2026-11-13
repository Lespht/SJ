<script lang="ts">
	import {
		pb,
		sesion,
		nombre,
		fechaCorta,
		obtenerTokenArchivo,
		urlFoto,
		type Foto
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

	$effect(() => {
		cargar(1);
	});

	async function cargar(p: number) {
		const [res, tk] = await Promise.all([
			pb.collection('fotos').getList<Foto>(p, POR_PAGINA, {
				sort: '-fecha,-created',
				expand: 'autor'
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
</style>
