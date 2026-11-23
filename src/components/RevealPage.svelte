<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { copyPlainText, downloadPng } from '../lib/export';
	import { decodeGift } from '../lib/share';
	import Envelope from './Envelope.svelte';
	import LetterCard from './LetterCard.svelte';
	import BouquetStage, { type StageHandle } from './BouquetStage.svelte';

	let { token }: { token: string } = $props();

	const gift = $derived(decodeGift(token));
	const reduced =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const autoOpen =
		typeof window !== 'undefined' && new URLSearchParams(location.search).has('open');

	type Phase = 'sealed' | 'opening' | 'blooming' | 'letter';
	let phase = $state<Phase>(autoOpen || reduced ? 'blooming' : 'sealed');
	let status = $state('');
	let openTimer: number | undefined;
	let letterTimer: number | undefined;

	const flowers = $derived(gift?.flowers ?? []);
	const letter = $derived(gift?.letter);
	let stage = $state<StageHandle | undefined>(undefined);

	function clearTimers() {
		if (openTimer !== undefined) clearTimeout(openTimer);
		if (letterTimer !== undefined) clearTimeout(letterTimer);
		openTimer = letterTimer = undefined;
	}

	function beginBloom() {
		clearTimers();
		phase = 'blooming';
		if (reduced) {
			phase = 'letter';
			return;
		}
		if (!flowers.length) {
			phase = 'letter';
			return;
		}
		// Already mounted on replay; first open relies on autoGrow.
		stage?.replay();
	}

	function ongrown() {
		if (phase !== 'blooming') return;
		letterTimer = window.setTimeout(() => {
			phase = 'letter';
		}, 450);
	}

	function openEnvelope() {
		if (phase !== 'sealed') return;
		phase = 'opening';
		openTimer = window.setTimeout(beginBloom, reduced ? 0 : 1150);
	}

	function advance() {
		if (phase === 'sealed') {
			openEnvelope();
			return;
		}
		if (phase === 'opening') {
			beginBloom();
			return;
		}
		if (phase === 'blooming') {
			stage?.advance();
			if (stage?.isGrown()) {
				phase = 'letter';
			}
		}
	}

	function replay() {
		beginBloom();
	}

	function onkey(e: KeyboardEvent) {
		if (e.key === ' ' || e.key === 'Spacebar') {
			e.preventDefault();
			advance();
		}
	}

	async function copyText() {
		if (!gift) return;
		const grid = stage?.getGrid();
		if (!grid) return;
		const ok = await copyPlainText(grid, gift.letter.note);
		status = ok ? 'Copied as plain text.' : 'Could not copy this time.';
	}

	async function savePng() {
		if (!gift) return;
		const grid = stage?.getGrid();
		if (!grid) return;
		await downloadPng(grid, gift.letter.note, 'bloom.txt.png');
		status = 'Saved a PNG of the bouquet.';
	}

	onMount(() => {
		if (autoOpen || reduced) beginBloom();
	});

	onDestroy(clearTimers);
</script>

<svelte:window onkeydown={onkey} />

<div class="page" data-phase={phase}>
	<header>
		<p class="eyebrow">Bloom.txt</p>
		{#if gift && phase !== 'sealed' && phase !== 'opening'}
			<h1>{letter?.to ? `For ${letter.to}` : 'A little bouquet'}</h1>
		{/if}
	</header>

	{#if !gift}
		<section class="wilted">
			<pre class="sad" aria-hidden="true">{`    .  .
   \\|/
    |    the stems came loose
   / \\
  '   '`}</pre>
			<h2>This bloom wilted</h2>
			<p>The gift link looks broken or incomplete. Ask them to send it again, or grow a new one.</p>
			<a href="#/" class="primary">Make a bouquet</a>
		</section>
	{:else}
		<div class="reveal">
			{#if phase === 'sealed' || phase === 'opening'}
				<div class="env-stage">
					<Envelope letter={gift.letter} open={phase === 'opening'} onclick={openEnvelope} />
				</div>
			{/if}

			{#if phase === 'blooming' || phase === 'letter'}
				<div class="bloom">
					<BouquetStage
						bind:handle={stage}
						{flowers}
						critters={gift.critters}
						autoGrow={true}
						note={gift.letter.note}
						{ongrown}
						onadvance={advance}
						hint={phase === 'blooming'
							? 'Growing from the roots — drag to spin, tap or press space to skip ahead'
							: 'Drag to spin, or replay the bloom from the roots'}
					/>
					<div class="actions">
						<button type="button" class="ghost" onclick={replay}>Replay bloom</button>
						<button type="button" class="ghost" onclick={copyText}>Copy as text</button>
						<button type="button" class="ghost" onclick={savePng}>Download PNG</button>
					</div>
					{#if phase === 'letter'}
						<LetterCard letter={gift.letter} />
					{/if}
					{#if status}
						<p class="status" role="status">{status}</p>
					{/if}
					<p class="back">
						<a href="#/">Make a bouquet of your own</a>
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.page {
		width: min(820px, calc(100% - 2rem));
		margin: 0 auto;
		padding: 2rem 0 4rem;
	}
	header {
		text-align: center;
		margin-bottom: 1.4rem;
	}
	.eyebrow {
		margin: 0;
		font-size: 0.75rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--ink-soft);
		font-weight: 700;
	}
	h1,
	h2 {
		margin: 0.25rem 0 0;
		font-family: var(--serif);
		font-style: italic;
		font-weight: 500;
		color: var(--ink);
	}
	h1 {
		font-size: clamp(1.8rem, 5vw, 2.6rem);
	}
	.env-stage {
		display: flex;
		justify-content: center;
		min-height: 22rem;
		align-items: center;
	}
	.bloom {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		animation: fade 0.6s ease both;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		justify-content: center;
	}
	.ghost,
	.primary {
		border-radius: 999px;
		font: inherit;
		font-weight: 700;
		padding: 0.5rem 0.95rem;
		cursor: pointer;
		text-decoration: none;
		display: inline-block;
	}
	.ghost {
		border: 1px solid var(--line);
		background: var(--card);
		color: var(--ink);
	}
	.primary {
		border: 0;
		background: var(--rose);
		color: #fffaf5;
	}
	.ghost:focus-visible,
	.primary:focus-visible,
	.back a:focus-visible {
		outline: 2px solid var(--rose);
		outline-offset: 2px;
	}
	.status {
		margin: 0;
		text-align: center;
		color: var(--leaf);
		font-size: 0.92rem;
	}
	.back {
		text-align: center;
		margin: 0.4rem 0 0;
	}
	.back a {
		color: var(--rose);
		font-weight: 700;
	}
	.wilted {
		text-align: center;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 18px;
		padding: 2rem 1.4rem;
	}
	.sad {
		margin: 0 auto 1rem;
		font-family: var(--mono);
		color: #6a8f70;
		font-size: 0.9rem;
		line-height: 1.2;
	}
	.wilted p {
		color: var(--ink-soft);
		max-width: 28rem;
		margin: 0.6rem auto 1.2rem;
	}
	@keyframes fade {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bloom {
			animation: none;
		}
	}
</style>
