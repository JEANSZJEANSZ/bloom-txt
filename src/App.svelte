<script lang="ts">
	import BuilderPage from './components/BuilderPage.svelte';
	import RevealPage from './components/RevealPage.svelte';
	import { parseRoute } from './lib/share';

	let route = $state(parseRoute(typeof location !== 'undefined' ? location.hash : ''));

	function onHash() {
		route = parseRoute(location.hash);
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
	}

	const title = $derived(
		route.page === 'gift' ? 'A bloom, for you' : 'Bloom.txt — handmade ASCII wildflowers',
	);
</script>

<svelte:window onhashchange={onHash} />

<svelte:head>
	<title>{title}</title>
</svelte:head>

<a class="skip" href="#main">Skip to the bouquet</a>

<div class="shell">
	<main id="main">
		{#if route.page === 'gift'}
			<RevealPage token={route.token} />
		{:else}
			<BuilderPage />
		{/if}
	</main>
	<footer>
		<p>
			Bloom.txt keeps the whole gift in the link — no accounts, no server, just a bouquet that can travel.
		</p>
	</footer>
</div>

<style>
	.skip {
		position: absolute;
		left: 0.75rem;
		top: -4rem;
		background: var(--ink);
		color: #fffaf5;
		padding: 0.4rem 0.8rem;
		border-radius: 8px;
		z-index: 10;
	}
	.skip:focus {
		top: 0.75rem;
	}
	.shell {
		min-height: 100svh;
		display: flex;
		flex-direction: column;
	}
	main {
		flex: 1;
	}
	footer {
		text-align: center;
		padding: 0 1rem 2.2rem;
		color: var(--ink-soft);
		font-size: 0.85rem;
	}
	footer p {
		margin: 0 auto;
		max-width: 32rem;
	}
</style>
