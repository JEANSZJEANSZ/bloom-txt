<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { copyPlainText, downloadPng } from '../lib/export';
	import { DEFAULT_DETAIL, DEFAULT_STYLE, styleOf } from '../lib/look';
	import { DEFAULT_MUSIC } from '../lib/music';
	import { DEFAULT_RIBBON } from '../lib/ribbon';
	import { decodeGift } from '../lib/share';
	import Atmosphere from './Atmosphere.svelte';
	import BloomCharms from './BloomCharms.svelte';
	import Envelope from './Envelope.svelte';
	import GiftMusic, { type MusicHandle } from './GiftMusic.svelte';
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
	const music = $derived(gift?.music ?? DEFAULT_MUSIC);
	const ribbon = $derived(gift?.ribbon ?? DEFAULT_RIBBON);
	let stage = $state<StageHandle | undefined>(undefined);
	let musicHandle = $state<MusicHandle | undefined>(undefined);
	let musicOn = $state(false);

	function startMusic() {
		musicOn = true;
		void musicHandle?.start();
	}

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
		// Start music in the same user-gesture turn so autoplay is allowed.
		startMusic();
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
			// If the bloom is already done, just reveal the letter.
			// Calling stage.advance() here would bounce back into this handler and overflow the stack.
			if (stage?.isGrown()) {
				phase = 'letter';
				return;
			}
			stage?.advance();
			if (stage?.isGrown()) phase = 'letter';
		}
	}

	function replay() {
		startMusic();
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
		await downloadPng(grid, gift.letter.note, 'bloom.txt.png', { plain: styleOf(gift.style) === 'retro' });
		status = 'Saved a PNG of the bouquet.';
	}

	onMount(() => {
		if (autoOpen || reduced) {
			beginBloom();
			if (music.kind !== 'none') musicOn = true;
		}
	});

	onDestroy(clearTimers);
</script>

<svelte:window onkeydown={onkey} />

<div class="page" data-phase={phase}>
	<Atmosphere fireflies={true} petals={true} moon={true} fixed={true} />

	{#if !gift}
		<section class="wilted">
			<pre class="sad" aria-hidden="true">{`    .  .
   \|/
    |    the stems came loose
   / \\
  '   '`}</pre>
			<h2>This bloom wilted</h2>
			<p>The gift link looks broken or incomplete. Ask them to send it again, or grow a new one.</p>
			<a href="#/" class="btn-primary">Make a bouquet</a>
		</section>
	{:else}
		<div class="music-slot">
			<GiftMusic {music} bind:handle={musicHandle} visible={musicOn} tone="night" />
		</div>

		{#if phase === 'sealed' || phase === 'opening'}
			<div class="env-stage">
				<p class="brand">Bloom.txt</p>
				<Envelope letter={gift.letter} open={phase === 'opening'} onclick={openEnvelope} tone="night" />
			</div>
		{/if}

		{#if phase === 'blooming' || phase === 'letter'}
			<div class="bloom" class:with-letter={phase === 'letter'}>
				<div class="bouquet-wrap">
					<BloomCharms active={phase === 'blooming'} />
					<BouquetStage
						bind:handle={stage}
						{flowers}
						critters={gift.critters}
						renderStyle={gift.style ?? DEFAULT_STYLE}
						detail={gift.detail ?? DEFAULT_DETAIL}
						{ribbon}
						autoGrow={true}
						note={gift.letter.note}
						{ongrown}
						onadvance={advance}
						skin="ether"
						hint={phase === 'blooming'
							? 'Growing from the stems — drag to spin, tap or press space to skip ahead'
							: 'Drag to spin, or replay the bloom from the stems'}
					/>
				</div>
				{#if phase === 'letter'}
					<div class="letter-slot">
						<p class="for">
							{letter?.to ? `For ${letter.to}` : 'A little bouquet'}
						</p>
						<LetterCard letter={gift.letter} tone="night" />
					</div>
				{/if}
			</div>
			<div class="bar">
				<div class="actions">
					<button type="button" class="btn-ghost night" onclick={replay}>Replay bloom</button>
					<button type="button" class="btn-ghost night" onclick={copyText}>Copy as text</button>
					<button type="button" class="btn-ghost night" onclick={savePng}>Download PNG</button>
					<a href="#/" class="btn-primary back">Make one back</a>
				</div>
				{#if status}
					<p class="status" role="status">{status}</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.page {
		position: relative;
		min-height: 100svh;
		color: var(--moon);
		overflow-x: hidden;
		isolation: isolate;
	}
	.music-slot {
		position: fixed;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 8;
		width: min(100% - 1.5rem, 36rem);
		display: flex;
		justify-content: center;
		pointer-events: none;
	}
	.music-slot :global(.dock) {
		pointer-events: auto;
	}
	.env-stage {
		position: relative;
		z-index: 2;
		min-height: 100svh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 5rem 1rem 3rem;
	}
	.brand {
		position: absolute;
		top: 1.4rem;
		margin: 0;
		font-family: var(--serif);
		font-style: italic;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--moon-soft);
		font-size: 1.05rem;
	}
	.bloom {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.4rem;
		width: min(860px, calc(100% - 2rem));
		margin: 0 auto;
		padding: 5.5rem 0 9rem;
		min-height: 100svh;
		animation: fade 0.9s var(--ease-out) both;
	}
	.bloom.with-letter {
		width: min(860px, calc(100% - 2rem));
	}
	.bouquet-wrap {
		position: relative;
		width: 100%;
	}
	.bloom :global(figcaption) {
		opacity: 0;
		height: 0;
		padding: 0;
		overflow: hidden;
		pointer-events: none;
	}
	.letter-slot {
		position: relative;
		z-index: 3;
		width: 100%;
	}
	.for {
		margin: 0 0 0.8rem;
		font-family: var(--serif);
		font-style: italic;
		font-weight: 500;
		font-size: clamp(1.6rem, 4vw, 2.5rem);
		color: var(--moon);
		text-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
	}
	.bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 6;
		padding: 1.6rem 1rem 1.15rem;
		background: linear-gradient(180deg, transparent, rgba(7, 8, 15, 0.88) 42%);
		pointer-events: none;
	}
	.bar .actions,
	.bar .status {
		pointer-events: auto;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: center;
	}
	:global(.btn-ghost.night) {
		background: #16141c;
		border-color: rgba(246, 239, 228, 0.18);
		color: var(--moon);
	}
	:global(.btn-ghost.night:hover:not(:disabled)) {
		border-color: rgba(246, 239, 228, 0.4);
	}
	.back {
		background: var(--moon);
		color: #2a2018;
		box-shadow: 0 12px 28px -14px rgba(255, 230, 200, 0.8);
	}
	.status {
		margin: 0.45rem 0 0;
		text-align: center;
		color: var(--gold);
		font-size: 0.92rem;
	}
	.wilted {
		position: relative;
		z-index: 2;
		text-align: center;
		max-width: 28rem;
		margin: 0 auto;
		padding: 8rem 1.4rem 4rem;
	}
	.sad {
		margin: 0 auto 1rem;
		font-family: var(--mono);
		color: #9aae9c;
		font-size: 0.9rem;
		line-height: 1.2;
	}
	.wilted h2 {
		margin: 0;
		font-family: var(--serif);
		font-style: italic;
		font-weight: 500;
		font-size: 2rem;
	}
	.wilted p {
		color: var(--moon-soft);
		margin: 0.6rem auto 1.2rem;
	}
	@keyframes fade {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (min-width: 1280px) {
		.bloom.with-letter {
			width: min(1280px, calc(100% - 2rem));
			display: grid;
			grid-template-columns: minmax(820px, 1fr) minmax(20rem, 26rem);
			align-items: center;
			gap: 2rem;
		}
	}
	@media (max-width: 860px) {
		.bloom,
		.bloom.with-letter {
			padding: 4.5rem 0 9.5rem;
			min-height: auto;
		}
		.for {
			text-align: center;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bloom {
			animation: none;
		}
	}
</style>
