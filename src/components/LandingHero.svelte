<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import Atmosphere from './Atmosphere.svelte';
	import { createIntroField, type IntroHandle } from '../lib/fx';
	import { prefersReducedMotion } from '../lib/motion';

	let { oncompose }: { oncompose?: () => void } = $props();

	const reduced = prefersReducedMotion();
	const skip =
		typeof window !== 'undefined' &&
		(new URLSearchParams(location.search).get('intro') === 'done' ||
			new URLSearchParams(location.search).has('studio'));

	const forceStudio =
		typeof window !== 'undefined' && new URLSearchParams(location.search).has('studio');

	let canvas: HTMLCanvasElement | undefined = $state();
	let heroEl: HTMLElement | undefined = $state();
	let field: IntroHandle | undefined;
	let raf = 0;
	let shown = $state(skip || reduced);
	/** Animated sky + glyph field. Off when the studio is on screen (or ?studio). */
	let skyLive = $state(!forceStudio && !reduced);

	function stopLoop() {
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
	}

	function frame(now: number) {
		if (!skyLive) {
			raf = 0;
			return;
		}
		field?.draw(now);
		if (field?.ready()) shown = true;
		raf = requestAnimationFrame(frame);
	}

	function startField() {
		if (!canvas || reduced) return;
		field?.destroy();
		field = createIntroField(canvas, { reduced, skipToEnd: skip || shown });
		if (!raf) raf = requestAnimationFrame(frame);
	}

	onMount(() => {
		let ro: ResizeObserver | undefined;
		let io: IntersectionObserver | undefined;
		let cancelled = false;
		const begin = () => {
			if (cancelled) return;
			if (skyLive) startField();
			if (canvas) {
				ro = new ResizeObserver(() => field?.resize());
				ro.observe(canvas);
			}
		};
		io = new IntersectionObserver(
			(entries) => {
				const on = entries.some((e) => e.isIntersecting && e.intersectionRatio > 0.08);
				const next = !forceStudio && !reduced && on;
				if (next === skyLive) return;
				skyLive = next;
				if (next) {
					shown = shown || skip;
					void tick().then(() => {
						if (!cancelled) startField();
					});
				} else {
					stopLoop();
					field?.destroy();
					field = undefined;
				}
			},
			{ threshold: [0, 0.08, 0.2, 0.5] },
		);
		if (heroEl) io.observe(heroEl);
		const fonts = document.fonts?.ready;
		if (fonts) fonts.then(begin, begin);
		else begin();
		return () => {
			cancelled = true;
			ro?.disconnect();
			io?.disconnect();
			stopLoop();
		};
	});

	onDestroy(() => {
		stopLoop();
		field?.destroy();
	});

	function compose() {
		oncompose?.();
	}
</script>

<section class="hero" bind:this={heroEl} aria-label="Bloom.txt">
	{#if skyLive}
		<Atmosphere fireflies={true} petals={true} moon={true} />
		<canvas bind:this={canvas} class="field" aria-hidden="true"></canvas>
	{:else}
		<div class="sky-static" aria-hidden="true">
			<span class="static-moon"></span>
		</div>
	{/if}
	<div class="copy" class:in={shown} data-intro={shown ? 'ready' : 'playing'}>
		<p class="eyebrow">a letter, in flowers</p>
		<h1>
			<span class="bloom">Bloom</span><span class="txt">.txt</span>
		</h1>
		<p class="tag">
			Wildflowers, even out of season. Compose a bouquet, write a note, and send the link like a gift.
		</p>
		<button type="button" class="btn-primary cta" onclick={compose}>Compose a bouquet</button>
	</div>
	<button type="button" class="scroll" onclick={compose} aria-label="Scroll to the studio">
		<span aria-hidden="true">↓</span>
	</button>
</section>

<style>
	.hero {
		position: relative;
		min-height: 100svh;
		display: grid;
		place-items: center;
		overflow: hidden;
		color: var(--moon);
		background: var(--night);
		isolation: isolate;
	}
	.field {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		z-index: 1;
		pointer-events: none;
	}
	.sky-static {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			radial-gradient(60% 50% at 82% 10%, rgba(255, 230, 190, 0.16), transparent 52%),
			radial-gradient(80% 60% at 10% 0%, rgba(80, 100, 170, 0.14), transparent 50%),
			linear-gradient(180deg, #07080f 0%, #0c101a 55%, #14101a 100%);
	}
	.static-moon {
		position: absolute;
		top: 9%;
		right: 11%;
		width: clamp(4.5rem, 10vw, 8.5rem);
		height: clamp(4.5rem, 10vw, 8.5rem);
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, #fffaf0, #f0e2c4 46%, #d9c49a 100%);
		box-shadow: 0 0 36px 10px rgba(255, 236, 200, 0.22);
	}
	.copy {
		position: relative;
		z-index: 2;
		text-align: center;
		padding: 0 1.4rem 2rem;
		width: min(44rem, calc(100% - 2rem));
		opacity: 0;
		transform: translateY(16px);
		transition:
			opacity 1.1s var(--ease-out),
			transform 1.1s var(--ease-out);
	}
	.copy.in {
		opacity: 1;
		transform: none;
	}
	.eyebrow {
		margin: 0 0 0.6rem;
		font-size: 0.78rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--gold);
		font-weight: 700;
	}
	h1 {
		margin: 0;
		line-height: 0.9;
		font-weight: 500;
		color: var(--moon);
		text-shadow: 0 0 40px rgba(255, 220, 180, 0.25);
	}
	.bloom {
		font-family: var(--serif);
		font-style: italic;
		font-weight: 600;
		font-size: clamp(4rem, 16vw, 9.5rem);
		letter-spacing: -0.03em;
	}
	.txt {
		font-family: var(--mono);
		font-style: normal;
		font-weight: 400;
		font-size: clamp(1.4rem, 4.6vw, 2.8rem);
		letter-spacing: 0.02em;
		color: var(--blush);
		margin-left: 0.08em;
		vertical-align: 0.18em;
	}
	.tag {
		margin: 1.15rem auto 1.6rem;
		max-width: 28rem;
		color: var(--moon-soft);
		font-size: 1.08rem;
		line-height: 1.55;
	}
	.cta {
		min-width: 12.5rem;
		padding: 0.75rem 1.4rem;
		font-size: 1rem;
		background: var(--moon);
		color: #2a2018;
		box-shadow: 0 16px 40px -18px rgba(255, 230, 200, 0.8);
	}
	.cta:hover {
		filter: none;
		background: #fff;
	}
	.scroll {
		position: absolute;
		bottom: 1.4rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 2;
		border: 0;
		background: transparent;
		color: var(--moon-soft);
		font-size: 1.2rem;
		cursor: pointer;
		padding: 0.6rem;
		animation: bob 2.4s var(--ease-soft) infinite;
	}
	.scroll:focus-visible {
		outline: 2px solid var(--gold);
		outline-offset: 4px;
		border-radius: 999px;
	}
	@keyframes bob {
		0%,
		100% {
			transform: translateX(-50%) translateY(0);
		}
		50% {
			transform: translateX(-50%) translateY(6px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.copy {
			opacity: 1;
			transform: none;
			transition: none;
		}
		.scroll {
			animation: none;
		}
	}
</style>
