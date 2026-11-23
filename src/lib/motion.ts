import { clampDetail, DEFAULT_DETAIL, MIN_COLS } from './look';
import type { RenderStyle } from './types';

export { DEFAULT_DETAIL, MIN_COLS };

export function prefersReducedMotion(): boolean {
	return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Dense character grid for the shaded 3D renderer. Small glyphs make the
 * per-cell lighting read as a surface; sizes are capped to keep each frame
 * well inside a 60fps budget on phones.
 */
export function preferredGrid(width?: number, height?: number): { cols: number; rows: number } {
	const w = width ?? (typeof window !== 'undefined' ? window.innerWidth : 1200);
	const h = height ?? (typeof window !== 'undefined' ? window.innerHeight : 900);
	if (w < 640) return { cols: 150, rows: h < 640 ? 84 : 100 };
	if (h < 700) return { cols: 220, rows: 124 };
	return { cols: 260, rows: 164 };
}

/** Sprite-renderer grid at the fine end of the Detail slider. A little denser than the original 85×42, same wide aspect. */
export function preferredRetroGrid(width?: number, height?: number): { cols: number; rows: number } {
	const w = width ?? (typeof window !== 'undefined' ? window.innerWidth : 1200);
	const h = height ?? (typeof window !== 'undefined' ? window.innerHeight : 900);
	if (w < 640) return { cols: 110, rows: h < 640 ? 48 : 56 };
	if (h < 700) return { cols: 128, rows: 52 };
	return { cols: 140, rows: 68 };
}

const RETRO_MIN_COLS = 48;

/**
 * Grid size for a 0–100 detail setting.
 * 3D: 100 matches `preferredGrid`; 0 is about 60 columns, same aspect.
 * Retro: 0 is about 48 columns (chunky sprites); 100 is `preferredRetroGrid`.
 * Auto-fit still has the same margins at every step.
 */
export function gridForDetail(
	detail: number = DEFAULT_DETAIL,
	width?: number,
	height?: number,
	style: RenderStyle = '3d',
): { cols: number; rows: number } {
	const retro = style === 'retro';
	const max = retro ? preferredRetroGrid(width, height) : preferredGrid(width, height);
	const minCols = retro ? RETRO_MIN_COLS : MIN_COLS;
	const t = clampDetail(detail) / 100;
	if (t >= 1) return { cols: max.cols, rows: max.rows };
	const cols = Math.round(minCols + (max.cols - minCols) * t);
	const rows = Math.max(18, Math.round(max.rows * (cols / max.cols)));
	return { cols, rows };
}

/** Auto-spin speed in radians per second (a full turn in ~8s). */
export const AUTO_YAW_SPEED = 0.78;
export const SLOW_YAW_SPEED = 0.18;

/** Seconds for a full root-to-bloom grow. */
export const GROW_DURATION = 4.2;
/** How much of the 0–1 growth clock a tap/space skip jumps. */
export const GROW_SKIP = 0.2;
