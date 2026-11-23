import { TERMINAL_BG } from './palette';
import { INKS } from './palette';
import type { Grid } from './types';

const FONT_STACK = '"IBM Plex Mono", "IBMPlexMono", ui-monospace, monospace';

export async function waitForFonts(): Promise<void> {
	if (typeof document === 'undefined' || !document.fonts?.ready) return;
	try {
		await document.fonts.ready;
	} catch {
		/* continue */
	}
}

export type DrawMetrics = {
	fontSize: number;
	lineHeight: number;
	charW: number;
	padX: number;
	padY: number;
	noteGap: number;
	width: number;
	height: number;
};

export function measureGrid(
	ctx: CanvasRenderingContext2D,
	cols: number,
	rows: number,
	cssWidth: number,
	note: string,
): DrawMetrics {
	const padX = Math.max(8, Math.round(cssWidth * 0.03));
	const padY = 12;
	const noteGap = note.trim() ? 26 : 8;
	const target = Math.max(40, cssWidth - padX * 2);
	let fontSize = 12;
	ctx.font = `${fontSize}px ${FONT_STACK}`;
	let charW = ctx.measureText('M').width || fontSize * 0.6;
	fontSize = fontSize * (target / Math.max(1, charW * cols));
	fontSize = Math.max(3.5, Math.min(28, fontSize));
	ctx.font = `${fontSize}px ${FONT_STACK}`;
	charW = ctx.measureText('M').width || fontSize * 0.6;
	const lineHeight = fontSize * 1.05;
	const width = Math.ceil(padX * 2 + charW * cols);
	const height = Math.ceil(padY * 2 + lineHeight * rows + noteGap);
	return { fontSize, lineHeight, charW, padX, padY, noteGap, width, height };
}

const batches = new Map<string, (number | string)[]>();

export function drawGrid(
	ctx: CanvasRenderingContext2D,
	grid: Grid,
	note: string,
	metrics: DrawMetrics,
	flicker = 1,
): void {
	const { fontSize, lineHeight, charW, padX, padY, width, height } = metrics;
	const rows = grid.length;
	const cols = grid[0]?.length ?? 0;

	ctx.fillStyle = TERMINAL_BG;
	ctx.fillRect(0, 0, width, height);

	const g = ctx.createRadialGradient(
		width / 2,
		height / 2,
		Math.min(width, height) * 0.2,
		width / 2,
		height * 0.55,
		Math.max(width, height) * 0.7,
	);
	g.addColorStop(0, 'rgba(0,0,0,0)');
	g.addColorStop(1, 'rgba(0,0,0,0.28)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, width, height);

	ctx.save();
	ctx.globalAlpha = flicker;
	ctx.font = `${fontSize}px ${FONT_STACK}`;
	ctx.textBaseline = 'top';
	ctx.textAlign = 'left';

	// Batch by color: thousands of cells, but only a few hundred distinct shades.
	batches.clear();
	for (let y = 0; y < rows; y++) {
		const row = grid[y];
		for (let x = 0; x < cols; x++) {
			const cell = row[x];
			if (!cell) continue;
			let b = batches.get(cell.color);
			if (!b) {
				b = [];
				batches.set(cell.color, b);
			}
			b.push(x, y, cell.ch);
		}
	}
	for (const [color, b] of batches) {
		ctx.fillStyle = color;
		for (let i = 0; i < b.length; i += 3) {
			ctx.fillText(b[i + 2] as string, padX + (b[i] as number) * charW, padY + (b[i + 1] as number) * lineHeight);
		}
	}

	if (note.trim()) {
		ctx.fillStyle = INKS.note;
		ctx.globalAlpha = flicker * 0.82;
		ctx.textAlign = 'center';
		ctx.fillText(note.trim(), width / 2, padY + rows * lineHeight + 8);
	}
	ctx.restore();
}

/* ------------------------------------------------------------------------
 * Fast path for dense grids: glyphs are rasterised once into alpha masks and
 * blitted into an ImageData with per-cell colour, instead of thousands of
 * fillText calls per frame. Each surface cell also gets a dim fill of its own
 * colour so petals read as solid shaded surfaces with ASCII texture on top.
 * --------------------------------------------------------------------- */

type GlyphAtlas = {
	key: string;
	cw: number;
	ch: number;
	masks: Map<string, Uint8Array>;
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	fontPx: number;
};

type FrameBuf = {
	key: string;
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	img: ImageData;
	px: Uint32Array;
	bg: Uint32Array;
	w: number;
	h: number;
};

const atlases = new Map<string, GlyphAtlas>();
const frameBufs = new Map<string, FrameBuf>();
const hexInt = new Map<string, number>();

function colorInt(c: string): number {
	let v = hexInt.get(c);
	if (v === undefined) {
		v = c.startsWith('#') && c.length === 7 ? parseInt(c.slice(1), 16) : 0xdddddd;
		hexInt.set(c, v);
	}
	return v;
}

function getAtlas(fontPx: number, cw: number, ch: number): GlyphAtlas {
	const key = `${fontPx.toFixed(2)}|${cw}|${ch}`;
	const hit = atlases.get(key);
	if (hit) return hit;
	if (atlases.size > 4) atlases.clear();
	const canvas = document.createElement('canvas');
	canvas.width = cw;
	canvas.height = ch;
	const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
	const made: GlyphAtlas = { key, cw, ch, masks: new Map(), canvas, ctx, fontPx };
	atlases.set(key, made);
	return made;
}

function glyphMask(a: GlyphAtlas, glyph: string): Uint8Array {
	let m = a.masks.get(glyph);
	if (m) return m;
	const { ctx, cw, ch } = a;
	ctx.clearRect(0, 0, cw, ch);
	ctx.font = `600 ${a.fontPx}px ${FONT_STACK}`;
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'center';
	ctx.fillStyle = '#fff';
	ctx.fillText(glyph, cw / 2, ch / 2 + 0.5);
	const data = ctx.getImageData(0, 0, cw, ch).data;
	m = new Uint8Array(cw * ch);
	for (let i = 0; i < m.length; i++) m[i] = data[i * 4 + 3];
	a.masks.set(glyph, m);
	return m;
}

function getFrameBuf(w: number, h: number, metrics: DrawMetrics, scale: number): FrameBuf {
	const key = `${w}x${h}|${metrics.width}x${metrics.height}`;
	const hit = frameBufs.get(key);
	if (hit) return hit;
	if (frameBufs.size > 3) frameBufs.clear();
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
	ctx.setTransform(scale, 0, 0, scale, 0, 0);
	ctx.fillStyle = TERMINAL_BG;
	ctx.fillRect(0, 0, metrics.width, metrics.height);
	const g = ctx.createRadialGradient(
		metrics.width / 2,
		metrics.height / 2,
		Math.min(metrics.width, metrics.height) * 0.2,
		metrics.width / 2,
		metrics.height * 0.55,
		Math.max(metrics.width, metrics.height) * 0.7,
	);
	g.addColorStop(0, 'rgba(0,0,0,0)');
	g.addColorStop(1, 'rgba(0,0,0,0.28)');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, metrics.width, metrics.height);
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	const bgImg = ctx.getImageData(0, 0, w, h);
	const bg = new Uint32Array(bgImg.data.buffer.slice(0));
	const img = ctx.createImageData(w, h);
	const made: FrameBuf = { key, canvas, ctx, img, px: new Uint32Array(img.data.buffer), bg, w, h };
	frameBufs.set(key, made);
	return made;
}

const FILL_KINDS = new Set(['flower', 'stem', 'leaf', 'critter']);

/**
 * Draw a dense grid via a glyph atlas. `pixelScale` is the backing-store scale
 * (device pixels per CSS pixel); it is capped so a frame stays cheap.
 */
export function drawGridFast(
	ctx: CanvasRenderingContext2D,
	grid: Grid,
	note: string,
	metrics: DrawMetrics,
	flicker = 1,
	pixelScale = 1,
): void {
	const { fontSize, lineHeight, charW, padX, padY, width, height } = metrics;
	const rows = grid.length;
	const cols = grid[0]?.length ?? 0;
	// Blit straight into the target when its backing store matches; otherwise
	// render at a capped resolution and scale it in.
	const direct =
		ctx.canvas.width === Math.round(width * pixelScale) && ctx.canvas.height === Math.round(height * pixelScale);
	const d = direct ? pixelScale : Math.max(1, Math.min(pixelScale, Math.sqrt(2.4e6 / Math.max(1, width * height))));
	const W = direct ? ctx.canvas.width : Math.max(1, Math.round(width * d));
	const H = direct ? ctx.canvas.height : Math.max(1, Math.round(height * d));
	const fb = getFrameBuf(W, H, metrics, d);
	const cw = Math.max(1, Math.ceil(charW * d));
	const chh = Math.max(1, Math.ceil(lineHeight * d));
	const a = getAtlas(fontSize * d, cw, chh);
	const px = fb.px;
	px.set(fb.bg);
	const le = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

	for (let y = 0; y < rows; y++) {
		const row = grid[y];
		const y0 = Math.round((padY + y * lineHeight) * d);
		if (y0 >= H) break;
		for (let x = 0; x < cols; x++) {
			const cell = row[x];
			if (!cell) continue;
			const x0 = Math.round((padX + x * charW) * d);
			if (x0 >= W) continue;
			const rgb = cell.rgb ?? colorInt(cell.color);
			const r = (rgb >> 16) & 255;
			const g = (rgb >> 8) & 255;
			const b = rgb & 255;
			const fill = FILL_KINDS.has(cell.kind);
			const mask = glyphMask(a, cell.ch);
			const yMax = Math.min(chh, H - y0);
			const xMax = Math.min(cw, W - x0);
			for (let yy = 0; yy < yMax; yy++) {
				let o = (y0 + yy) * W + x0;
				let mo = yy * cw;
				for (let xx = 0; xx < xMax; xx++, o++, mo++) {
					const al = mask[mo];
					const p = px[o];
					let pr: number;
					let pg: number;
					let pb: number;
					if (le) {
						pr = p & 255;
						pg = (p >> 8) & 255;
						pb = (p >> 16) & 255;
					} else {
						pr = (p >>> 24) & 255;
						pg = (p >> 16) & 255;
						pb = (p >> 8) & 255;
					}
					if (fill) {
						pr = pr * 0.55 + r * 0.45;
						pg = pg * 0.55 + g * 0.45;
						pb = pb * 0.55 + b * 0.45;
					} else if (!al) continue;
					if (al) {
						const t = al / 255;
						pr += (r - pr) * t;
						pg += (g - pg) * t;
						pb += (b - pb) * t;
					}
					px[o] = le
						? (0xff000000 | ((pb & 255) << 16) | ((pg & 255) << 8) | (pr & 255)) >>> 0
						: ((((pr & 255) << 24) | ((pg & 255) << 16) | ((pb & 255) << 8) | 0xff) >>> 0);
				}
			}
		}
	}
	ctx.save();
	if (direct) {
		ctx.putImageData(fb.img, 0, 0);
		if (flicker < 1) {
			ctx.fillStyle = `rgba(11,14,20,${(1 - flicker).toFixed(3)})`;
			ctx.fillRect(0, 0, width, height);
		}
	} else {
		fb.ctx.putImageData(fb.img, 0, 0);
		ctx.fillStyle = TERMINAL_BG;
		ctx.fillRect(0, 0, width, height);
		ctx.globalAlpha = flicker;
		ctx.imageSmoothingEnabled = true;
		ctx.drawImage(fb.canvas, 0, 0, width, height);
	}
	if (note.trim()) {
		ctx.font = `${Math.max(9, Math.min(13, width / 70))}px ${FONT_STACK}`;
		ctx.textBaseline = 'top';
		ctx.fillStyle = INKS.note;
		ctx.globalAlpha = flicker * 0.82;
		ctx.textAlign = 'center';
		ctx.fillText(note.trim(), width / 2, padY + rows * lineHeight + 8);
	}
	ctx.restore();
}
