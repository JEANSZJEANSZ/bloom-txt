<script lang="ts">
	import type { RenderStyle } from '../lib/types';

	let {
		style = $bindable(),
		detail = $bindable(),
	}: {
		style: RenderStyle;
		detail: number;
	} = $props();

	function setStyle(next: RenderStyle) {
		style = next;
	}
</script>

<div class="look">
	<div class="row" role="radiogroup" aria-labelledby="style-label">
		<span class="label" id="style-label">Style</span>
		<div class="seg">
			<button
				type="button"
				role="radio"
				aria-checked={style === 'retro'}
				class:on={style === 'retro'}
				onclick={() => setStyle('retro')}
			>
				Retro
			</button>
			<button
				type="button"
				role="radio"
				aria-checked={style === '3d'}
				class:on={style === '3d'}
				onclick={() => setStyle('3d')}
			>
				3D
			</button>
		</div>
	</div>
	<div class="row">
		<label class="label" for="detail-slider">Detail</label>
		<span class="end" aria-hidden="true">Chunky</span>
		<input
			id="detail-slider"
			class="slider"
			type="range"
			min="0"
			max="100"
			step="1"
			bind:value={detail}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={detail}
			aria-valuetext={detail <= 20 ? 'chunky' : detail >= 80 ? 'fine' : 'medium'}
		/>
		<span class="end" aria-hidden="true">Fine</span>
	</div>
</div>

<style>
	.look {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1.25rem;
		padding: 0.7rem 0.9rem;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex: 1 1 14rem;
		min-width: 0;
	}
	.label {
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-soft);
		flex: 0 0 auto;
	}
	.seg {
		display: inline-flex;
		border: 1px solid var(--line);
		border-radius: 999px;
		overflow: hidden;
		background: #f3e8e0;
	}
	.seg button {
		border: 0;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-weight: 700;
		font-size: 0.88rem;
		padding: 0.32rem 0.9rem;
		cursor: pointer;
	}
	.seg button:hover:not(.on) {
		background: rgba(196, 92, 122, 0.08);
	}
	.seg button.on {
		background: var(--rose);
		color: #fffaf5;
	}
	.seg button:focus-visible {
		outline: 2px solid var(--rose);
		outline-offset: 2px;
		z-index: 1;
	}
	.end {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--ink-soft);
		flex: 0 0 auto;
	}
	.slider {
		flex: 1 1 auto;
		min-width: 6rem;
		accent-color: var(--rose);
		height: 1.4rem;
		cursor: pointer;
	}
	.slider:focus-visible {
		outline: 2px solid var(--rose);
		outline-offset: 2px;
	}
</style>
