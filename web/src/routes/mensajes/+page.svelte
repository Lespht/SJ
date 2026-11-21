<script lang="ts">
	import { tick } from 'svelte';
	import { pb, sesion, nombre, type Mensaje, type Usuario } from '#lib/pb.svelte.js';

	let mensajes = $state<Mensaje[]>([]);
	let texto = $state('');
	let enviando = $state(false);
	let lista: HTMLElement | undefined = $state();

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

<h1>💬 Mensajes</h1>

<div class="chat tarjeta">
	<div class="lista" bind:this={lista}>
		{#each mensajes as m (m.id)}
			{@const mio = m.autor === sesion.usuario?.id}
			<div class="burbuja" class:mio>
				{#if !mio}<small class="quien">{nombre(autorDe(m))}</small>{/if}
				<p>{m.texto}</p>
				<small class="hora">{hora(m.created)}</small>
			</div>
		{:else}
			<p class="suave vacio">Escribí el primer mensaje 💌</p>
		{/each}
	</div>

	<form onsubmit={enviar}>
		<textarea
			placeholder="Escribí algo lindo…"
			bind:value={texto}
			onkeydown={teclas}
			rows="1"
			maxlength="4000"></textarea>
		<button disabled={enviando || !texto.trim()}>Enviar</button>
	</form>
</div>

<style>
	.chat {
		display: flex;
		flex-direction: column;
		height: calc(100dvh - 12rem);
		min-height: 320px;
		padding: 0;
		overflow: hidden;
	}
	.lista {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.vacio {
		margin: auto;
	}
	.burbuja {
		max-width: 75%;
		align-self: flex-start;
		background: var(--fondo);
		border: 1px solid var(--borde);
		border-radius: 16px 16px 16px 4px;
		padding: 0.5rem 0.75rem;
	}
	.burbuja.mio {
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
	.hora {
		display: block;
		font-size: 0.7rem;
		opacity: 0.7;
		text-align: right;
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
