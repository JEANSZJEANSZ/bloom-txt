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

/** Auto-spin speed in radians per second (a full turn in ~8s). */
export const AUTO_YAW_SPEED = 0.78;
export const SLOW_YAW_SPEED = 0.18;

/** Seconds for a full root-to-bloom grow. */
export const GROW_DURATION = 4.2;
/** How much of the 0–1 growth clock a tap/space skip jumps. */
export const GROW_SKIP = 0.2;
