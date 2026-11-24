<script lang="ts">
	import {
		TUNES,
		TUNE_IDS,
		parseYoutubeUrl,
		playTune,
		type Music,
		type TuneHandle,
		type TuneId,
	} from '../lib/music';

	let { music = $bindable() }: { music: Music } = $props();

	let urlDraft = $state(music.kind === 'youtube' ? youtubeDraft(music) : '');
	let urlError = $state('');
	let previewing = $state(false);
	let ctx: AudioContext | null = null;
	let handle: TuneHandle | null = null;

	function youtubeDraft(m: Extract<Music, { kind: 'youtube' }>): string {
		const t = m.start ? `?t=${m.start}` : '';
		return `https://youtu.be/${m.id}${t}`;
	}

	function chooseNone() {
		stopPreview();
		music = { kind: 'none' };
		urlError = '';
	}

	function chooseTune(id: TuneId) {
		music = { kind: 'tune', id };
		urlError = '';
	}

	function applyUrl() {
		const parsed = parseYoutubeUrl(urlDraft);
		if (!parsed) {
			urlError = 'Paste a YouTube watch, youtu.be, or Shorts link.';
			return;
		}
		urlError = '';
		stopPreview();
		music = parsed.start ? { kind: 'youtube', id: parsed.id, start: parsed.start } : { kind: 'youtube', id: parsed.id };
	}

	async function togglePreview() {
		if (music.kind !== 'tune') return;
		if (previewing) {
			stopPreview();
			return;
		}
		try {
			ctx = ctx ?? new AudioContext();
			if (ctx.state === 'suspended') await ctx.resume();
			handle = playTune(ctx, music.id);
			previewing = true;
		} catch {
			urlError = 'Could not start audio in this browser.';
		}
	}

	function stopPreview() {
		handle?.stop();
		handle = null;
		previewing = false;
	}

	$effect(() => {
		music;
		// Stop a preview if the sender picks a different option.
		return () => stopPreview();
	});
</script>

<section class="music" aria-labelledby="music-title">
	<div class="head">
		<h2 id="music-title">A song for the bloom</h2>
		<p>It starts when they open the letter, and plays through the bouquet.</p>
	</div>

	<div class="choices" role="radiogroup" aria-labelledby="music-title">
		<button
			type="button"
			class="choice"
			class:on={music.kind === 'none'}
			role="radio"
			aria-checked={music.kind === 'none'}
			onclick={chooseNone}
		>
			<span class="title">None</span>
			<span class="blurb">A quiet letter.</span>
		</button>
		{#each TUNE_IDS as id (id)}
			<button
				type="button"
				class="choice"
				class:on={music.kind === 'tune' && music.id === id}
				role="radio"
				aria-checked={music.kind === 'tune' && music.id === id}
				onclick={() => chooseTune(id)}
			>
				<span class="title">{TUNES[id].name}</span>
				<span class="blurb">{TUNES[id].blurb}</span>
			</button>
		{/each}
	</div>

	{#if music.kind === 'tune'}
		<button type="button" class="preview" onclick={togglePreview}>
			{previewing ? 'Stop preview' : 'Preview this tune'}
		</button>
	{/if}

	<label class="yt">
		<span>Or paste a YouTube link</span>
		<div class="row">
			<input
				type="url"
				placeholder="https://youtu.be/… or a Shorts / watch link"
				bind:value={urlDraft}
				onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), applyUrl())}
			/>
			<button type="button" class="ghost" onclick={applyUrl}>Use link</button>
		</div>
		{#if music.kind === 'youtube'}
			<p class="ok">This gift will play that video when they open the letter.</p>
		{/if}
		{#if urlError}
			<p class="err" role="status">{urlError}</p>
		{/if}
	</label>
</section>

<style>
	.music {
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
	.choices {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
	}
	.choice {
		text-align: left;
		border: 1px solid var(--line);
		background: #fff;
		border-radius: 14px;
		padding: 0.55rem 0.65rem;
		cursor: pointer;
		font: inherit;
		color: var(--ink);
	}
	.choice:hover:not(.on) {
		border-color: var(--rose);
	}
	.choice.on {
		border-color: var(--rose);
		box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--rose);
		background: #fffaf5;
	}
	.choice:focus-visible {
		outline: 2px solid var(--rose);
		outline-offset: 2px;
	}
	.title {
		display: block;
		font-weight: 800;
		font-size: 0.88rem;
	}
	.blurb {
		display: block;
		color: var(--ink-soft);
		font-size: 0.78rem;
		margin-top: 0.1rem;
	}
	.preview,
	.ghost {
		margin-top: 0.65rem;
		border-radius: 999px;
		font: inherit;
		font-weight: 700;
		padding: 0.4rem 0.85rem;
		cursor: pointer;
		border: 1px solid var(--line);
		background: var(--card);
		color: var(--ink);
	}
	.preview {
		background: var(--rose);
		border-color: var(--rose);
		color: #fffaf5;
	}
	.preview:focus-visible,
	.ghost:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--rose);
		outline-offset: 2px;
	}
	.yt {
		display: block;
		margin-top: 0.85rem;
	}
	.yt > span {
		display: block;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-soft);
		margin-bottom: 0.3rem;
	}
	.row {
		display: flex;
		gap: 0.4rem;
	}
	.row input {
		flex: 1;
		min-width: 0;
		font: inherit;
		padding: 0.45rem 0.6rem;
		border-radius: 12px;
		border: 1px solid var(--line);
		background: #fff;
		color: var(--ink);
	}
	.row .ghost {
		margin-top: 0;
		flex: none;
	}
	.ok,
	.err {
		margin: 0.35rem 0 0;
		font-size: 0.82rem;
	}
	.ok {
		color: var(--leaf);
	}
	.err {
		color: #a43333;
	}
</style>
