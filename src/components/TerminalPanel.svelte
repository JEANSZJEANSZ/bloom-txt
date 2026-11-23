<script lang="ts">
	import type { RenderedLine } from '../lib/render';

	let {
		lines,
		note = '',
		title = 'bloom.txt',
		interactive = false,
		onclick,
		hint = '',
	}: {
		lines: RenderedLine[];
		note?: string;
		title?: string;
		interactive?: boolean;
		onclick?: () => void;
		hint?: string;
	} = $props();
</script>

<figure class="panel">
	<div class="chrome">
		<span class="dots" aria-hidden="true"><i class="r"></i><i class="y"></i><i class="g"></i></span>
		<span class="title">{title}</span>
	</div>

	{#snippet art()}
		<pre class="term" aria-label="An ASCII-art bouquet"><code
			>{#each lines as line, i (i)}{#each line.runs as run, j (`${i}-${j}`)}<span style:color={run.color}>{run.text}</span
				>{/each}{i < lines.length - 1 ? '\n' : ''}{/each}</code
		></pre>
		{#if note}
			<p class="note">{note}</p>
		{/if}
	{/snippet}

	{#if interactive}
		<button type="button" class="body interactive" {onclick}>
			{@render art()}
		</button>
	{:else}
		<div class="body">
			{@render art()}
		</div>
	{/if}
	{#if hint}
		<figcaption>{hint}</figcaption>
	{/if}
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
		container-type: inline-size;
		padding: 14px 10px 18px;
		background:
			radial-gradient(120% 80% at 50% 30%, rgba(40, 70, 50, 0.12), transparent 55%),
			#0b0e14;
		overflow-x: auto;
		display: block;
		width: 100%;
		border: 0;
		color: inherit;
		font: inherit;
		text-align: left;
	}
	.body.interactive {
		cursor: pointer;
	}
	.body.interactive:focus-visible {
		outline: 2px solid #ff8ad4;
		outline-offset: -4px;
	}
	.term {
		margin: 0;
		font-family: var(--mono);
		font-size: clamp(4.7px, calc(100cqi / 86), 13px);
		line-height: 1.05;
		letter-spacing: 0;
		font-variant-ligatures: none;
		font-kerning: none;
		tab-size: 1;
		white-space: pre;
		color: #8a93a3;
		text-align: left;
		min-width: min-content;
		width: 100%;
	}
	.term code {
		font-family: inherit;
		font-size: inherit;
	}
	.note {
		margin: 0.9em 0 0;
		text-align: center;
		color: #f0a0c0;
		opacity: 0.82;
		font-family: var(--mono);
		font-size: clamp(5.2px, calc(100cqi / 72), 13px);
		letter-spacing: 0.04em;
		font-weight: 400;
	}
	figcaption {
		margin: 0;
		padding: 8px 14px 12px;
		text-align: center;
		color: #8a93a3;
		font-size: 0.78rem;
		background: #0b0e14;
	}
</style>
