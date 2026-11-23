import type { CenterStyle, ColorId, ColorRole } from './types';

export const TERMINAL_BG = '#0b0e14';

export const STEM = {
	bright: '#3ee66b',
	mid: '#2bc85a',
	dim: '#1e8a3f',
	leaf: '#7dff9a',
	vein: '#b8ffc8',
} as const;

export const PETAL: Record<ColorId, { bright: string; mid: string; dim: string; name: string }> = {
	red: { bright: '#ff4d5c', mid: '#ff3b4a', dim: '#d91f3a', name: 'red' },
	orange: { bright: '#ff9f3d', mid: '#ff8a1f', dim: '#e06a00', name: 'orange' },
	yellow: { bright: '#ffe87a', mid: '#ffe14a', dim: '#e0b800', name: 'yellow' },
	green: { bright: '#6dff8e', mid: '#3ee66b', dim: '#1e8a3f', name: 'green' },
	blue: { bright: '#7cbcff', mid: '#4da3ff', dim: '#2a74d4', name: 'blue' },
	purple: { bright: '#c894ff', mid: '#b46bff', dim: '#7d3fd4', name: 'purple' },
	magenta: { bright: '#ff79de', mid: '#ff4dcf', dim: '#d41fa3', name: 'magenta' },
	pink: { bright: '#ffb3e0', mid: '#ff8ad4', dim: '#e056a0', name: 'pink' },
	white: { bright: '#ffffff', mid: '#f6f3ec', dim: '#c9c3b6', name: 'white' },
};

export const INKS = {
	gold: '#ffc53d',
	goldHot: '#ffe14a',
	brown: '#6b3a1f',
	brownHot: '#8b5a2b',
	dark: '#2a1210',
	darkHot: '#4a2018',
	cream: '#fff4d6',
	cyan: '#5ce1ff',
	mint: '#b8ffc8',
	blush: '#ffb7d5',
	note: '#f0a0c0',
	heart: '#ff6b9d',
} as const;

export const COLOR_ORDER: ColorId[] = [
	'red',
	'orange',
	'yellow',
	'green',
	'blue',
	'purple',
	'magenta',
	'pink',
	'white',
];

export function resolveRoles(petal: ColorId, centerStyle: CenterStyle): Record<ColorRole, string> {
	const p = PETAL[petal];
	let center: string = INKS.gold;
	let centerHot: string = INKS.goldHot;
	switch (centerStyle) {
		case 'gold':
			center = INKS.gold;
			centerHot = INKS.goldHot;
			break;
		case 'yellow':
			center = PETAL.yellow.mid;
			centerHot = PETAL.yellow.bright;
			break;
		case 'brown':
			center = INKS.brown;
			centerHot = INKS.brownHot;
			break;
		case 'dark':
			center = INKS.dark;
			centerHot = INKS.darkHot;
			break;
		case 'warm':
			center = p.dim;
			centerHot = INKS.gold;
			break;
		case 'white':
			center = PETAL.white.mid;
			centerHot = '#ffffff';
			break;
	}
	if ((centerStyle === 'yellow' || centerStyle === 'gold') && petal === 'yellow') {
		center = INKS.brown;
		centerHot = INKS.gold;
	}
	return {
		petal: p.mid,
		petalDim: p.dim,
		center,
		centerHot,
		stamen: INKS.gold,
		leaf: STEM.leaf,
		accent: petal === 'white' ? INKS.gold : PETAL.white.mid,
	};
}

/** Multiply a #rrggbb color by a 0–1 light factor (for depth shading). */
const shadeHexCache = new Map<string, string>();

export function shadeHex(hex: string, light: number): string {
	// Quantised and cached: called for every star/particle/critter glyph each frame.
	const t = Math.round(Math.max(0, Math.min(1.4, light)) * 64) / 64;
	const key = hex + t;
	const hit = shadeHexCache.get(key);
	if (hit) return hit;
	if (shadeHexCache.size > 4000) shadeHexCache.clear();
	const out = shadeHexRaw(hex, t);
	shadeHexCache.set(key, out);
	return out;
}

function shadeHexRaw(hex: string, t: number): string {
	const h = hex.startsWith('#') ? hex.slice(1) : hex;
	if (h.length !== 6) return hex;
	const n = parseInt(h, 16);
	const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * t)));
	const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * t)));
	const b = Math.max(0, Math.min(255, Math.round((n & 255) * t)));
	return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
