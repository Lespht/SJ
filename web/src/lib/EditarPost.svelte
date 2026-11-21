<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fly } from 'svelte/transition';
	import { diaDe } from './calendario.js';
	import Confirmar from './Confirmar.svelte';
	import { cargarPost, fotosDe } from './feed.svelte.js';
	import Icono from './Icono.svelte';
	import { obtenerTokenArchivo, sesion, urlFoto, type Foto, type Post } from './pb.svelte.js';
	import {
		agregarFotos,
		borrarFoto,
		categoriasPlan,
		editarPost,
		ErrorFotosMomento,
		ErrorFotosPlan
	} from './posts.js';

	let {
		post,
		cerrar,
		alGuardar,
		alQuitar
	}: { post: Post; cerrar: () => void; alGuardar: (post: Post) => void; alQuitar: () => void } =
		$props();

	let actual = $state.raw(untrack(() => post));
	let campos = $state(
		untrack(() => ({
			titulo: post.titulo,
			texto: post.texto,
			categoria: post.categoria,
			dia: diaDe(post.fecha),
			hora: post.hora
		}))
	);
	let archivos: FileList | undefined = $state();
	let token = $state<string>();
	let confirmando = $state.raw<Foto>();
	let ocupado = $state(false);
	let error = $state('');
	let reintentarFotos = $state<() => Promise<Post>>();
	let fotosPorActualizar = $state(false);
	let dialogo: HTMLDialogElement;
	const esPlan = $derived(actual.tipo === 'plan');
	const fotos = $derived(fotosDe(actual));
	const retomando = $derived(!!reintentarFotos || fotosPorActualizar);
	const yo = $derived(sesion.usuario?.id);

	onMount(() => {
		const modal = dialogo;
		const foco = document.activeElement;
		const raiz = document.documentElement;
		const overflow = raiz.style.overflow;
		raiz.style.overflow = 'hidden';
		modal.showModal();
		void obtenerTokenArchivo()
			.then((valor) => (token = valor))
			.catch(() => {});
		return () => {
			raiz.style.overflow = overflow;
			modal.close();
			if (foco instanceof HTMLElement && foco.isConnected) foco.focus({ preventScroll: true });
		};
	});

	function pedirCierre() {
		if (!ocupado) cerrar();
	}

	function aplicar(postActualizado: Post) {
		actual = postActualizado;
		alGuardar(postActualizado);
	}

	async function guardar(evento: SubmitEvent) {
		evento.preventDefault();
		if (ocupado || !yo || (!esPlan && actual.autor !== yo)) return;
		const autor = yo;
		ocupado = true;
		error = '';
		try {
			if (!retomando)
				aplicar(await editarPost(actual, { ...campos, titulo: campos.titulo.trim() }));
			if (reintentarFotos || archivos?.length) {
				await (reintentarFotos
					? reintentarFotos()
					: agregarFotos(actual, Array.from(archivos ?? []), autor));
				reintentarFotos = undefined;
				archivos = undefined;
				fotosPorActualizar = true;
			}
			if (fotosPorActualizar) aplicar(await cargarPost(actual.id));
			cerrar();
		} catch (fallo) {
			if (fallo instanceof ErrorFotosPlan || fallo instanceof ErrorFotosMomento) {
				reintentarFotos = fallo.reintentar;
				error = 'No se pudieron subir todas las fotos.';
				const parcial = await cargarPost(actual.id).catch(() => undefined);
				if (parcial) aplicar(parcial);
			} else {
				error = fotosPorActualizar
					? 'Las fotos se guardaron, pero no se pudo actualizar el post.'
					: 'No se pudieron guardar los cambios.';
			}
		} finally {
			ocupado = false;
		}
	}

	async function sacar(foto: Foto) {
		if (!yo || foto.autor !== yo) return;
		const { postBorrado } = await borrarFoto(foto, actual);
		if (postBorrado) {
			cerrar();
			alQuitar();
			return;
		}
		aplicar({
			...actual,
			expand: { ...actual.expand, fotos_via_post: fotos.filter((otra) => otra.id !== foto.id) }
		});
	}
</script>

<dialog
	bind:this={dialogo}
	aria-labelledby="editar-titulo"
	oncancel={(evento) => {
		evento.preventDefault();
		pedirCierre();
	}}
>
	<button
		type="button"
		class="fondo"
		tabindex="-1"
		aria-label="Cerrar edición"
		disabled={ocupado}
		onclick={pedirCierre}
	></button>
	<form
		class="hoja"
		aria-busy={ocupado}
		onsubmit={guardar}
		transition:fly|global={{ y: '100%', duration: prefersReducedMotion.current ? 0 : 280 }}
	>
		<div class="cabecera">
			<h2 id="editar-titulo">{esPlan ? 'Editar plan' : 'Editar momento'}</h2>
			<button
				type="button"
				class="icono cerrar"
				aria-label="Cerrar"
				disabled={ocupado}
				onclick={pedirCierre}
			>
				<Icono nombre="cerrar" />
			</button>
		</div>
		<fieldset class="campos" disabled={ocupado || retomando}>
			{#if esPlan}
				<label>Título<input bind:value={campos.titulo} required maxlength="200" /></label>
				<label>
					Categoría
					<select bind:value={campos.categoria}>
						<option value="">Sin categoría</option>
						{#each categoriasPlan as categoria (categoria.valor)}
							<option value={categoria.valor}>{categoria.label}</option>
						{/each}
					</select>
				</label>
			{/if}
			<label>Texto<textarea bind:value={campos.texto} rows="3" maxlength="2000"></textarea></label>
			<div class="cuando">
				<label>Día<input type="date" bind:value={campos.dia} /></label>
				{#if esPlan}
					<label>
						Hora (opcional)<input type="time" bind:value={campos.hora} disabled={!campos.dia} />
					</label>
				{/if}
			</div>
			{#if fotos.length}
				<div class="fotos">
					{#each fotos as foto, i (foto.id)}
						{@const descripcion = foto.descripcion.trim() || `Foto ${i + 1}`}
						<div class="foto">
							<div class="miniatura">
								{#if token}
									<img src={urlFoto(foto, token, '100x100')} alt={descripcion} />
								{/if}
							</div>
							{#if foto.autor === yo}
								<button
									type="button"
									class="fantasma sacar"
									aria-label={`Sacar foto: ${descripcion}`}
									onclick={() => (confirmando = foto)}
								>
									Sacar foto
								</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
			<label class="sumar">
				<input type="file" accept="image/*" multiple bind:files={archivos} />
				<Icono nombre="mas" tam={20} /> Sumar fotos
			</label>
			{#if archivos?.length}
				<p class="suave seleccion">
					{archivos.length === 1 ? archivos[0].name : `${archivos.length} fotos seleccionadas`}
				</p>
			{/if}
		</fieldset>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<button class="guardar" disabled={ocupado || (!retomando && esPlan && !campos.titulo.trim())}>
			{ocupado ? 'Guardando…' : retomando ? 'Reintentar' : 'Guardar'}
		</button>
	</form>
</dialog>

{#if confirmando}
	{@const foto = confirmando}
	<Confirmar
		titulo={foto.descripcion.trim() || 'esta foto'}
		borrar={() => sacar(foto)}
		cerrar={() => (confirmando = undefined)}
	/>
{/if}

<style>
	dialog {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		overflow: hidden;
		border: 0;
		background: transparent;
		color: var(--texto);
	}
	dialog[open] {
		display: grid;
		align-items: end;
		justify-items: center;
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.55);
	}
	.fondo {
		position: absolute;
		inset: 0;
		width: 100%;
		padding: 0;
		background: transparent;
	}
	.hoja {
		position: relative;
		width: min(100%, var(--ancho));
		max-height: 94dvh;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0.85rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
		border-radius: 1.25rem 1.25rem 0 0;
		background: var(--fondo);
	}
	.cabecera {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.cabecera h2 {
		margin: 0;
		font-size: 1.4rem;
	}
	.cerrar {
		min-width: 44px;
		min-height: 44px;
	}
	.campos {
		display: grid;
		min-width: 0;
		gap: 0.65rem;
		margin: 0.4rem 0 1rem;
		padding: 0;
		border: 0;
	}
	.cuando {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: 0.65rem;
	}
	.fotos {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding: 0.25rem;
	}
	.foto {
		flex: none;
		width: 100px;
	}
	.miniatura {
		height: 100px;
		overflow: hidden;
		border-radius: 8px;
		background: var(--fondo-elevado);
	}
	.miniatura img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.sacar,
	.guardar {
		width: 100%;
		min-height: 44px;
	}
	.sacar {
		padding-inline: 0;
	}
	.sumar {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		min-height: 44px;
		border: 1px dashed var(--acento);
		border-radius: 10px;
		color: var(--acento);
		cursor: pointer;
	}
	.sumar:focus-within {
		outline: 2px solid var(--acento);
		outline-offset: 2px;
	}
	.sumar input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		border: 0;
		clip-path: inset(50%);
	}
	.seleccion {
		margin: 0;
		overflow-wrap: anywhere;
	}
</style>
