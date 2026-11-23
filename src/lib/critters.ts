import type { CritterId, CritterPlacement } from './types';

export const CRITTER_IDS: CritterId[] = ['ladybug', 'bee', 'butterfly'];

export const CRITTER_META: { id: CritterId; name: string; blurb: string; preview: string }[] = [
	{ id: 'ladybug', name: 'Ladybug', blurb: 'A tiny red guest that crawls the stems.', preview: '(@)' },
	{ id: 'bee', name: 'Bee', blurb: 'Buzzes a figure-eight around the bunch.', preview: '>o<' },
	{ id: 'butterfly', name: 'Butterfly', blurb: 'Soft wings, a slower loop in the air.', preview: '}o{' },
];

export function isCritterId(v: unknown): v is CritterId {
	return v === 'ladybug' || v === 'bee' || v === 'butterfly';
}

export type CritterGlyph = { dx: number; dy: number; ch: string; color: string };

const RED = '#ff3b3b';
const RED_DIM = '#c42a2a';
const BLACK = '#2a1a14';
const YELLOW = '#ffd24a';
const GOLD = '#f0b429';
const BROWN = '#3a2a10';
const WING = '#fff6c8';
const LILAC = '#c46bff';
const PINK = '#ff8ad4';
const SKY = '#7ad7ff';
const WING_B = '#f4e9ff';

/** Two or three flap / crawl frames, anchored at the body. */
export function critterFrames(id: CritterId): CritterGlyph[][] {
	if (id === 'ladybug') {
		return [
			[
				{ dx: -1, dy: 0, ch: '(', color: RED },
				{ dx: 0, dy: 0, ch: '@', color: BLACK },
				{ dx: 1, dy: 0, ch: ')', color: RED },
			],
			[
				{ dx: -1, dy: 0, ch: '(', color: RED },
				{ dx: 0, dy: 0, ch: ':', color: BLACK },
				{ dx: 1, dy: 0, ch: ')', color: RED_DIM },
			],
			[
				{ dx: -1, dy: 0, ch: '(', color: RED_DIM },
				{ dx: 0, dy: 0, ch: '*', color: BLACK },
				{ dx: 1, dy: 0, ch: ')', color: RED },
			],
		];
	}
	if (id === 'bee') {
		return [
			[
				{ dx: -1, dy: 0, ch: '>', color: WING },
				{ dx: 0, dy: 0, ch: 'o', color: GOLD },
				{ dx: 1, dy: 0, ch: '<', color: WING },
			],
			[
				{ dx: -1, dy: 0, ch: '-', color: YELLOW },
				{ dx: 0, dy: 0, ch: 'o', color: BROWN },
				{ dx: 1, dy: 0, ch: '-', color: YELLOW },
			],
			[
				{ dx: -1, dy: 0, ch: '~', color: WING },
				{ dx: 0, dy: 0, ch: '*', color: GOLD },
				{ dx: 1, dy: 0, ch: '~', color: WING },
			],
		];
	}
	return [
		[
			{ dx: -1, dy: 0, ch: '}', color: LILAC },
			{ dx: 0, dy: 0, ch: 'o', color: PINK },
			{ dx: 1, dy: 0, ch: '{', color: LILAC },
		],
		[
			{ dx: -1, dy: 0, ch: '{', color: SKY },
			{ dx: 0, dy: 0, ch: 'O', color: PINK },
			{ dx: 1, dy: 0, ch: '}', color: SKY },
		],
		[
			{ dx: -1, dy: 0, ch: '\\', color: WING_B },
			{ dx: 0, dy: 0, ch: 'o', color: LILAC },
			{ dx: 1, dy: 0, ch: '/', color: WING_B },
		],
	];
}

export type FlyingKind = 'bee' | 'butterfly';

/** Lemniscate path in XZ, with a gentle vertical bob. World space, not bouquet space. */
export function flyerPose(
	kind: FlyingKind,
	index: number,
	time: number,
): { x: number; y: number; z: number } {
	const phase = index * 1.9 + (kind === 'butterfly' ? 0.7 : 0);
	const speed = kind === 'butterfly' ? 0.42 : 0.72;
	const t = time * speed + phase;
	const w = (kind === 'butterfly' ? 1.22 : 1.08) + (index % 3) * 0.1;
	const y0 = (kind === 'butterfly' ? 1.35 : 1.12) + (index % 3) * 0.16;
	const bob = kind === 'butterfly' ? 0.22 : 0.16;
	return {
		x: w * Math.sin(t),
		y: y0 + bob * Math.sin(t * 2 + phase),
		z: w * Math.sin(t) * Math.cos(t),
	};
}

/** Ping-pong along a stem, with short rests. Returns 0–1 along plus a sit flag. */
export function crawlAlong(index: number, time: number): { along: number; sitting: boolean } {
	const phase = index * 1.3 + 0.2;
	const speed = 0.13 + (index % 3) * 0.03;
	const sit = Math.sin(time * 0.55 + phase) > 0.72;
	const t = time * speed + phase;
	const cycle = t % 2;
	const raw = cycle < 1 ? cycle : 2 - cycle;
	const along = 0.18 + raw * 0.74;
	return { along, sitting: sit };
}

export function flapFrame(id: CritterId, time: number, index: number, sitting = false): number {
	const frames = id === 'ladybug' ? 3 : 3;
	if (id === 'ladybug' && sitting) return 0;
	const hz = id === 'bee' ? 9 : id === 'butterfly' ? 4 : 2.2;
	return Math.floor(time * hz + index * 1.7) % frames;
}

export function normalizeCritters(raw: unknown, cap: number): CritterPlacement[] {
	if (!Array.isArray(raw)) return [];
	const out: CritterPlacement[] = [];
	for (const item of raw) {
		if (out.length >= cap) break;
		const id = typeof item === 'string' ? item : item && typeof item === 'object' && 'id' in item ? (item as { id: unknown }).id : null;
		if (isCritterId(id)) out.push({ id });
	}
	return out;
}
