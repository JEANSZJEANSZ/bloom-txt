import type { RenderStyle } from './types';

export const DEFAULT_STYLE: RenderStyle = '3d';
export const DEFAULT_DETAIL = 100;
/** Lowest grid width the Detail slider will use — large, readable glyphs. */
export const MIN_COLS = 60;

export function isRenderStyle(v: unknown): v is RenderStyle {
	return v === '3d' || v === 'retro';
}

export function styleOf(style?: RenderStyle | null): RenderStyle {
	return style === 'retro' ? 'retro' : DEFAULT_STYLE;
}

export function clampDetail(value: unknown, fallback = DEFAULT_DETAIL): number {
	const n = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.max(0, Math.min(100, Math.round(n)));
}
