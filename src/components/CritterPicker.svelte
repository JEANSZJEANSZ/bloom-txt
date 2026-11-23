<script lang="ts">
	import { CRITTER_META, critterFrames } from '../lib/critters';
	import type { CritterId, CritterPlacement } from '../lib/types';
	import { MAX_CRITTERS } from '../lib/types';

	let {
		critters,
		onadd,
		onremove,
	}: {
		critters: CritterPlacement[];
		onadd: (id: CritterId) => void;
		onremove: (index: number) => void;
	} = $props();

	const full = $derived(critters.length >= MAX_CRITTERS);

	const names: Record<CritterId, string> = {
		ladybug: 'Ladybug',
		bee: 'Bee',
		butterfly: 'Butterfly',
	};
</script>

<section class="friends" aria-labelledby="friends-title">
	<div class="head">
		<h2 id="friends-title">Add a little friend</h2>
		<p>Ladybugs crawl the stems. Bees and butterflies buzz around the bunch after it blooms.</p>
	</div>

	<ul class="picks">
		{#each CRITTER_META as c (c.id)}
			<li>
				<button type="button" class="pick" disabled={full} onclick={() => onadd(c.id)}>
					<span class="art" aria-hidden="true"
						>{#each critterFrames(c.id)[0] as g}{#if g.dx === -1}<span style:color={g.color}>{g.ch}</span>{/if}{/each}{#each critterFrames(c.id)[0] as g}{#if g.dx === 0}<span
								style:color={g.color}>{g.ch}</span
							>{/if}{/each}{#each critterFrames(c.id)[0] as g}{#if g.dx === 1}<span style:color={g.color}
								>{g.ch}</span
							>{/if}{/each}</span
					>
					<span class="kind-name">{c.name}</span>
					<span class="kind-blurb">{c.blurb}</span>
				</button>
			</li>
		{/each}
	</ul>

	<div class="tools">
		<p class="count">{critters.length} / {MAX_CRITTERS}</p>
	</div>

	{#if critters.length}
		<ol class="bunch">
			{#each critters as c, i (i + c.id)}
				<li>
					<span class="art mini" aria-hidden="true"
						>{#each critterFrames(c.id)[0] as g}{#if g.dx === -1}<span style:color={g.color}>{g.ch}</span
							>{/if}{/each}{#each critterFrames(c.id)[0] as g}{#if g.dx === 0}<span style:color={g.color}
								>{g.ch}</span
							>{/if}{/each}{#each critterFrames(c.id)[0] as g}{#if g.dx === 1}<span style:color={g.color}
								>{g.ch}</span
							>{/if}{/each}</span
					>
					<span class="name">{names[c.id]}</span>
					<button type="button" class="icon danger" onclick={() => onremove(i)} aria-label="Remove {names[c.id]}"
						>×</button
					>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="empty">No visitors yet. Invite a ladybug, a bee, or a butterfly.</p>
	{/if}
</section>

<style>
	.friends {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.head h2 {
		margin: 0 0 0.25rem;
		font-family: var(--serif);
		font-weight: 500;
		font-size: 1.45rem;
		color: var(--ink);
	}
	.head p,
	.empty,
	.count {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.95rem;
	}
	.picks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.45rem;
	}
	.pick {
		width: 100%;
		text-align: left;
		border: 1px solid var(--line);
		background: var(--card);
		border-radius: 12px;
		padding: 0.55rem 0.65rem;
		cursor: pointer;
		color: inherit;
		font: inherit;
		min-height: 5.2rem;
	}
	.pick:hover:not(:disabled) {
		border-color: #d3b8ae;
	}
	.pick:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.pick:focus-visible {
		outline: 2px solid var(--rose);
		outline-offset: 2px;
	}
	.art {
		display: block;
		font-family: var(--mono);
		font-size: 1.05rem;
		letter-spacing: 0.02em;
		background: #0b0e14;
		border-radius: 8px;
		padding: 0.2rem 0.35rem;
		margin-bottom: 0.35rem;
		text-align: center;
	}
	.art.mini {
		display: inline-block;
		margin: 0 0.35rem 0 0;
		padding: 0.1rem 0.3rem;
		font-size: 0.85rem;
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
	.tools {
		display: flex;
		justify-content: flex-end;
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
		gap: 0.35rem;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 0.3rem 0.45rem;
	}
	.name {
		flex: 1;
		font-size: 0.88rem;
		font-weight: 600;
	}
	.icon {
		border: 0;
		background: transparent;
		font: inherit;
		font-size: 1.1rem;
		cursor: pointer;
		color: var(--ink-soft);
		border-radius: 8px;
		width: 1.8rem;
		height: 1.8rem;
	}
	.icon:hover,
	.icon.danger:hover {
		background: #fde8e8;
		color: #b32626;
	}
	.icon:focus-visible {
		outline: 2px solid var(--rose);
		outline-offset: 2px;
	}
	@media (max-width: 520px) {
		.picks {
			grid-template-columns: 1fr;
		}
	}
</style>
