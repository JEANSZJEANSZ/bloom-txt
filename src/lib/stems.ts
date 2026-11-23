import { flowerHeight, flowerWidth } from './flowers';
import { STEM } from './palette';
import type { Cell, Grid, Placement } from './types';
import { COLS, ROWS } from './types';

export type Tip = { x: number; y: number };

export function emptyGrid(cols = COLS, rows = ROWS): Grid {
	return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
}

function put(grid: Grid, x: number, y: number, ch: string, color: string, kind: Cell['kind']) {
	const rows = grid.length;
	const cols = grid[0]?.length ?? 0;
	if (x < 0 || y < 0 || x >= cols || y >= rows) return;
	const existing = grid[y][x];
	if (existing && (existing.kind === 'flower' || existing.kind === 'heart')) return;
	grid[y][x] = { ch, color, kind };
}

function stemChar(dx: number, dy: number): string {
	if (dy === 0) return '_';
	const slope = dx / Math.abs(dy);
	if (Math.abs(slope) < 0.25) return '|';
	return slope > 0 ? '/' : '\\';
}

function plotLine(
	grid: Grid,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	rng: () => number,
	bright = false,
) {
	const dx = Math.abs(x1 - x0);
	const sx = x0 < x1 ? 1 : -1;
	const dy = -Math.abs(y1 - y0);
	const sy = y0 < y1 ? 1 : -1;
	let err = dx + dy;
	let x = x0;
	let y = y0;
	const total = Math.max(dx, Math.abs(y1 - y0), 1);
	let step = 0;

	while (true) {
		const t = step / total;
		const color = bright
			? t > 0.65
				? STEM.bright
				: STEM.mid
			: t < 0.2
				? STEM.dim
				: t > 0.8
					? STEM.bright
					: STEM.mid;
		put(grid, x, y, stemChar(x1 - x0, y1 - y0), color, 'stem');

		if (rng() < 0.035 && t > 0.3 && t < 0.85) {
			const leaf = rng() < 0.4 ? '~' : rng() < 0.5 ? 'j' : 'r';
			put(grid, x + (rng() < 0.5 ? -1 : 1), y, leaf, STEM.leaf, 'leaf');
		}

		if (x === x1 && y === y1) break;
		const e2 = 2 * err;
		if (e2 >= dy) {
			err += dy;
			x += sx;
		}
		if (e2 <= dx) {
			err += dx;
			y += sy;
		}
		step++;
	}
}

export function placeTips(flowers: Placement[], rng: () => number, cols = COLS, rows = ROWS): Tip[] {
	const n = flowers.length;
	const originX = Math.floor(cols / 2);
	const originY = rows - 2;
	if (n === 0) return [];

	const margin = 7;
	const left = margin;
	const right = cols - 1 - margin;

	const tips: Tip[] = flowers.map((f, i) => {
		const t = n === 1 ? 0.5 : i / (n - 1);
		const head = flowerHeight(f.id);
		const halfW = Math.ceil(flowerWidth(f.id) / 2);

		// Even horizontal spread, tightened a little so wide blooms stay on the page.
		let x = left + t * (right - left);
		x += (rng() - 0.5) * 1.6;
		x = Math.round(Math.max(halfW + 1, Math.min(cols - halfW - 2, x)));

		// Scalloped canopy: generally taller in the center, alternating high/low
		// so large neighboring blooms don't sit on top of each other.
		const dome = Math.sin(t * Math.PI);
		const alternate = i % 2 === 0 ? 0.1 : -0.1;
		const wobble = (rng() - 0.5) * 0.05;
		let frac = 0.62 + 0.26 * dome + alternate + wobble;

		// Large statement blooms stay in the canopy; smaller ones may sit deeper
		// in the fan, like the tucked flower in the inspiration bouquet.
		const compact = f.id === 'lavender' || f.id === 'violet' || f.id === 'forgetmenot' || f.id === 'daisy' || f.id === 'cornflower';
		if (n >= 6 && compact && i > 0 && i < n - 1 && (i === Math.floor(n * 0.3) || i === Math.floor(n * 0.65))) {
			frac = Math.min(frac, 0.52 + rng() * 0.05);
		}

		frac = Math.max(0.4, Math.min(0.96, frac));
		const available = originY - head - 1;
		let y = Math.round(originY - available * frac);
		y = Math.max(head, Math.min(originY - 4, y));
		return { x, y };
	});

	// If two adjacent blooms still share too much of a row, nudge the lower one down.
	for (let pass = 0; pass < 3; pass++) {
		for (let i = 1; i < n; i++) {
			const a = flowers[i - 1];
			const b = flowers[i];
			const overlapX =
				Math.min(tips[i - 1].x + flowerWidth(a.id) / 2, tips[i].x + flowerWidth(b.id) / 2) -
				Math.max(tips[i - 1].x - flowerWidth(a.id) / 2, tips[i].x - flowerWidth(b.id) / 2);
			if (overlapX < 3) continue;
			const ay0 = tips[i - 1].y - flowerHeight(a.id);
			const by0 = tips[i].y - flowerHeight(b.id);
			const overlapY =
				Math.min(tips[i - 1].y, tips[i].y) - Math.max(ay0, by0);
			if (overlapY > Math.min(flowerHeight(a.id), flowerHeight(b.id)) * 0.45) {
				const cap = 5;
				if (tips[i].y >= tips[i - 1].y) {
					tips[i].y = Math.min(originY - 6, tips[i].y + Math.min(cap, Math.ceil(overlapY * 0.4)));
				} else {
					tips[i - 1].y = Math.min(originY - 6, tips[i - 1].y + Math.min(cap, Math.ceil(overlapY * 0.4)));
				}
			}
		}
	}

	return tips;
}

export function drawStems(grid: Grid, tips: Tip[], rng: () => number) {
	const rows = grid.length;
	const cols = grid[0]?.length ?? 0;
	const ox = Math.floor(cols / 2);
	const oy = rows - 2;

	put(grid, ox, oy, 'v', STEM.bright, 'stem');
	put(grid, ox, oy + 1, '.', STEM.dim, 'stem');

	if (tips.length === 0) {
		plotLine(grid, ox, oy, ox, oy - 6, rng, true);
		put(grid, ox, oy - 7, ',', STEM.leaf, 'leaf');
		return;
	}

	const leftmost = Math.min(...tips.map((t) => t.x));
	const rightmost = Math.max(...tips.map((t) => t.x));
	const tallest = Math.min(...tips.map((t) => t.y));

	// Estimate the canopy height at any x by blending nearby tips, then
	// filling a dense fan from the origin up to that scalloped edge.
	const canopyY = (x: number) => {
		let best = tallest + 6;
		let bestDist = Infinity;
		for (const tip of tips) {
			const d = Math.abs(tip.x - x);
			const y = tip.y + d * 0.08;
			if (d < bestDist) {
				bestDist = d;
				best = y;
			}
		}
		// A little extra length in the middle of the triangle.
		const t = (x - leftmost) / Math.max(1, rightmost - leftmost);
		const dome = Math.sin(Math.max(0, Math.min(1, t)) * Math.PI);
		return best - dome * 1.2;
	};

	const fillers = Math.max(64, Math.min(140, (rightmost - leftmost) * 2 + 24));
	for (let i = 0; i < fillers; i++) {
		const t = fillers === 1 ? 0.5 : i / (fillers - 1);
		const x = leftmost - 1 + t * (rightmost - leftmost + 2);
		const jitter = (rng() - 0.5) * 1.2;
		const x1 = Math.round(x + jitter);
		const y1 = Math.round(canopyY(x1) + (rng() - 0.5) * 2);
		plotLine(grid, ox, oy, x1, Math.max(tallest - 1, Math.min(oy - 3, y1)), rng, false);
	}

	for (const tip of tips) {
		plotLine(grid, ox, oy, tip.x, tip.y, rng, true);
	}
}

export function originOf(cols = COLS, rows = ROWS): Tip {
	return { x: Math.floor(cols / 2), y: rows - 2 };
}
