<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { drawGrid, drawGridFast, measureGrid, waitForFonts, type DrawMetrics } from '../lib/draw';
	import { AUTO_YAW_SPEED, GROW_DURATION, GROW_SKIP, gridForDetail, prefersReducedMotion, SLOW_YAW_SPEED } from '../lib/motion';
	import { DEFAULT_DETAIL, DEFAULT_STYLE, styleOf } from '../lib/look';
	import { renderBouquet as renderBouquet3d } from '../lib/render';
	import { renderBouquet as renderBouquetRetro } from '../lib/renderRetro';
	import type { Grid, Placement, RenderStyle } from '../lib/types';
	import { emptyGrid } from '../lib/stems';

	export type StageHandle = {
		getGrid: () => Grid;
		replay: () => void;
		advance: () => void;
		isGrown: () => boolean;
	};

	let {
		flowers,
		critters = [],
		note = '',
		hint = '',
		title = 'bloom.txt',
		autoGrow = false,
		ongrown,
		onadvance,
		handle = $bindable(),
		renderStyle = DEFAULT_STYLE,
		detail = DEFAULT_DETAIL,
	}: {
		flowers: Placement[];
		critters?: import('../lib/types').CritterPlacement[];
		note?: string;
		hint?: string;
		title?: string;
		/** Start from roots and grow organically (gift page after the envelope opens). */
		autoGrow?: boolean;
		ongrown?: () => void;
		onadvance?: () => void;
		handle?: StageHandle;
		renderStyle?: RenderStyle;
		/** 0 (chunky, ~60 cols) to 100 (finest grid for this viewport). */
		detail?: number;
	} = $props();

	const look = $derived(styleOf(renderStyle));

	const reduced = prefersReducedMotion();
	// Capture the mount-time prop once: the gift page starts from the roots,
	// later replays go through handle.replay().
	// svelte-ignore state_referenced_locally
	const startFromRoots = Boolean(autoGrow) && !reduced;
	let isGrowing = $state(startFromRoots);
	let growth = startFromRoots ? 0 : 1;
	let grownNotified = !startFromRoots;
	let grownAt = startFromRoots ? -1 : 0;
	// `?pose=<radians>` freezes the turntable at a chosen angle (stills, sharing a view).
	const poseParam = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('pose') : null;
	const pose = poseParam !== null && Number.isFinite(Number(poseParam)) ? Number(poseParam) : null;
	let autoRotate = $state(!reduced && pose === null);
	let canvas: HTMLCanvasElement | undefined;
	let host: HTMLDivElement | undefined;
	let lastGrid: Grid = emptyGrid();
	let yaw = pose ?? 0.15;
	let vel = reduced || pose !== null ? 0 : AUTO_YAW_SPEED;
	let time = 0;
	let raf = 0;
	let lastTs = 0;
	let dragging = $state(false);
	let dragMoved = false;
	let lastPtrX = 0;
	let lastPtrT = 0;
	let width = 0;
	let metrics: DrawMetrics | null = null;
	let flicker = 1;
	const colsRows = { cols: 0, rows: 0 };
	let sizedFor = { cols: 0, rows: 0, style: DEFAULT_STYLE };

	function finishGrow() {
		growth = 1;
		if (grownAt < 0) grownAt = time;
		if (isGrowing) isGrowing = false;
		if (!grownNotified) {
			grownNotified = true;
			ongrown?.();
		}
	}

	function replay() {
		if (reduced) {
			growth = 1;
			isGrowing = false;
			grownNotified = false;
			finishGrow();
			return;
		}
		growth = 0;
		isGrowing = true;
		grownNotified = false;
		grownAt = -1;
	}

	function advance() {
		if (growth >= 1) {
			onadvance?.();
			return;
		}
		growth = Math.min(1, growth + GROW_SKIP);
		if (growth >= 1) finishGrow();
	}

	handle = {
		getGrid: () => lastGrid,
		replay,
		advance,
		isGrown: () => growth >= 1,
	};

	function sizeCanvas() {
		if (!canvas || !host) return;
		const cssW = Math.max(160, host.clientWidth);
		const next = gridForDetail(detail, window.innerWidth, window.innerHeight, look);
		const sameGrid = next.cols === sizedFor.cols && next.rows === sizedFor.rows && look === sizedFor.style;
		if (cssW === width && metrics && sameGrid) return;
		width = cssW;
		colsRows.cols = next.cols;
		colsRows.rows = next.rows;
		sizedFor = { cols: next.cols, rows: next.rows, style: look };
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		metrics = measureGrid(ctx, colsRows.cols, colsRows.rows, cssW, note);
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		canvas.width = Math.round(metrics.width * dpr);
		canvas.height = Math.round(metrics.height * dpr);
		canvas.style.width = `${metrics.width}px`;
		canvas.style.height = `${metrics.height}px`;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function frame(ts: number) {
		raf = requestAnimationFrame(frame);
		if (!canvas) return;
		const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
		lastTs = ts;
		time += dt;

		if (isGrowing && growth < 1) {
			growth = Math.min(1, growth + dt / GROW_DURATION);
			if (growth >= 1) finishGrow();
		}

		if (!dragging) {
			yaw += vel * dt;
			if (autoRotate) {
				const target = reduced ? SLOW_YAW_SPEED : AUTO_YAW_SPEED;
				vel += (target - vel) * Math.min(1, dt * 2.2);
			} else {
				vel *= Math.pow(0.92, dt * 60);
				if (Math.abs(vel) < 0.01) vel = 0;
			}
		}

		if (!reduced) {
			flicker = 0.93 + 0.07 * (0.5 + 0.5 * Math.sin(time * 17.3) * Math.sin(time * 3.1));
		} else {
			flicker = 1;
		}

		sizeCanvas();
		const ctx = canvas.getContext('2d');
		if (!ctx || !metrics) return;

		const intro =
			growth < 1 ? 0 : reduced ? 1 : grownAt < 0 ? 0 : Math.max(0, Math.min(1, (time - grownAt) / 0.85));
		const render = look === 'retro' ? renderBouquetRetro : renderBouquet3d;
		const rendered = render({
			flowers,
			critters,
			critterIntro: intro,
			animateCritters: !reduced,
			growth,
			complete: growth >= 1,
			yaw,
			time,
			sway: !reduced,
			particles: !reduced,
			cols: colsRows.cols,
			rows: colsRows.rows,
		});
		lastGrid = rendered.grid;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		if (look === 'retro') drawGrid(ctx, rendered.grid, note, metrics, flicker);
		else drawGridFast(ctx, rendered.grid, note, metrics, flicker, dpr);
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		dragging = true;
		dragMoved = false;
		lastPtrX = e.clientX;
		lastPtrT = performance.now();
		host?.setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const dx = e.clientX - lastPtrX;
		if (Math.abs(dx) > 3) dragMoved = true;
		const now = performance.now();
		const dt = Math.max(0.008, (now - lastPtrT) / 1000);
		yaw += (dx / Math.max(160, width)) * Math.PI;
		vel = (dx / Math.max(160, width)) * Math.PI / dt;
		vel = Math.max(-8, Math.min(8, vel));
		lastPtrX = e.clientX;
		lastPtrT = now;
	}

	function onPointerUp(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		try {
			host?.releasePointerCapture(e.pointerId);
		} catch {
			/* already released */
		}
		if (!dragMoved) advance();
	}

	function toggleRotate() {
		autoRotate = !autoRotate;
		if (autoRotate && Math.abs(vel) < 0.05) vel = reduced ? SLOW_YAW_SPEED : AUTO_YAW_SPEED;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'r' || e.key === 'R') {
			const t = e.target as HTMLElement | null;
			if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
			e.preventDefault();
			toggleRotate();
		}
	}

	let ro: ResizeObserver | undefined;

	onMount(() => {
		waitForFonts().then(() => sizeCanvas());
		sizeCanvas();
		raf = requestAnimationFrame(frame);
		ro = new ResizeObserver(() => {
			width = 0;
			sizeCanvas();
		});
		if (host) ro.observe(host);
	});

	onDestroy(() => {
		if (raf) cancelAnimationFrame(raf);
		ro?.disconnect();
	});
</script>

<svelte:window onkeydown={onKey} />

<figure class="panel">
	<div class="chrome">
		<span class="dots" aria-hidden="true"><i class="r"></i><i class="y"></i><i class="g"></i></span>
		<span class="title">{title}</span>
	</div>
	<div
		class="body"
		class:grabbing={dragging}
		bind:this={host}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		role="img"
		aria-label="A spinning ASCII-art bouquet. Drag to turn it, tap or press space to skip the growth."
	>
		<canvas bind:this={canvas}></canvas>
		<div class="scan" aria-hidden="true"></div>
	</div>
	<figcaption>
		{#if isGrowing}
			<p class="hint">Growing from the roots — drag to spin, tap or press space to skip ahead</p>
		{:else if hint}
			<p class="hint">{hint}</p>
		{/if}
		<button type="button" class="spin" onclick={toggleRotate} aria-pressed={autoRotate}>
			{autoRotate ? 'Pause rotation' : 'Rotate'}
		</button>
	</figcaption>
</figure>

<style>
	.panel {
		margin: 0;
		background: #0b0e14;
		border-radius: 18px;
		overflow: hidden;
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.06) inset,
			0 24px 50px -28px rgba(20, 10, 8, 0.7);
		border: 1px solid #1a1f2a;
	}
	.chrome {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 14px;
		background: linear-gradient(180deg, #161b26, #10141c);
		border-bottom: 1px solid #1e2533;
	}
	.dots {
		display: flex;
		gap: 6px;
	}
	.dots i {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		display: block;
	}
	.dots .r {
		background: #ff5f57;
	}
	.dots .y {
		background: #febc2e;
	}
	.dots .g {
		background: #28c840;
	}
	.title {
		flex: 1;
		text-align: center;
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		color: #7a8496;
		padding-right: 42px;
	}
	.body {
		position: relative;
		padding: 8px 4px 6px;
		background:
			radial-gradient(120% 80% at 50% 30%, rgba(40, 70, 50, 0.12), transparent 55%),
			#0b0e14;
		cursor: grab;
		touch-action: none;
		user-select: none;
		display: flex;
		justify-content: center;
	}
	.body.grabbing {
		cursor: grabbing;
	}
	canvas {
		display: block;
		max-width: 100%;
		height: auto;
	}
	.scan {
		pointer-events: none;
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			to bottom,
			rgba(255, 255, 255, 0.015) 0 1px,
			transparent 1px 3px
		);
		mix-blend-mode: soft-light;
		opacity: 0.5;
	}
	figcaption {
		margin: 0;
		padding: 8px 14px 12px;
		text-align: center;
		color: #8a93a3;
		font-size: 0.78rem;
		background: #0b0e14;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.45rem;
	}
	.hint {
		margin: 0;
	}
	.spin {
		border: 1px solid #2a3344;
		background: #161b26;
		color: #d5dbe6;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 700;
		border-radius: 999px;
		padding: 0.3rem 0.8rem;
		cursor: pointer;
	}
	.spin:hover {
		border-color: #3d4a60;
	}
	.spin:focus-visible {
		outline: 2px solid #ff8ad4;
		outline-offset: 2px;
	}
	.spin[aria-pressed='true'] {
		border-color: #3ee66b;
		color: #b8ffc8;
	}
</style>
