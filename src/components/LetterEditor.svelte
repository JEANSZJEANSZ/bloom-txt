<script lang="ts">
	import { OCCASIONS } from '../lib/occasions';
	import type { Letter, OccasionId } from '../lib/types';
	import { LIMITS } from '../lib/types';

	let { letter = $bindable() }: { letter: Letter } = $props();

	function setOccasion(id: OccasionId) {
		letter = { ...letter, occasion: id };
	}
</script>

<section class="editor" aria-labelledby="letter-title">
	<div class="head">
		<h2 id="letter-title">Write a little letter</h2>
		<p>A short line sits under the bouquet. The rest waits inside the envelope.</p>
	</div>

	<div class="occasions" role="radiogroup" aria-label="Card style">
		{#each OCCASIONS as o (o.id)}
			<button
				type="button"
				class="occ"
				class:on={letter.occasion === o.id}
				style:--accent={o.hue}
				onclick={() => setOccasion(o.id)}
				role="radio"
				aria-checked={letter.occasion === o.id}
			>
				<span class="seal" aria-hidden="true">{o.seal}</span>
				<span class="lab">{o.label}</span>
			</button>
		{/each}
	</div>

	<div class="fields">
		<label>
			<span>To</span>
			<input type="text" maxlength={LIMITS.to} bind:value={letter.to} placeholder="someone special" />
		</label>
		<label>
			<span>From</span>
			<input type="text" maxlength={LIMITS.from} bind:value={letter.from} placeholder="you" />
		</label>
		<label class="wide">
			<span>Line under the bouquet <em>{letter.note.length}/{LIMITS.note}</em></span>
			<input
				type="text"
				maxlength={LIMITS.note}
				bind:value={letter.note}
				placeholder="you are my forever wildflower"
			/>
		</label>
		<label class="wide">
			<span>Letter <em>{letter.message.length}/{LIMITS.message}</em></span>
			<textarea
				rows="5"
				maxlength={LIMITS.message}
				bind:value={letter.message}
				placeholder="A few sentences, just for them."
			></textarea>
		</label>
	</div>
</section>

<style>
	.editor {
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
	.head p {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.95rem;
	}
	.occasions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.occ {
		border: 1px solid var(--line);
		background: var(--card);
		border-radius: 999px;
		padding: 0.3rem 0.7rem 0.3rem 0.4rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
		font: inherit;
		color: var(--ink);
	}
	.occ.on {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
	}
	.occ:focus-visible {
		outline: 2px solid var(--rose);
		outline-offset: 2px;
	}
	.seal {
		width: 1.4rem;
		height: 1.4rem;
		border-radius: 50%;
		background: var(--accent);
		color: #fffaf5;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
	}
	.lab {
		font-weight: 700;
		font-size: 0.85rem;
	}
	.fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
	.wide {
		grid-column: 1 / -1;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--ink);
	}
	label em {
		font-style: normal;
		font-weight: 600;
		color: var(--ink-soft);
		float: right;
		font-variant-numeric: tabular-nums;
	}
	input,
	textarea {
		font: inherit;
		font-weight: 400;
		color: var(--ink);
		background: #fff;
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 0.55rem 0.7rem;
		width: 100%;
		box-sizing: border-box;
	}
	textarea {
		resize: vertical;
		min-height: 7rem;
		line-height: 1.5;
		font-family: var(--serif);
	}
	input:focus-visible,
	textarea:focus-visible {
		outline: 2px solid var(--rose);
		outline-offset: 1px;
		border-color: var(--rose);
	}
	@media (max-width: 640px) {
		.fields {
			grid-template-columns: 1fr;
		}
	}
</style>
