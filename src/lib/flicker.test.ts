import { describe, expect, it } from 'vitest';
import { DEFAULT_FLOWERS } from './defaults';
import { renderBouquet } from './render';
import { renderBouquet as renderRetro } from './renderRetro';
import type { Grid } from './types';

const luma = (rgb?: number) =>
	rgb === undefined ? 0 : ((rgb >> 16) & 255) * 0.3 + ((rgb >> 8) & 255) * 0.59 + (rgb & 255) * 0.11;

/**
 * Turn the bouquet at the studio's auto-spin speed (60 fps) and count flower
 * cells that flash: A → B → A over three consecutive frames. Smooth motion
 * changes a cell once; flicker changes it and changes it back.
 */
function flicker(render: typeof renderBouquet, cols: number, rows: number, frames = 40) {
	const grids: Grid[] = [];
	let yaw = 0.15;
	let time = 3;
	for (let f = 0; f < frames; f++) {
		grids.push(render({ flowers: DEFAULT_FLOWERS, complete: true, yaw, time, sway: true, particles: false, cols, rows }).grid);
		yaw += 0.78 / 60;
		time += 1 / 60;
	}
	let cells = 0;
	let visible = 0;
	let flashes = 0;
	for (let f = 1; f < frames - 1; f++) {
		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				const a = grids[f - 1][y][x];
				const b = grids[f][y][x];
				const c = grids[f + 1][y][x];
				if (!a || !b || !c || (a.kind !== 'flower' && b.kind !== 'flower')) continue;
				cells++;
				const ka = a.ch + a.color + a.kind;
				if (ka !== c.ch + c.color + c.kind || ka === b.ch + b.color + b.kind) continue;
				const dl = Math.abs(luma(a.rgb) - luma(b.rgb));
				if (dl > 8 || a.ch !== b.ch) visible++;
				if (dl > 25) flashes++;
			}
		}
	}
	return { visiblePct: (100 * visible) / cells, flashPct: (100 * flashes) / cells };
}

describe('shading stays steady while the bouquet turns', () => {
	it('3D: petals do not flash between frames', () => {
		// Before the fix (winner-takes-all splats + in-place gap fill):
		// visible ≈ 3.4%, flashes ≈ 0.43% at 150×100.
		const m = flicker(renderBouquet, 150, 100);
		expect(m.flashPct).toBeLessThan(0.12);
		expect(m.visiblePct).toBeLessThan(1.8);
	});

	it('retro: sprite shading does not flash between frames', () => {
		const m = flicker(renderRetro as typeof renderBouquet, 140, 68);
		expect(m.flashPct).toBeLessThan(0.05);
		expect(m.visiblePct).toBeLessThan(1);
	});
});
