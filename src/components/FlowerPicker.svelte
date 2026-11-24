<script lang="ts">
	import { FLOWERS } from '../lib/flowers';
	import FlowerPreview from './FlowerPreview.svelte';
	import { COLOR_ORDER, PETAL } from '../lib/palette';
	import { DEFAULT_STYLE } from '../lib/look';
	import type { ColorId, FlowerId, Placement, RenderStyle } from '../lib/types';
	import { MAX_FLOWERS } from '../lib/types';

	let {
		flowers,
		onadd,
		onremove,
		onmove,
		onsurprise,
		onclear,
		renderStyle = DEFAULT_STYLE,
		ondragstart,
	}: {
		flowers: Placement[];
		onadd: (id: FlowerId, color: ColorId) => void;
		onremove: (index: number) => void;
		onmove: (from: number, to: number) => void;
		onsurprise: () => void;
		onclear: () => void;
		renderStyle?: RenderStyle;
		ondragstart: (id: FlowerId, color: ColorId, ev: PointerEvent) => void;
	} = $props();

	let selected: FlowerId = $state('rose');
	let color: ColorId = $state('red');

	const def = $derived(FLOWERS.find((f) => f.id === selected)!);
	const full = $derived(flowers.length >= MAX_FLOWERS);

	function choose(id: FlowerId) {
		selected = id;
		color = FLOWERS.find((f) => f.id === id)!.defaultColor;
	}

	type Press = {
		id: FlowerId;
		color: ColorId;
		x: number;
		y: number;
		pointerId: number;
		fromVariety: boolean;
	};
	let press: Press | null = null;
	let dragging = false;

	function pointerDown(e: PointerEvent, id: FlowerId, col: ColorId, fromVariety: boolean) {
		if (e.button !== 0) return;
		press = { id, color: col, x: e.clientX, y: e.clientY, pointerId: e.pointerId, fromVariety };
		dragging = false;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function pointerMove(e: PointerEvent) {
		if (!press || press.pointerId !== e.pointerId) return;
		const dx = e.clientX - press.x;
		const dy = e.clientY - press.y;
		if (!dragging && dx * dx + dy * dy > 64) {
			if (full) return;
			dragging = true;
			ondragstart(press.id, press.color, e);
		}
	}

	function pointerUp(e: PointerEvent) {
		if (!press || press.pointerId !== e.pointerId) return;
		const p = press;
		press = null;
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			/* already released */
		}
		if (!dragging && p.fromVariety) choose(p.id);
		else if (!dragging && !p.fromVariety && !full) onadd(p.id, p.color);
		dragging = false;
	}

	function onGrabKey(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			if (!full) onadd(selected, color);
		}
	}
</script>

<section class="picker" aria-labelledby="pick-title">
	<div class="head">
		<h2 id="pick-title">Gather your flowers</h2>
		<p>Pick a bloom and a color, then drag it onto the bouquet. You can also use the add button or press Enter.</p>
	</div>

	<ul class="varieties">
		{#each FLOWERS as f (f.id)}
			<li>
				<button
					type="button"
					class="kind"
					class:on={selected === f.id}
					aria-pressed={selected === f.id}
					onpointerdown={(e) => pointerDown(e, f.id, f.id === selected ? color : f.defaultColor, true)}
					onpointermove={pointerMove}
					onpointerup={pointerUp}
					onpointercancel={pointerUp}
				>
					<span class="kind-name">{f.name}</span>
					<span class="kind-blurb">{f.blurb}</span>
				</button>
			</li>
		{/each}
	</ul>

	<div class="studio">
		<div
			class="grab"
			role="button"
			tabindex="0"
			aria-label={`Drag a ${def.name} onto the bouquet, or press Enter to add one`}
			onpointerdown={(e) => pointerDown(e, selected, color, false)}
			onpointermove={pointerMove}
			onpointerup={pointerUp}
			onpointercancel={pointerUp}
			onkeydown={onGrabKey}
		>
			<FlowerPreview id={selected} {color} {renderStyle} label={`${def.name} in ${PETAL[color].name}`} />
			<span class="grab-hint">Drag onto the bouquet</span>
		</div>
		<div class="studio-side">
			<p class="current">{def.name}</p>
			<p class="blurb">{def.blurb}</p>
			<div class="swatches" role="radiogroup" aria-label="Flower color">
				{#each COLOR_ORDER as id (id)}
					<button
						type="button"
						class="swatch"
						class:on={color === id}
						style:background={PETAL[id].mid}
						onclick={() => (color = id)}
						aria-label={PETAL[id].name}
						aria-checked={color === id}
						role="radio"
						title={PETAL[id].name}
					></button>
				{/each}
			</div>
			<button class="add" type="button" disabled={full} onclick={() => onadd(selected, color)}>
				{full ? 'The vase is full' : 'Add to the bouquet'}
			</button>
		</div>
	</div>

	<div class="tools">
		<button class="ghost" type="button" onclick={onsurprise}>Surprise me</button>
		<button class="ghost" type="button" disabled={flowers.length === 0} onclick={onclear}>Clear</button>
		<p class="count">{flowers.length} / {MAX_FLOWERS}</p>
	</div>

	{#if flowers.length}
		<ol class="bunch">
			{#each flowers as f, i (i + f.id + f.color)}
				<li>
					<span class="dot" style:background={PETAL[f.color].mid}></span>
					<span class="name">{FLOWERS.find((x) => x.id === f.id)?.name} · {PETAL[f.color].name}</span>
					<span class="row-actions">
						<button
							type="button"
							class="icon"
							disabled={i === 0}
							onclick={() => onmove(i, i - 1)}
							aria-label="Move left">‹</button
						>
						<button
							type="button"
							class="icon"
							disabled={i === flowers.length - 1}
							onclick={() => onmove(i, i + 1)}
							aria-label="Move right">›</button
						>
						<button type="button" class="icon danger" onclick={() => onremove(i)} aria-label="Remove"
							>×</button
						>
					</span>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="empty">Your vase is empty. Drag a flower onto the bouquet, or let me surprise you.</p>
	{/if}
</section>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.head h2 {
		margin: 0 0 0.25rem;
		font-family: var(--serif);
		font-weight: 500;
		font-size: 1.45rem;
		color: var(--ink);
	}
	.head p,
	.blurb,
	.empty,
	.count {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.95rem;
	}
	.varieties {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7.4rem, 1fr));
		gap: 0.45rem;
	}
	.kind {
		width: 100%;
		text-align: left;
		border: 1px solid var(--line);
		background: var(--card);
		border-radius: 12px;
		padding: 0.55rem 0.65rem;
		cursor: pointer;
		color: inherit;
		font: inherit;
		min-height: 3.4rem;
	}
	.kind:hover {
		border-color: #d3b8ae;
	}
	.kind.on {
		border-color: var(--rose);
		background: #fff3f0;
		box-shadow: 0 0 0 2px rgba(196, 92, 122, 0.15);
	}
	.kind:focus-visible {
		outline: 2px solid var(--rose);
		outline-offset: 2px;
	}
	.kind-name {
		display: block;
		font-weight: 700;
		font-size: 0.86rem;
		color: var(--ink);
	}
	.kind-blurb {
		display: block;
		font-size: 0.72rem;
		color: var(--ink-soft);
		line-height: 1.25;
	}
	.studio {
		display: grid;
		grid-template-columns: minmax(7rem, 13.5rem) 1fr;
		gap: 0.9rem;
		align-items: center;
		background: #0b0e14;
		border-radius: 14px;
		padding: 0.9rem 1rem;
		border: 1px solid #1a1f2a;
	}
	.grab {
		cursor: grab;
		touch-action: none;
		user-select: none;
		border-radius: 12px;
		outline: none;
	}
	.grab:focus-visible {
		outline: 2px solid #ff8ad4;
		outline-offset: 3px;
	}
	.grab:active {
		cursor: grabbing;
	}
	.grab-hint {
		display: block;
		margin-top: 0.35rem;
		text-align: center;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #9aa3b2;
	}
	.kind {
		touch-action: none;
	}
	.current {
		margin: 0;
		font-family: var(--serif);
		font-size: 1.2rem;
		color: #f6f3ec;
	}
	.studio .blurb {
		color: #9aa3b2;
		margin: 0.15rem 0 0.6rem;
	}
	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.swatch {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.25);
		cursor: pointer;
		padding: 0;
	}
	.swatch.on {
		box-shadow:
			0 0 0 2px #0b0e14,
			0 0 0 4px #f6f3ec;
	}
	.swatch:focus-visible {
		outline: 2px solid #ff8ad4;
		outline-offset: 2px;
	}
	.add {
		margin-top: 0.8rem;
		width: 100%;
		border: 0;
		background: var(--rose);
		color: #fffaf5;
		font: inherit;
		font-weight: 700;
		border-radius: 999px;
		padding: 0.55rem 0.9rem;
		cursor: pointer;
	}
	.add:hover:not(:disabled) {
		filter: brightness(1.06);
	}
	.add:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.add:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 2px;
	}
	.tools {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.ghost {
		border: 1px solid var(--line);
		background: var(--card);
		color: var(--ink);
		font: inherit;
		font-weight: 700;
		border-radius: 999px;
		padding: 0.4rem 0.85rem;
		cursor: pointer;
	}
	.ghost:hover:not(:disabled) {
		border-color: #d3b8ae;
	}
	.ghost:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.ghost:focus-visible {
		outline: 2px solid var(--rose);
		outline-offset: 2px;
	}
	.count {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}
	.bunch {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.bunch li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 0.3rem 0.45rem 0.3rem 0.65rem;
	}
	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex: none;
		box-shadow: 0 0 0 1px rgba(58, 42, 40, 0.18);
	}
	.name {
		flex: 1;
		font-size: 0.9rem;
		color: var(--ink);
	}
	.row-actions {
		display: flex;
		gap: 0.15rem;
	}
	.icon {
		width: 28px;
		height: 28px;
		border: 0;
		background: transparent;
		border-radius: 8px;
		cursor: pointer;
		font: inherit;
		color: var(--ink-soft);
	}
	.icon:hover:not(:disabled) {
		background: #f3e8e1;
		color: var(--ink);
	}
	.icon:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.icon.danger:hover:not(:disabled) {
		background: #ffe4e4;
		color: #b4232a;
	}
	.empty {
		font-style: italic;
		font-family: var(--serif);
	}
	@media (max-width: 640px) {
		.studio {
			grid-template-columns: 1fr;
			text-align: center;
		}
		.swatches {
			justify-content: center;
		}
		.swatches {
			display: inline-flex;
		}
	}
</style>
