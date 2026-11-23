import { colorsFor, FLOWER_BY_ID, roleFor } from './flowers';
import { INKS, STEM } from './palette';
import { mulberry32, seedFromFlowers } from './rng';
import type { ColorId, FlowerId, Placement } from './types';

export type ScenePoint = {
	x: number;
	y: number;
	z: number;
	/** Stem direction, used to pick / | \ after projection. */
	dx: number;
	dy: number;
	dz: number;
	ch: string;
	color: string;
	kind: 'stem' | 'leaf' | 'flower' | 'sparkle' | 'heart' | 'petal';
	/** -1 if not part of a flower sprite. */
	flowerIndex: number;
	/** -1 if always visible; otherwise only when that flower is on this bloom frame. */
	frame: number;
	phase: number;
	/** 0 at the base, 1 at the tip; negative for roots spreading downward. */
	along: number;
	/** -2 roots, -1 ribbon/soil tuft, 0+ a stem (flower stems use their flower index). */
	stemId: number;
};

export type FlowerTip3 = {
	x: number;
	y: number;
	z: number;
	angle: number;
	id: FlowerId;
	color: ColorId;
};

export type BouquetScene = {
	points: ScenePoint[];
	tips: FlowerTip3[];
	seed: number;
};

const CHAR_W = 0.05;
const CHAR_H = 0.058;

type PointExtra = Partial<
	Pick<ScenePoint, 'dx' | 'dy' | 'dz' | 'flowerIndex' | 'frame' | 'phase' | 'along' | 'stemId'>
>;

function push(
	points: ScenePoint[],
	x: number,
	y: number,
	z: number,
	ch: string,
	color: string,
	kind: ScenePoint['kind'],
	extra: PointExtra = {},
) {
	points.push({
		x,
		y,
		z,
		dx: extra.dx ?? 0,
		dy: extra.dy ?? 1,
		dz: extra.dz ?? 0,
		ch,
		color,
		kind,
		flowerIndex: extra.flowerIndex ?? -1,
		frame: extra.frame ?? -1,
		phase: extra.phase ?? 0,
		along: extra.along ?? 0,
		stemId: extra.stemId ?? -1,
	});
}

function addStem(
	points: ScenePoint[],
	tx: number,
	ty: number,
	tz: number,
	steps: number,
	bright: boolean,
	rng: () => number,
	stemId: number,
) {
	const len = Math.hypot(tx, ty, tz) || 1;
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const x = tx * t;
		const y = ty * t;
		const z = tz * t;
		const color = bright ? (t > 0.7 ? STEM.bright : STEM.mid) : t < 0.2 ? STEM.dim : t > 0.8 ? STEM.bright : STEM.mid;
		push(points, x, y, z, '|', color, 'stem', { dx: tx, dy: ty, dz: tz, phase: rng(), along: t, stemId });
		if (rng() < 0.045 && t > 0.28 && t < 0.85) {
			const side = rng() < 0.5 ? -1 : 1;
			const nx = (-tz / len) * 0.07 * side;
			const nz = (tx / len) * 0.07 * side;
			const leaf = rng() < 0.4 ? '~' : rng() < 0.5 ? 'j' : 'r';
			push(points, x + nx, y + (rng() - 0.5) * 0.04, z + nz, leaf, STEM.leaf, 'leaf', {
				dx: tx,
				dy: ty,
				dz: tz,
				phase: rng(),
				along: t,
				stemId,
			});
		}
	}
}

/** Little roots, soil tuft, and a tied ribbon at the gathered waist. */
function addRoots(points: ScenePoint[], rng: () => number) {
	const chars = ['~', ',', "'", '`', '/', '\\', '.', "'"];
	const n = 14;
	for (let i = 0; i < n; i++) {
		const angle = (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.35;
		const len = 0.22 + rng() * 0.22;
		const steps = 5 + Math.floor(rng() * 3);
		for (let k = 1; k <= steps; k++) {
			const t = k / steps;
			const curl = Math.sin(t * 5 + i) * 0.05;
			const spread = len * t * 1.15 + curl;
			const x = Math.sin(angle) * spread;
			const z = Math.cos(angle) * spread;
			// Stay just under the waist so the tuft isn't clipped off the grid.
			const y = -t * len * (0.45 + rng() * 0.2);
			const ch = chars[(Math.floor(t * (chars.length - 1)) + i) % chars.length];
			const color = t > 0.55 ? STEM.dim : STEM.mid;
			push(points, x, y, z, ch, color, 'stem', {
				dx: x,
				dy: -1,
				dz: z,
				along: -t,
				stemId: -2,
				phase: t + i,
			});
		}
	}
	for (let i = 0; i < 7; i++) {
		const a = (i / 7) * Math.PI * 2 + rng() * 0.2;
		const r = 0.04 + rng() * 0.08;
		push(
			points,
			Math.sin(a) * r,
			-0.02 - rng() * 0.04,
			Math.cos(a) * r,
			i % 2 ? '.' : "'",
			INKS.brown,
			'stem',
			{ dy: -1, along: -0.12, stemId: -2, phase: i },
		);
	}
	const ribbon = INKS.blush;
	push(points, 0.09, 0.02, 0.02, '~', ribbon, 'leaf', { along: 0, stemId: -1, phase: 0 });
	push(points, -0.09, 0.02, -0.02, '~', ribbon, 'leaf', { along: 0, stemId: -1, phase: 1 });
	push(points, 0.05, 0, 0.05, '>', INKS.heart, 'leaf', { along: 0, stemId: -1, phase: 2 });
	push(points, -0.05, 0, -0.05, '<', INKS.heart, 'leaf', { along: 0, stemId: -1, phase: 3 });
	push(points, 0, 0.01, 0.07, '&', ribbon, 'leaf', { along: 0, stemId: -1, phase: 4 });
}

function placeTips(flowers: Placement[], rng: () => number): FlowerTip3[] {
	const n = flowers.length;
	if (n === 0) return [];
	if (n === 1) {
		const f = flowers[0];
		const height = 1.45 + (rng() - 0.5) * 0.04;
		return [
			{
				x: 0,
				y: height,
				z: 0.05,
				angle: 0,
				id: f.id,
				color: f.color,
			},
		];
	}
	return flowers.map((f, i) => {
		const t = i / n;
		const angle = t * Math.PI * 2 + (rng() - 0.5) * 0.18;
		const compact =
			f.id === 'lavender' ||
			f.id === 'violet' ||
			f.id === 'forgetmenot' ||
			f.id === 'daisy' ||
			f.id === 'cornflower';
		const tucked = n >= 6 && compact && (i === Math.floor(n * 0.3) || i === Math.floor(n * 0.65));
		let radial = 0.78 + (rng() - 0.5) * 0.16 + (i % 2 === 0 ? 0.06 : -0.05);
		if (tucked) radial *= 0.52;
		radial = Math.max(0.32, Math.min(1.08, radial));
		const height = 1.22 + 0.72 * (0.45 + 0.55 * (1 - Math.abs(radial - 0.75))) + (i % 2 === 0 ? 0.1 : -0.08) + (rng() - 0.5) * 0.08;
		const r = 1.22 * radial;
		return {
			x: Math.sin(angle) * r,
			y: Math.max(0.95, Math.min(2.08, height)),
			z: Math.cos(angle) * r,
			angle,
			id: f.id,
			color: f.color,
		};
	});
}

function stampFlower(
	points: ScenePoint[],
	tip: FlowerTip3,
	flowerIndex: number,
	frameIndex: number,
	art: string[],
	petal: ColorId,
) {
	const palette = colorsFor(tip.id, petal);
	const h = art.length;
	const w = Math.max(...art.map((l) => l.length));
	const ax = Math.floor(w / 2);
	const ay = h - 1;
	// Vertical plane facing outward from the bouquet axis.
	const outwardX = Math.sin(tip.angle);
	const outwardZ = Math.cos(tip.angle);
	const rightX = Math.cos(tip.angle);
	const rightZ = -Math.sin(tip.angle);

	for (let row = 0; row < h; row++) {
		const line = art[row];
		for (let col = 0; col < line.length; col++) {
			const ch = line[col];
			const role = roleFor(ch);
			if (!role) continue;
			const u = (col - ax) * CHAR_W;
			const v = (ay - row) * CHAR_H;
			const x = tip.x + rightX * u + outwardX * 0.02;
			const y = tip.y + v;
			const z = tip.z + rightZ * u + outwardZ * 0.02;
			push(points, x, y, z, ch, palette[role], 'flower', {
				dx: rightX,
				dy: 0,
				dz: rightZ,
				flowerIndex,
				frame: frameIndex,
				phase: (row * 13 + col) * 0.01,
				along: 1,
				stemId: flowerIndex,
			});
		}
	}
}

export function buildScene(flowers: Placement[], fill = 64): BouquetScene {
	const seed = seedFromFlowers(flowers);
	const rng = mulberry32(seed);
	const points: ScenePoint[] = [];
	const tips = placeTips(flowers, rng);

	addRoots(points, rng);
	// The gathered base of the bunch.
	push(points, 0, 0, 0, 'v', STEM.bright, 'stem', { dy: 1, phase: 0, along: 0, stemId: -1 });
	push(points, 0, -0.06, 0, '.', STEM.dim, 'stem', { dy: 1, phase: 1, along: -0.08, stemId: -1 });

	if (tips.length === 0) {
		addStem(points, 0, 0.7, 0, 10, true, rng, 0);
		push(points, 0, 0.76, 0, ',', STEM.leaf, 'leaf', { dy: 1, along: 1, stemId: 0 });
		return { points, tips, seed };
	}

	const fillers = Math.max(0, Math.min(fill, 28 + tips.length * 4));
	for (let i = 0; i < fillers; i++) {
		const angle = (i / fillers) * Math.PI * 2 + (rng() - 0.5) * 0.2;
		const radial = 0.35 + rng() * 0.78;
		const height = 1.0 + rng() * 0.95;
		const r = 1.18 * radial;
		addStem(
			points,
			Math.sin(angle) * r,
			height,
			Math.cos(angle) * r,
			8 + Math.round(height * 6),
			false,
			rng,
			tips.length + i,
		);
	}

	for (let i = 0; i < tips.length; i++) {
		const tip = tips[i];
		addStem(points, tip.x, tip.y, tip.z, 14, true, rng, i);
	}

	flowers.forEach((f, i) => {
		const tip = tips[i];
		const def = FLOWER_BY_ID[f.id];
		def.frames.forEach((frame, fi) => {
			stampFlower(points, tip, i, fi, frame.art, f.color);
		});
	});

	return { points, tips, seed };
}

export type Particle = {
	kind: 'sparkle' | 'heart' | 'petal';
	phase: number;
	radius: number;
	height: number;
	angle0: number;
	speed: number;
	ch: string;
	color: string;
	drift: number;
};

export function buildParticles(seed: number, count = 28): Particle[] {
	const rng = mulberry32(seed ^ 0x51ed);
	const petals = [INKS.blush, INKS.heart, INKS.gold, '#ff8ad4', '#ff4d5c', '#ffe14a', '#b46bff'];
	const out: Particle[] = [];
	for (let i = 0; i < count; i++) {
		out.push({
			kind: 'sparkle',
			phase: rng() * Math.PI * 2,
			radius: 0.7 + rng() * 1.5,
			height: 0.3 + rng() * 2.0,
			angle0: rng() * Math.PI * 2,
			speed: 0.15 + rng() * 0.35,
			ch: rng() < 0.4 ? '*' : rng() < 0.5 ? '+' : '.',
			color: rng() < 0.4 ? INKS.cyan : rng() < 0.5 ? INKS.gold : INKS.mint,
			drift: (rng() - 0.5) * 0.2,
		});
	}
	for (let i = 0; i < 5; i++) {
		out.push({
			kind: 'heart',
			phase: rng() * Math.PI * 2,
			radius: 1.15 + rng() * 0.7,
			height: 0.4 + rng() * 1.8,
			angle0: rng() * Math.PI * 2,
			speed: 0.12 + rng() * 0.2,
			ch: '<3',
			color: INKS.heart,
			drift: 0.15 + rng() * 0.15,
		});
	}
	for (let i = 0; i < 8; i++) {
		out.push({
			kind: 'petal',
			phase: rng() * Math.PI * 2,
			radius: 0.9 + rng() * 1.1,
			height: 0.2 + rng() * 2.1,
			angle0: rng() * Math.PI * 2,
			speed: 0.2 + rng() * 0.4,
			ch: rng() < 0.5 ? "'" : rng() < 0.5 ? ',' : 'o',
			color: petals[Math.floor(rng() * petals.length)],
			drift: 0.25 + rng() * 0.35,
		});
	}
	return out;
}
