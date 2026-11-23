<script lang="ts">
	import { drawGrid, drawGridFast, measureGrid, waitForFonts } from '../lib/draw';
	import { DEFAULT_STYLE, styleOf } from '../lib/look';
	import { renderBouquet as renderBouquet3d } from '../lib/render';
	import { renderBouquet as renderBouquetRetro } from '../lib/renderRetro';
	import type { ColorId, FlowerId, RenderStyle } from '../lib/types';

	let {
		id,
		color,
		label,
		renderStyle = DEFAULT_STYLE,
	}: { id: FlowerId; color: ColorId; label: string; renderStyle?: RenderStyle } = $props();

	const look = $derived(styleOf(renderStyle));
	const grid = $derived(look === 'retro' ? { cols: 36, rows: 24 } : { cols: 80, rows: 64 });
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
		const { cols, rows } = grid;
		const m = measureGrid(ctx, cols, rows, 214, '');
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		c.width = Math.round(m.width * dpr);
		c.height = Math.round(m.height * dpr);
		c.style.width = `${m.width}px`;
		c.style.height = `${m.height}px`;
		if (look === 'retro') {
			const r = renderBouquetRetro({
				flowers: [{ id, color }],
				complete: true,
				growth: 1,
				focus: true,
				yaw: 0.15,
				time: 0,
				cols,
				rows,
				fill: 0,
				particles: false,
				sway: false,
			});
			drawGrid(ctx, r.grid, '', m, 1);
		} else {
			const r = renderBouquet3d({
				flowers: [{ id, color }],
				complete: true,
				growth: 1,
				focus: true,
				yaw: 0,
				time: 0,
				cols,
				rows,
				stars: false,
				particles: false,
				sway: false,
			});
			drawGridFast(ctx, r.grid, '', m, 1, dpr);
		}
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
