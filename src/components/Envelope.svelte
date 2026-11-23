<script lang="ts">
	import { OCCASION_BY_ID } from '../lib/occasions';
	import type { Letter } from '../lib/types';

	let {
		letter,
		open = false,
		onclick,
	}: {
		letter: Letter;
		open?: boolean;
		onclick?: () => void;
	} = $props();

	const occasion = $derived(OCCASION_BY_ID[letter.occasion]);
	const addressed = $derived(letter.to.trim() ? `For ${letter.to.trim()}` : 'A little something for you');
</script>

<button class="wrap" class:open {onclick} type="button" aria-label="Open the envelope">
	<span class="eyebrow">a letter arrived</span>
	<span class="address">{addressed}</span>
	<span class="scene">
		<span class="burst" aria-hidden="true">
			{#each [
				{ ch: '*', x: '-70px', y: '-56px' },
				{ ch: '+', x: '64px', y: '-70px' },
				{ ch: "'", x: '-40px', y: '-88px' },
				{ ch: '♥', x: '20px', y: '-96px' },
				{ ch: '.', x: '86px', y: '-40px' },
				{ ch: '*', x: '-90px', y: '-24px' },
				{ ch: '+', x: '50px', y: '-20px' },
				{ ch: 'o', x: '-16px', y: '-110px' },
			] as bit, i (i)}
				<span class="bit" style:--i={i} style:--dx={bit.x} style:--dy={bit.y}>{bit.ch}</span>
			{/each}
		</span>
		<span class="envelope" style:--seal={occasion.hue}>
			<span class="pocket">
				<span class="sheet"></span>
			</span>
			<span class="flap"></span>
			<span class="seal">{occasion.seal}</span>
		</span>
	</span>
	<span class="cta">Tap to open</span>
	{#if letter.from.trim()}
		<span class="from">from {letter.from.trim()}</span>
	{/if}
</button>

<style>
	.wrap {
		appearance: none;
		border: 0;
		background: transparent;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
		font: inherit;
		color: inherit;
		padding: 0.5rem;
		width: min(100%, 26rem);
	}
	.wrap:focus-visible {
		outline: 2px solid var(--rose);
		outline-offset: 6px;
		border-radius: 16px;
	}
	.eyebrow {
		font-family: var(--sans);
		font-size: 0.75rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}
	.address {
		font-family: var(--serif);
		font-style: italic;
		font-size: 1.55rem;
		color: var(--ink);
		text-align: center;
	}
	.scene {
		position: relative;
		width: min(100%, 20rem);
		height: 14.5rem;
		perspective: 900px;
		display: grid;
		place-items: center;
		margin: 0.4rem 0;
	}
	.envelope {
		position: relative;
		width: 16.5rem;
		height: 10.5rem;
		transform-style: preserve-3d;
		transform: rotateX(8deg);
		animation: bob 2.8s ease-in-out infinite;
		filter: drop-shadow(0 18px 24px rgba(70, 30, 20, 0.2));
	}
	.pocket {
		position: absolute;
		inset: 0;
		border-radius: 8px;
		background: linear-gradient(180deg, #fffaf4, #f3e6d8);
		border: 1px solid #d9c4b0;
		overflow: hidden;
	}
	.pocket::before,
	.pocket::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(115deg, transparent 46%, #ead7c6 46.5%, #ead7c6 53.5%, transparent 54%);
	}
	.pocket::after {
		background: linear-gradient(-115deg, transparent 46%, #f6ece2 46.5%, #f6ece2 53.5%, transparent 54%);
	}
	.sheet {
		position: absolute;
		left: 10%;
		right: 10%;
		top: 28%;
		height: 70%;
		background: #fffdf9;
		border: 1px solid #ead9c8;
		border-radius: 3px 3px 0 0;
		display: block;
		padding: 1rem 1.2rem;
		background:
			linear-gradient(#fffdf9, #fffdf9) padding-box,
			repeating-linear-gradient(to bottom, transparent 0 1.1rem, #ead9c8 1.1rem 1.15rem);
		transform: translateY(52%);
		transition: transform 0.9s 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.flap {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 55%;
		transform-origin: top center;
		transform-style: preserve-3d;
		clip-path: polygon(0 0, 100% 0, 50% 100%);
		background: linear-gradient(180deg, #efe0d0, #e2cbb6);
		border-bottom: 1px solid #d9c4b0;
		z-index: 2;
		transition: transform 1.05s cubic-bezier(0.2, 0.75, 0.2, 1);
	}
	.seal {
		position: absolute;
		left: 50%;
		top: 46%;
		width: 3rem;
		height: 3rem;
		margin-left: -1.5rem;
		margin-top: -1.5rem;
		border-radius: 50%;
		background: var(--seal);
		color: #fffaf4;
		display: grid;
		place-items: center;
		font-family: Georgia, serif;
		font-size: 1.15rem;
		z-index: 3;
		box-shadow: 0 4px 10px rgba(70, 20, 30, 0.25);
		transition:
			transform 0.85s cubic-bezier(0.2, 0.7, 0.2, 1),
			opacity 0.85s ease;
	}
	.open .envelope {
		animation: none;
		transform: rotateX(12deg) scale(1.05);
	}
	.open .flap {
		transform: rotateX(186deg);
	}
	.open .sheet {
		transform: translateY(-18%);
	}
	.open .seal {
		transform: translate(42px, -64px) rotate(48deg) scale(0.7);
		opacity: 0;
	}
	.burst {
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0;
	}
	.open .burst {
		opacity: 1;
	}
	.bit {
		position: absolute;
		left: 50%;
		top: 50%;
		color: var(--rose);
		font-size: 1rem;
		opacity: 0;
	}
	.open .bit {
		animation: burst 0.9s ease-out forwards;
		animation-delay: calc(var(--i) * 0.04s);
	}
	@keyframes bob {
		0%,
		100% {
			transform: rotateX(8deg) translateY(0);
		}
		50% {
			transform: rotateX(8deg) translateY(-6px);
		}
	}
	@keyframes burst {
		0% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(0.4);
		}
		100% {
			opacity: 0;
			transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.1);
		}
	}
	.cta {
		margin-top: 0.2rem;
		font-size: 0.92rem;
		color: var(--rose);
		font-weight: 700;
		transition: opacity 0.4s ease;
	}
	.from {
		font-family: var(--serif);
		font-style: italic;
		color: var(--ink-soft);
		font-size: 0.95rem;
	}
	.open .cta {
		opacity: 0;
	}
	@media (prefers-reduced-motion: reduce) {
		.envelope {
			animation: none;
		}
	}
</style>
