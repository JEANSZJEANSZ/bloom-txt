<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { prefersReducedMotion } from '../lib/motion';
	import { OCCASION_BY_ID } from '../lib/occasions';
	import type { Letter } from '../lib/types';

	let { letter, animate = true, tone = 'paper' }: { letter: Letter; animate?: boolean; tone?: 'paper' | 'night' } = $props();
	const occasion = $derived(OCCASION_BY_ID[letter.occasion]);
	const hasBody = $derived(letter.to || letter.from || letter.message);
	let shown = $state('');
	let timer: number | undefined;

	onMount(() => {
		if (!animate || prefersReducedMotion() || !letter.message) {
			shown = letter.message;
			return;
		}
		let i = 0;
		const step = () => {
			i += 1;
			shown = letter.message.slice(0, i);
			if (i < letter.message.length) {
				const ch = letter.message[i - 1];
				timer = window.setTimeout(step, ch === '\n' ? 90 : 16);
			}
		};
		timer = window.setTimeout(step, 180);
	});

	onDestroy(() => {
		if (timer !== undefined) clearTimeout(timer);
	});
</script>

{#if hasBody}
	<article class="card" class:night={tone === 'night'} style:--accent={occasion.hue}>
		<p class="occasion">{occasion.greeting}</p>
		{#if letter.to}
			<p class="to">Dear {letter.to},</p>
		{/if}
		{#if letter.message}
			<div class="body">
				{#each shown.split('\n') as para, i (`${i}-${para}`)}
					{#if para === ''}
						<div class="gap"></div>
					{:else}
						<p>{para}</p>
					{/if}
				{/each}
				{#if shown.length < letter.message.length}
					<span class="caret" aria-hidden="true">▍</span>
				{/if}
			</div>
		{/if}
		{#if letter.from}
			<p class="sign">— {letter.from}</p>
		{/if}
	</article>
{/if}

<style>
	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-top: 4px solid var(--accent);
		border-radius: 16px;
		padding: 1.25rem 1.4rem 1.4rem;
		box-shadow: var(--shadow);
		text-align: left;
		animation: rise 0.7s var(--ease-out, ease) both;
	}
	.occasion {
		margin: 0 0 0.7rem;
		font-size: 0.72rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--accent);
		font-weight: 700;
	}
	.to,
	.sign,
	.body p {
		margin: 0;
		font-family: var(--serif);
		color: var(--ink);
	}
	.to {
		font-size: 1.2rem;
		font-style: italic;
		margin-bottom: 0.8rem;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		font-size: 1.05rem;
		line-height: 1.55;
		min-height: 2.4em;
	}
	.gap {
		height: 0.4rem;
	}
	.caret {
		color: var(--accent);
		font-size: 0.85em;
		animation: blink 0.9s steps(1, end) infinite;
		align-self: flex-start;
	}
	.sign {
		margin-top: 1.1rem;
		text-align: right;
		font-style: italic;
		font-size: 1.1rem;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(16px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.card {
			animation: none;
		}
		.caret {
			animation: none;
		}
	}

	.card.night {
		background:
			linear-gradient(180deg, rgba(255, 250, 242, 0.98), #f4e8d8);
		border-color: rgba(255, 236, 210, 0.4);
		box-shadow:
			0 30px 70px -28px rgba(0, 0, 0, 0.65),
			0 0 0 1px rgba(255, 230, 200, 0.12);
		transform-origin: top center;
		animation: unfold 1.15s var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)) both;
	}
	@keyframes unfold {
		from {
			opacity: 0;
			transform: perspective(900px) rotateX(-72deg) translateY(18px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.card.night {
			animation: none;
		}
	}
</style>
