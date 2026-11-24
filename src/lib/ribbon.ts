import { COLOR_ORDER, PETAL } from './palette';
import type { ColorId } from './types';

/** Flower colours plus a few extra ribbon-y tones. Default is the classic pink bow. */
export type RibbonId = ColorId | 'cream' | 'gold' | 'black';

export type RibbonTone = {
	bright: string;
	mid: string;
	dim: string;
	name: string;
	midInt: number;
	brightInt: number;
};

export const DEFAULT_RIBBON: RibbonId = 'pink';

export const RIBBON_ORDER: RibbonId[] = [...COLOR_ORDER, 'cream', 'gold', 'black'];

function hexToInt(hex: string): number {
	return parseInt(hex.replace('#', ''), 16) | 0;
}

function tone(bright: string, mid: string, dim: string, name: string): RibbonTone {
	return { bright, mid, dim, name, midInt: hexToInt(mid), brightInt: hexToInt(bright) };
}

/** Pink keeps the original bow so older gifts do not change colour. */
export const RIBBON: Record<RibbonId, RibbonTone> = {
	red: tone(PETAL.red.bright, PETAL.red.mid, PETAL.red.dim, 'red'),
	orange: tone(PETAL.orange.bright, PETAL.orange.mid, PETAL.orange.dim, 'orange'),
	yellow: tone(PETAL.yellow.bright, PETAL.yellow.mid, PETAL.yellow.dim, 'yellow'),
	green: tone(PETAL.green.bright, PETAL.green.mid, PETAL.green.dim, 'green'),
	blue: tone(PETAL.blue.bright, PETAL.blue.mid, PETAL.blue.dim, 'blue'),
	purple: tone(PETAL.purple.bright, PETAL.purple.mid, PETAL.purple.dim, 'purple'),
	magenta: tone(PETAL.magenta.bright, PETAL.magenta.mid, PETAL.magenta.dim, 'magenta'),
	pink: tone('#ffd0e6', '#ff9cc8', '#e05690', 'pink'),
	white: tone('#ffffff', '#f6f3ec', '#c9c3b6', 'white'),
	cream: tone('#fff6e4', '#f0d9b0', '#c9a97a', 'cream'),
	gold: tone('#f0d36a', '#d4a017', '#8a6a10', 'gold'),
	black: tone('#5c5c64', '#2a2a2e', '#141416', 'black'),
};

export function isRibbonId(v: unknown): v is RibbonId {
	return typeof v === 'string' && v in RIBBON;
}

export function ribbonOf(v: unknown): RibbonId {
	return isRibbonId(v) ? v : DEFAULT_RIBBON;
}
