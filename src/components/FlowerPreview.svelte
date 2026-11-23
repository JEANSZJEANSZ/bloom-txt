<script lang="ts">
	import { drawGridFast, measureGrid, waitForFonts } from '../lib/draw';
	import { renderBouquet } from '../lib/render';
	import type { ColorId, FlowerId } from '../lib/types';

	let { id, color, label }: { id: FlowerId; color: ColorId; label: string } = $props();

	const COLS = 80;
	const ROWS = 64;
	let canvas: HTMLCanvasElement | undefined = $state();
	let ready = $state(false);

	$effect(() => {
		waitForFonts().then(() => (ready = true));
	});

	$effect(() => {
		const c = canvas;
		if (!c || !ready) return;
		const ctx = c.getContext('2d', { willReadFrequently: true });
		if (!ctx) return;
		const m = measureGrid(ctx, COLS, ROWS, 214, '');
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		c.width = Math.round(m.width * dpr);
		c.height = Math.round(m.height * dpr);
		c.style.width = `${m.width}px`;
		c.style.height = `${m.height}px`;
		// A static, front-facing close-up of one 3D bloom.
		const r = renderBouquet({
			flowers: [{ id, color }],
			complete: true,
			growth: 1,
			focus: true,
			yaw: 0,
			time: 0,
			cols: COLS,
			rows: ROWS,
			stars: false,
			particles: false,
			sway: false,
		});
		drawGridFast(ctx, r.grid, '', m, 1, dpr);
	});
</script>

<div role="img" aria-label={label}><canvas bind:this={canvas} class="flower-preview" aria-hidden="true"></canvas></div>

<style>
	.flower-preview {
		max-width: 100%;
		height: auto;
		border-radius: 10px;
		display: block;
		margin: 0 auto;
	}
</style>
