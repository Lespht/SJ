<script lang="ts">
	import { tick } from 'svelte';
	import { pb, sesion, nombre, type Mensaje, type Usuario } from '#lib/pb.svelte.js';
	import Avatar from '#lib/Avatar.svelte';
	import Icono from '#lib/Icono.svelte';
	import { cambiarTema, cargarTema, ID_CHAT, TEMAS, temaValido, type Tema } from '#lib/chat.js';

	let mensajes = $state<Mensaje[]>([]);
	let texto = $state('');
	let enviando = $state(false);
	let lista: HTMLElement | undefined = $state();

	// Tema compartido: si uno lo cambia, el otro lo ve al instante.
	let tema = $state<Tema>('polaroid');
	let eligiendo = $state(false);
	const colorTema = $derived(TEMAS.find((t) => t.id === tema)?.color ?? null);

	$effect(() => {
		let cancelado = false;
		let desuscribir: (() => Promise<void>) | undefined;
		cargarTema().then((t) => {
			if (!cancelado) tema = t;
		});
		pb.collection('chat')
			.subscribe<{ tema: string }>(ID_CHAT, (e) => (tema = temaValido(e.record.tema)))
			.then((quitar) => {
				if (cancelado) quitar();
				else desuscribir = quitar;
			})
			.catch(() => {});
		return () => {
			cancelado = true;
			desuscribir?.();
		};
	});

	async function elegirTema(t: Tema) {
		const anterior = tema;
		tema = t; // se ve al instante; si falla, vuelve
		eligiendo = false;
		try {
			await cambiarTema(t);
		} catch {
			tema = anterior;
		}
	}

	// Cache de usuarios para mostrar nombres de mensajes que llegan en tiempo real.
	const usuarios = new Map<string, Usuario>();

	$effect(() => {
		let cancelado = false;
		let desuscribir: (() => Promise<void>) | undefined;

		(async () => {
			const res = await pb.collection('mensajes').getList<Mensaje>(1, 100, {
				sort: '-created',
				expand: 'autor'
			});
			if (cancelado) return;
			mensajes = res.items.reverse();
			for (const m of mensajes) if (m.expand?.autor) usuarios.set(m.autor, m.expand.autor);
			await bajar();

			// Realtime: PocketBase avisa cuando se crea/borra un mensaje.
			const quitar = await pb.collection('mensajes').subscribe<Mensaje>('*', async (e) => {
				if (e.action === 'create') {
					if (mensajes.some((m) => m.id === e.record.id)) return;
					mensajes.push(e.record);
					await bajar();
				} else if (e.action === 'delete') {
					mensajes = mensajes.filter((m) => m.id !== e.record.id);
				}
			});
			if (cancelado) quitar();
			else desuscribir = quitar;
		})();

		return () => {
			cancelado = true;
			desuscribir?.();
		};
	});

	async function bajar() {
		await tick();
		lista?.scrollTo({ top: lista.scrollHeight, behavior: 'smooth' });
	}

	async function enviar(e: SubmitEvent) {
		e.preventDefault();
		const t = texto.trim();
		if (!t || !sesion.usuario) return;
		enviando = true;
		try {
			const m = await pb
				.collection('mensajes')
				.create<Mensaje>({ texto: t, autor: sesion.usuario.id });
			texto = '';
			if (!mensajes.some((x) => x.id === m.id)) {
				mensajes.push(m);
				await bajar();
			}
		} finally {
			enviando = false;
		}
	}

	function teclas(e: KeyboardEvent) {
		// Enter envía, Shift+Enter hace salto de línea.
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			(e.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
		}
	}

	function autorDe(m: Mensaje) {
		return (
			m.expand?.autor ??
			usuarios.get(m.autor) ??
			(m.autor === sesion.usuario?.id ? sesion.usuario : null)
		);
	}

	function hora(iso: string) {
		return new Date(iso.replace(' ', 'T')).toLocaleString('es', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="titulo">
	<div class="encabezado">
		<a class="volver" href="/" aria-label="Volver a Inicio">
			<Icono nombre="flecha-izquierda" />
		</a>
		<h1>Mensajes</h1>
	</div>
	<button
		class="fantasma tema"
		onclick={() => (eligiendo = !eligiendo)}
		aria-expanded={eligiendo}
		aria-controls="temas"
	>
		<Icono nombre="paleta" tam={20} />
		Tema
	</button>
	{#if eligiendo}
		<div class="temas tarjeta" id="temas" role="radiogroup" aria-label="Tema del chat">
			{#each TEMAS as t (t.id)}
				<button
					class="muestra"
					role="radio"
					aria-checked={tema === t.id}
					aria-label={t.nombre}
					title={t.nombre}
					style:--muestra={t.color ?? 'var(--acento)'}
					onclick={() => elegirTema(t.id)}
				></button>
			{/each}
		</div>
	{/if}
</div>

<div
	class="chat tarjeta"
	style:--color-tema={colorTema ?? 'var(--acento)'}
	style:--texto-tema={colorTema ? '#fff' : 'var(--sobre-acento)'}
>
	<div class="lista" bind:this={lista}>
		{#each mensajes as m, i (m.id)}
			{@const mio = m.autor === sesion.usuario?.id}
			{@const ultimoDeTanda = mensajes[i + 1]?.autor !== m.autor}
			{@const primeroDeTanda = mensajes[i - 1]?.autor !== m.autor}
			<div class="fila" class:mio>
				{#if !mio}
					<span class="lugar-avatar">
						{#if ultimoDeTanda}<Avatar usuario={autorDe(m)} tam={28} />{/if}
					</span>
				{/if}
				<div class="burbuja" class:mio>
					{#if !mio && primeroDeTanda}<small class="quien">{nombre(autorDe(m))}</small>{/if}
					<p>{m.texto}</p>
					<small class="hora">{hora(m.created)}</small>
				</div>
			</div>
		{:else}
			<p class="suave vacio">Todavía no hay mensajes.</p>
		{/each}
	</div>

	<form onsubmit={enviar}>
		<textarea
			placeholder="Escribí un mensaje"
			bind:value={texto}
			onkeydown={teclas}
			rows="1"
			maxlength="4000"></textarea>
		<button disabled={enviando || !texto.trim()}>Enviar</button>
	</form>
</div>

<style>
	.titulo {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}
	.encabezado {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.volver {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		flex: none;
		border-radius: 10px;
		color: var(--texto);
	}
	.titulo h1 {
		margin: 0;
	}
	.tema {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	/* Flota sobre el chat para no cambiar su alto. */
	.temas {
		position: absolute;
		top: 100%;
		right: 0;
		z-index: 5;
		display: flex;
		gap: 0.6rem;
		padding: 0.75rem;
		margin-top: -0.5rem;
		box-shadow: var(--sombra-polaroid);
	}
	.muestra {
		width: 2rem;
		height: 2rem;
		padding: 0;
		border-radius: 50%;
		background: var(--muestra);
		border: 2px solid var(--fondo-elevado);
		outline: 2px solid transparent;
	}
	.muestra[aria-checked='true'] {
		outline-color: var(--texto);
	}
	.chat {
		display: flex;
		flex-direction: column;
		/* Alto disponible: padding de main (1rem + 1rem), sin la cabecera de la app, encabezado (flecha de 44px + 0.5rem) y área segura. */
		height: calc(100dvh - var(--alto-nav) - 2.5rem - 44px);
		min-height: 320px;
		padding: 0;
		overflow: hidden;
	}
	.lista {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		background: color-mix(in oklab, var(--color-tema) 9%, var(--fondo-elevado));
		transition: background 0.3s;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.vacio {
		margin: auto;
	}
	/* El avatar va al pie de cada tanda de mensajes del otro, como en Instagram. */
	.fila {
		display: flex;
		align-items: flex-end;
		gap: 0.4rem;
		max-width: 85%;
		align-self: flex-start;
	}
	.fila.mio {
		align-self: flex-end;
	}
	.lugar-avatar {
		width: 28px;
		flex: none;
	}
	.burbuja {
		min-width: 0;
		background: var(--fondo);
		border: 1px solid var(--borde);
		border-radius: 16px 16px 16px 4px;
		padding: 0.5rem 0.75rem;
	}
	.burbuja.mio {
		background: var(--color-tema);
		border-color: var(--color-tema);
		color: var(--texto-tema);
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
	.hora {
		display: block;
		font-size: 0.7rem;
		opacity: 0.7;
		text-align: right;
	}
	form button {
		background: var(--color-tema);
		color: var(--texto-tema);
	}
	form {
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem;
		border-top: 1px solid var(--borde);
	}
	textarea {
		resize: none;
		field-sizing: content;
		max-height: 8rem;
	}
</style>
