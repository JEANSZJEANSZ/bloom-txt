import { CRITTER_IDS } from './critters';
import { FLOWER_IDS, FLOWER_BY_ID } from './flowers';
import type { ColorId, CritterPlacement, FlowerId, Placement } from './types';

const PALETTES: Record<string, ColorId[]> = {
	meadow: ['red', 'orange', 'yellow', 'blue', 'purple', 'pink', 'white', 'magenta'],
	sunset: ['red', 'orange', 'yellow', 'pink', 'magenta'],
	moonlight: ['white', 'blue', 'purple', 'pink'],
	sweetheart: ['red', 'pink', 'magenta', 'white'],
	spring: ['pink', 'yellow', 'white', 'purple', 'blue'],
	wild: ['orange', 'purple', 'yellow', 'blue', 'red', 'pink', 'magenta', 'white'],
};

const NAMES = Object.keys(PALETTES);

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

export function surpriseBouquet(count?: number): Placement[] {
	const n = count ?? 7 + Math.floor(Math.random() * 5); // 7–11
	const palette = PALETTES[pick(NAMES)];
	const flowers: Placement[] = [];
	// Guarantee a bit of variety — don't repeat a type until we've used several.
	const bag: FlowerId[] = [];
	while (bag.length < n) {
		const shuffled = [...FLOWER_IDS].sort(() => Math.random() - 0.5);
		bag.push(...shuffled);
	}
	for (let i = 0; i < n; i++) {
		const id = bag[i];
		const fallback = FLOWER_BY_ID[id].defaultColor;
		const color = Math.random() < 0.55 ? pick(palette) : palette.includes(fallback) ? fallback : pick(palette);
		flowers.push({ id, color });
	}
	return flowers;
}

export function surpriseCritters(count?: number): CritterPlacement[] {
	const n = count ?? 1 + Math.floor(Math.random() * 3);
	const bag = [...CRITTER_IDS, 'bee', 'ladybug'] as const;
	const out: CritterPlacement[] = [];
	for (let i = 0; i < n; i++) {
		out.push({ id: bag[Math.floor(Math.random() * bag.length)] });
	}
	return out;
}
