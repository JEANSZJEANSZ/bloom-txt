import { bez, bezTangent, buildScene3, densityFor, KIND_FLOWER, KIND_LEAF, KIND_RIBBON, KIND_STEM, type Scene3 } from './bouquet3d';
import { DEFAULT_RIBBON, ribbonOf, type RibbonId } from './ribbon';
import { crawlAlong, critterFrames, flapFrame, flyerPose } from './critters';
import { OPEN_KEYS, SLOT_ANTHER, SLOT_FILAMENT } from './flora3d';
import { frameCount } from './flowers';
import { shadeHex, TERMINAL_BG } from './palette';
import { mulberry32 } from './rng';
import { buildParticles, type Particle } from './scene';
import { emptyGrid } from './stems';
import type { Cell, CritterPlacement, Grid, Letter, Placement } from './types';
import { COLS, ROWS } from './types';

export type Tip = { x: number; y: number; z: number };

export type BloomPlan = {
	start: number;
	frames: number;
};

export type RenderOptions = {
	flowers: Placement[];
	/** Frame the flower heads only (close-up stills, picker previews). */
	focus?: boolean;
	/** Legacy discrete bloom tick. Used only when `growth` is omitted. */
	tick?: number;
	/** Show the finished bouquet, ignoring tick/growth. */
	complete?: boolean;
	/** Continuous 0–1 growth: stems → buds → bloom. */
	growth?: number;
	twinkle?: number;
	cols?: number;
	rows?: number;
	/** Rotation around the vertical axis, in radians. */
	yaw?: number;
	/** Seconds, for sway, twinkle, stars, and drifting particles. */
	time?: number;
	/** Gentle wind bend. Default false so still frames stay deterministic. */
	sway?: boolean;
	/** Sparkles, hearts, and background stars. */
	particles?: boolean;
	/** Background star dust (defaults to `particles`). */
	stars?: boolean;
	/** Point density override (world units between samples). */
	fill?: number;
	critters?: CritterPlacement[];
	/** 0 = hidden, 1 = fully present. Bees fly in as this rises after the grow. */
	critterIntro?: number;
	animateCritters?: boolean;
	/** Tied bow colour. Default is the classic pink. */
	ribbon?: RibbonId;
	/** Test hook: draw only these layers ('flowers' = petals only, for depth checks). */
	_layers?: 'all' | 'flowers' | 'green';
	/** Test hook: copy the final per-cell depth into the result. */
	_depth?: boolean;
};

export type RenderResult = {
	grid: Grid;
	tips: Tip[];
	plan: BloomPlan[];
	totalTicks: number;
	done: boolean;
	/** Present when `opts._depth` is set: view-space depth per cell (or -Infinity). */
	depth?: Float32Array;
	/** Max flower-splat depth per cell, before gap fill (test hook). */
	flowerDepth?: Float32Array;
};

export function planBloom(flowers: Placement[]): BloomPlan[] {
	const mid = (flowers.length - 1) / 2;
	return flowers.map((f, i) => {
		const dist = Math.abs(i - mid);
		return { start: 1 + Math.round(dist * 1.2), frames: frameCount(f.id) };
	});
}

export function totalTicksFor(flowers: Placement[]): number {
	if (flowers.length === 0) return 0;
	const plan = planBloom(flowers);
	return Math.max(...plan.map((p) => p.start + p.frames));
}

/* ---------------------------------------------------------------- camera */

export type Camera = {
	scale: number;
	originX: number;
	originY: number;
	camZ: number;
	aspect: number;
};

export const CAM_Z = 4.6;
export const CAM_FOCAL = 3.8;
export const CAM_ASPECT = 0.55;

/**
 * Scale and center the bouquet so every point stays inside the grid (with
 * padding) at every yaw, including sway: the rest-pose bounds are projected
 * at 36 yaws and padded for wind sway and orbiting critters.
 */
export function fitCamera(points: { x: number; y: number; z: number }[], cols: number, rows: number, extraRadius = 0, tight = false): Camera {
	const padX = Math.max(2, cols * 0.035);
	const padY = Math.max(2, rows * 0.035);
	// Sample the full turn and take the true projected extents (plus a margin
	// for sway and critters), so the bouquet fills the frame at its widest
	// yaw without ever clipping.
	const swayR = 0.08 + extraRadius;
	let xExt = tight ? 0.05 : 0.35;
	let yUp = tight ? -1e9 : 0.2;
	let yDown = tight ? 1e9 : -0.05;
	const YAWS = tight ? 24 : 36;
	for (let k = 0; k < YAWS; k++) {
		const a = (k / YAWS) * Math.PI * 2;
		const ca = Math.cos(a);
		const sa = Math.sin(a);
		for (const p of points) {
			const rx = p.x * ca + p.z * sa;
			const rz = -p.x * sa + p.z * ca + swayR;
			const persp = CAM_FOCAL / Math.max(0.85, CAM_Z - rz);
			const ax = (Math.abs(rx) + swayR) * persp;
			if (ax > xExt) xExt = ax;
			const py = p.y * persp;
			if (py > yUp) yUp = py;
			if (py < yDown) yDown = py;
		}
	}
	yUp += swayR * 0.5;
	const usableW = Math.max(8, cols - padX * 2);
	const usableH = Math.max(8, rows - padY * 2);
	const scaleX = usableW / (2 * Math.max(0.2, xExt));
	const scaleY = usableH / (Math.max(0.2, yUp - yDown) * CAM_ASPECT);
	const scale = Math.max(0.4, Math.min(scaleX, scaleY));
	return {
		scale,
		originX: cols / 2,
		originY: rows / 2 + ((yUp + yDown) / 2) * scale * CAM_ASPECT,
		camZ: CAM_Z,
		aspect: CAM_ASPECT,
	};
}

function project(x: number, y: number, z: number, cam: Camera): { cx: number; cy: number; depth: number } | null {
	const zc = cam.camZ - z;
	if (zc < 0.55) return null;
	const persp = CAM_FOCAL / zc;
	return { cx: cam.originX + x * persp * cam.scale, cy: cam.originY - y * persp * cam.scale * cam.aspect, depth: z };
}

function rotateY(x: number, y: number, z: number, yaw: number): { x: number; y: number; z: number } {
	const c = Math.cos(yaw);
	const s = Math.sin(yaw);
	return { x: x * c + z * s, y, z: -x * s + z * c };
}

function windAt(y: number, time: number, strength: number): { dx: number; dz: number } {
	const k = Math.max(0, y) * 0.8 * strength;
	return {
		dx: (Math.sin(time * 1.15 + y * 1.1) * 0.05 + Math.sin(time * 0.62 + 1.7) * 0.025) * k,
		dz: Math.cos(time * 0.9 + y * 0.7) * 0.028 * k,
	};
}

/* -------------------------------------------------------------- timeline */

function clamp01(t: number): number {
	return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function easeOutCubic(t: number): number {
	const x = clamp01(t);
	return 1 - (1 - x) ** 3;
}

function easeInOut(t: number): number {
	const x = clamp01(t);
	return x * x * (3 - 2 * x);
}

/** When stem `i` of `n` starts and finishes growing on the 0–1 clock. */
export function stemGrowWindow(i: number, n: number, _isMain = true): { start: number; end: number } {
	const t = n <= 1 ? 0 : i / (n - 1);
	const start = t * 0.12;
	return { start, end: start + 0.36 };
}

function stemProgress(i: number, n: number, g: number): number {
	if (g >= 1) return 1;
	const { start, end } = stemGrowWindow(i, n);
	return easeOutCubic((g - start) / (end - start));
}

function flowerPhase(i: number, n: number, g: number): { bud: number; open: number } {
	if (g >= 1) return { bud: 1, open: 1 };
	const { end } = stemGrowWindow(i, n);
	return { bud: easeOutCubic((g - end) / 0.08), open: easeInOut((g - end - 0.05) / 0.3) };
}

/* ---------------------------------------------------------------- caches */

const sceneCache = new Map<string, Scene3>();
const camCache = new Map<string, Camera>();
const particleCache = new Map<number, Particle[]>();

const sceneKeyByArray = new WeakMap<Placement[], { sp: number; ribbon: RibbonId; key: string }>();

function sceneFor(flowers: Placement[], sp: number, ribbon: RibbonId = DEFAULT_RIBBON): { scene: Scene3; key: string } {
	const bow = ribbonOf(ribbon);
	const memo = sceneKeyByArray.get(flowers);
	let key: string;
	if (memo && memo.sp === sp && memo.ribbon === bow) key = memo.key;
	else {
		key = `${sp}|${bow}|${flowers.map((f) => `${f.id}:${f.color}`).join(',')}`;
		sceneKeyByArray.set(flowers, { sp, ribbon: bow, key });
	}
	let scene = sceneCache.get(key);
	if (!scene) {
		scene = buildScene3(flowers, sp, bow);
		if (sceneCache.size > 16) sceneCache.clear();
		sceneCache.set(key, scene);
	}
	return { scene, key };
}

/* ------------------------------------------------------- shading / glyphs */

/**
 * One fine, monotonic glyph ramp. Glyph and colour both come from the same
 * smoothed luminance, so a surface reads as an even gradient rather than
 * mixed punctuation.
 */
const RAMP = '.:-=+*#%@';
const SHADE_Q = 40;
/** Depth band (world units) treated as one surface when resolving a cell. */
const SURF_EPS = 0.015;
const colorCache = new Map<number, string>();
const rgbCache = new Map<number, number>();

function shadedRgb(rgb: number, q: number): number {
	const key = rgb * 64 + q;
	let v = rgbCache.get(key);
	if (v !== undefined) return v;
	if (rgbCache.size > 60000) rgbCache.clear();
	const f = q / SHADE_Q;
	const ch = (c: number) => {
		// Gamma lifts mid-tones so shaded yellows stay golden, not olive.
		let x = c * Math.pow(Math.min(1, f), 0.65);
		if (f > 1) x = x + (255 - x) * (f - 1) * 0.9;
		return Math.max(0, Math.min(255, Math.round(x)));
	};
	v = (ch((rgb >> 16) & 255) << 16) | (ch((rgb >> 8) & 255) << 8) | ch(rgb & 255);
	rgbCache.set(key, v);
	return v;
}

function shadeRgbStr(rgb: number, q: number): string {
	const key = rgb * 64 + q;
	let s = colorCache.get(key);
	if (s) return s;
	if (colorCache.size > 60000) colorCache.clear();
	s = `#${shadedRgb(rgb, q).toString(16).padStart(6, '0')}`;
	colorCache.set(key, s);
	return s;
}

// Light from the upper left, slightly in front of the viewer.
const LX = -0.4;
const LY = 0.55;
const LZ = 0.8;
const LL = Math.hypot(LX, LY, LZ);
const Lx = LX / LL;
const Ly = LY / LL;
const Lz = LZ / LL;
const HX0 = Lx;
const HY0 = Ly;
const HZ0 = Lz + 1;
const HL = Math.hypot(HX0, HY0, HZ0);
const Hx = HX0 / HL;
const Hy = HY0 / HL;
const Hz = HZ0 / HL;

const swayLutX = new Float32Array(512);
const swayLutZ = new Float32Array(512);

type Buffers = {
	z: Float32Array;
	lum: Float32Array;
	lum2: Float32Array;
	tone: Float32Array;
	rgb: Int32Array;
	kind: Uint8Array;
	id: Uint16Array;
	/** Per-cell sample weight and colour sums for the front surface. */
	cnt: Float32Array;
	/** Packed channel sums: r·2^28 + g·2^14 + b (exact in a double). */
	srgb: Float64Array;
	size: number;
};
let buffers: Buffers | null = null;

type Snap = { z: Float32Array; id: Uint16Array; kind: Uint8Array; lum: Float32Array; rgb: Int32Array; tone: Float32Array };
let snapBuf: Snap | null = null;
function getSnap(n: number): Snap {
	if (!snapBuf || snapBuf.z.length !== n)
		snapBuf = {
			z: new Float32Array(n),
			id: new Uint16Array(n),
			kind: new Uint8Array(n),
			lum: new Float32Array(n),
			rgb: new Int32Array(n),
			tone: new Float32Array(n),
		};
	return snapBuf;
}

function getBuffers(n: number): Buffers {
	if (!buffers || buffers.size !== n) {
		buffers = {
			z: new Float32Array(n),
			lum: new Float32Array(n),
			lum2: new Float32Array(n),
			tone: new Float32Array(n),
			rgb: new Int32Array(n),
			kind: new Uint8Array(n),
			id: new Uint16Array(n),
			cnt: new Float32Array(n),
			srgb: new Float64Array(n),
			size: n,
		};
	}
	buffers.z.fill(-Infinity);
	return buffers;
}

const KIND_NAMES: Cell['kind'][] = ['stem', 'leaf', 'flower', 'stem', 'leaf'];

/* --------------------------------------------------------- 2D overlays */

function plot(
	grid: Grid,
	depths: Float32Array,
	cols: number,
	rows: number,
	cx: number,
	cy: number,
	depth: number,
	ch: string,
	color: string,
	kind: Cell['kind'],
) {
	const x = Math.round(cx);
	const y = Math.round(cy);
	if (x < 0 || y < 0 || x >= cols || y >= rows) return;
	const i = y * cols + x;
	if (depth < depths[i]) return;
	depths[i] = depth;
	grid[y][x] = { ch, color, kind };
}

function depthLight(depth: number): number {
	return 0.45 + 0.6 * clamp01((depth + 1.4) / 2.8);
}

function drawParticle(grid: Grid, depths: Float32Array, cols: number, rows: number, p: Particle, time: number, cam: Camera) {
	const ang = p.angle0 + time * p.speed;
	let y = p.height + Math.sin(time * p.drift + p.phase) * 0.15;
	if (p.kind === 'petal') y = ((p.height + time * p.drift * 0.35) % 2.4) - 0.1;
	const r = p.radius * 1.05 + Math.sin(time * 0.4 + p.phase) * 0.08;
	const pr = project(Math.sin(ang) * r, y, Math.cos(ang) * r, cam);
	if (!pr) return;
	const twinkle = 0.55 + 0.45 * Math.sin(time * (p.kind === 'sparkle' ? 6 : 2) + p.phase);
	if (p.kind === 'sparkle' && twinkle < 0.35) return;
	const color = shadeHex(p.color, depthLight(pr.depth) * (0.7 + 0.3 * twinkle));
	if (p.kind === 'heart') {
		plot(grid, depths, cols, rows, pr.cx, pr.cy, pr.depth, '<', color, 'heart');
		plot(grid, depths, cols, rows, pr.cx + 1, pr.cy, pr.depth, '3', color, 'heart');
		return;
	}
	const ch = p.kind === 'sparkle' && twinkle > 0.85 ? (p.ch === '.' ? '+' : '*') : p.ch;
	plot(grid, depths, cols, rows, pr.cx, pr.cy, pr.depth, ch, color, 'sparkle');
}

function drawStars(grid: Grid, depths: Float32Array, cols: number, rows: number, seed: number, time: number) {
	const rng = mulberry32(seed ^ 0x9e3779b9);
	const count = Math.round((cols * rows) / 95);
	for (let i = 0; i < count; i++) {
		const bx = rng();
		const by = rng();
		const sp = 0.004 + rng() * 0.01;
		const ph = rng() * 6.28;
		const tw = 0.6 + rng() * 2.2;
		const big = rng() < 0.07;
		const x = (((bx + time * sp * 0.6) % 1) + 1) % 1;
		const y = (((by - time * sp) % 1) + 1) % 1;
		const b = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(time * tw + ph));
		const cx = Math.floor(x * cols);
		const cy = Math.floor(y * rows);
		const idx = cy * cols + cx;
		if (depths[idx] !== -Infinity) continue;
		plot(grid, depths, cols, rows, cx, cy, -1e6, big ? '+' : '.', shadeHex('#dfe6f2', big ? b + 0.2 : b), 'sparkle');
	}
}

function drawCritters(
	grid: Grid,
	depths: Float32Array,
	cols: number,
	rows: number,
	scene: Scene3,
	critters: CritterPlacement[],
	intro: number,
	yaw: number,
	time: number,
	animate: boolean,
	sway: number,
	cam: Camera,
) {
	if (!critters.length || intro <= 0) return;
	// Sprites are a few glyphs; on dense grids draw them as CS×CS blocks so they stay visible.
	const CS = Math.max(1, Math.round(cols / 120));
	const fly = intro * intro * (3 - 2 * intro);
	const t = animate ? time : 8;
	const stems = scene.stems;
	let crawlers = 0;
	let flyers = 0;
	for (let i = 0; i < critters.length; i++) {
		const id = critters[i].id;
		if (id === 'ladybug') {
			if (!stems.length) continue;
			const curve = stems[(crawlers * 3 + 1) % stems.length];
			crawlers += 1;
			const crawl = animate ? crawlAlong(crawlers, t) : { along: 0.62, sitting: true };
			const along = 0.35 + crawl.along * 0.55;
			const c = bez(curve, along);
			const tg = bezTangent(curve, along);
			// Sit on the side of the stem that faces outward.
			const hx = c.x;
			const hz = c.z;
			const hl = Math.hypot(hx, hz) || 1;
			let x = c.x + (hx / hl) * 0.03 - tg.z * 0.0;
			let y = c.y;
			let z = c.z + (hz / hl) * 0.03;
			if (sway > 0) {
				const w = windAt(y, t, sway);
				x += w.dx;
				z += w.dz;
			}
			const r = rotateY(x, y, z, yaw);
			const pr = project(r.x, r.y, r.z, cam);
			if (!pr) continue;
			const light = depthLight(pr.depth) * (0.65 + 0.35 * intro);
			const frame = critterFrames(id)[flapFrame(id, t, i, crawl.sitting || !animate)];
			for (const g of frame) {
				const col = shadeHex(g.color, light);
				for (let sx = 0; sx < CS; sx++)
					for (let sy = 0; sy < CS; sy++)
						plot(grid, depths, cols, rows, pr.cx + g.dx * CS + sx, pr.cy + g.dy * CS + sy, pr.depth + 0.04, g.ch, col, 'critter');
			}
			continue;
		}
		const kind = id === 'butterfly' ? 'butterfly' : 'bee';
		const fi = flyers;
		flyers += 1;
		const S = 0.72;
		const pose = (tt: number) => {
			const p = flyerPose(kind, fi, tt);
			return { x: p.x * S, y: p.y * 1.05, z: p.z * S };
		};
		const pos = pose(t);
		const start = { x: pos.x * 1.75 + (fi % 2 ? 0.45 : -0.45), y: pos.y + 1.1, z: pos.z * 1.75 };
		const lerp = (a: { x: number; y: number; z: number }) => ({
			x: start.x + (a.x - start.x) * fly,
			y: start.y + (a.y - start.y) * fly,
			z: start.z + (a.z - start.z) * fly,
		});
		if (animate && fly > 0.12) {
			const trailN = kind === 'bee' ? 7 : 5;
			const trailColor = kind === 'bee' ? '#e8d48a' : '#d8b8ff';
			for (let k = trailN; k >= 1; k--) {
				const q = lerp(pose(t - k * 0.05));
				const tr = project(q.x, q.y, q.z, cam);
				if (!tr) continue;
				const dim = 0.22 + 0.45 * (1 - k / trailN);
				plot(grid, depths, cols, rows, tr.cx, tr.cy, tr.depth - 0.03, k % 2 ? '.' : ':', shadeHex(trailColor, dim), 'critter');
			}
		}
		const q = lerp(pos);
		const pr = project(q.x, q.y, q.z, cam);
		if (!pr) continue;
		const light = depthLight(pr.depth);
		const frame = critterFrames(id)[animate ? flapFrame(id, t, i) : 0];
		for (const g of frame) {
			const col = shadeHex(g.color, light);
			for (let sx = 0; sx < CS; sx++)
				for (let sy = 0; sy < CS; sy++)
					plot(grid, depths, cols, rows, pr.cx + g.dx * CS + sx, pr.cy + g.dy * CS + sy, pr.depth + 0.05, g.ch, col, 'critter');
		}
	}
}

/* ---------------------------------------------------------------- render */

export function renderBouquet(opts: RenderOptions): RenderResult {
	const cols = opts.cols ?? COLS;
	const rows = opts.rows ?? ROWS;
	const flowers = opts.flowers;
	const sp = opts.fill && opts.fill < 0.1 ? opts.fill : densityFor(cols) * (opts.focus ? 0.46 : 1);
	const { scene, key } = sceneFor(flowers, sp, ribbonOf(opts.ribbon));
	const plan = planBloom(flowers);
	const total = totalTicksFor(flowers);
	const g = opts.complete ? 1 : opts.growth !== undefined ? clamp01(opts.growth) : total ? clamp01((opts.tick ?? 0) / total) : 0;
	const done = opts.complete ? true : opts.growth !== undefined ? g >= 1 : (opts.tick ?? 0) >= total;
	const yaw = opts.yaw ?? 0;
	const time = opts.time ?? 0;
	const swayAmt = opts.sway ? (g >= 1 ? 1 : Math.max(0, (g - 0.55) / 0.45)) : 0;
	const critters = opts.critters ?? [];
	const critterIntro = clamp01(opts.critterIntro ?? (critters.length ? 1 : 0));

	const camKey = `${key}|${cols}x${rows}|${critters.length ? 1 : 0}|${opts.focus ? 'f' : ''}`;
	let cam = camCache.get(camKey);
	if (!cam) {
		cam = opts.focus
			? fitCamera(scene.headBounds.length ? scene.headBounds : scene.bounds, cols, rows, 0, true)
			: fitCamera(scene.bounds, cols, rows, critters.length ? 0.12 : 0);
		if (camCache.size > 32) camCache.clear();
		camCache.set(camKey, cam);
	}

	const N = cols * rows;
	const buf = getBuffers(N);
	const Z = buf.z;
	const LUM = buf.lum;
	const RGB = buf.rgb;
	const KIND = buf.kind;
	const cy = Math.cos(yaw);
	const sy = Math.sin(yaw);
	const scale = cam.scale;
	const sAsp = cam.scale * cam.aspect;
	const ox = cam.originX;
	const oy = cam.originY;
	const camZ = cam.camZ;
	const n = scene.flowers.length;
	const nStems = Math.max(1, n);

	const TONE = buf.tone;
	const ID = buf.id;
	const CNT = buf.cnt;
	const SRGB = buf.srgb;
	// Wind sway depends only on height: tabulate it once per frame.
	const SWAY_N = 512;
	const SWAY_MAX = 3;
	const swayX = swayLutX;
	const swayZ = swayLutZ;
	if (swayAmt > 0) {
		for (let i = 0; i < SWAY_N; i++) {
			const yy = (i / (SWAY_N - 1)) * SWAY_MAX;
			const k = yy * 0.8 * swayAmt;
			swayX[i] = (Math.sin(time * 1.15 + yy * 1.1) * 0.05 + Math.sin(time * 0.62 + 1.7) * 0.025) * k;
			swayZ[i] = Math.cos(time * 0.9 + yy * 0.7) * 0.028 * k;
		}
	}
	const swayScale = (SWAY_N - 1) / SWAY_MAX;
	// Each point covers two cells side by side: glyph cells are ~1.8× taller
	// than wide, so this keeps surfaces solid with half the points.
	const flowerZ = opts._depth ? new Float32Array(cols * rows).fill(-Infinity) : null;
	const splat = (
		wx: number,
		wy: number,
		wz: number,
		nx: number,
		ny: number,
		nz: number,
		rgb: number,
		kind: number,
		glow: number,
		tone: number,
		sid: number,
		bias = 0,
	) => {
		if (swayAmt > 0 && wy > 0) {
			const si = Math.min(SWAY_N - 1, (wy * swayScale) | 0);
			wx += swayX[si];
			wz += swayZ[si];
		}
		const vx = wx * cy + wz * sy;
		const vz = -wx * sy + wz * cy;
		const zc = camZ - vz;
		if (zc < 0.55) return;
		const persp = CAM_FOCAL / zc;
		const fx = ox + vx * persp * scale;
		const fy = oy - wy * persp * sAsp;
		const col0 = Math.floor(fx);
		// Flowers also cover the two nearest rows so hanging petals form a solid
		// surface; stems stay 2×1 so the bunch does not get any fatter.
		const row0 = kind === KIND_FLOWER ? Math.floor(fy) : Math.round(fy);
		const row1 = kind === KIND_FLOWER ? row0 + 1 : row0;
		if (col0 < -1 || row0 >= rows || row1 < 0 || col0 >= cols) return;
		const depth = vz + bias;
		// Front-surface resolve: every sample within SURF_EPS of a cell's
		// nearest surface (same flower/part) is averaged, instead of the last
		// point to win a near-tie. Winner-takes-all let a different point own
		// the cell each frame as the bouquet turned, so shade and texture
		// flashed. Averaging is order-independent and stable across frames.
		const rA = row0 < 0 ? 0 : row0;
		const rB = row1 >= rows ? rows - 1 : row1;
		const cA = col0 < 0 ? 0 : col0;
		const cB = col0 + 1 >= cols ? cols - 1 : col0 + 1;
		if (flowerZ && kind === KIND_FLOWER) for (let row = rA; row <= rB; row++) for (let col = cA; col <= cB; col++) { const idx = row * cols + col; if (depth > flowerZ[idx]) flowerZ[idx] = depth; }
		let mx = nx * cy + nz * sy;
		let my = ny;
		let mz = -nx * sy + nz * cy;
		if (mz < 0) {
			mx = -mx;
			my = -my;
			mz = -mz;
		}
		const diff = mx * Lx + my * Ly + mz * Lz;
		let h = mx * Hx + my * Hy + mz * Hz;
		if (h < 0) h = 0;
		h *= h;
		h *= h;
		h *= h;
		h *= h; // ^16
		const wrap = (diff + 0.3) / 1.3;
		let lum = 0.16 + 0.84 * (wrap > 0 ? wrap : 0) + 0.26 * h;
		if (glow > lum) lum = glow;
		lum *= 0.72 + 0.28 * clamp01((vz + 1.4) / 2.8);
		const packed = ((rgb >> 16) & 255) * 268435456 + ((rgb >> 8) & 255) * 16384 + (rgb & 255);
		for (let row = rA; row <= rB; row++) {
			for (let col = cA; col <= cB; col++) {
				const idx = row * cols + col;
				const zc0 = Z[idx];
				if (depth > zc0 + SURF_EPS || zc0 === -Infinity || (depth > zc0 && ID[idx] !== sid)) {
					// A clearly closer surface (or a closer different part): restart.
					Z[idx] = depth;
					LUM[idx] = lum;
					TONE[idx] = tone;
					CNT[idx] = 1;
					SRGB[idx] = packed;
					RGB[idx] = rgb;
					KIND[idx] = kind;
					ID[idx] = sid;
				} else if (depth >= zc0 - SURF_EPS && ID[idx] === sid && CNT[idx] < 60) {
					// Same surface, near the front: accumulate.
					if (depth > zc0) Z[idx] = depth;
					LUM[idx] += lum;
					TONE[idx] += tone;
					CNT[idx] += 1;
					SRGB[idx] += packed;
				}
			}
		}
	};

	// Static geometry: leaves first, then stems and ribbon so the stalks stay
	// visible in the bunch core. Flowers are drawn after and win on depth, so
	// petals always stay in front of their stems.
	const baseLeaf = easeOutCubic((g - 0.1) / 0.28);
	const ribbon = easeOutCubic((g - 0.08) / 0.12);
	const splatGroup = (grp: (typeof scene.groups)[number], limit: number, unfurl: number) => {
		if (limit <= 0 || unfurl <= 0) return;
		const P = grp.pos;
		const Nn = grp.nor;
		const A = grp.along;
		const C = grp.rgb;
		const o = grp.origin;
		const count = A.length;
		for (let i = 0; i < count; i++) {
			if (A[i] > limit) continue;
			const k = i * 3;
			let x = P[k];
			let y = P[k + 1];
			let z = P[k + 2];
			if (unfurl < 1) {
				x = o.x + (x - o.x) * unfurl;
				y = o.y + (y - o.y) * unfurl;
				z = o.z + (z - o.z) * unfurl;
			}
			splat(x, y, z, Nn[k], Nn[k + 1], Nn[k + 2], C[i], grp.kind, 0, 1, 1000 + grp.kind);
		}
	};
	const layers = opts._layers ?? 'all';
	if (layers !== 'flowers') for (const grp of scene.groups) {
		if (grp.kind !== KIND_LEAF) continue;
		const unfurl =
			grp.stem < 0 ? baseLeaf : easeOutCubic((stemProgress(grp.stem, nStems, g) - grp.attach) / 0.22);
		splatGroup(grp, 1, unfurl);
	}
	if (layers !== 'flowers') for (const grp of scene.groups) {
		if (grp.kind !== KIND_STEM && grp.kind !== KIND_RIBBON) continue;
		const limit = grp.kind === KIND_STEM ? stemProgress(grp.stem, nStems, g) : 1;
		const unfurl = grp.kind === KIND_RIBBON ? ribbon : 1;
		splatGroup(grp, limit, unfurl);
	}

	// Flowers: bud → bloom by blending openness keyframes.
	if (layers !== 'green') for (let fi = 0; fi < n; fi++) {
		const inst = scene.flowers[fi];
		const ph = flowerPhase(fi, nStems, g);
		if (ph.bud <= 0) continue;
		const size = inst.size * (0.3 + 0.42 * ph.bud + 0.28 * ph.open);
		const f = ph.open * (OPEN_KEYS - 1);
		const k0 = Math.min(OPEN_KEYS - 2, Math.floor(f));
		const tt = f - k0;
		const P0 = inst.mesh.pos[k0];
		const P1 = inst.mesh.pos[k0 + 1];
		const N0 = inst.mesh.nor[k0];
		const N1 = inst.mesh.nor[k0 + 1];
		const S = inst.mesh.slot;
		const T = inst.mesh.tone;
		const m = inst.m;
		const b = inst.base;
		const pal = inst.palette;
		const count = inst.mesh.count;
		// Heads on the far side mostly peek through gaps: half the points will do.
		const bz = -b.x * sy + b.z * cy;
		const bny = -m[3] * sy + m[5] * cy;
		const stride = bz < -0.12 && bny < -0.2 ? 2 : 1;
		for (let i = 0; i < count; i += stride) {
			const k = i * 3;
			const lx = (P0[k] + (P1[k] - P0[k]) * tt) * size;
			const ly = (P0[k + 1] + (P1[k + 1] - P0[k + 1]) * tt) * size;
			const lz = (P0[k + 2] + (P1[k + 2] - P0[k + 2]) * tt) * size;
			const ax = N0[k] + (N1[k] - N0[k]) * tt;
			const ay = N0[k + 1] + (N1[k + 1] - N0[k + 1]) * tt;
			const az = N0[k + 2] + (N1[k + 2] - N0[k + 2]) * tt;
			const wx = b.x + m[0] * lx + m[3] * ly + m[6] * lz;
			const wy = b.y + m[1] * lx + m[4] * ly + m[7] * lz;
			const wz = b.z + m[2] * lx + m[5] * ly + m[8] * lz;
			let nx = m[0] * ax + m[3] * ay + m[6] * az;
			let ny = m[1] * ax + m[4] * ay + m[7] * az;
			let nz = m[2] * ax + m[5] * ay + m[8] * az;
			const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
			nx /= nl;
			ny /= nl;
			nz /= nl;
			const slot = S[i];
			const glow = slot === SLOT_FILAMENT || slot === SLOT_ANTHER ? 0.55 : 0;
			splat(wx, wy, wz, nx, ny, nz, pal[slot], KIND_FLOWER, glow, T[i], fi + 1);
		}
	}

	// Resolve accumulated samples into one averaged sample per cell.
	for (let i = 0; i < N; i++) {
		if (Z[i] === -Infinity) continue;
		const k = CNT[i];
		if (k > 1) {
			const inv = 1 / k;
			LUM[i] *= inv;
			TONE[i] *= inv;
			// Unpack the channel sums (each < 2^14) and snap blended colours to
			// a 3-bit grid so shades stay cacheable.
			const sum = SRGB[i];
			const rs = Math.floor(sum / 268435456);
			const gs = Math.floor((sum - rs * 268435456) / 16384);
			const bs = sum - rs * 268435456 - gs * 16384;
			const r = Math.round((rs * inv) / 8) * 8;
			const gg = Math.round((gs * inv) / 8) * 8;
			const bb = Math.round((bs * inv) / 8) * 8;
			RGB[i] = (Math.min(255, r) << 16) | (Math.min(255, gg) << 8) | Math.min(255, bb);
		}
	}

	// Close 1-cell pinholes in a surface, and restore a closer flower over a
	// farther stem/leaf that landed in a gap between petal splats. Without
	// this, the dense lower bunch shows through hanging blooms as if the
	// stalks were drawn on top of the petals.
	// Gap passes read from a snapshot and write to the live buffers, so the
	// result does not depend on scan order. Filling in place let one fill feed
	// the next along a row, so whole streaks of petal appeared and vanished
	// from frame to frame as the bouquet turned (the "flashing" texture).
	const snap = getSnap(N);
	const takeSnap = () => {
		snap.z.set(Z);
		snap.id.set(ID);
		snap.kind.set(KIND);
		snap.lum.set(LUM);
		snap.rgb.set(RGB);
		snap.tone.set(TONE);
	};
	const copyFrom = (idx: number, src: number) => {
		Z[idx] = snap.z[src] - 0.001;
		LUM[idx] = snap.lum[src];
		RGB[idx] = snap.rgb[src];
		KIND[idx] = snap.kind[src];
		TONE[idx] = snap.tone[src];
		ID[idx] = snap.id[src];
	};
	// Empty 1-cell holes inside one surface (any part, including stems).
	takeSnap();
	{
		const z0 = snap.z;
		const id0 = snap.id;
		for (let r = 1; r < rows - 1; r++) {
			const base = r * cols;
			for (let c = 1; c < cols - 1; c++) {
				const idx = base + c;
				if (z0[idx] !== -Infinity) continue;
				let src = -1;
				const l = idx - 1;
				const rr = idx + 1;
				const u = idx - cols;
				const d = idx + cols;
				if (z0[l] !== -Infinity && z0[rr] !== -Infinity && id0[l] === id0[rr] && Math.abs(z0[l] - z0[rr]) < 0.06)
					src = z0[l] >= z0[rr] ? l : rr;
				else if (z0[u] !== -Infinity && z0[d] !== -Infinity && id0[u] === id0[d] && Math.abs(z0[u] - z0[d]) < 0.06)
					src = z0[u] >= z0[d] ? u : d;
				if (src >= 0) copyFrom(idx, src);
			}
		}
	}
	// Then let a closer petal reclaim a 1-cell gap where a farther stalk or
	// another flower shows through between its splats. Without this, the
	// dense lower bunch shows through hanging blooms.
	takeSnap();
	{
		const z0 = snap.z;
		const id0 = snap.id;
		const k0 = snap.kind;
		for (let r = 1; r < rows - 1; r++) {
			const base = r * cols;
			for (let c = 1; c < cols - 1; c++) {
				const idx = base + c;
				const here = z0[idx];
				let src = -1;
				let srcZ = -Infinity;
				const consider = (a: number, b: number) => {
					if (z0[a] === -Infinity || z0[b] === -Infinity) return;
					if (id0[a] !== id0[b] || id0[a] <= 0 || id0[a] === id0[idx]) return;
					if (k0[a] !== KIND_FLOWER || k0[b] !== KIND_FLOWER) return;
					if (Math.abs(z0[a] - z0[b]) > 0.08) return;
					const nearer = z0[a] >= z0[b] ? a : b;
					const z = z0[nearer];
					if (here !== -Infinity && z < here + 0.015) return;
					if (z > srcZ) {
						srcZ = z;
						src = nearer;
					}
				};
				consider(idx - 1, idx + 1);
				consider(idx - cols, idx + cols);
				if (src >= 0) copyFrom(idx, src);
			}
		}
	}

	// Smooth lighting within each surface (3×3, same flower, similar depth) so
	// gradients are even; tone (heart, crease) is applied after, so it stays crisp.
	const L2 = buf.lum2;
	for (let r = 0; r < rows; r++) {
		const base = r * cols;
		for (let c = 0; c < cols; c++) {
			const idx = base + c;
			const z = Z[idx];
			if (z === -Infinity) continue;
			const id = ID[idx];
			let sum = LUM[idx] * 2;
			let wsum = 2;
			for (let dr = -1; dr <= 1; dr++) {
				const rr = r + dr;
				if (rr < 0 || rr >= rows) continue;
				for (let dc = -1; dc <= 1; dc++) {
					if (!dr && !dc) continue;
					const cc = c + dc;
					if (cc < 0 || cc >= cols) continue;
					const j = rr * cols + cc;
					if (ID[j] !== id || Z[j] === -Infinity) continue;
					// Soft depth weight: a hard cut-off flips neighbours in and out
					// of the blur between frames.
					const dz = Z[j] - z;
					const w = 1 - (dz < 0 ? -dz : dz) * (1 / 0.06);
					if (w <= 0) continue;
					sum += LUM[j] * w;
					wsum += w;
				}
			}
			L2[idx] = sum / wsum;
		}
	}

	// Cells → glyphs and shaded colours. Cells just behind a depth edge (or a
	// different flower) get a dark seam so overlapping heads separate cleanly.
	const grid = emptyGrid(cols, rows);
	for (let r = 0; r < rows; r++) {
		const row = grid[r];
		const base = r * cols;
		for (let c = 0; c < cols; c++) {
			const idx = base + c;
			const z = Z[idx];
			if (z === -Infinity) continue;
			const id = ID[idx];
			let edge = 0;
			if (c > 0 && ID[idx - 1] !== id && Z[idx - 1] - z > 0.02) edge++;
			if (c < cols - 1 && ID[idx + 1] !== id && Z[idx + 1] - z > 0.02) edge++;
			if (r > 0 && Z[idx - cols] - z > 0.06) edge++;
			if (r < rows - 1 && Z[idx + cols] - z > 0.06) edge++;
			if (c > 0 && Z[idx - 1] - z > 0.06) edge++;
			if (c < cols - 1 && Z[idx + 1] - z > 0.06) edge++;
			let s = L2[idx] * TONE[idx];
			if (edge) s *= edge > 1 ? 0.4 : 0.58;
			const rgb = RGB[idx];
			const q = Math.max(5, Math.min(56, Math.round((0.3 + 1.05 * s) * SHADE_Q) + ((rgb >> 16) + ((rgb >> 8) & 255) + (rgb & 255) > 690 ? 5 : 0)));
			const gl = 0.28 + s * 0.8;
			const ri = gl <= 0 ? 0 : gl >= 1 ? RAMP.length - 1 : Math.floor(gl * RAMP.length);
			row[c] = { ch: RAMP[ri], color: shadeRgbStr(rgb, q), kind: KIND_NAMES[KIND[idx]], rgb: shadedRgb(rgb, q) };
		}
	}

	const showStars = opts.stars ?? opts.particles ?? false;
	if (showStars) drawStars(grid, Z, cols, rows, scene.seed, time);

	const particleFade = g >= 1 ? 1 : g >= 0.8 ? (g - 0.8) / 0.2 : 0;
	if (opts.particles && particleFade > 0) {
		let parts = particleCache.get(scene.seed);
		if (!parts) {
			parts = buildParticles(scene.seed, cols < 100 ? 14 : 22);
			particleCache.set(scene.seed, parts);
		}
		for (let i = 0; i < parts.length; i++) {
			if (i / parts.length > particleFade) continue;
			drawParticle(grid, Z, cols, rows, parts[i], time, cam);
		}
	}

	if (critters.length && critterIntro > 0) {
		drawCritters(grid, Z, cols, rows, scene, critters, critterIntro, yaw, time, opts.animateCritters ?? true, swayAmt, cam);
	}

	return {
		grid,
		tips: scene.flowers.map((f) => ({ x: f.base.x, y: f.base.y, z: f.base.z })),
		plan,
		totalTicks: total,
		done,
		...(opts._depth ? { depth: Z.slice(), flowerDepth: flowerZ ?? undefined } : {}),
	};
}

/* --------------------------------------------------------------- export */

export type ColorRun = { text: string; color: string };

export type RenderedLine = { runs: ColorRun[] };

export function gridToRuns(grid: Grid): RenderedLine[] {
	return grid.map((row) => {
		const runs: ColorRun[] = [];
		let buf = '';
		let color = '';
		const flush = () => {
			if (!buf) return;
			runs.push({ text: buf, color: color || 'transparent' });
			buf = '';
		};
		for (const cell of row) {
			const ch = cell?.ch ?? ' ';
			const c = cell?.color ?? 'transparent';
			if (c !== color && buf) flush();
			color = c;
			buf += ch;
		}
		flush();
		return { runs };
	});
}

export function gridToPlainText(grid: Grid, letter?: Pick<Letter, 'note'>): string {
	const lines = grid.map((row) =>
		row
			.map((c) => (c && c.kind !== 'sparkle' ? c.ch : ' '))
			.join('')
			.trimEnd(),
	);
	while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
	while (lines.length && lines[0].trim() === '') lines.shift();
	const body = lines.join('\n');
	if (letter?.note?.trim()) {
		const note = letter.note.trim();
		const width = Math.max(...lines.map((l) => l.length), note.length);
		const pad = Math.max(0, Math.floor((width - note.length) / 2));
		return `${body}\n\n${' '.repeat(pad)}${note}\n`;
	}
	return body + '\n';
}


export type StemJoint = {
	id: import('./types').FlowerId;
	index: number;
	hx: number;
	hy: number;
	sx: number;
	sy: number;
	/** Grid-cell distance between projected stem tip and head base. */
	gap: number;
	/** Head has visible flower cells nearby. */
	visible: boolean;
	/** A stem/calyx cell sits at or just below the projected base (underside). */
	connected: boolean;
	/** Flower cells on the face above the base. */
	faceFlower: number;
	/** Stem cells painted on the face above the base (should stay low). */
	faceStem: number;
};

/**
 * After a render, report how tightly each stem meets its head in projected space.
 * Used to guarantee no floating petals.
 */
export function measureStemJoints(opts: RenderOptions): { joints: StemJoint[]; result: RenderResult } {
	const result = renderBouquet(opts);
	const cols = opts.cols ?? COLS;
	const rows = opts.rows ?? ROWS;
	const sp = opts.fill && opts.fill < 0.1 ? opts.fill : densityFor(cols) * (opts.focus ? 0.46 : 1);
	const { scene } = sceneFor(opts.flowers, sp, ribbonOf(opts.ribbon));
	const yaw = opts.yaw ?? 0;
	const cam = opts.focus
		? fitCamera(scene.headBounds.length ? scene.headBounds : scene.bounds, cols, rows, 0, true)
		: fitCamera(scene.bounds, cols, rows, (opts.critters?.length ?? 0) ? 0.12 : 0);
	const cy = Math.cos(yaw);
	const sy = Math.sin(yaw);
	const project = (x: number, y: number, z: number) => {
		const vx = x * cy + z * sy;
		const vz = -x * sy + z * cy;
		const zc = cam.camZ - vz;
		if (zc < 0.55) return null;
		const persp = CAM_FOCAL / zc;
		return { cx: cam.originX + vx * persp * cam.scale, cy: cam.originY - y * persp * cam.scale * cam.aspect };
	};
	const countKind = (x: number, y: number, dx0: number, dx1: number, dy0: number, dy1: number, want: string[]) => {
		let n = 0;
		for (let dy = dy0; dy <= dy1; dy++) {
			for (let dx = dx0; dx <= dx1; dx++) {
				const xi = Math.round(x + dx);
				const yi = Math.round(y + dy);
				if (yi < 0 || yi >= rows || xi < 0 || xi >= cols) continue;
				const k = result.grid[yi][xi]?.kind;
				if (k && want.includes(k)) n++;
			}
		}
		return n;
	};
	const kindsNear = (x: number, y: number, rad: number, want: string[]) =>
		countKind(x, y, -rad, rad, -rad, rad, want);
	/** Just below the projected base (larger row = lower on the screen). */
	const kindsNearBelow = (x: number, y: number, halfW: number, down: number, want: string[]) =>
		countKind(x, y, -halfW, halfW, 0, down, want);
	/** The bloom face sits above the base (smaller row). */
	const kindsNearAbove = (x: number, y: number, halfW: number, up: number, want: string[]) =>
		countKind(x, y, -halfW, halfW, -up, -1, want);
	const joints: StemJoint[] = [];
	for (let i = 0; i < scene.flowers.length; i++) {
		const inst = scene.flowers[i];
		const curve = scene.stems[i];
		if (!curve) continue;
		const head = project(inst.base.x, inst.base.y, inst.base.z);
		if (!head) continue;
		// Sample the last stretch of the stem; the closest projected point to the base is the joint.
		let best = Infinity;
		let sx = head.cx;
		let sy = head.cy;
		for (let s = 0; s <= 16; s++) {
			const t = 0.8 + 0.2 * (s / 16);
			const p = bez(curve, t);
			const pr = project(p.x, p.y, p.z);
			if (!pr) continue;
			const d = Math.hypot(pr.cx - head.cx, pr.cy - head.cy);
			if (d < best) {
				best = d;
				sx = pr.cx;
				sy = pr.cy;
			}
		}
		// The attachment sits at the underside of the head. A visible stalk should
		// appear along the last stretch of the stem or just below the base, never
		// as overpaint on the bloom face.
		const under = kindsNearBelow(head.cx, head.cy, 5, 7, ['stem', 'leaf']);
		let alongStem = 0;
		let alongFlower = 0;
		for (let s = 0; s <= 10; s++) {
			const t = 0.62 + 0.3 * (s / 10);
			const p = bez(curve, t);
			const pr = project(p.x, p.y, p.z);
			if (!pr) continue;
			const rad = cols < 80 ? 3 : 2;
			alongStem += kindsNear(pr.cx, pr.cy, rad, ['stem', 'leaf']);
			alongFlower += kindsNear(pr.cx, pr.cy, rad, ['flower']);
		}
		const faceFlower = kindsNearAbove(head.cx, head.cy, 3, 3, ['flower']);
		const faceStem = kindsNearAbove(head.cx, head.cy, 3, 3, ['stem']);
		const visible = kindsNearAbove(head.cx, head.cy, 5, 7, ['flower']) > (cols < 80 ? 3 : 8);
		// Hidden-by-petals is still connected in 3D: the tip sits on the base and
		// the last stretch is behind a closer bloom, not a geometric gap.
		const connected = under > 0 || alongStem > 0 || alongFlower > 0;
		joints.push({
			id: inst.id,
			index: i,
			hx: head.cx,
			hy: head.cy,
			sx,
			sy,
			gap: best,
			visible,
			connected,
			faceFlower,
			faceStem,
		});
	}
	return { joints, result };
}

export { TERMINAL_BG };
