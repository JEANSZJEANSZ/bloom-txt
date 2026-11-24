<script lang="ts">
	import { RIBBON, RIBBON_ORDER, type RibbonId } from '../lib/ribbon';

	let { ribbon = $bindable() }: { ribbon: RibbonId } = $props();
</script>

<section class="bow" aria-labelledby="bow-label">
	<div class="head">
		<h2 id="bow-label">Bow colour</h2>
		<p>The ribbon that ties the bunch. Pink is the classic default.</p>
	</div>
	<div class="swatches" role="radiogroup" aria-labelledby="bow-label">
		{#each RIBBON_ORDER as id (id)}
			<button
				type="button"
				class="swatch"
				class:on={ribbon === id}
				class:light={id === 'white' || id === 'cream' || id === 'yellow'}
				style:--swatch={RIBBON[id].mid}
				style:--edge={RIBBON[id].dim}
				onclick={() => (ribbon = id)}
				role="radio"
				aria-checked={ribbon === id}
				aria-label={RIBBON[id].name}
				title={RIBBON[id].name}
			>
				<span class="chip"></span>
				<span class="name">{RIBBON[id].name}</span>
			</button>
		{/each}
	</div>
</section>

<style>
	.bow {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 0.9rem 1rem 1rem;
		box-shadow: var(--shadow);
	}
	.head h2 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 800;
	}
	.head p {
		margin: 0.15rem 0 0.7rem;
		color: var(--ink-soft);
		font-size: 0.86rem;
	}
	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.swatch {
		transition: transform 0.25s var(--ease-out), border-color 0.25s ease, box-shadow 0.25s ease;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--line);
		background: #fff;
		border-radius: 999px;
		padding: 0.22rem 0.55rem 0.22rem 0.28rem;
		cursor: pointer;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--ink);
		text-transform: capitalize;
	}
	.swatch:hover:not(.on) {
		border-color: var(--rose);
		transform: translateY(-1px) scale(1.04);
	}
	.swatch.on {
		border-color: var(--edge, var(--rose));
		box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--edge, var(--rose));
		background: #fffaf5;
	}
	.swatch:focus-visible {
		outline: 2px solid var(--rose);
		outline-offset: 2px;
	}
	.chip {
		width: 1.05rem;
		height: 1.05rem;
		border-radius: 50%;
		background: var(--swatch);
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
		flex: none;
	}
	.swatch.light .chip {
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.22);
	}
	.name {
		line-height: 1;
	}
</style>
