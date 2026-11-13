<script lang="ts">
	import {
		pb,
		sesion,
		nombre,
		obtenerTokenArchivo,
		urlFoto,
		type Foto,
		type Idea,
		type Mensaje
	} from '#lib/pb.svelte.js';

	let fotos = $state<Foto[]>([]);
	let token = $state('');
	let ideasPendientes = $state(0);
	let ideaAlAzar = $state<Idea | null>(null);
	let ultimoMensaje = $state<Mensaje | null>(null);

	$effect(() => {
		cargar();
	});

	async function cargar() {
		const [f, ideas, msgs, tk] = await Promise.all([
			pb.collection('fotos').getList<Foto>(1, 6, { sort: '-created' }),
			pb.collection('ideas').getFullList<Idea>({ filter: 'hecha = false' }),
			pb.collection('mensajes').getList<Mensaje>(1, 1, { sort: '-created', expand: 'autor' }),
			obtenerTokenArchivo()
		]);
		fotos = f.items;
		token = tk;
		ideasPendientes = ideas.length;
		ideaAlAzar = ideas.length ? ideas[Math.floor(Math.random() * ideas.length)] : null;
		ultimoMensaje = msgs.items[0] ?? null;
	}
</script>

<h1>Hola, {nombre(sesion.usuario)} 💕</h1>

<div class="grilla">
	<a class="tarjeta" href="/mensajes">
		<h2>💬 Último mensaje</h2>
		{#if ultimoMensaje}
			<p><strong>{nombre(ultimoMensaje.expand?.autor)}:</strong> {ultimoMensaje.texto}</p>
		{:else}
			<p class="suave">Todavía no hay mensajes. ¡Escribí el primero!</p>
		{/if}
	</a>

	<a class="tarjeta" href="/ideas">
		<h2>💡 Ideas pendientes: {ideasPendientes}</h2>
		{#if ideaAlAzar}
			<p>¿Qué tal… <strong>{ideaAlAzar.titulo}</strong>?</p>
		{:else}
			<p class="suave">Agreguen planes, citas o regalos.</p>
		{/if}
	</a>
</div>

<section>
	<h2><a href="/fotos">📷 Fotos recientes</a></h2>
	{#if fotos.length}
		<div class="fotos">
			{#each fotos as f (f.id)}
				<a href="/fotos"><img src={urlFoto(f, token, '400x400')} alt={f.descripcion} /></a>
			{/each}
		</div>
	{:else}
		<p class="suave">Subí la primera foto en la sección Fotos.</p>
	{/if}
</section>

<style>
	h2 {
		font-size: 1.05rem;
		margin: 0 0 0.5rem;
	}
	.grilla {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	.grilla a {
		text-decoration: none;
		color: inherit;
	}
	.grilla p {
		margin: 0;
	}
	section h2 a {
		color: inherit;
		text-decoration: none;
	}
	.fotos {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.5rem;
	}
	.fotos img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 10px;
		display: block;
	}
</style>
