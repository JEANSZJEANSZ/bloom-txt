/**
 * Parametric 3D flower meshes, sampled densely as points with normals
 * (in the spirit of donut.c). Each mesh is stored at several "openness"
 * keyframes so a bud can unfold into a full bloom by interpolation.
 *
 * Local frame: the flower sits on its stem at the origin and opens along +Y.
 */
import type { FlowerId } from './types';

export const OPEN_KEYS = 9;

export const SLOT_THROAT = 0;
export const SLOT_PETAL = 1;
export const SLOT_TIP = 2;
export const SLOT_CENTER = 3;
export const SLOT_CENTER_HOT = 4;
export const SLOT_FILAMENT = 5;
export const SLOT_ANTHER = 6;
export const SLOT_SEPAL = 7;
export const SLOT_SPECK = 8;
export const SLOT_COUNT = 9;

export type FlowerMesh = {
	count: number;
	/** OPEN_KEYS arrays of xyz positions, same point order in every key. */
	pos: Float32Array[];
	nor: Float32Array[];
	slot: Uint8Array;
	/** Per-point brightness multiplier (dark throat, midrib crease); 1 = flat. */
	tone: Float32Array;
};

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

type Shape = 'lance' | 'round' | 'ray' | 'fringe';

type Whorl = {
	count: number;
	length: number;
	width: number;
	shape: Shape;
	/** Elevation from the flower axis (radians) when closed / fully open. */
	open: [number, number];
	/** Extra bend toward the tip when open (positive recurves outward / down). */
	curl: number;
	/** Inward bend toward the tip when closed, so buds close into a point. */
	pinch?: number;
	/** Cross-section curvature; edges lift toward the flower's center. */
	cup?: number;
	/** V-shaped midrib fold (0–1), gives petals two lit halves. */
	crease?: number;
	ruffle?: number;
	phase?: number;
	jitter?: number;
	radius0?: number;
	lift?: number;
	budLen?: number;
	budWidth?: number;
	throat?: number;
	tipLight?: boolean;
	speckle?: number;
	/** Shade the petal itself: dark heart → bright tips, dark midrib. Replaces throat slots. */
	shade?: { heart: number; reach: number; crease: number; edge?: number; dim?: number };
	slot?: number;
	ox?: number;
	oz?: number;
};

type Emit = (x: number, y: number, z: number, nx: number, ny: number, nz: number, slot: number, tone?: number) => void;

function hash(a: number, b: number, c: number): number {
	const h = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
	return h - Math.floor(h);
}

function widthAt(shape: Shape, u: number): number {
	switch (shape) {
		case 'lance':
			// Widest a third of the way out, tapering to a sharp tip.
			return u < 0.32
				? Math.pow(Math.sin((Math.PI / 2) * (u / 0.32)), 0.75)
				: Math.pow(Math.cos((Math.PI / 2) * ((u - 0.32) / 0.68)), 1.15);
		case 'round': {
			const t = (u - 0.56) / 0.56;
			return Math.sqrt(Math.max(0, 1 - t * t));
		}
		case 'ray':
			return Math.min(1, u * 5) * Math.sqrt(Math.max(0, 1 - Math.pow(u, 8)));
		case 'fringe':
			return Math.min(1, u * 4) * (0.5 + 0.5 * u);
	}
}

function petal(w: Whorl, p: number, o: number, sp: number, emit: Emit) {
	const phi = (p / w.count) * TAU + (w.phase ?? 0) + (hash(p, 1, w.count) - 0.5) * (w.jitter ?? 0.15);
	const rx = Math.sin(phi);
	const rz = Math.cos(phi);
	const tx = Math.cos(phi);
	const tz = -Math.sin(phi);
	const nu = Math.max(4, Math.ceil(w.length / sp) + 1);
	const nv = Math.max(3, Math.ceil((2 * w.width) / sp) + 1);
	const budLen = w.budLen ?? 0.7;
	const budWidth = w.budWidth ?? 0.75;
	const L = w.length * (budLen + (1 - budLen) * o) * (1 + (hash(p, 3, 4) - 0.5) * 0.12);
	const th0 = w.open[0] + (w.open[1] - w.open[0]) * o + (hash(p, 5, 6) - 0.5) * 0.14 * o;
	const bend = w.curl * o - (w.pinch ?? 0.4) * (1 - o);
	const ws = budWidth + (1 - budWidth) * o;
	const cup = w.cup ?? 0.3;
	const crease = w.crease ?? 0;
	const ruffle = w.ruffle ?? 0;
	const ox = w.ox ?? 0;
	const oz = w.oz ?? 0;
	const P = new Float32Array(nu * nv * 3);
	const IN = new Float32Array(nu * 2);
	let cr = w.radius0 ?? 0.01;
	let cy = w.lift ?? 0;
	const ds = L / (nu - 1);
	for (let i = 0; i < nu; i++) {
		const u = i / (nu - 1);
		if (i > 0) {
			const um = (i - 0.5) / (nu - 1);
			const thm = th0 + bend * um * um;
			cr += Math.sin(thm) * ds;
			cy += Math.cos(thm) * ds;
		}
		const th = th0 + bend * u * u;
		const inR = -Math.cos(th);
		const inY = Math.sin(th);
		IN[i * 2] = inR;
		IN[i * 2 + 1] = inY;
		const wd = w.width * ws * widthAt(w.shape, u);
		for (let j = 0; j < nv; j++) {
			const v = -1 + (2 * j) / (nv - 1);
			const lat = v * wd;
			const av = Math.abs(v);
			let off = cup * (crease * av + (1 - crease) * v * v) * wd;
			if (ruffle) off += ruffle * Math.sin(v * 7 + u * 11 + p * 1.7) * wd * u;
			const rr = cr + inR * off;
			const yy = cy + inY * off;
			const k = (i * nv + j) * 3;
			P[k] = ox + rx * rr + tx * lat;
			P[k + 1] = yy;
			P[k + 2] = oz + rz * rr + tz * lat;
		}
	}
	for (let i = 0; i < nu; i++) {
		const u = i / (nu - 1);
		for (let j = 0; j < nv; j++) {
			const v = -1 + (2 * j) / (nv - 1);
			if (w.shape === 'fringe' && u > 0.86 && Math.floor((v + 1) * 3.5) % 2 === 1) continue;
			const i0 = Math.max(0, i - 1);
			const i1 = Math.min(nu - 1, i + 1);
			const j0 = Math.max(0, j - 1);
			const j1 = Math.min(nv - 1, j + 1);
			const a = (i1 * nv + j) * 3;
			const b = (i0 * nv + j) * 3;
			const c = (i * nv + j1) * 3;
			const d = (i * nv + j0) * 3;
			const ux = P[a] - P[b];
			const uy = P[a + 1] - P[b + 1];
			const uz = P[a + 2] - P[b + 2];
			const vx = P[c] - P[d];
			const vy = P[c + 1] - P[d + 1];
			const vz = P[c + 2] - P[d + 2];
			let nx = uy * vz - uz * vy;
			let ny = uz * vx - ux * vz;
			let nz = ux * vy - uy * vx;
			let len = Math.hypot(nx, ny, nz);
			if (len < 1e-9) {
				nx = rx * IN[i * 2];
				ny = IN[i * 2 + 1];
				nz = rz * IN[i * 2];
				len = Math.hypot(nx, ny, nz) || 1;
			}
			let slot = w.slot ?? SLOT_PETAL;
			let tone = 1;
			if (w.slot === undefined) {
				if (w.throat !== undefined || !w.shade) {
					if (u < (w.throat ?? 0.2)) slot = SLOT_THROAT;
				}
				if (slot === SLOT_PETAL) {
					if (w.tipLight && u > 0.8) slot = SLOT_TIP;
					else if (w.speckle && u > 0.16 && u < 0.6 && Math.abs(v) < 0.55 && hash(p * 31 + i, j, 7) < w.speckle)
						slot = SLOT_SPECK;
				}
			}
			if (w.shade) {
				const s = Math.min(1, u / w.shade.reach);
				const heart = 1 - w.shade.heart * (1 - s * s * (3 - 2 * s));
				const rib = 1 - w.shade.crease * Math.exp(-((v / 0.13) ** 2)) * (u > 0.06 && u < 0.92 ? 1 : 0.4);
				const av2 = Math.abs(v);
				const edge = w.shade.edge ? 1 - w.shade.edge * Math.max(0, (av2 - 0.62) / 0.38) ** 1.5 : 1;
				tone = heart * rib * edge * (1 - 0.12 * v * v) * (w.shade.dim ?? 1);
			}
			const k = (i * nv + j) * 3;
			emit(P[k], P[k + 1], P[k + 2], nx / len, ny / len, nz / len, slot, tone);
		}
	}
}

function whorl(w: Whorl, o: number, sp: number, emit: Emit) {
	for (let p = 0; p < w.count; p++) petal(w, p, o, sp, emit);
}

function disc(
	R: number,
	dome: number,
	lift: number,
	sp: number,
	pattern: 'seeds' | 'ring' | 'plain',
	emit: Emit,
	ox = 0,
	oz = 0,
	toneIn = 1,
	toneOut = 1,
) {
	const N = Math.max(6, Math.ceil((Math.PI * R * R) / (sp * sp * 0.7)));
	for (let i = 0; i < N; i++) {
		const r = R * Math.sqrt((i + 0.5) / N);
		const a = i * GOLDEN;
		const sx = Math.sin(a);
		const sz = Math.cos(a);
		const y = lift + dome * (1 - (r / R) ** 2);
		const g = (2 * dome * r) / (R * R);
		const len = Math.hypot(g, 1);
		let slot = SLOT_CENTER;
		if (pattern === 'seeds') slot = i % 3 === 0 ? SLOT_CENTER_HOT : SLOT_CENTER;
		if (pattern === 'ring') slot = r > R * 0.7 ? SLOT_CENTER_HOT : SLOT_CENTER;
		emit(ox + r * sx, y, oz + r * sz, (g * sx) / len, 1 / len, (g * sz) / len, slot, toneIn + (toneOut - toneIn) * Math.sqrt(r / R));
	}
}

function stamens(n: number, len: number, lift: number, o: number, sp: number, pistil: boolean, emit: Emit) {
	const steps = Math.max(3, Math.ceil(len / sp));
	const L = len * (0.12 + 0.88 * o);
	for (let s = 0; s < n; s++) {
		const phi = (s / n) * TAU + 0.35;
		const sx = Math.sin(phi);
		const sz = Math.cos(phi);
		const th0 = 0.14 + 0.5 * o;
		let r = 0;
		let y = lift;
		for (let i = 1; i <= steps; i++) {
			const u = i / steps;
			const th = th0 + 0.55 * u * o;
			r += (Math.sin(th) * L) / steps;
			y += (Math.cos(th) * L) / steps;
			emit(r * sx, y, r * sz, sx * 0.6, 0.8, sz * 0.6, SLOT_FILAMENT);
		}
		for (let q = 0; q < 5; q++) {
			const a = (q / 5) * TAU;
			const d = 0.011;
			emit(r * sx + Math.cos(a) * d * sz, y + Math.sin(a) * d * 0.6, r * sz - Math.cos(a) * d * sx, sx, 0.4, sz, SLOT_ANTHER);
		}
	}
	if (pistil) {
		let y = lift;
		const L2 = len * 1.05 * (0.12 + 0.88 * o);
		for (let i = 1; i <= steps; i++) {
			y += L2 / steps;
			emit(0.004 * i * o, y, 0, 0.3, 0.9, 0.3, SLOT_FILAMENT);
		}
		for (let q = 0; q < 4; q++) {
			const a = (q / 4) * TAU;
			emit(0.04 * o + Math.cos(a) * 0.008, y, Math.sin(a) * 0.008, 0, 1, 0, SLOT_CENTER_HOT);
		}
	}
}

function spike(o: number, sp: number, emit: Emit) {
	// Dense cone of overlapping florets, three per level, lighter toward the tip.
	const levels = 22;
	const H = 0.5;
	for (let lv = 0; lv < levels; lv++) {
		const t = lv / (levels - 1);
		const y = t * H;
		for (let k = 0; k < 3; k++) {
			const ang = lv * 0.9 + (k / 3) * TAU;
			const rad = 0.03 * (1 - 0.55 * t);
			const rf = (0.012 + 0.014 * o) * (1 - 0.3 * t);
			const cx = rad * Math.sin(ang);
			const cz = rad * Math.cos(ang);
			const rfMax = 0.026 * (1 - 0.3 * t); // fixed per level so every keyframe has the same point count
			const m = Math.max(10, Math.min(120, Math.ceil((4 * Math.PI * rfMax * rfMax) / (sp * sp * 0.9))));
			const slot = (lv + k) % 4 === 0 ? SLOT_TIP : SLOT_PETAL;
			const base = 0.78 + 0.22 * t;
			for (let q = 0; q < m; q++) {
				const yq = 1 - (2 * (q + 0.5)) / m;
				const rq = Math.sqrt(1 - yq * yq);
				const a = q * GOLDEN;
				const nx = rq * Math.sin(a);
				const nz = rq * Math.cos(a);
				emit(cx + nx * rf, y + yq * rf, cz + nz * rf, nx, yq, nz, slot, base * (0.8 + 0.2 * (yq * 0.5 + 0.5)));
			}
		}
	}
}

const sepals = (count: number, length: number): Whorl => ({
	count,
	length,
	width: 0.022,
	shape: 'ray',
	open: [0.35, 1.85],
	curl: 0.35,
	pinch: 0,
	cup: 0.2,
	lift: -0.01,
	slot: SLOT_SEPAL,
	budLen: 1,
	budWidth: 1,
});

function build(id: FlowerId, o: number, sp: number, emit: Emit) {
	switch (id) {
		case 'lily': {
			const base = {
				shape: 'lance' as const,
				curl: 1.45,
				pinch: 0.5,
				cup: 0.55,
				crease: 0.75,
				budLen: 0.62,
				budWidth: 0.62,
				shade: { heart: 0.55, reach: 0.6, crease: 0.5 },
				radius0: 0.014,
			};
			whorl({ ...base, count: 3, length: 0.48, width: 0.1, open: [0.1, 0.62], phase: 0 }, o, sp, emit);
			whorl({ ...base, count: 3, length: 0.46, width: 0.115, open: [0.08, 0.55], phase: Math.PI / 3, curl: 1.35 }, o, sp, emit);
			stamens(6, 0.3, 0.02, o, sp, true, emit);
			return;
		}
		case 'tulip': {
			const base = {
				shape: 'round' as const,
				curl: 0.3,
				pinch: 0.2,
				cup: 0.8,
				budLen: 0.82,
				budWidth: 0.9,
				shade: { heart: 0.3, reach: 0.75, crease: 0.15, edge: 0.4 },
			};
			whorl({ ...base, count: 3, length: 0.31, width: 0.15, open: [0.06, 0.5] }, o, sp, emit);
			whorl({ ...base, count: 3, length: 0.29, width: 0.14, open: [0.04, 0.36], phase: Math.PI / 3, shade: { ...base.shade, dim: 0.82 } }, o, sp, emit);
			return;
		}
		case 'rose': {
			// Five tight spiral layers; inner layers sit deeper and darker, every petal
			// has a dark base and rolled-edge shading so the layers read as a spiral cup.
			const counts = [3, 4, 5, 6, 8];
			const lens = [0.11, 0.14, 0.17, 0.2, 0.23];
			const wids = [0.08, 0.1, 0.12, 0.14, 0.16];
			const opens: [number, number][] = [
				[0.02, 0.12],
				[0.05, 0.32],
				[0.08, 0.6],
				[0.12, 0.95],
				[0.18, 1.2],
			];
			const curls = [0, 0.1, 0.22, 0.38, 0.55];
			for (let i = 0; i < 5; i++) {
				whorl(
					{
						count: counts[i],
						length: lens[i],
						width: wids[i],
						shape: 'round',
						open: opens[i],
						curl: curls[i],
						pinch: 0.25,
						cup: 0.7,
						phase: i * 2.4,
						radius0: 0.004 + i * 0.006,
						budLen: 0.8,
						budWidth: 0.9,
						tipLight: i >= 2,
						shade: { heart: 0.55, reach: 0.7, crease: 0.1, edge: 0.6, dim: 0.74 + 0.065 * i },
					},
					o,
					sp,
					emit,
				);
			}
			whorl(sepals(5, 0.1), o, sp, emit);
			return;
		}
		case 'peony': {
			for (let i = 0; i < 6; i++) {
				whorl(
					{
						count: 5 + i,
						length: 0.09 + i * 0.03,
						width: 0.07 + i * 0.02,
						shape: 'round',
						open: [0.05 + i * 0.03, 0.25 + i * 0.25],
						curl: 0.3,
						pinch: 0.2,
						cup: 0.55,
						ruffle: 0.12,
						phase: i * 1.9,
						radius0: 0.004 + i * 0.006,
						budLen: 0.8,
						budWidth: 0.9,
						shade: { heart: 0.42, reach: 0.65, crease: 0.12, edge: 0.5, dim: 0.7 + 0.06 * i },
					},
					o,
					sp,
					emit,
				);
			}
			return;
		}
		case 'mum': {
			// Shaggy pom of many narrow rays: inner layers curl inward, outer ones spread.
			const curls = [-0.7, -0.5, -0.25, 0, 0.25];
			for (let i = 0; i < 5; i++) {
				whorl(
					{
						count: 20,
						length: 0.09 + i * 0.026,
						width: 0.024,
						shape: 'ray',
						open: [0.05 + i * 0.03, 0.2 + i * 0.33],
						curl: curls[i],
						pinch: 0.2,
						cup: 0.55,
						phase: i * 0.21,
						budLen: 0.75,
						shade: { heart: 0.4, reach: 0.7, crease: 0.3, edge: 0.25, dim: 0.7 + 0.075 * i },
					},
					o,
					sp,
					emit,
				);
			}
			return;
		}
		case 'daisy': {
			// Two rings of separate white rays (back ring lower and darker) around a domed yellow disc.
			const ray = { shape: 'ray' as const, curl: 0.15, pinch: 0.3, cup: 0.3, shade: { heart: 0.25, reach: 0.45, crease: 0.3, edge: 0.2 } };
			whorl({ ...ray, count: 14, length: 0.23, width: 0.034, open: [0.12, 1.42], phase: 0.2, lift: -0.012, shade: { ...ray.shade, dim: 0.86 } }, o, sp, emit);
			whorl({ ...ray, count: 14, length: 0.24, width: 0.036, open: [0.12, 1.52], phase: 0.2 + Math.PI / 14 }, o, sp, emit);
			disc(0.065, 0.045, 0.006, sp, 'ring', emit, 0, 0, 0.75, 1);
			return;
		}
		case 'sunflower': {
			const ray = { shape: 'ray' as const, curl: 0.2, pinch: 0.3, cup: 0.3, shade: { heart: 0.4, reach: 0.5, crease: 0.35, edge: 0.3 } };
			whorl({ ...ray, count: 17, length: 0.2, width: 0.05, open: [0.15, 1.42], phase: 0.1, lift: -0.01, shade: { ...ray.shade, dim: 0.8 } }, o, sp, emit);
			whorl({ ...ray, count: 17, length: 0.19, width: 0.05, open: [0.12, 1.52], phase: 0.1 + Math.PI / 17 }, o, sp, emit);
			disc(0.115, 0.03, 0.005, sp, 'seeds', emit, 0, 0, 0.6, 1);
			return;
		}
		case 'cornflower': {
			whorl({ count: 13, length: 0.15, width: 0.042, shape: 'fringe', open: [0.15, 1.2], curl: 0.15, cup: 0.3, phase: 0.1, shade: { heart: 0.4, reach: 0.5, crease: 0.2, edge: 0.3 } }, o, sp, emit);
			whorl({ count: 10, length: 0.095, width: 0.034, shape: 'fringe', open: [0.1, 0.75], curl: 0.1, cup: 0.3, phase: 0.4, lift: 0.01, shade: { heart: 0.35, reach: 0.5, crease: 0.15, edge: 0.3, dim: 0.78 } }, o, sp, emit);
			disc(0.03, 0.02, 0.02, sp, 'plain', emit, 0, 0, 0.7, 1);
			return;
		}
		case 'poppy':
			// Four crinkled silky petals with a black blotch at the base and a dark stamen ring.
			whorl(
				{ count: 4, length: 0.21, width: 0.19, shape: 'round', open: [0.1, 0.85], curl: 0.28, pinch: 0.3, cup: 0.5, ruffle: 0.07, jitter: 0.25, throat: 0.26, shade: { heart: 0.3, reach: 0.55, crease: 0.12, edge: 0.3 } },
				o,
				sp,
				emit,
			);
			disc(0.035, 0.03, 0.01, sp, 'plain', emit, 0, 0, 0.8, 1);
			stamens(20, 0.055, 0.01, o, sp, false, emit);
			return;
		case 'violet':
			// Pansy-like: five rounded petals, bright throat, dark creases.
			whorl({ count: 5, length: 0.11, width: 0.08, shape: 'round', open: [0.2, 1.35], curl: 0.15, cup: 0.3, throat: 0.3, shade: { heart: 0.2, reach: 0.6, crease: 0.35, edge: 0.3 } }, o, sp, emit);
			disc(0.014, 0.006, 0.006, sp, 'plain', emit);
			return;
		case 'lavender':
			spike(o, sp, emit);
			return;
		case 'forgetmenot': {
			// A cluster of five small open blossoms with white throats and yellow eyes.
			const spots: [number, number, number][] = [[0, 0.03, 0]];
			for (let q = 0; q < 4; q++) spots.push([0.115 * Math.cos(q * 1.57 + 0.5), 0.004 + (q % 2) * 0.006, 0.115 * Math.sin(q * 1.57 + 0.5)]);
			for (const [x, y, z] of spots) {
				whorl(
					{ count: 5, length: 0.075, width: 0.052, shape: 'round', open: [0.3, 1.45], curl: 0.1, cup: 0.25, lift: y, ox: x, oz: z, throat: 0.22, budLen: 0.8, shade: { heart: 0.1, reach: 0.6, crease: 0.15, edge: 0.3 } },
					o,
					sp,
					emit,
				);
				disc(0.014, 0.005, y + 0.005, sp, 'plain', emit, x, z);
			}
			return;
		}
	}
}

const meshCache = new Map<string, FlowerMesh>();

export function flowerMesh(id: FlowerId, sp: number): FlowerMesh {
	const key = `${id}|${sp}`;
	const hit = meshCache.get(key);
	if (hit) return hit;
	const pos: Float32Array[] = [];
	const nor: Float32Array[] = [];
	let slot: Uint8Array | null = null;
	let tone: Float32Array | null = null;
	let count = 0;
	for (let k = 0; k < OPEN_KEYS; k++) {
		const o = k / (OPEN_KEYS - 1);
		const P: number[] = [];
		const N: number[] = [];
		const S: number[] = [];
		const T: number[] = [];
		build(id, o, sp, (x, y, z, nx, ny, nz, s, tn) => {
			P.push(x, y, z);
			N.push(nx, ny, nz);
			S.push(s);
			T.push(tn ?? 1);
		});
		if (k === OPEN_KEYS - 1) tone = Float32Array.from(T);
		if (k === 0) {
			count = S.length;
			slot = Uint8Array.from(S);
		} else if (S.length !== count) {
			throw new Error(`flower mesh ${id} changed point count between keyframes`);
		}
		pos.push(Float32Array.from(P));
		nor.push(Float32Array.from(N));
	}
	const mesh: FlowerMesh = { count, pos, nor, slot: slot!, tone: tone! };
	meshCache.set(key, mesh);
	return mesh;
}
