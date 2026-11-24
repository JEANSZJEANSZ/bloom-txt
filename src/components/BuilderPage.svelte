<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { DEFAULT_CRITTERS, DEFAULT_FLOWERS, EMPTY_LETTER } from '../lib/defaults';
	import { FLOWERS } from '../lib/flowers';
	import { PETAL } from '../lib/palette';
	import { copyPlainText, downloadPng } from '../lib/export';
	import { giftHash, giftUrl } from '../lib/share';
	import { surpriseBouquet, surpriseCritters } from '../lib/surprise';
	import { clampDetail, DEFAULT_DETAIL, DEFAULT_STYLE, isRenderStyle, styleOf } from '../lib/look';
	import { DEFAULT_MUSIC, encodeMusic, musicOf, type Music } from '../lib/music';
	import { DEFAULT_RIBBON, ribbonOf, type RibbonId } from '../lib/ribbon';
	import { LIMITS, type ColorId, type CritterId, type CritterPlacement, type FlowerId, type Gift, type Letter, type Placement, type RenderStyle } from '../lib/types';
	import { normalizeCritters } from '../lib/critters';
	import FlowerPicker from './FlowerPicker.svelte';
	import CritterPicker from './CritterPicker.svelte';
	import LetterEditor from './LetterEditor.svelte';
	import BouquetStage, { type StageHandle } from './BouquetStage.svelte';
	import StageControls from './StageControls.svelte';
	import RibbonPicker from './RibbonPicker.svelte';
	import MusicPicker from './MusicPicker.svelte';
	import LandingHero from './LandingHero.svelte';

	const DRAFT_KEY = 'bloom-txt:draft';

	function loadDraft(): {
		flowers: Placement[];
		letter: Letter;
		critters: CritterPlacement[];
		style: RenderStyle;
		detail: number;
		ribbon: RibbonId;
		music: Music;
	} {
		const fallback = {
			flowers: [...DEFAULT_FLOWERS],
			letter: { ...EMPTY_LETTER },
			critters: [...DEFAULT_CRITTERS],
			style: DEFAULT_STYLE,
			detail: DEFAULT_DETAIL,
			ribbon: DEFAULT_RIBBON,
			music: DEFAULT_MUSIC,
		};
		try {
			const raw = localStorage.getItem(DRAFT_KEY);
			if (!raw) return fallback;
			const d = JSON.parse(raw) as {
				flowers?: Placement[];
				letter?: Letter;
				critters?: unknown;
				style?: unknown;
				detail?: unknown;
				ribbon?: unknown;
				music?: unknown;
			};
			if (!Array.isArray(d.flowers)) throw new Error('bad draft');
			return {
				flowers: d.flowers.slice(0, LIMITS.flowers),
				letter: { ...EMPTY_LETTER, ...d.letter },
				critters: normalizeCritters(d.critters, LIMITS.critters),
				style: isRenderStyle(d.style) ? d.style : DEFAULT_STYLE,
				detail: clampDetail(d.detail, DEFAULT_DETAIL),
				ribbon: ribbonOf(d.ribbon),
				music: musicOf(d.music),
			};
		} catch {
			return fallback;
		}
	}

	const draft = loadDraft();
	let flowers: Placement[] = $state(draft.flowers);
	let letter: Letter = $state(draft.letter);
	let critters: CritterPlacement[] = $state(draft.critters);
	let style: RenderStyle = $state(draft.style);
	let detail: number = $state(draft.detail);
	let ribbon: RibbonId = $state(draft.ribbon);
	let music: Music = $state(draft.music);

	let playing = $state(false);
	let status = $state('');

	const gift = $derived<Gift>({
		v: 1,
		flowers,
		letter,
		critters,
		...(styleOf(style) === 'retro' ? { style: 'retro' as const } : {}),
		...(clampDetail(detail) !== DEFAULT_DETAIL ? { detail: clampDetail(detail) } : {}),
		...(ribbonOf(ribbon) !== DEFAULT_RIBBON ? { ribbon: ribbonOf(ribbon) } : {}),
		...(encodeMusic(music) ? { music } : {}),
	});
	const hint = $derived(
		playing
			? 'Growing from the stems — drag to spin, tap or press space to skip ahead'
			: flowers.length
				? 'Drag to spin the bouquet, or drag a flower onto it to add another. Replay the bloom anytime.'
				: 'Drag a flower onto the bouquet to begin, or tap Surprise me.',
	);

	let stage = $state<StageHandle | undefined>(undefined);

	$effect(() => {
		const snapshot = JSON.stringify({ flowers, letter, critters, style, detail: clampDetail(detail), ribbon: ribbonOf(ribbon), music });
		try {
			localStorage.setItem(DRAFT_KEY, snapshot);
		} catch {
			/* private mode, ignore */
		}
	});

	function replay() {
		playing = true;
		stage?.replay();
	}

	function advance() {
		if (!playing && (stage?.isGrown() ?? true)) {
			replay();
			return;
		}
		stage?.advance();
		if (stage?.isGrown()) playing = false;
	}

	function ongrown() {
		playing = false;
	}

	function onkey(e: KeyboardEvent) {
		const t = e.target as HTMLElement | null;
		if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
		if (e.key === ' ' || e.key === 'Spacebar') {
			e.preventDefault();
			advance();
		}
	}

	function add(id: FlowerId, color: ColorId) {
		if (flowers.length >= LIMITS.flowers) return;
		flowers = [...flowers, { id, color }];
		status = '';
	}

	type Drag = { id: FlowerId; color: ColorId; x: number; y: number };
	let drag: Drag | null = $state(null);
	let overStage = $state(false);
	let dropEl: HTMLElement | undefined = $state();
	const vaseFull = $derived(flowers.length >= LIMITS.flowers);

	function hitStage(x: number, y: number): boolean {
		if (!dropEl) return false;
		const r = dropEl.getBoundingClientRect();
		return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
	}

	function onDragMove(e: PointerEvent) {
		if (!drag) return;
		e.preventDefault();
		drag = { ...drag, x: e.clientX, y: e.clientY };
		overStage = hitStage(e.clientX, e.clientY);
	}

	function endDrag(e?: PointerEvent) {
		window.removeEventListener('pointermove', onDragMove, true);
		window.removeEventListener('pointerup', onDragUp, true);
		window.removeEventListener('pointercancel', onDragUp, true);
		const d = drag;
		const over = e ? hitStage(e.clientX, e.clientY) : overStage;
		drag = null;
		overStage = false;
		if (d && over && !vaseFull) add(d.id, d.color);
	}

	function onDragUp(e: PointerEvent) {
		endDrag(e);
	}

	function ondragstart(id: FlowerId, color: ColorId, ev: PointerEvent) {
		if (vaseFull) return;
		drag = { id, color, x: ev.clientX, y: ev.clientY };
		overStage = hitStage(ev.clientX, ev.clientY);
		window.addEventListener('pointermove', onDragMove, { capture: true, passive: false });
		window.addEventListener('pointerup', onDragUp, { capture: true });
		window.addEventListener('pointercancel', onDragUp, { capture: true });
	}

	onDestroy(() => endDrag());

	const dragName = $derived(drag ? (FLOWERS.find((f) => f.id === drag!.id)?.name ?? 'flower') : 'flower');
	function remove(index: number) {
		flowers = flowers.filter((_, i) => i !== index);
	}
	function move(from: number, to: number) {
		if (to < 0 || to >= flowers.length) return;
		const next = [...flowers];
		const [item] = next.splice(from, 1);
		next.splice(to, 0, item);
		flowers = next;
	}
	function addCritter(id: CritterId) {
		if (critters.length >= LIMITS.critters) return;
		critters = [...critters, { id }];
		status = '';
	}
	function removeCritter(index: number) {
		critters = critters.filter((_, i) => i !== index);
	}
	function surprise() {
		flowers = surpriseBouquet();
		critters = surpriseCritters();
		status = 'A wild little bunch, just for now.';
	}
	function clear() {
		flowers = [];
		status = '';
	}

	async function copyLink() {
		if (!flowers.length) {
			status = 'Add at least one flower before sending the bouquet.';
			return;
		}
		const url = giftUrl(gift);
		try {
			await navigator.clipboard.writeText(url);
			status = 'Gift link copied — send it like a letter.';
		} catch {
			status = url;
		}
	}

	function previewGift() {
		if (!flowers.length) {
			status = 'Add at least one flower before sending the bouquet.';
			return;
		}
		location.hash = giftHash(gift).replace(/^#/, '#');
	}

	function currentGrid() {
		return stage?.getGrid();
	}

	async function copyText() {
		const grid = currentGrid();
		if (!grid) return;
		const ok = await copyPlainText(grid, letter.note);
		status = ok ? 'Copied as plain text.' : 'Could not copy — try selecting the bouquet instead.';
	}

	async function savePng() {
		const grid = currentGrid();
		if (!grid) return;
		await downloadPng(grid, letter.note, 'bloom.txt.png', { plain: styleOf(style) === 'retro' });
		status = 'Saved a PNG of the bouquet.';
	}

	let studioEl: HTMLElement | undefined = $state();

	function goStudio() {
		const smooth =
			typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		studioEl?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
	}

	onMount(() => {
		const q = new URLSearchParams(location.search);
		if (q.has('studio')) {
			studioEl?.scrollIntoView({ behavior: 'auto', block: 'start' });
		}
	});

</script>

<svelte:window onkeydown={onkey} />

<LandingHero oncompose={goStudio} />

<div class="page" id="studio" bind:this={studioEl}>
	<header class="studio-head">
		<p class="kicker">The studio</p>
		<h2>Compose your bouquet</h2>
		<p class="lede">Keep it simple. Pick flowers, tie a bow, write a note, and send the link.</p>
	</header>

	<div class="layout">
		<section class="stage">
			<StageControls bind:style bind:detail />
			<div class="drop-host" class:live={!!drag} bind:this={dropEl}>
				<BouquetStage
					bind:handle={stage}
					{flowers}
					{critters}
					renderStyle={style}
					{detail}
					{ribbon}
					note={letter.note}
					{hint}
					{ongrown}
					onadvance={advance}
					dropActive={!!drag && overStage}
					dropAllowed={!vaseFull}
					dropName={dragName}
					locked={!!drag}
				/>
			</div>
			<RibbonPicker bind:ribbon />
			<div class="actions">
				<button type="button" class="btn-ghost" onclick={replay} disabled={flowers.length === 0}>Replay bloom</button>
				<button type="button" class="btn-ghost" onclick={copyText} disabled={flowers.length === 0}>Copy as text</button>
				<button type="button" class="btn-ghost" onclick={savePng} disabled={flowers.length === 0}>Download PNG</button>
			</div>
		</section>

		<div class="desk">
			<FlowerPicker
				{flowers}
				onadd={add}
				onremove={remove}
				onmove={move}
				onsurprise={surprise}
				onclear={clear}
				renderStyle={style}
				{ondragstart}
			/>
			<CritterPicker {critters} onadd={addCritter} onremove={removeCritter} />
			<LetterEditor bind:letter />
			<MusicPicker bind:music />
			<div class="send">
				<button type="button" class="btn-primary" onclick={copyLink}>Copy gift link</button>
				<button type="button" class="btn-ghost" onclick={previewGift}>Preview the gift</button>
			</div>
			{#if status}
				<p class="status" role="status">{status}</p>
			{/if}
		</div>
	</div>
</div>

{#if drag}
	<div
		class="drag-ghost"
		class:over={overStage && !vaseFull}
		style:left="{drag.x}px"
		style:top="{drag.y}px"
		aria-hidden="true"
	>
		<span class="ghost-swatch" style:background={PETAL[drag.color].mid}></span>
		<span class="ghost-name">{dragName}</span>
		<span class="ghost-hint">{overStage ? (vaseFull ? 'Vase is full' : 'Drop to add') : 'Drop on the bouquet'}</span>
	</div>
{/if}

<style>
	.page {
		width: min(1120px, calc(100% - 2rem));
		margin: 0 auto;
		padding: 3.2rem 0 4.5rem;
		scroll-margin-top: 0;
		position: relative;
	}
	.page::before {
		content: '';
		position: absolute;
		inset: 0 -50vw;
		background: var(--paper);
		z-index: -1;
		box-shadow: 0 -40px 60px 40px var(--paper);
	}
	.studio-head {
		margin: 0 0 1.75rem;
		max-width: 36rem;
	}
	.kicker {
		margin: 0 0 0.3rem;
		font-size: 0.75rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--rose);
		font-weight: 800;
	}
	.studio-head h2 {
		margin: 0;
		font-family: var(--serif);
		font-style: italic;
		font-weight: 500;
		font-size: clamp(1.8rem, 4vw, 2.6rem);
		letter-spacing: -0.02em;
	}
	.lede {
		margin: 0.45rem 0 0;
		color: var(--ink-soft);
		font-size: 1.02rem;
	}
	.drop-host {
		min-width: 0;
		border-radius: var(--radius);
		transition: box-shadow 0.35s var(--ease-out);
	}
	.drop-host.live {
		box-shadow: 0 0 0 3px rgba(196, 92, 122, 0.18);
	}
	.drag-ghost {
		position: fixed;
		z-index: 80;
		pointer-events: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.75rem 0.45rem 0.5rem;
		background: #fffaf5;
		border: 1px solid var(--line);
		border-radius: 999px;
		box-shadow: 0 16px 32px -16px rgba(40, 16, 12, 0.55), 0 0 0 1px rgba(196, 92, 122, 0.12);
		transform: translate(14px, 18px) rotate(-6deg);
		font-weight: 700;
		color: var(--ink);
		white-space: nowrap;
		transition: transform 0.25s var(--ease-out), border-color 0.25s ease, box-shadow 0.25s ease;
	}
	.drag-ghost.over {
		transform: translate(14px, 18px) rotate(0deg) scale(1.05);
		border-color: var(--rose);
		box-shadow: 0 16px 36px -14px rgba(196, 92, 122, 0.45);
	}
	.ghost-swatch {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1px rgba(40, 20, 16, 0.15);
	}
	.ghost-hint {
		font-weight: 600;
		color: var(--ink-soft);
		font-size: 0.78rem;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(18rem, 0.9fr);
		gap: 1.6rem;
		align-items: start;
	}
	.stage,
	.desk {
		display: flex;
		flex-direction: column;
		gap: 1.05rem;
	}
	.actions,
	.send {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.status {
		margin: 0;
		font-size: 0.92rem;
		color: var(--leaf);
		background: #e8f4ea;
		border-radius: 10px;
		padding: 0.55rem 0.75rem;
		overflow-wrap: anywhere;
	}
	@media (min-width: 901px) {
		.layout {
			grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 0.85fr);
		}
		.stage {
			position: sticky;
			top: 1rem;
		}
	}
	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
		.page {
			padding-top: 2.2rem;
		}
	}
</style>
