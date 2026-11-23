import { INKS, STEM } from './palette';
import type { Tip } from './stems';
import type { Grid } from './types';

function empty(grid: Grid, x: number, y: number): boolean {
	return y >= 0 && x >= 0 && y < grid.length && x < (grid[0]?.length ?? 0) && grid[y][x] === null;
}

function put(grid: Grid, x: number, y: number, ch: string, color: string, kind: 'sparkle' | 'heart') {
	if (!empty(grid, x, y)) return;
	grid[y][x] = { ch, color, kind };
}

const PLUS = [
	{ dx: 0, dy: -1, ch: '|', color: INKS.cyan },
	{ dx: -1, dy: 0, ch: '-', color: INKS.cyan },
	{ dx: 0, dy: 0, ch: '+', color: INKS.cyan },
	{ dx: 1, dy: 0, ch: '-', color: INKS.cyan },
	{ dx: 0, dy: 1, ch: '|', color: INKS.cyan },
] as const;

export function drawSparkles(grid: Grid, tips: Tip[], rng: () => number, twinkle = 0) {
	const rows = grid.length;
	const cols = grid[0]?.length ?? 0;

	// A handful of four-pointed cyan stars, like the inspiration video.
	const plusCount = 3 + (tips.length > 0 ? 2 : 0);
	for (let i = 0; i < plusCount; i++) {
		const x = 3 + Math.floor(rng() * (cols - 6));
		const y = 1 + Math.floor(rng() * Math.max(4, Math.floor(rows * 0.55)));
		if ([...PLUS].every((p) => empty(grid, x + p.dx, y + p.dy))) {
			const on = twinkle === 0 || (i + twinkle) % 2 === 0;
			if (on) {
				for (const p of PLUS) put(grid, x + p.dx, y + p.dy, p.ch, p.color, 'sparkle');
			}
		}
	}

	const singles: { ch: string; color: string; kind: 'sparkle' | 'heart' }[] = [
		{ ch: '*', color: INKS.gold, kind: 'sparkle' },
		{ ch: '*', color: INKS.cyan, kind: 'sparkle' },
		{ ch: '+', color: STEM.leaf, kind: 'sparkle' },
		{ ch: '+', color: INKS.gold, kind: 'sparkle' },
		{ ch: '.', color: INKS.mint, kind: 'sparkle' },
		{ ch: '.', color: INKS.blush, kind: 'sparkle' },
		{ ch: "'", color: INKS.cyan, kind: 'sparkle' },
		{ ch: 'v', color: INKS.heart, kind: 'sparkle' },
		{ ch: '*', color: INKS.blush, kind: 'sparkle' },
	];

	const scatter = 18 + tips.length * 2;
	for (let i = 0; i < scatter; i++) {
		const x = 1 + Math.floor(rng() * (cols - 2));
		const y = Math.floor(rng() * (rows - 3));
		const glyph = singles[Math.floor(rng() * singles.length)];
		if (twinkle && i % 5 === twinkle % 5 && glyph.ch === '.') continue;
		put(grid, x, y, glyph.ch, glyph.color, glyph.kind);
	}

	// A few <3 hearts tucked in the margins.
	const hearts = 2 + (tips.length >= 4 ? 1 : 0) + (tips.length >= 8 ? 1 : 0);
	for (let i = 0; i < hearts; i++) {
		const x = rng() < 0.5 ? 2 + Math.floor(rng() * 10) : cols - 12 + Math.floor(rng() * 8);
		const y = 2 + Math.floor(rng() * Math.floor(rows * 0.6));
		if (empty(grid, x, y) && empty(grid, x + 1, y)) {
			put(grid, x, y, '<', INKS.heart, 'heart');
			put(grid, x + 1, y, '3', INKS.heart, 'heart');
		}
	}
}
