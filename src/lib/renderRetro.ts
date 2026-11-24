/**
 * Pre-realistic sprite-style bouquet renderer — the "Retro" look.
 * Flowers are handmade ASCII sprites placed in 3D, with rotation, grow-from-stems,
 * critters, and auto-fit framing. Kept as an alternate mode beside the shaded 3D renderer.
 */
import { crawlAlong, critterFrames, flapFrame, flyerPose } from './critters';
import { frameCount } from './flowers';
import { shadeHex, STEM, TERMINAL_BG } from './palette';
import { buildParticles, buildScene, type BouquetScene, type Particle, type ScenePoint } from './scene';
import { DEFAULT_RIBBON, ribbonOf, type RibbonId } from './ribbon';
import type { CritterPlacement, Grid, Letter, Placement } from './types';
import { COLS, ROWS } from './types';
import { emptyGrid } from './stems';

export type { FlowerTip3 as Tip } from './scene';

export type BloomPlan = {
	start: number;
	frames: number;
};

export type RenderOptions = {
	flowers: Placement[];
	/** Legacy discrete bloom tick. Used only when `growth` is omitted. */
	tick?: number;
	/** Show every flower in its final frame, ignoring tick. */
	complete?: boolean;
	/**
	 * Continuous 0–1 growth from stems to open blooms.
	 * When set, stems grow from the base, leaves unfurl, and flowers open after their stem arrives.
	 */
	growth?: number;
	twinkle?: number;
	cols?: number;
	rows?: number;
	/** Rotation around the vertical axis, in radians. */
	yaw?: number;
	/** Seconds, for sway, twinkle, and drifting particles. */
	time?: number;
	/** Gentle wind bend. Default false so still frames stay deterministic. */
	sway?: boolean;
	/** Skip drifting particles (tests / static exports can leave this off). */
	particles?: boolean;
	/** How many filler stems to include (lower on mobile). */
	fill?: number;
	/** Frame the flower heads tightly (picker previews). */
	focus?: boolean;
	/** Optional bees, ladybugs, and butterflies. */
	critters?: CritterPlacement[];
	/** 0 = hidden, 1 = fully present. Bees fly in as this rises after the grow. */
	critterIntro?: number;
	/** Wing flaps, crawl, and trails. Default true. */
	animateCritters?: boolean;
	/** Tied bow colour. Default is the classic pink. */
	ribbon?: RibbonId;
};

export type RenderResult = {
	grid: Grid;
	tips: { x: number; y: number; z: number }[];
	plan: BloomPlan[];
	totalTicks: number;
	done: boolean;
};

const sceneCache = new Map<string, BouquetScene>();
const particleCache = new Map<number, Particle[]>();

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

export type Camera = {
	scale: number;
	originX: number;
	originY: number;
	camZ: number;
	aspect: number;
};

export const CAM_Z = 4.35;
export const CAM_FOCAL = 3.55;
export const CAM_ASPECT = 0.55;

/**
 * Scale and vertically center the bouquet so every point stays inside the
 * grid (with padding) at every yaw, including sway.
 */
export function fitCamera(
	points: { x: number; y: number; z: number }[],
	cols: number,
	rows: number,
	extraRadius = 0,
	tight = false,
): Camera {
	const padX = Math.max(2.2, cols * 0.055);
	const padY = Math.max(1.8, rows * 0.06);
	const swayR = (tight ? 0.02 : 0.16) + extraRadius;

	let xExt = tight ? 0.02 : 0.35;
	let yUp = tight ? -1e9 : 0.2;
	let yDown = tight ? 1e9 : -0.05;
	for (const p of points) {
		const r = Math.hypot(p.x, p.z) + swayR;
		const maxP = CAM_FOCAL / Math.max(0.85, CAM_Z - r);
		const minP = CAM_FOCAL / (CAM_Z + r);
		xExt = Math.max(xExt, r * maxP);
		const a = p.y * maxP;
		const b = p.y * minP;
		yUp = Math.max(yUp, a, b);
		yDown = Math.min(yDown, a, b);
	}

	const usableW = Math.max(8, cols - padX * 2);
	const usableH = Math.max(8, rows - padY * 2);
	const scaleX = usableW / (2 * Math.max(0.2, xExt));
	const scaleY = usableH / (Math.max(0.2, yUp - yDown) * CAM_ASPECT);
	const scale = Math.max(0.4, Math.min(scaleX, scaleY));
	const originX = cols / 2;
	const originY = rows / 2 + ((yUp + yDown) / 2) * scale * CAM_ASPECT;
	return { scale, originX, originY, camZ: CAM_Z, aspect: CAM_ASPECT };
}

function sceneFor(flowers: Placement[], fill: number, ribbon: RibbonId = DEFAULT_RIBBON): BouquetScene {
	const bow = ribbonOf(ribbon);
	const key = `${fill}|${bow}|${flowers.map((f) => `${f.id}:${f.color}`).join(',')}`;
	let scene = sceneCache.get(key);
	if (!scene) {
		scene = buildScene(flowers, fill, bow);
		if (sceneCache.size > 24) sceneCache.clear();
		sceneCache.set(key, scene);
	}
	return scene;
}

function flowerFrame(plan: BloomPlan, tick: number, complete: boolean): number {
	if (complete) return plan.frames - 1;
	if (tick < plan.start) return -1;
	return Math.min(plan.frames - 1, Math.max(0, tick - plan.start));
}

function clamp01(t: number): number {
	return Math.max(0, Math.min(1, t));
}

export function easeOutCubic(t: number): number {
	const x = clamp01(t);
	return 1 - (1 - x) ** 3;
}

/** When a stem starts and finishes growing along the 0–1 growth clock. */
export function stemGrowWindow(stemId: number, mainCount: number, isMain: boolean): { start: number; end: number } {
	const start0 = 0;
	const span = 0.18;
	const dur = isMain ? 0.38 : 0.32;
	if (isMain) {
		const t = mainCount <= 1 ? 0 : stemId / (mainCount - 1);
		return { start: start0 + t * span, end: start0 + t * span + dur };
	}
	const t = (stemId * 0.6180339887) % 1;
	return { start: start0 + 0.03 + t * span, end: start0 + 0.03 + t * span + dur };
}

function stemProgress(stemId: number, isMain: boolean, mainCount: number, growth: number): number {
	const { start, end } = stemGrowWindow(stemId, mainCount, isMain);
	if (growth <= start) return 0;
	if (growth >= end) return 1;
	return easeOutCubic((growth - start) / (end - start));
}

function flowerFrameFromGrowth(flowerIndex: number, plan: BloomPlan, growth: number, complete: boolean, mainCount: number): number {
	if (complete || growth >= 1) return plan.frames - 1;
	const { end } = stemGrowWindow(flowerIndex, mainCount, true);
	if (growth < end) return -1;
	const u = (growth - end) / 0.16;
	if (u <= 0) return -1;
	return Math.min(plan.frames - 1, Math.floor(u * plan.frames));
}

function pointVisible(p: ScenePoint, growth: number | undefined, mainCount: number): boolean {
	if (growth === undefined) return true;
	if (p.stemId === -2) return false;
	if (p.stemId === -1) {
		return growth >= 0.04;
	}
	if (p.flowerIndex >= 0) return true;
	const isMain = p.stemId >= 0 && p.stemId < mainCount;
	const progress = stemProgress(p.stemId, isMain, Math.max(1, mainCount), growth);
	if (progress <= 0) return false;
	if (p.kind === 'leaf') return p.along + 0.02 <= progress;
	return p.along <= progress;
}

function applyWiggle(
	x: number,
	y: number,
	z: number,
	p: ScenePoint,
	growth: number,
	mainCount: number,
	time: number,
): { x: number; y: number; z: number } {
	if (p.stemId < 0 || p.flowerIndex >= 0) return { x, y, z };
	const isMain = p.stemId < mainCount;
	const progress = stemProgress(p.stemId, isMain, Math.max(1, mainCount), growth);
	if (progress <= 0 || progress >= 1) return { x, y, z };
	const nlen = Math.hypot(p.dx, p.dz) || 1;
	const wx = -p.dz / nlen;
	const wz = p.dx / nlen;
	const bump = Math.exp(-Math.abs(p.along - progress) * 8);
	const amp = 0.055 * Math.sin(time * 16 + p.along * 10 + p.stemId) * (1 - progress) * bump;
	return { x: x + wx * amp, y, z: z + wz * amp };
}

function stemGlyph(sx: number, sy: number): string {
	if (Math.abs(sx) < 0.32 * Math.max(0.001, Math.abs(sy))) return '|';
	return sx > 0 ? '/' : '\\';
}

/**
 * Camera sits on +Z, looking toward the origin. A point with larger z is nearer.
 * Cells are taller than they are wide, so Y is scaled to keep the bunch in proportion.
 */
function project(
	x: number,
	y: number,
	z: number,
	cam: Camera,
): { cx: number; cy: number; depth: number; persp: number } | null {
	const zc = cam.camZ - z;
	if (zc < 0.55) return null;
	const persp = CAM_FOCAL / zc;
	const cx = cam.originX + x * persp * cam.scale;
	const cy = cam.originY - y * persp * cam.scale * cam.aspect;
	return { cx, cy, depth: z, persp };
}

function applySway(x: number, y: number, z: number, time: number, strength = 1): { x: number; y: number; z: number } {
	const wind = (Math.sin(time * 1.15 + y * 1.1) * 0.055 + Math.sin(time * 0.62 + 1.7) * 0.03) * strength;
	const windZ = Math.cos(time * 0.9 + y * 0.7) * 0.03 * strength;
	const k = y * 0.85;
	return { x: x + wind * k, y, z: z + windZ * k };
}

function rotateY(x: number, y: number, z: number, yaw: number): { x: number; y: number; z: number } {
	const c = Math.cos(yaw);
	const s = Math.sin(yaw);
	return { x: x * c + z * s, y, z: -x * s + z * c };
}

function depthLight(depth: number, near: number, far: number): number {
	const span = Math.max(0.001, near - far);
	const t = (depth - far) / span;
	return 0.38 + 0.72 * Math.max(0, Math.min(1, t));
}

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
	kind: 'stem' | 'leaf' | 'flower' | 'sparkle' | 'heart' | 'critter',
	fat = 1,
) {
	if (fat > 1) {
		const o = (fat - 1) / 2;
		for (let dy = 0; dy < fat; dy++) {
			for (let dx = 0; dx < fat; dx++) {
				plot(grid, depths, cols, rows, cx - o + dx, cy - o + dy, depth, ch, color, kind, 1);
			}
		}
		return;
	}
	const x = Math.round(cx);
	const y = Math.round(cy);
	if (x < 0 || y < 0 || x >= cols || y >= rows) return;
	const i = y * cols + x;
	if (depth < depths[i]) return;
	depths[i] = depth;
	grid[y][x] = { ch, color, kind };
}

/** Stroke a 1-cell-wide line so stems stay solid when the grid is finer than the original art. */
function plotLine(
	grid: Grid,
	depths: Float32Array,
	cols: number,
	rows: number,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	depth: number,
	ch: string,
	color: string,
	kind: 'stem' | 'leaf' | 'flower' | 'sparkle' | 'heart' | 'critter',
) {
	const dx = x1 - x0;
	const dy = y1 - y0;
	const n = Math.max(1, Math.round(Math.hypot(dx, dy)));
	for (let i = 1; i < n; i++) {
		const t = i / n;
		plot(grid, depths, cols, rows, x0 + dx * t, y0 + dy * t, depth, ch, color, kind);
	}
}

function drawParticlePair(
	grid: Grid,
	depths: Float32Array,
	cols: number,
	rows: number,
	p: Particle,
	yaw: number,
	time: number,
	near: number,
	far: number,
	cam: Camera,
) {
	const ang = p.angle0 + time * p.speed + yaw * 0.15;
	let y = p.height + Math.sin(time * p.drift + p.phase) * 0.15;
	if (p.kind === 'petal') {
		y = ((p.height + time * p.drift * 0.35) % 2.4) - 0.1;
	}
	const r = p.radius + Math.sin(time * 0.4 + p.phase) * 0.08;
	const pos = rotateY(Math.sin(ang) * r, y, Math.cos(ang) * r, yaw * 0.0);
	// particles already live in a spinning world; don't double-apply bouquet yaw —
	// they should orbit independently so they feel like air around the bunch.
	const pr = project(pos.x, pos.y, pos.z, cam);
	if (!pr) return;
	const twinkle = 0.55 + 0.45 * Math.sin(time * (p.kind === 'sparkle' ? 6 : 2) + p.phase);
	if (p.kind === 'sparkle' && twinkle < 0.35) return;
	const light = depthLight(pr.depth, near, far) * (0.7 + 0.3 * twinkle);
	const color = shadeHex(p.color, light);
	if (p.kind === 'heart') {
		plot(grid, depths, cols, rows, pr.cx, pr.cy, pr.depth, '<', color, 'heart');
		plot(grid, depths, cols, rows, pr.cx + 1, pr.cy, pr.depth, '3', color, 'heart');
		return;
	}
	const ch = p.kind === 'sparkle' && twinkle > 0.85 ? (p.ch === '.' ? '+' : '*') : p.ch;
	plot(grid, depths, cols, rows, pr.cx, pr.cy, pr.depth, ch, color, p.kind === 'petal' ? 'sparkle' : p.kind);
}

const plusOffsets = [
	{ dx: 0, dy: -1, ch: '|' },
	{ dx: -1, dy: 0, ch: '-' },
	{ dx: 0, dy: 0, ch: '+' },
	{ dx: 1, dy: 0, ch: '-' },
	{ dx: 0, dy: 1, ch: '|' },
] as const;


function stemPaths(scene: BouquetScene): { id: number; pts: ScenePoint[] }[] {
	const map = new Map<number, ScenePoint[]>();
	for (const p of scene.points) {
		if (p.stemId < 0 || p.kind !== 'stem') continue;
		let list = map.get(p.stemId);
		if (!list) {
			list = [];
			map.set(p.stemId, list);
		}
		list.push(p);
	}
	const out: { id: number; pts: ScenePoint[] }[] = [];
	for (const [id, pts] of map) {
		pts.sort((a, b) => a.along - b.along);
		if (pts.length >= 2) out.push({ id, pts });
	}
	out.sort((a, b) => a.id - b.id);
	return out;
}

function alongPoint(pts: ScenePoint[], along: number): { x: number; y: number; z: number; dx: number; dz: number } {
	const t = Math.max(0, Math.min(1, along)) * (pts.length - 1);
	const i = Math.min(pts.length - 2, Math.max(0, Math.floor(t)));
	const f = t - i;
	const a = pts[i];
	const b = pts[Math.min(pts.length - 1, i + 1)];
	return {
		x: a.x + (b.x - a.x) * f,
		y: a.y + (b.y - a.y) * f,
		z: a.z + (b.z - a.z) * f,
		dx: a.dx,
		dz: a.dz,
	};
}

function drawCritters(
	grid: Grid,
	depths: Float32Array,
	cols: number,
	rows: number,
	scene: BouquetScene,
	critters: CritterPlacement[],
	intro: number,
	yaw: number,
	time: number,
	animate: boolean,
	sway: boolean,
	swayAmt: number,
	near: number,
	far: number,
	cam: Camera,
	fat = 1,
) {
	if (!critters.length || intro <= 0) return;
	const fly = intro * intro * (3 - 2 * intro);
	const t = animate ? time : 8 + intro * 0;
	const paths = stemPaths(scene);
	const main = paths.filter((p) => p.id < Math.max(1, scene.tips.length));
	const crawlPool = main.length ? main : paths;
	let crawlers = 0;
	let flyers = 0;

	for (let i = 0; i < critters.length; i++) {
		const id = critters[i].id;
		if (id === 'ladybug') {
			if (!crawlPool.length) continue;
			const path = crawlPool[crawlers % crawlPool.length];
			crawlers += 1;
			const crawl = animate ? crawlAlong(crawlers, t) : { along: 0.62, sitting: true };
			const pt = alongPoint(path.pts, crawl.along);
			const nlen = Math.hypot(pt.dx, pt.dz) || 1;
			let x = pt.x + (-pt.dz / nlen) * 0.07;
			let y = pt.y;
			let z = pt.z + (pt.dx / nlen) * 0.07;
			if (sway && swayAmt > 0) {
				const s = applySway(x, y, z, t, swayAmt);
				x = s.x;
				y = s.y;
				z = s.z;
			}
			const r = rotateY(x, y, z, yaw);
			const pr = project(r.x, r.y, r.z, cam);
			if (!pr) continue;
			const light = depthLight(pr.depth, near, far) * (0.65 + 0.35 * intro);
			const frame = critterFrames(id)[flapFrame(id, t, i, crawl.sitting || !animate)];
			for (const g of frame) {
				plot(grid, depths, cols, rows, pr.cx + g.dx * fat, pr.cy + g.dy * fat, pr.depth + 0.02, g.ch, shadeHex(g.color, light), 'critter', fat);
			}
			continue;
		}

		const kind = id === 'butterfly' ? 'butterfly' : 'bee';
		const fi = flyers;
		flyers += 1;
		const pos = flyerPose(kind, fi, t);
		const start = {
			x: pos.x * 1.75 + (fi % 2 ? 0.45 : -0.45),
			y: pos.y + 1.1,
			z: pos.z * 1.75,
		};
		const x = start.x + (pos.x - start.x) * fly;
		const y = start.y + (pos.y - start.y) * fly;
		const z = start.z + (pos.z - start.z) * fly;
		if (animate && fly > 0.12) {
			const trailN = kind === 'bee' ? 6 : 4;
			const trailColor = kind === 'bee' ? '#e8d48a' : '#d8b8ff';
			for (let k = trailN; k >= 1; k--) {
				const past = flyerPose(kind, fi, t - k * 0.05);
				const px = start.x + (past.x - start.x) * fly;
				const py = start.y + (past.y - start.y) * fly;
				const pz = start.z + (past.z - start.z) * fly;
				const tr = project(px, py, pz, cam);
				if (!tr) continue;
				const dim = 0.22 + 0.45 * (1 - k / trailN);
				plot(
					grid,
					depths,
					cols,
					rows,
					tr.cx,
					tr.cy,
					tr.depth - 0.03,
					k % 2 ? '.' : ':',
					shadeHex(trailColor, dim),
					'critter',
				);
			}
		}
		const pr = project(x, y, z, cam);
		if (!pr) continue;
		const light = depthLight(pr.depth, near, far);
		const frame = critterFrames(id)[animate ? flapFrame(id, t, i) : 0];
		for (const g of frame) {
			plot(grid, depths, cols, rows, pr.cx + g.dx * fat, pr.cy + g.dy * fat, pr.depth + 0.04, g.ch, shadeHex(g.color, light), 'critter', fat);
		}
	}
}

export function renderBouquet(opts: RenderOptions): RenderResult {
	const cols = opts.cols ?? COLS;
	const rows = opts.rows ?? ROWS;
	const flowers = opts.flowers;
	const fill = opts.fill ?? (opts.focus ? 0 : cols < 80 ? 44 : 68);
	const scene = sceneFor(flowers, fill, ribbonOf(opts.ribbon));
	const plan = planBloom(flowers);
	const total = totalTicksFor(flowers);
	const growth = opts.complete ? 1 : opts.growth;
	const tick = opts.complete ? total : (opts.tick ?? 0);
	const done = growth !== undefined ? growth >= 1 : tick >= total;
	const yaw = opts.yaw ?? 0;
	const time = opts.time ?? 0;
	const sway = opts.sway ?? false;
	const mainCount = scene.tips.length;
	const swayAmt =
		growth === undefined ? 1 : growth >= 1 ? 1 : Math.max(0, (growth - 0.55) / 0.45);
	const critters = opts.critters ?? [];
	const critterIntro = Math.max(0, Math.min(1, opts.critterIntro ?? (critters.length ? 1 : 0)));
	const camPoints = opts.focus
		? scene.points.filter((p) => p.kind === 'flower' || (p.kind === 'stem' && p.stemId >= 0 && p.along >= 0.82))
		: scene.points;
	const cam = fitCamera(
		camPoints.length ? camPoints : scene.points,
		cols,
		rows,
		opts.focus ? 0 : critters.length ? 0.16 : 0,
		!!opts.focus,
	);
	// Original sprites were authored so one glyph ≈ one cell at ~85 columns.
	// At finer grids, stamp each glyph as a block so the art stays solid.
	const fat = Math.max(1, Math.round(cam.scale * 0.05 * (CAM_FOCAL / cam.camZ)));

	const frames =
		growth !== undefined
			? plan.map((p, i) => flowerFrameFromGrowth(i, p, growth, !!opts.complete, mainCount))
			: plan.map((p) => flowerFrame(p, tick, !!opts.complete));

	const grid = emptyGrid(cols, rows);
	const depths = new Float32Array(cols * rows);
	depths.fill(-Infinity);

	// First pass: find depth range of visible points for shading.
	let near = -Infinity;
	let far = Infinity;
	const visible: { p: ScenePoint; rx: number; ry: number; rz: number; rdx: number; rdy: number; rdz: number }[] = [];

	for (const p of scene.points) {
		if (p.flowerIndex >= 0) {
			if (frames[p.flowerIndex] < 0 || p.frame !== frames[p.flowerIndex]) continue;
		} else if (!pointVisible(p, growth, mainCount)) {
			continue;
		}
		let x = p.x;
		let y = p.y;
		let z = p.z;
		let dx = p.dx;
		let dy = p.dy;
		let dz = p.dz;
		if (growth !== undefined && growth < 1) {
			const w = applyWiggle(x, y, z, p, growth, mainCount, time);
			const w2 = applyWiggle(x + dx, y + dy, z + dz, p, growth, mainCount, time);
			x = w.x;
			y = w.y;
			z = w.z;
			dx = w2.x - w.x;
			dy = w2.y - w.y;
			dz = w2.z - w.z;
		}
		if (sway && swayAmt > 0) {
			const s = applySway(x, y, z, time, swayAmt);
			const s2 = applySway(x + dx, y + dy, z + dz, time, swayAmt);
			x = s.x;
			y = s.y;
			z = s.z;
			dx = s2.x - s.x;
			dy = s2.y - s.y;
			dz = s2.z - s.z;
		}
		const r = rotateY(x, y, z, yaw);
		const rd = rotateY(dx, dy, dz, yaw);
		visible.push({ p, rx: r.x, ry: r.y, rz: r.z, rdx: rd.x, rdy: rd.y, rdz: rd.z });
		if (r.z > near) near = r.z;
		if (r.z < far) far = r.z;
	}

	if (!isFinite(near)) {
		near = 1;
		far = -1;
	}

	const lastStem = new Map<number, { cx: number; cy: number; depth: number; ch: string; color: string }>();
	for (const v of visible) {
		const pr = project(v.rx, v.ry, v.rz, cam);
		if (!pr) continue;
		const light = depthLight(pr.depth, near, far);
		let ch = v.p.ch;
		if (v.p.kind === 'stem' && v.p.stemId >= 0) {
			const a = project(v.rx, v.ry, v.rz, cam);
			const b = project(v.rx + v.rdx * 0.08, v.ry + v.rdy * 0.08, v.rz + v.rdz * 0.08, cam);
			if (a && b) ch = stemGlyph(b.cx - a.cx, b.cy - a.cy);
		}
		const color = shadeHex(v.p.color, light);
		const kind = v.p.kind === 'petal' ? 'sparkle' : v.p.kind;
		const useFat = kind === 'flower' || kind === 'leaf' ? fat : 1;
		plot(grid, depths, cols, rows, pr.cx, pr.cy, pr.depth, ch, color, kind, useFat);
		if (kind === 'stem') {
			const prev = lastStem.get(v.p.stemId);
			if (prev && Math.hypot(pr.cx - prev.cx, pr.cy - prev.cy) > 1.4) {
				plotLine(grid, depths, cols, rows, prev.cx, prev.cy, pr.cx, pr.cy, (pr.depth + prev.depth) / 2, ch, color, 'stem');
			}
			lastStem.set(v.p.stemId, { cx: pr.cx, cy: pr.cy, depth: pr.depth, ch, color });
		}
	}

	const particleFade =
		growth === undefined || growth >= 1 ? 1 : growth >= 0.78 ? (growth - 0.78) / 0.22 : 0;
	if (opts.particles && particleFade > 0) {
		let parts = particleCache.get(scene.seed);
		if (!parts) {
			parts = buildParticles(scene.seed, cols < 80 ? 18 : 28);
			particleCache.set(scene.seed, parts);
		}
		for (let i = 0; i < parts.length; i++) {
			if (i / parts.length > particleFade) continue;
			drawParticlePair(grid, depths, cols, rows, parts[i], yaw, time, near, far, cam);
		}
		// A couple of plus-shaped sparkles in screen space, orbiting slowly.
		if (time > 0) {
			const plusCount = cols < 80 ? 2 : 3;
			for (let i = 0; i < plusCount; i++) {
				const ang = time * 0.25 + i * 2.1;
				const pr = project(Math.cos(ang) * 1.55, 1.5 + Math.sin(time + i) * 0.4, Math.sin(ang) * 1.1, cam);
				if (!pr) continue;
				const on = Math.sin(time * 5 + i) > -0.3;
				if (!on) continue;
				const color = shadeHex('#5ce1ff', depthLight(pr.depth, near, far));
				for (const o of plusOffsets) {
					plot(grid, depths, cols, rows, pr.cx + o.dx, pr.cy + o.dy, pr.depth - 0.01, o.ch, color, 'sparkle');
				}
			}
		}
	}

	if (critters.length && critterIntro > 0) {
		drawCritters(
			grid,
			depths,
			cols,
			rows,
			scene,
			critters,
			critterIntro,
			yaw,
			time,
			opts.animateCritters ?? true,
			sway,
			swayAmt,
			near,
			far,
			cam,
			fat,
		);
	}

	// A tiny dim "ground" point so the bunch always has a waist, once the tuft has appeared.
	if (growth === undefined || growth > 0.04) {
		const base = project(0, 0, 0, cam);
		if (base) {
			plot(grid, depths, cols, rows, base.cx, base.cy, base.depth, 'v', shadeHex(STEM.bright, 0.85), 'stem');
		}
	}

	return {
		grid,
		tips: scene.tips.map((t) => ({ x: t.x, y: t.y, z: t.z })),
		plan,
		totalTicks: total,
		done,
	};
}

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
	const lines = grid.map((row) => row.map((c) => c?.ch ?? ' ').join('').trimEnd());
	while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
	const body = lines.join('\n');
	if (letter?.note?.trim()) {
		const note = letter.note.trim();
		const width = Math.max(...lines.map((l) => l.length), note.length);
		const pad = Math.max(0, Math.floor((width - note.length) / 2));
		return `${body}\n\n${' '.repeat(pad)}${note}\n`;
	}
	return body + '\n';
}

export { TERMINAL_BG };


export type StemJoint = {
	id: import('./types').FlowerId;
	index: number;
	hx: number;
	hy: number;
	sx: number;
	sy: number;
	gap: number;
	visible: boolean;
	connected: boolean;
	faceFlower: number;
	faceStem: number;
};

export function measureStemJoints(opts: RenderOptions): { joints: StemJoint[]; result: RenderResult } {
	const result = renderBouquet(opts);
	const cols = opts.cols ?? COLS;
	const rows = opts.rows ?? ROWS;
	const fill = opts.fill ?? (opts.focus ? 0 : cols < 80 ? 44 : 68);
	const scene = sceneFor(opts.flowers, fill, ribbonOf(opts.ribbon));
	const yaw = opts.yaw ?? 0;
	const cam = fitCamera(
		opts.focus
			? scene.points.filter((p) => p.kind === 'flower' || (p.kind === 'stem' && p.stemId >= 0 && p.along >= 0.82))
			: scene.points,
		cols,
		rows,
		opts.focus ? 0 : opts.critters?.length ? 0.16 : 0,
		!!opts.focus,
	);
	const projectH = (x: number, y: number, z: number) => {
		const r = rotateY(x, y, z, yaw);
		return project(r.x, r.y, r.z, cam);
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
	const joints: StemJoint[] = [];
	for (let i = 0; i < scene.tips.length; i++) {
		const tip = scene.tips[i];
		const head = projectH(tip.x, tip.y, tip.z);
		if (!head) continue;
		const mid = projectH(tip.x, tip.y, tip.z);
		const sx = mid?.cx ?? head.cx;
		const sy = mid?.cy ?? head.cy;
		const gap = mid ? Math.hypot(mid.cx - head.cx, mid.cy - head.cy) : 0;
		const under = countKind(head.cx, head.cy, -4, 4, 0, 6, ['stem', 'leaf']);
		const faceFlower = countKind(head.cx, head.cy, -3, 3, -6, -2, ['flower']);
		const faceStem = countKind(head.cx, head.cy, -3, 3, -6, -2, ['stem']);
		joints.push({
			id: tip.id,
			index: i,
			hx: head.cx,
			hy: head.cy,
			sx,
			sy,
			gap,
			visible: kindsNear(head.cx, head.cy, 6, ['flower']) > 2,
			connected: under > 0,
			faceFlower,
			faceStem,
		});
	}
	return { joints, result };
}
