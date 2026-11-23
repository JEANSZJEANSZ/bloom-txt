<script lang="ts">
	import { DEFAULT_CRITTERS, DEFAULT_FLOWERS, EMPTY_LETTER } from '../lib/defaults';
	import { copyPlainText, downloadPng } from '../lib/export';
	import { giftHash, giftUrl } from '../lib/share';
	import { surpriseBouquet, surpriseCritters } from '../lib/surprise';
	import { clampDetail, DEFAULT_DETAIL, DEFAULT_STYLE, isRenderStyle, styleOf } from '../lib/look';
	import { LIMITS, type ColorId, type CritterId, type CritterPlacement, type FlowerId, type Gift, type Letter, type Placement, type RenderStyle } from '../lib/types';
	import { normalizeCritters } from '../lib/critters';
	import FlowerPicker from './FlowerPicker.svelte';
	import CritterPicker from './CritterPicker.svelte';
	import LetterEditor from './LetterEditor.svelte';
	import BouquetStage, { type StageHandle } from './BouquetStage.svelte';
	import StageControls from './StageControls.svelte';

	const DRAFT_KEY = 'bloom-txt:draft';

	function loadDraft(): {
		flowers: Placement[];
		letter: Letter;
		critters: CritterPlacement[];
		style: RenderStyle;
		detail: number;
	} {
		const fallback = {
			flowers: [...DEFAULT_FLOWERS],
			letter: { ...EMPTY_LETTER },
			critters: [...DEFAULT_CRITTERS],
			style: DEFAULT_STYLE,
			detail: DEFAULT_DETAIL,
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
			};
			if (!Array.isArray(d.flowers)) throw new Error('bad draft');
			return {
				flowers: d.flowers.slice(0, LIMITS.flowers),
				letter: { ...EMPTY_LETTER, ...d.letter },
				critters: normalizeCritters(d.critters, LIMITS.critters),
				style: isRenderStyle(d.style) ? d.style : DEFAULT_STYLE,
				detail: clampDetail(d.detail, DEFAULT_DETAIL),
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

	let playing = $state(false);
	let status = $state('');

	const gift = $derived<Gift>({
		v: 1,
		flowers,
		letter,
		critters,
		...(styleOf(style) === 'retro' ? { style: 'retro' as const } : {}),
		...(clampDetail(detail) !== DEFAULT_DETAIL ? { detail: clampDetail(detail) } : {}),
	});
	const hint = $derived(
		playing
			? 'Growing from the roots — drag to spin, tap or press space to skip ahead'
			: flowers.length
				? 'Drag to spin the bouquet. Replay the bloom anytime, then copy the gift link.'
				: 'Add a flower to begin, or tap Surprise me.',
	);

	let stage = $state<StageHandle | undefined>(undefined);

	$effect(() => {
		const snapshot = JSON.stringify({ flowers, letter, critters, style, detail: clampDetail(detail) });
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

</script>

<svelte:window onkeydown={onkey} />

<div class="page">
	<header class="hero">
		<p class="eyebrow">a handmade bouquet</p>
		<h1>Bloom.txt</h1>
		<p class="tag">Wildflowers, even out of season. Assemble a bunch, write a note, and send the link like a gift.</p>
	</header>

	<div class="layout">
		<section class="stage">
			<StageControls bind:style bind:detail />
			<BouquetStage
				bind:handle={stage}
				{flowers}
				{critters}
				renderStyle={style}
				{detail}
				note={letter.note}
				{hint}
				{ongrown}
				onadvance={advance}
			/>
			<div class="actions">
				<button type="button" class="ghost" onclick={replay} disabled={flowers.length === 0}>Replay bloom</button>
				<button type="button" class="ghost" onclick={copyText} disabled={flowers.length === 0}>Copy as text</button>
				<button type="button" class="ghost" onclick={savePng} disabled={flowers.length === 0}>Download PNG</button>
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
			/>
			<CritterPicker {critters} onadd={addCritter} onremove={removeCritter} />
			<LetterEditor bind:letter />
			<div class="send">
				<button type="button" class="primary" onclick={copyLink}>Copy gift link</button>
				<button type="button" class="ghost" onclick={previewGift}>Preview the gift</button>
			</div>
			{#if status}
				<p class="status" role="status">{status}</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.page {
		width: min(1120px, calc(100% - 2rem));
		margin: 0 auto;
		padding: 2rem 0 4rem;
	}
	.hero {
		text-align: center;
		margin-bottom: 1.8rem;
	}
	.eyebrow {
		margin: 0;
		font-size: 0.75rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--ink-soft);
		font-weight: 700;
	}
	h1 {
		margin: 0.2rem 0 0.45rem;
		font-family: var(--serif);
		font-style: italic;
		font-weight: 500;
		font-size: clamp(2.4rem, 6vw, 3.8rem);
		color: var(--ink);
		letter-spacing: -0.03em;
	}
	.tag {
		margin: 0 auto;
		max-width: 36rem;
		color: var(--ink-soft);
		font-size: 1.05rem;
		line-height: 1.5;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(18rem, 0.9fr);
		gap: 1.5rem;
		align-items: start;
	}
	.stage,
	.desk {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.actions,
	.send {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}
	.ghost,
	.primary {
		border-radius: 999px;
		font: inherit;
		font-weight: 700;
		padding: 0.5rem 0.95rem;
		cursor: pointer;
	}
	.ghost {
		border: 1px solid var(--line);
		background: var(--card);
		color: var(--ink);
	}
	.ghost:hover:not(:disabled) {
		border-color: #d3b8ae;
	}
	.ghost:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.primary {
		border: 0;
		background: var(--rose);
		color: #fffaf5;
	}
	.primary:hover {
		filter: brightness(1.06);
	}
	.ghost:focus-visible,
	.primary:focus-visible {
		outline: 2px solid var(--rose);
		outline-offset: 2px;
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
	}
</style>
