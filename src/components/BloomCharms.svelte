<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { createCharms, type CharmHandle } from '../lib/fx';
	import { prefersReducedMotion } from '../lib/motion';

	let { active = true }: { active?: boolean } = $props();

	const reduced = prefersReducedMotion();
	let canvas: HTMLCanvasElement | undefined;
	let fx: CharmHandle | undefined;
	let raf = 0;

	function frame(now: number) {
		fx?.draw(now);
		raf = requestAnimationFrame(frame);
	}

	onMount(() => {
		if (!canvas) return;
		fx = createCharms(canvas, { reduced });
		const ro = new ResizeObserver(() => fx?.resize());
		ro.observe(canvas);
		if (active && !reduced) raf = requestAnimationFrame(frame);
		return () => ro.disconnect();
	});

	let wasActive = false;
	$effect(() => {
		const on = active;
		if (on && !wasActive) {
			fx?.restart();
			if (!raf && !reduced) raf = requestAnimationFrame(frame);
		}
		if (!on) {
			cancelAnimationFrame(raf);
			raf = 0;
		}
		wasActive = on;
	});

	onDestroy(() => {
		cancelAnimationFrame(raf);
		fx?.destroy();
	});
</script>

<canvas class="charms" class:on={active} bind:this={canvas} aria-hidden="true"></canvas>

<style>
	.charms {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		pointer-events: none;
		z-index: 4;
		opacity: 0;
		transition: opacity 0.6s ease;
	}
	.charms.on {
		opacity: 1;
	}
</style>
