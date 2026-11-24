/** Built-in original tunes and YouTube gift-link helpers. Nothing copyrighted. */

export type TuneId = 'musicbox' | 'lofi' | 'piano';

export type Music =
	| { kind: 'none' }
	| { kind: 'tune'; id: TuneId }
	| { kind: 'youtube'; id: string; start?: number };

export const DEFAULT_MUSIC: Music = { kind: 'none' };

export const TUNE_IDS: TuneId[] = ['musicbox', 'lofi', 'piano'];

export const TUNES: Record<TuneId, { name: string; blurb: string }> = {
	musicbox: { name: 'Music box', blurb: 'A tiny chime, like a keepsake.' },
	lofi: { name: 'Lo-fi chip', blurb: 'A soft 8-bit loop.' },
	piano: { name: 'Soft piano', blurb: 'A gentle arpeggio.' },
};

export function isTuneId(v: unknown): v is TuneId {
	return v === 'musicbox' || v === 'lofi' || v === 'piano';
}

/** YouTube watch ids are 11 URL-safe characters. */
export const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function isYoutubeId(v: unknown): v is string {
	return typeof v === 'string' && YT_ID.test(v);
}

export function musicOf(v: unknown): Music {
	if (!v) return { kind: 'none' };
	if (typeof v === 'string') return decodeMusic(v);
	if (typeof v === 'object' && v && 'kind' in (v as object)) {
		const m = v as Music;
		if (m.kind === 'tune' && isTuneId(m.id)) return m;
		if (m.kind === 'youtube' && isYoutubeId(m.id)) {
			const start = typeof m.start === 'number' && m.start > 0 ? Math.floor(m.start) : 0;
			return start ? { kind: 'youtube', id: m.id, start } : { kind: 'youtube', id: m.id };
		}
	}
	return { kind: 'none' };
}

export function musicsEqual(a: Music | undefined, b: Music | undefined): boolean {
	const x = a ?? DEFAULT_MUSIC;
	const y = b ?? DEFAULT_MUSIC;
	if (x.kind !== y.kind) return false;
	if (x.kind === 'none' || y.kind === 'none') return true;
	if (x.kind === 'tune' && y.kind === 'tune') return x.id === y.id;
	if (x.kind === 'youtube' && y.kind === 'youtube') return x.id === y.id && (x.start ?? 0) === (y.start ?? 0);
	return false;
}

export function encodeMusic(music: Music | undefined): string | undefined {
	if (!music || music.kind === 'none') return undefined;
	if (music.kind === 'tune') return music.id;
	const start = music.start && music.start > 0 ? `@${Math.floor(music.start)}` : '';
	return `yt:${music.id}${start}`;
}

export function decodeMusic(raw: unknown): Music {
	if (typeof raw !== 'string' || !raw) return { kind: 'none' };
	if (isTuneId(raw)) return { kind: 'tune', id: raw };
	const m = raw.match(/^yt:([A-Za-z0-9_-]{11})(?:@(\d+))?$/);
	if (!m) return { kind: 'none' };
	const start = m[2] ? Number(m[2]) : 0;
	return start > 0 ? { kind: 'youtube', id: m[1], start } : { kind: 'youtube', id: m[1] };
}

/** Parse seconds from t=90, t=1m30s, t=1h2m3s, or a bare number. */
export function parseTimestamp(value: string | null | undefined): number | undefined {
	if (!value) return undefined;
	let s = String(value).trim();
	s = s.replace(/^#?t=/, '');
	if (!s) return undefined;
	if (/^\d+(\.\d+)?$/.test(s)) {
		const n = Math.floor(Number(s));
		return n > 0 ? n : undefined;
	}
	const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
	if (!m) return undefined;
	const sec = (Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)) | 0;
	return sec > 0 ? sec : undefined;
}

/**
 * Accepts youtu.be, youtube.com/watch, /shorts, /embed, /live, and optional t= / start=.
 * Also accepts a bare 11-character video id.
 */
export function parseYoutubeUrl(input: string): { id: string; start?: number } | null {
	const raw = input.trim();
	if (!raw) return null;
	if (YT_ID.test(raw)) return { id: raw };

	let url: URL;
	try {
		url = new URL(raw.includes('://') ? raw : `https://${raw}`);
	} catch {
		return null;
	}

	const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '').replace(/^music\./, '');
	const allowed = host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com';
	if (!allowed) return null;

	let id = '';
	if (host === 'youtu.be') {
		id = url.pathname.split('/').filter(Boolean)[0] ?? '';
	} else if (url.searchParams.get('v')) {
		id = url.searchParams.get('v') ?? '';
	} else {
		const parts = url.pathname.split('/').filter(Boolean);
		const mark = parts.findIndex((p) => p === 'shorts' || p === 'embed' || p === 'live' || p === 'v');
		if (mark >= 0) id = parts[mark + 1] ?? '';
	}
	id = id.replace(/[^A-Za-z0-9_-].*$/, '');
	if (!YT_ID.test(id)) return null;

	const start =
		parseTimestamp(url.searchParams.get('t')) ??
		parseTimestamp(url.searchParams.get('start')) ??
		parseTimestamp(url.hash);
	return start ? { id, start } : { id };
}

export function musicLabel(music: Music | undefined): string {
	if (!music || music.kind === 'none') return 'No music';
	if (music.kind === 'tune') return TUNES[music.id].name;
	return 'YouTube';
}

export type TuneHandle = { stop: () => void; setMuted: (muted: boolean) => void };

function tone(
	ctx: AudioContext,
	dest: AudioNode,
	type: OscillatorType,
	freq: number,
	at: number,
	dur: number,
	gain: number,
	attack = 0.01,
	release = 0.25,
) {
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.type = type;
	osc.frequency.value = freq;
	g.gain.setValueAtTime(0.0001, at);
	g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + attack);
	g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(attack + 0.02, dur - release));
	osc.connect(g);
	g.connect(dest);
	osc.start(at);
	osc.stop(at + dur + 0.02);
}

/** Original music-box chime in G major, a little waltz. */
function scheduleMusicBox(ctx: AudioContext, dest: AudioNode, t0: number): number {
	const bpm = 92;
	const beat = 60 / bpm;
	// G major pentatonic, invented phrase — not a quoted tune.
	const notes = [67, 71, 74, 79, 74, 71, 69, 67, 64, 67, 69, 71, 74, 71, 67, 62];
	const bass = [43, 0, 47, 0, 45, 0, 50, 0, 43, 0, 47, 0, 45, 0, 42, 0];
	for (let i = 0; i < notes.length; i++) {
		const at = t0 + i * beat * 0.5;
		tone(ctx, dest, 'sine', midi(notes[i]), at, beat * 0.95, 0.16, 0.008, 0.45);
		tone(ctx, dest, 'triangle', midi(notes[i]) * 2, at, beat * 0.5, 0.05, 0.006, 0.3);
		if (bass[i]) tone(ctx, dest, 'sine', midi(bass[i]), at, beat * 0.9, 0.06, 0.01, 0.35);
	}
	return notes.length * beat * 0.5;
}

/** Original soft square-wave loop, lo-fi and slow. */
function scheduleLofi(ctx: AudioContext, dest: AudioNode, t0: number): number {
	const bpm = 76;
	const beat = 60 / bpm;
	const lead = [60, 64, 67, 64, 69, 67, 64, 60, 65, 64, 60, 57, 55, 59, 62, 59];
	const bass = [36, 36, 43, 43, 38, 38, 41, 41, 33, 33, 36, 36, 31, 31, 38, 38];
	const filter = ctx.createBiquadFilter();
	filter.type = 'lowpass';
	filter.frequency.value = 1400;
	filter.Q.value = 0.7;
	filter.connect(dest);
	for (let i = 0; i < lead.length; i++) {
		const at = t0 + i * beat * 0.5;
		tone(ctx, filter, 'square', midi(lead[i]), at, beat * 0.42, 0.06, 0.01, 0.12);
		tone(ctx, dest, 'triangle', midi(bass[i]), at, beat * 0.55, 0.08, 0.01, 0.2);
	}
	return lead.length * beat * 0.5;
}

/** Original rolling piano arpeggio. */
function schedulePiano(ctx: AudioContext, dest: AudioNode, t0: number): number {
	const bpm = 68;
	const beat = 60 / bpm;
	const chords = [
		[60, 64, 67, 71],
		[57, 60, 64, 67],
		[53, 57, 60, 64],
		[55, 59, 62, 65],
	];
	let i = 0;
	for (const chord of chords) {
		for (const n of [...chord, chord[2]!, chord[1]!, chord[0]!, chord[2]!]) {
			const at = t0 + i * beat * 0.5;
			tone(ctx, dest, 'triangle', midi(n), at, beat * 1.15, 0.11, 0.02, 0.55);
			tone(ctx, dest, 'sine', midi(n), at, beat * 1.05, 0.05, 0.015, 0.5);
			i++;
		}
	}
	return i * beat * 0.5;
}

function midi(n: number): number {
	return 440 * 2 ** ((n - 69) / 12);
}

const SCHEDULE: Record<TuneId, (ctx: AudioContext, dest: AudioNode, t0: number) => number> = {
	musicbox: scheduleMusicBox,
	lofi: scheduleLofi,
	piano: schedulePiano,
};

/**
 * Play a built-in tune on a running AudioContext.
 * The context should already be resumed from a user gesture.
 */
export function playTune(ctx: AudioContext, id: TuneId, volume = 0.7): TuneHandle {
	const master = ctx.createGain();
	master.gain.value = volume;
	master.connect(ctx.destination);
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const schedule = (when: number) => {
		if (stopped) return;
		const dur = SCHEDULE[id](ctx, master, when);
		const delay = Math.max(50, (when + dur - ctx.currentTime - 0.05) * 1000);
		timer = setTimeout(() => schedule(Math.max(ctx.currentTime + 0.02, when + dur)), delay);
	};
	schedule(ctx.currentTime + 0.04);
	return {
		setMuted(muted) {
			try {
				const now = ctx.currentTime;
				master.gain.cancelScheduledValues(now);
				master.gain.setTargetAtTime(muted ? 0.0001 : volume, now, 0.05);
			} catch {
				/* closing */
			}
		},
		stop() {
			stopped = true;
			if (timer) clearTimeout(timer);
			try {
				const now = ctx.currentTime;
				master.gain.cancelScheduledValues(now);
				master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
				master.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
				setTimeout(() => {
					try {
						master.disconnect();
					} catch {
						/* already torn down */
					}
				}, 250);
			} catch {
				/* closing */
			}
		},
	};
}

export function loadYoutubeApi(): Promise<void> {
	if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
	const w = window as Window & { YT?: { Player: unknown }; onYouTubeIframeAPIReady?: () => void };
	if (w.YT && w.YT.Player) return Promise.resolve();
	return new Promise((resolve, reject) => {
		const prev = w.onYouTubeIframeAPIReady;
		const done = () => {
			if (typeof prev === 'function') prev();
			resolve();
		};
		w.onYouTubeIframeAPIReady = done;
		if (document.querySelector('script[data-yt-api]')) {
			if (w.YT && w.YT.Player) done();
			return;
		}
		const s = document.createElement('script');
		s.src = 'https://www.youtube.com/iframe_api';
		s.async = true;
		s.dataset.ytApi = '1';
		s.onerror = () => reject(new Error('youtube api failed'));
		document.head.appendChild(s);
	});
}
