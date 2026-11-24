<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		TUNES,
		loadYoutubeApi,
		musicLabel,
		playTune,
		type Music,
		type TuneHandle,
	} from '../lib/music';

	export type MusicHandle = {
		start: () => Promise<void>;
		stop: () => void;
		toggleMute: () => void;
	};

	let {
		music,
		handle = $bindable(),
		visible = false,
		tone = 'paper',
	}: {
		music: Music;
		handle?: MusicHandle;
		/** Show the now-playing chip (after the letter has been opened). */
		visible?: boolean;
		tone?: 'paper' | 'night';
	} = $props();

	let muted = $state(false);
	let playing = $state(false);
	let failed = $state('');
	let ytHost: HTMLDivElement | undefined = $state();

	let ctx: AudioContext | null = null;
	let tune: TuneHandle | null = null;
	// YouTube IFrame player — typed loosely because the API is loaded at runtime.
	let player: { playVideo: () => void; pauseVideo: () => void; mute: () => void; unMute: () => void; destroy: () => void } | null =
		null;
	let startAfterCreate = false;

	function applyMute() {
		tune?.setMuted(muted);
		try {
			if (muted) player?.mute();
			else player?.unMute();
		} catch {
			/* player not ready */
		}
	}

	function stop() {
		tune?.stop();
		tune = null;
		try {
			player?.pauseVideo();
		} catch {
			/* ignore */
		}
		playing = false;
	}

	async function start() {
		failed = '';
		if (music.kind === 'none') return;
		if (music.kind === 'tune') {
			try {
				ctx = ctx ?? new AudioContext();
				if (ctx.state === 'suspended') await ctx.resume();
				tune?.stop();
				tune = playTune(ctx, music.id);
				tune.setMuted(muted);
				playing = true;
			} catch {
				failed = "This browser couldn't start the music.";
			}
			return;
		}
		startAfterCreate = true;
		try {
			await loadYoutubeApi();
		} catch {
			failed = "The video couldn't be loaded, so the bouquet is playing quietly.";
			return;
		}
		const YT = (window as unknown as { YT?: { Player: new (el: HTMLElement, opts: object) => typeof player } }).YT;
		if (!YT?.Player || !ytHost) {
			failed = "The video couldn't be loaded, so the bouquet is playing quietly.";
			return;
		}
		if (player) {
			try {
				player.playVideo();
				applyMute();
				playing = true;
				return;
			} catch {
				/* recreate below */
			}
		}
		player = new YT.Player(ytHost, {
			videoId: music.id,
			width: 200,
			height: 113,
			playerVars: {
				autoplay: 1,
				start: music.start ?? 0,
				modestbranding: 1,
				rel: 0,
				playsinline: 1,
				origin: typeof location !== 'undefined' ? location.origin : undefined,
			},
			events: {
				onReady: (e: { target: { playVideo: () => void } }) => {
					if (startAfterCreate) {
						try {
							e.target.playVideo();
						} catch {
							/* blocked */
						}
					}
					applyMute();
					playing = true;
				},
				onError: () => {
					failed = "This video can't be played here, so the bouquet is playing quietly.";
					playing = false;
					try {
						player?.destroy();
					} catch {
						/* ignore */
					}
					player = null;
				},
			},
		});
	}

	function toggleMute() {
		muted = !muted;
		applyMute();
	}

	handle = { start, stop, toggleMute };

	$effect(() => {
		handle = { start, stop, toggleMute };
	});

	onMount(() => {
		if (music.kind === 'youtube') {
			loadYoutubeApi().catch(() => {
				/* we'll show a note if they try to play */
			});
		}
	});

	onDestroy(() => {
		stop();
		try {
			player?.destroy();
		} catch {
			/* ignore */
		}
		player = null;
		if (ctx) {
			ctx.close().catch(() => {});
			ctx = null;
		}
	});

	const label = $derived(
		music.kind === 'tune' ? TUNES[music.id].name : music.kind === 'youtube' ? 'YouTube' : 'Music',
	);
</script>

{#if music.kind !== 'none'}
	<div class="dock" class:night={tone === 'night'} class:show={visible} aria-live="polite">
		{#if music.kind === 'youtube'}
			<div class="yt" class:off={!!failed}>
				<div class="host" bind:this={ytHost}></div>
			</div>
		{/if}
		{#if visible}
			<div class="chip">
				{#if failed}
					<p class="note">{failed}</p>
				{:else if !playing}
					<p class="now">
						<span class="kicker">A song came with this letter</span>
						<span class="title">{label}</span>
					</p>
					<button type="button" class="mute" onclick={() => start()}>Play</button>
				{:else}
					<p class="now">
						<span class="kicker">Now playing</span>
						<span class="title">{label}</span>
					</p>
					<button type="button" class="mute" onclick={toggleMute} aria-pressed={muted}>
						{muted ? 'Unmute' : 'Mute'}
					</button>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.dock {
		display: none;
		align-items: center;
		gap: 0.7rem;
		flex-wrap: wrap;
		justify-content: center;
	}
	.dock.show {
		display: flex;
		margin: 0 0 1rem;
	}
	/* Keep the YouTube iframe in the document (and sized) as soon as the gift
	   uses a video, so a play() after "Open your letter" stays within the rules. */
	.yt {
		width: 200px;
		height: 113px;
		border-radius: 12px;
		overflow: hidden;
		background: #111;
		box-shadow: var(--shadow);
		flex: none;
	}
	.yt.off {
		display: none;
	}
	.host,
	.host :global(iframe) {
		width: 200px;
		height: 113px;
		border: 0;
		display: block;
	}
	.chip {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 0.4rem 0.45rem 0.4rem 0.85rem;
		box-shadow: var(--shadow);
	}
	.now {
		margin: 0;
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}
	.kicker {
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-soft);
	}
	.title {
		font-weight: 800;
		font-size: 0.92rem;
	}
	.mute {
		border: 0;
		background: var(--rose);
		color: #fffaf5;
		font: inherit;
		font-weight: 700;
		border-radius: 999px;
		padding: 0.35rem 0.75rem;
		cursor: pointer;
	}
	.mute:focus-visible {
		outline: 2px solid var(--rose);
		outline-offset: 2px;
	}
	.note {
		margin: 0;
		padding: 0.2rem 0.4rem;
		color: var(--ink-soft);
		font-size: 0.85rem;
		max-width: 22rem;
	}
	@media (max-width: 720px) {
		.dock.show {
			flex-direction: column;
		}
	}

	.dock.night.show {
		margin: 0;
	}
	.dock.night .chip {
		background: rgba(18, 16, 24, 0.72);
		border-color: rgba(246, 239, 228, 0.16);
		color: var(--moon, #f6efe4);
		box-shadow: 0 16px 40px -20px rgba(0, 0, 0, 0.7);
	}
	.dock.night .kicker {
		color: var(--gold, #e8c988);
	}
	.dock.night .note {
		color: var(--moon-soft, rgba(246, 239, 228, 0.72));
	}
</style>
