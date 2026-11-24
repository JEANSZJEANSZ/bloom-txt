/**
 * 3D bouquet layout: flower heads on a dome, tube stems that cross at a tied
 * ribbon, and curved leaf blades. Static geometry is
 * stored as flat typed arrays so the per-frame loop stays tight.
 */
import { resolveFlowerColors } from './flowerColors';
import { flowerMesh, SLOT_COUNT, type FlowerMesh } from './flora3d';
import { mulberry32, seedFromFlowers } from './rng';
import { DEFAULT_RIBBON, RIBBON, type RibbonId } from './ribbon';
import type { ColorId, FlowerId, Placement } from './types';

export type V3 = { x: number; y: number; z: number };

export type StemCurve = { p0: V3; p1: V3; p2: V3; p3: V3 };

export type FlowerInst = {
	id: FlowerId;
	color: ColorId;
	mesh: FlowerMesh;
	base: V3;
	/** Columns of the local→world rotation: X, Y (flower axis), Z. */
	m: Float32Array;
	size: number;
	stem: number;
	/** rgb (0xRRGGBB) per mesh color slot. */
	palette: Int32Array;
};

export const KIND_STEM = 0;
export const KIND_LEAF = 1;
export const KIND_FLOWER = 2;
export const KIND_ROOT = 3;
export const KIND_RIBBON = 4;

export type Group = {
	kind: number;
	pos: Float32Array;
	nor: Float32Array;
	rgb: Int32Array;
	/** 0–1 along the stem/root/leaf, for growth. */
	along: Float32Array;
	/** Stem index this group belongs to (-1 base leaves, -2 roots, -3 ribbon). */
	stem: number;
	/** Where the group unfurls from. */
	origin: V3;
	/** For stem leaves: where on the stem the leaf is attached (0–1). */
	attach: number;
};

export type Scene3 = {
	flowers: FlowerInst[];
	groups: Group[];
	stems: StemCurve[];
	seed: number;
	/** Rest-pose sample of the full bloom, used to fit the camera. */
	bounds: V3[];
	/** Flower-head points only, for close-up framing. */
	headBounds: V3[];
	tie: V3;
};

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function scaleRgb(rgb: number, f: number): number {
	const c = (s: number) => Math.max(0, Math.min(255, Math.round(((rgb >> s) & 255) * f)));
	return (c(16) << 16) | (c(8) << 8) | c(0);
}

function hexToInt(hex: string): number {
	return parseInt(hex.replace('#', ''), 16) | 0;
}

export function bez(c: StemCurve, t: number): V3 {
	const a = 1 - t;
	const w0 = a * a * a;
	const w1 = 3 * a * a * t;
	const w2 = 3 * a * t * t;
	const w3 = t * t * t;
	return {
		x: c.p0.x * w0 + c.p1.x * w1 + c.p2.x * w2 + c.p3.x * w3,
		y: c.p0.y * w0 + c.p1.y * w1 + c.p2.y * w2 + c.p3.y * w3,
		z: c.p0.z * w0 + c.p1.z * w1 + c.p2.z * w2 + c.p3.z * w3,
	};
}

export function bezTangent(c: StemCurve, t: number): V3 {
	const a = 1 - t;
	const k0 = -3 * a * a;
	const k1 = 3 * a * a - 6 * a * t;
	const k2 = 6 * a * t - 3 * t * t;
	const k3 = 3 * t * t;
	const x = c.p0.x * k0 + c.p1.x * k1 + c.p2.x * k2 + c.p3.x * k3;
	const y = c.p0.y * k0 + c.p1.y * k1 + c.p2.y * k2 + c.p3.y * k3;
	const z = c.p0.z * k0 + c.p1.z * k1 + c.p2.z * k2 + c.p3.z * k3;
	const l = Math.hypot(x, y, z) || 1;
	return { x: x / l, y: y / l, z: z / l };
}

/** Mesh scale per flower so open heads have believable relative sizes (lily ≈ 0.25 radius). */
const SIZE: Record<FlowerId, number> = {
	lily: 0.6,
	tulip: 0.8,
	rose: 0.62,
	peony: 0.64,
	mum: 0.95,
	daisy: 0.8,
	sunflower: 0.88,
	cornflower: 1,
	poppy: 0.8,
	violet: 0.9,
	lavender: 1,
	forgetmenot: 0.95,
};

/** Height of a lone flower's axis relative to its forward tilt (bigger = more upright). */
const SOLO_UP: Partial<Record<FlowerId, number>> = {
	lavender: 6,
	tulip: 2.6,
	rose: 0.7,
	peony: 0.8,
	forgetmenot: 0.6,
	sunflower: 0.25,
	daisy: 0.3,
	mum: 0.45,
	poppy: 0.5,
	cornflower: 0.5,
	violet: 0.5,
	lily: 0.6,
};

const FLAT = new Set<FlowerId>(['sunflower', 'daisy', 'poppy', 'cornflower', 'violet', 'mum', 'forgetmenot']);

/** Open-head radius per flower at SIZE scale, for packing. */
const HEAD_R: Record<FlowerId, number> = {
	lily: 0.25,
	tulip: 0.16,
	rose: 0.2,
	peony: 0.21,
	mum: 0.2,
	daisy: 0.21,
	sunflower: 0.22,
	cornflower: 0.14,
	poppy: 0.2,
	violet: 0.12,
	lavender: 0.1,
	forgetmenot: 0.18,
};

class GroupBuilder {
	P: number[] = [];
	N: number[] = [];
	C: number[] = [];
	A: number[] = [];
	push(x: number, y: number, z: number, nx: number, ny: number, nz: number, rgb: number, along: number) {
		this.P.push(x, y, z);
		this.N.push(nx, ny, nz);
		this.C.push(rgb);
		this.A.push(along);
	}
	done(kind: number, stem: number, origin: V3, attach = 0): Group {
		return {
			kind,
			pos: Float32Array.from(this.P),
			nor: Float32Array.from(this.N),
			rgb: Int32Array.from(this.C),
			along: Float32Array.from(this.A),
			stem,
			origin,
			attach,
		};
	}
}

function frameFor(t: V3): { a: V3; b: V3 } {
	const ref = Math.abs(t.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
	let ax = t.y * ref.z - t.z * ref.y;
	let ay = t.z * ref.x - t.x * ref.z;
	let az = t.x * ref.y - t.y * ref.x;
	const l = Math.hypot(ax, ay, az) || 1;
	ax /= l;
	ay /= l;
	az /= l;
	return {
		a: { x: ax, y: ay, z: az },
		b: { x: t.y * az - t.z * ay, y: t.z * ax - t.x * az, z: t.x * ay - t.y * ax },
	};
}

function tube(
	g: GroupBuilder,
	curve: (t: number) => V3,
	tangent: (t: number) => V3,
	length: number,
	radius: (t: number) => number,
	sp: number,
	ring: number,
	color: (t: number) => number,
	alongOf: (t: number) => number = (t) => t,
) {
	const n = Math.max(4, Math.ceil(length / sp));
	for (let i = 0; i <= n; i++) {
		const t = i / n;
		const c = curve(t);
		const tg = tangent(t);
		const { a, b } = frameFor(tg);
		const r = radius(t);
		const rgb = color(t);
		for (let k = 0; k < ring; k++) {
			const ang = (k / ring) * TAU + i * 0.5;
			const ca = Math.cos(ang);
			const sa = Math.sin(ang);
			const nx = a.x * ca + b.x * sa;
			const ny = a.y * ca + b.y * sa;
			const nz = a.z * ca + b.z * sa;
			g.push(c.x + nx * r, c.y + ny * r, c.z + nz * r, nx, ny, nz, rgb, alongOf(t));
		}
	}
}

/** A curved leaf blade growing from `o` in horizontal direction `dir`. */
function blade(
	g: GroupBuilder,
	o: V3,
	dirAng: number,
	length: number,
	width: number,
	th0: number,
	th1: number,
	twist: number,
	sp: number,
	dark: number,
	light: number,
) {
	const rx = Math.sin(dirAng);
	const rz = Math.cos(dirAng);
	const tx = Math.cos(dirAng);
	const tz = -Math.sin(dirAng);
	const nu = Math.max(4, Math.ceil(length / sp) + 1);
	const nv = Math.max(3, Math.ceil((2 * width) / sp) + 1);
	const P = new Float32Array(nu * nv * 3);
	let cr = 0;
	let cy = 0;
	const ds = length / (nu - 1);
	for (let i = 0; i < nu; i++) {
		const u = i / (nu - 1);
		if (i > 0) {
			const um = (i - 0.5) / (nu - 1);
			const thm = th0 + (th1 - th0) * um * um;
			cr += Math.sin(thm) * ds;
			cy += Math.cos(thm) * ds;
		}
		const th = th0 + (th1 - th0) * u * u;
		const inR = -Math.cos(th);
		const inY = Math.sin(th);
		const wd = width * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)), 0.8);
		const tw = twist * u;
		for (let j = 0; j < nv; j++) {
			const v = -1 + (2 * j) / (nv - 1);
			const lat = v * wd * Math.cos(tw);
			const off = 0.4 * v * v * wd + v * wd * Math.sin(tw);
			const rr = cr + inR * off;
			const k = (i * nv + j) * 3;
			P[k] = o.x + rx * rr + tx * lat;
			P[k + 1] = o.y + cy + inY * off;
			P[k + 2] = o.z + rz * rr + tz * lat;
		}
	}
	for (let i = 0; i < nu; i++) {
		const u = i / (nu - 1);
		for (let j = 0; j < nv; j++) {
			const v = -1 + (2 * j) / (nv - 1);
			const a = (Math.min(nu - 1, i + 1) * nv + j) * 3;
			const b = (Math.max(0, i - 1) * nv + j) * 3;
			const c = (i * nv + Math.min(nv - 1, j + 1)) * 3;
			const d = (i * nv + Math.max(0, j - 1)) * 3;
			const ux = P[a] - P[b];
			const uy = P[a + 1] - P[b + 1];
			const uz = P[a + 2] - P[b + 2];
			const vx = P[c] - P[d];
			const vy = P[c + 1] - P[d + 1];
			const vz = P[c + 2] - P[d + 2];
			let nx = uy * vz - uz * vy;
			let ny = uz * vx - ux * vz;
			let nz = ux * vy - uy * vx;
			const len = Math.hypot(nx, ny, nz);
			if (len < 1e-9) {
				nx = rx;
				ny = 0.3;
				nz = rz;
			} else {
				nx /= len;
				ny /= len;
				nz /= len;
			}
			const k = (i * nv + j) * 3;
			const rib = Math.abs(v) < 0.18;
			g.push(P[k], P[k + 1], P[k + 2], nx, ny, nz, rib ? light : dark, u);
		}
	}
}


/** A small green collar just beneath the head, sitting on the stem top. Drawn with normal depth so petals in front hide it. */
function calyx(
	g: GroupBuilder,
	base: V3,
	X: V3,
	Y: V3,
	Z: V3,
	size: number,
	sp: number,
	dark: number,
	mid: number,
) {
	const rad = 0.012 + size * 0.016;
	const h = 0.018 + size * 0.016;
	const rings = Math.max(2, Math.ceil(h / Math.max(0.007, sp)));
	const around = Math.max(6, Math.ceil((TAU * rad) / Math.max(0.007, sp)));
	for (let j = 0; j <= rings; j++) {
		const t = j / rings;
		const along = 0.9 + 0.1 * t;
		// Entirely under the receptacle: y is negative along the flower axis.
		const y = -h * (1 - t * 0.85);
		const r = rad * (0.45 + 0.55 * t);
		for (let i = 0; i < around; i++) {
			const a = (i / around) * TAU;
			const ca = Math.cos(a);
			const sa = Math.sin(a);
			const ox = X.x * r * ca + Z.x * r * sa;
			const oy = X.y * r * ca + Z.y * r * sa;
			const oz = X.z * r * ca + Z.z * r * sa;
			const px = base.x + Y.x * y + ox;
			const py = base.y + Y.y * y + oy;
			const pz = base.z + Y.z * y + oz;
			const nl = Math.hypot(ox, oy, oz) || 1;
			g.push(px, py, pz, ox / nl, oy / nl + 0.25, oz / nl, t < 0.45 ? dark : mid, along);
		}
	}
}

export function densityFor(cols: number): number {
	// About two glyph cells per point horizontally (splats are two cells wide).
	return Math.round(Math.max(0.0095, Math.min(0.03, 2.6 / Math.max(40, cols))) * 1e4) / 1e4;
}

export function buildScene3(flowers: Placement[], sp: number, ribbon: RibbonId = DEFAULT_RIBBON): Scene3 {
	const seed = seedFromFlowers(flowers);
	const rng = mulberry32(seed);
	const n = flowers.length;
	const tie: V3 = { x: 0, y: 0.1, z: 0 };
	const groups: Group[] = [];
	const stems: StemCurve[] = [];
	const insts: FlowerInst[] = [];
	const bounds: V3[] = [];
	const headBounds: V3[] = [];

	const STEM_DARK = hexToInt('#2f9a4a');
	const STEM_MID = hexToInt('#46d464');
	const STEM_TOP = hexToInt('#6ee882');
	const LEAF_DARK = hexToInt('#36b457');
	const LEAF_LIGHT = hexToInt('#8ae89f');
	const tone = RIBBON[ribbon] ?? RIBBON[DEFAULT_RIBBON];
	const RIBBON_MID = tone.midInt;
	const RIBBON_HI = tone.brightInt;

	// Flower heads spread over an upright ellipsoid (taller than wide), faces
	// along the outward normal so the ones toward the viewer look straight at
	// it and the ones at the rim turn to the side. The ellipsoid is sized from
	// the total head area so 10–14 big heads cover it without big holes.
	let area = 0;
	for (const f of flowers) area += HEAD_R[f.id] * HEAD_R[f.id];
	// Solid round heads (roses, tulips…) need more room than open lily stars.
	const solid = n ? flowers.filter((f) => f.id !== 'lily').length / n : 0;
	const Rh = n <= 1 ? 0 : (0.29 + 0.05 * solid) * Math.sqrt(area) * (n <= 3 ? 0.8 : 1);
	const Rv = Rh * 1.72;
	const leafScale = n <= 3 ? 0.8 : Math.max(0.6, Math.min(1.0, Rh / 0.26));
	const cy = n <= 3 ? Math.max(0.95, 0.2 + Rv) : 0.2 + Rv;
	const domeC: V3 = { x: 0, y: cy, z: 0 };
	const a0 = 0.08;
	const a1 = n <= 3 ? 1.4 : 2.5;
	const spin0 = rng() * TAU;
	for (let i = 0; i < n; i++) {
		const f = flowers[i];
		const k = n <= 1 ? 0 : (i + 0.5) / n;
		const ca = Math.cos(a0) + (Math.cos(a1) - Math.cos(a0)) * k;
		const alpha = n <= 1 ? 0 : Math.acos(Math.max(-1, Math.min(1, ca)));
		const az = spin0 + i * GOLDEN + (rng() - 0.5) * 0.2;
		const d = { x: Math.sin(alpha) * Math.sin(az), y: Math.cos(alpha), z: Math.sin(alpha) * Math.cos(az) };
		const base: V3 = {
			x: domeC.x + d.x * Rh,
			y: domeC.y + d.y * Rv + (rng() - 0.5) * 0.03,
			z: domeC.z + d.z * Rh,
		};
		// Outward ellipsoid normal, flattened a little toward the horizon.
		// A lone flower turns its face toward the viewer (tall ones stay more upright).
		const soloUp = SOLO_UP[f.id] ?? 0.8;
		let ax = n <= 1 ? 0 : d.x / Math.max(0.01, Rh);
		let ay = n <= 1 ? soloUp : (d.y / Math.max(0.01, Rv)) * 0.85;
		let azz = n <= 1 ? 1 : d.z / Math.max(0.01, Rh);
		const al0 = Math.hypot(ax, ay, azz) || 1;
		ax /= al0;
		// Flowers lean upward like a hand-tied bunch; flat discs lean up more so the
		// ones at the rim don't turn edge-on.
		ay = ay / al0 + (FLAT.has(f.id) ? 0.95 : 0.4);
		azz /= al0;
		if (f.id === 'lavender') {
			ax *= 0.3;
			azz *= 0.3;
			ay = 1;
		}
		const al = Math.hypot(ax, ay, azz) || 1;
		ax /= al;
		ay /= al;
		azz /= al;
		const Y = { x: ax, y: ay, z: azz };
		const { a: X0, b: Z0 } = frameFor(Y);
		const spin = rng() * TAU;
		const cs = Math.cos(spin);
		const sn = Math.sin(spin);
		const X = { x: X0.x * cs + Z0.x * sn, y: X0.y * cs + Z0.y * sn, z: X0.z * cs + Z0.z * sn };
		const Z = { x: Z0.x * cs - X0.x * sn, y: Z0.y * cs - X0.y * sn, z: Z0.z * cs - X0.z * sn };
		const m = new Float32Array([X.x, X.y, X.z, Y.x, Y.y, Y.z, Z.x, Z.y, Z.z]);
		const mesh = flowerMesh(f.id, sp);
		const colors = resolveFlowerColors(f.id, f.color);
		// Slight per-bloom value shift so repeated colours read as separate flowers.
		const vshift = 0.86 + rng() * 0.2;
		const palette = new Int32Array(SLOT_COUNT);
		for (let s = 0; s < SLOT_COUNT; s++) palette[s] = scaleRgb(hexToInt(colors[s]), s <= 2 || s === 8 ? vshift : 1);
		const size = SIZE[f.id] * (0.94 + rng() * 0.12);
		insts.push({ id: f.id, color: f.color, mesh, base, m, size, stem: i, palette });

		// Stem: cut end → bunched through the tie → fans out to the head.
		const hl = Math.hypot(d.x, d.z) || 1;
		const ux = n <= 1 ? 0 : d.x / hl;
		const uz = n <= 1 ? 0 : d.z / hl;
		const jitter = (rng() - 0.5) * 0.02;
		// Tip is the head's rear/base: for a face tilted toward camera the attachment
		// sits behind and below the petals, so the stalk vanishes under the bloom.
		const curve: StemCurve = {
			p0: { x: 0.035 * ux + jitter, y: -0.01, z: 0.035 * uz },
			p1: { x: 0.028 * ux, y: tie.y + 0.05, z: 0.028 * uz },
			p2: { x: base.x * 0.48, y: tie.y + (base.y - tie.y) * 0.38, z: base.z * 0.48 },
			p3: base,
		};
		stems.push(curve);
		const g = new GroupBuilder();
		const len = Math.hypot(base.x, base.y, base.z) * 1.12;
		tube(
			g,
			(t) => bez(curve, t),
			(t) => bezTangent(curve, t),
			len,
			(t) => 0.024 * (1 - 0.5 * t),
			sp,
			sp < 0.013 ? 6 : 5,
			(t) => (t < 0.15 ? STEM_DARK : t > 0.7 ? STEM_TOP : STEM_MID),
		);
		groups.push(g.done(KIND_STEM, i, curve.p0, 1));
		const cg = new GroupBuilder();
		calyx(cg, base, X, Y, Z, size, sp, LEAF_DARK, STEM_MID);
		groups.push(cg.done(KIND_STEM, i, base, 1));

		// A leaf low on some stems, fanning out of the bunch.
		if (i % 2 === 0) {
			const at = 0.22 + rng() * 0.12;
			const o = bez(curve, at);
			const dirAng = Math.atan2(ux, uz) + (rng() - 0.5) * 0.8;
			const lg = new GroupBuilder();
			blade(lg, o, dirAng, (0.3 + rng() * 0.12) * leafScale, 0.04, 0.45, 1.5, (rng() - 0.5) * 1.2, sp, LEAF_DARK, LEAF_LIGHT);
			groups.push(lg.done(KIND_LEAF, i, o, at));
		}
	}

	if (n === 0) {
		const curve: StemCurve = {
			p0: { x: 0, y: -0.02, z: 0 },
			p1: { x: 0, y: 0.3, z: 0 },
			p2: { x: 0.02, y: 0.6, z: 0 },
			p3: { x: 0.03, y: 0.9, z: 0 },
		};
		stems.push(curve);
		const g = new GroupBuilder();
		tube(g, (t) => bez(curve, t), (t) => bezTangent(curve, t), 0.95, () => 0.017, sp, 5, () => STEM_MID);
		groups.push(g.done(KIND_STEM, 0, curve.p0));
	}

	// Base leaves around the tie, arching out and down.
	const baseLeaves = n === 0 ? 2 : Math.min(9, 4 + Math.ceil(n / 3));
	for (let i = 0; i < baseLeaves; i++) {
		const ang = (i / baseLeaves) * TAU + rng() * 0.4;
		const o = { x: Math.sin(ang) * 0.03, y: tie.y + 0.04 + rng() * 0.08, z: Math.cos(ang) * 0.03 };
		const lg = new GroupBuilder();
		blade(lg, o, ang, (0.4 + rng() * 0.18) * leafScale, 0.05 * Math.max(0.8, leafScale), 0.35 + rng() * 0.25, 1.55 + rng() * 0.4, (rng() - 0.5) * 1.4, sp, LEAF_DARK, LEAF_LIGHT);
		groups.push(lg.done(KIND_LEAF, -1, o, 0));
	}

	// Ribbon: a band around the tie, a bow, and two tails.
	{
		const g = new GroupBuilder();
		const R = 0.05;
		const h = 0.05;
		const ringN = Math.max(16, Math.ceil((TAU * R) / sp));
		const hN = Math.max(3, Math.ceil(h / sp));
		for (let i = 0; i < ringN; i++) {
			const a = (i / ringN) * TAU;
			for (let j = 0; j <= hN; j++) {
				const y = tie.y - h / 2 + (h * j) / hN;
				g.push(Math.sin(a) * R, y, Math.cos(a) * R, Math.sin(a), 0, Math.cos(a), j === 0 || j === hN ? RIBBON_HI : RIBBON_MID, 1);
			}
		}
		const loop = (side: number) => (t: number): V3 => {
			const a = t * TAU;
			return {
				x: side * (0.06 * (1 - Math.cos(a))) * 1.1,
				y: tie.y + 0.035 * Math.sin(a),
				z: R + 0.012 + 0.015 * (1 - Math.cos(a)) * 0.5,
			};
		};
		const tail = (side: number) => (t: number): V3 => ({
			x: side * (0.01 + 0.06 * t),
			y: tie.y - 0.13 * t,
			z: R + 0.015 + 0.01 * Math.sin(t * 3),
		});
		const tg = (c: (t: number) => V3) => (t: number): V3 => {
			const a = c(Math.max(0, t - 0.01));
			const b = c(Math.min(1, t + 0.01));
			const l = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 1;
			return { x: (b.x - a.x) / l, y: (b.y - a.y) / l, z: (b.z - a.z) / l };
		};
		for (const side of [-1, 1]) {
			const c = loop(side);
			tube(g, c, tg(c), 0.3, () => 0.011, sp, 5, () => RIBBON_MID);
			const tc = tail(side);
			tube(g, tc, tg(tc), 0.15, () => 0.009, sp, 4, () => RIBBON_MID);
		}
		// Knot.
		const m = 24;
		for (let q = 0; q < m; q++) {
			const yq = 1 - (2 * (q + 0.5)) / m;
			const rq = Math.sqrt(1 - yq * yq);
			const a = q * GOLDEN;
			const nx = rq * Math.sin(a);
			const nz = rq * Math.cos(a);
			g.push(nx * 0.018, tie.y + yq * 0.018, R + 0.016 + nz * 0.018, nx, yq, nz, RIBBON_HI, 1);
		}
		groups.push(g.done(KIND_RIBBON, -3, tie));
	}

	// Rest-pose bounds of the full bloom for camera fitting.
	for (const inst of insts) {
		const P = inst.mesh.pos[inst.mesh.pos.length - 1];
		const stride = Math.max(1, Math.floor(inst.mesh.count / 160)) * 3;
		for (let k = 0; k < P.length; k += stride) {
			const lx = P[k] * inst.size;
			const ly = P[k + 1] * inst.size;
			const lz = P[k + 2] * inst.size;
			const m = inst.m;
			const pt = {
				x: inst.base.x + m[0] * lx + m[3] * ly + m[6] * lz,
				y: inst.base.y + m[1] * lx + m[4] * ly + m[7] * lz,
				z: inst.base.z + m[2] * lx + m[5] * ly + m[8] * lz,
			};
			bounds.push(pt);
			headBounds.push(pt);
		}
	}
	for (const g of groups) {
		const stride = Math.max(1, Math.floor(g.pos.length / 3 / 60)) * 3;
		for (let k = 0; k < g.pos.length; k += stride) bounds.push({ x: g.pos[k], y: g.pos[k + 1], z: g.pos[k + 2] });
	}

	return { flowers: insts, groups, stems, seed, bounds, headBounds, tie };
}

