import { describe, expect, it } from 'vitest';
import { DEFAULT_FLOWERS, sampleGift } from './defaults';
import { clampDetail, DEFAULT_DETAIL, DEFAULT_STYLE, MIN_COLS } from './look';
import { gridForDetail, preferredGrid, preferredRetroGrid } from './motion';
import { gridToPlainText, renderBouquet } from './render';
import { renderBouquet as renderBouquetRetro } from './renderRetro';
import { decodeGift, encodeGift, fromPayload, giftsEqual, parseRoute, toPayload } from './share';
import { surpriseBouquet } from './surprise';
import type { Gift } from './types';

describe('share encoding', () => {
	it('round-trips a sample gift exactly', () => {
		const gift = sampleGift();
		const token = encodeGift(gift);
		expect(token.length).toBeGreaterThan(10);
		const back = decodeGift(token);
		expect(back).not.toBeNull();
		expect(giftsEqual(gift, back!)).toBe(true);
		expect(back!.flowers).toEqual(gift.flowers);
		expect(back!.letter).toEqual({
			...gift.letter,
			// clip() trims; sample is already tidy
			to: gift.letter.to,
			from: gift.letter.from,
			note: gift.letter.note,
		});
	});

	it('round-trips via payload shape', () => {
		const gift = sampleGift();
		expect(fromPayload(toPayload(gift))).toEqual(gift);
	});

	it('survives a long letter and a full bouquet', () => {
		const bunch = surpriseBouquet(16);
		const gift: Gift = {
			v: 1,
			flowers: bunch.length ? bunch : DEFAULT_FLOWERS,
			letter: {
				to: 'Alexandria-Maximilienne de la Fleur',
				from: 'Your friend in the garden',
				note: 'you are my forever wildflower, even in November',
				message: 'Hello!\n\n'.repeat(40) + 'Love always.',
				occasion: 'birthday',
			},
			critters: [{ id: 'bee' }, { id: 'ladybug' }, { id: 'butterfly' }],
		};
		const back = decodeGift(encodeGift(gift));
		expect(back).not.toBeNull();
		expect(giftsEqual(gift, back!)).toBe(true);
	});

	it('rejects garbage tokens', () => {
		expect(decodeGift('')).toBeNull();
		expect(decodeGift('not-a-real-token')).toBeNull();
		expect(decodeGift('%%%')).toBeNull();
	});

	it('parses gift and builder routes', () => {
		expect(parseRoute('')).toEqual({ page: 'builder' });
		expect(parseRoute('#/')).toEqual({ page: 'builder' });
		expect(parseRoute('#/gift/abc123')).toEqual({ page: 'gift', token: 'abc123' });
		expect(parseRoute('#gift/abc123')).toEqual({ page: 'gift', token: 'abc123' });
	});

	it('omits critters from older-style payloads and still decodes them', () => {
		const bare: Gift = { ...sampleGift(), critters: [] };
		const payload = toPayload(bare);
		expect(payload.c).toBeUndefined();
		const back = decodeGift(encodeGift(bare));
		expect(back).not.toBeNull();
		expect(back!.critters).toEqual([]);
		expect(back!.flowers).toEqual(bare.flowers);
	});

	it('round-trips bees, ladybugs, and butterflies in the share link', () => {
		const gift = sampleGift();
		expect(toPayload(gift).c).toEqual(['bee', 'ladybug']);
		const back = decodeGift(encodeGift(gift));
		expect(back!.critters).toEqual(gift.critters);
	});

	it('omits style and detail from payloads when they are the 3D defaults', () => {
		const gift = sampleGift();
		const payload = toPayload(gift);
		expect(payload.r).toBeUndefined();
		expect(payload.d).toBeUndefined();
		const back = decodeGift(encodeGift(gift));
		expect(back!.style).toBeUndefined();
		expect(back!.detail).toBeUndefined();
		expect(giftsEqual(gift, back!)).toBe(true);
	});

	it('round-trips retro style and a chunky detail setting', () => {
		const gift: Gift = { ...sampleGift(), style: 'retro', detail: 20 };
		const payload = toPayload(gift);
		expect(payload.r).toBe('retro');
		expect(payload.d).toBe(20);
		const back = decodeGift(encodeGift(gift));
		expect(back).not.toBeNull();
		expect(back!.style).toBe('retro');
		expect(back!.detail).toBe(20);
		expect(giftsEqual(gift, back!)).toBe(true);
	});

	it('ignores invalid style or detail on old-shaped payloads', () => {
		const payload = { ...toPayload(sampleGift()), r: 'neon', d: 'lots' };
		const back = fromPayload(payload as unknown as ReturnType<typeof toPayload>);
		expect(back.style).toBeUndefined();
		expect(back.detail).toBeUndefined();
	});
});

describe('bouquet render', () => {
	it('is deterministic for the same flowers', () => {
		const a = renderBouquet({ flowers: DEFAULT_FLOWERS, tick: 99, complete: true });
		const b = renderBouquet({ flowers: DEFAULT_FLOWERS, tick: 0, complete: true });
		expect(gridToPlainText(a.grid)).toBe(gridToPlainText(b.grid));
		expect(a.tips).toEqual(b.tips);
	});

	it('starts with stems only, then blooms to a richer grid', () => {
		const stems = renderBouquet({ flowers: DEFAULT_FLOWERS, tick: 0 });
		const done = renderBouquet({ flowers: DEFAULT_FLOWERS, tick: 0, complete: true });
		const stemChars = stems.grid.flat().filter((c) => c?.kind === 'flower').length;
		const bloomChars = done.grid.flat().filter((c) => c?.kind === 'flower').length;
		expect(stemChars).toBe(0);
		expect(bloomChars).toBeGreaterThan(100);
		expect(stems.done).toBe(false);
		expect(done.done).toBe(true);
		expect(done.totalTicks).toBeGreaterThan(4);
	});

	it('grows from the roots: stems first, flowers only after a stem arrives', () => {
		const start = renderBouquet({ flowers: DEFAULT_FLOWERS, growth: 0 });
		const mid = renderBouquet({ flowers: DEFAULT_FLOWERS, growth: 0.35 });
		const late = renderBouquet({ flowers: DEFAULT_FLOWERS, growth: 0.62 });
		const done = renderBouquet({ flowers: DEFAULT_FLOWERS, growth: 1 });
		const flowersOf = (r: typeof start) => r.grid.flat().filter((c) => c?.kind === 'flower').length;
		const stemsOf = (r: typeof start) => r.grid.flat().filter((c) => c?.kind === 'stem' || c?.kind === 'leaf').length;
		expect(flowersOf(start)).toBe(0);
		expect(stemsOf(mid)).toBeGreaterThan(10);
		expect(flowersOf(mid)).toBe(0);
		expect(flowersOf(late)).toBeGreaterThan(0);
		expect(flowersOf(late)).toBeLessThan(flowersOf(done));
		expect(flowersOf(done)).toBeGreaterThan(100);
		expect(start.done).toBe(false);
		expect(done.done).toBe(true);
	});

	it('plain text includes a centered note', () => {
		const { grid } = renderBouquet({ flowers: DEFAULT_FLOWERS, complete: true, tick: 0 });
		const text = gridToPlainText(grid, { note: 'hello you' });
		expect(text).toContain('hello you');
	});

	it('rotation around Y changes the silhouette but keeps flowers', () => {
		const a = renderBouquet({ flowers: DEFAULT_FLOWERS, complete: true, tick: 0, yaw: 0 });
		const b = renderBouquet({
			flowers: DEFAULT_FLOWERS,
			complete: true,
			tick: 0,
			yaw: Math.PI / 2,
		});
		expect(gridToPlainText(a.grid)).not.toBe(gridToPlainText(b.grid));
		const fa = a.grid.flat().filter((c) => c?.kind === 'flower').length;
		const fb = b.grid.flat().filter((c) => c?.kind === 'flower').length;
		expect(fa).toBeGreaterThan(50);
		expect(fb).toBeGreaterThan(50);
	});

	it('keeps every flower head and the roots inside the grid, at every angle and size', () => {
		const sizes = [
			{ cols: 150, rows: 84 },
			{ cols: 150, rows: 100 },
			{ cols: 220, rows: 124 },
			{ cols: 260, rows: 164 },
		];
		const yaws = [0, Math.PI / 4, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
		const kinds = new Set(['stem', 'leaf', 'flower']);
		for (const size of sizes) {
			for (const yaw of yaws) {
				for (const time of [0, 1.4]) {
					const r = renderBouquet({
						flowers: DEFAULT_FLOWERS,
						complete: true,
						yaw,
						time,
						sway: time > 0,
						particles: false,
						cols: size.cols,
						rows: size.rows,
					});
					const cells: { x: number; y: number; kind: string }[] = [];
					r.grid.forEach((row, y) => {
						row.forEach((c, x) => {
							if (c && kinds.has(c.kind)) cells.push({ x, y, kind: c.kind });
						});
					});
					const flowers = cells.filter((c) => c.kind === 'flower');
					expect(flowers.length, `${size.cols}x${size.rows} yaw=${yaw}`).toBeGreaterThan(40);
					const ys = cells.map((c) => c.y);
					const minY = Math.min(...ys);
					const maxY = Math.max(...ys);
					expect(minY).toBeGreaterThanOrEqual(1);
					expect(maxY).toBeLessThanOrEqual(size.rows - 2);
					// The old camera clipped the top and left a tall empty cellar.
					expect(minY).toBeGreaterThanOrEqual(2);
					expect(size.rows - 1 - maxY).toBeLessThanOrEqual(Math.ceil(size.rows * 0.28));
				}
			}
		}
	});

	it('draws ladybugs and bees after the bouquet has grown', () => {
		const hidden = renderBouquet({
			flowers: DEFAULT_FLOWERS,
			growth: 0.5,
			critters: [{ id: 'bee' }, { id: 'ladybug' }],
			critterIntro: 0,
			time: 2,
			particles: false,
		});
		const shown = renderBouquet({
			flowers: DEFAULT_FLOWERS,
			complete: true,
			critters: [{ id: 'bee' }, { id: 'ladybug' }, { id: 'butterfly' }],
			critterIntro: 1,
			time: 2.4,
			particles: false,
			animateCritters: true,
		});
		expect(hidden.grid.flat().filter((c) => c?.kind === 'critter').length).toBe(0);
		expect(shown.grid.flat().filter((c) => c?.kind === 'critter').length).toBeGreaterThan(4);
	});
});

describe('detail grid', () => {
	it('matches the current preferred grid at detail 100', () => {
		expect(gridForDetail(100, 1400, 900)).toEqual(preferredGrid(1400, 900));
		expect(gridForDetail(100, 390, 700)).toEqual(preferredGrid(390, 700));
		expect(clampDetail(undefined)).toBe(DEFAULT_DETAIL);
		expect(DEFAULT_STYLE).toBe('3d');
	});

	it('uses about 60 columns at the chunky end, keeping aspect', () => {
		const max = preferredGrid(1400, 900);
		const low = gridForDetail(0, 1400, 900);
		expect(low.cols).toBe(MIN_COLS);
		expect(low.rows).toBeGreaterThan(20);
		expect(low.rows).toBeLessThan(max.rows);
		const mid = gridForDetail(50, 1400, 900);
		expect(mid.cols).toBeGreaterThan(low.cols);
		expect(mid.cols).toBeLessThan(max.cols);
	});

	it('uses a shorter sprite-friendly grid in retro mode', () => {
		const max = preferredRetroGrid(1400, 900);
		expect(gridForDetail(100, 1400, 900, 'retro')).toEqual(max);
		const low = gridForDetail(0, 1400, 900, 'retro');
		expect(low.cols).toBe(48);
		expect(low.rows).toBeLessThan(max.rows);
		// Around the original 85×42 authored size
		const classic = gridForDetail(40, 1400, 900, 'retro');
		expect(classic.cols).toBeGreaterThanOrEqual(80);
		expect(classic.cols).toBeLessThanOrEqual(90);
	});
});

describe('retro bouquet render', () => {
	it('is deterministic for the same flowers', () => {
		const a = renderBouquetRetro({ flowers: DEFAULT_FLOWERS, tick: 99, complete: true });
		const b = renderBouquetRetro({ flowers: DEFAULT_FLOWERS, tick: 0, complete: true });
		expect(gridToPlainText(a.grid)).toBe(gridToPlainText(b.grid));
		expect(a.tips).toEqual(b.tips);
	});

	it('grows from the roots: stems first, flowers only after a stem arrives', () => {
		const start = renderBouquetRetro({ flowers: DEFAULT_FLOWERS, growth: 0 });
		const mid = renderBouquetRetro({ flowers: DEFAULT_FLOWERS, growth: 0.35 });
		const late = renderBouquetRetro({ flowers: DEFAULT_FLOWERS, growth: 0.62 });
		const done = renderBouquetRetro({ flowers: DEFAULT_FLOWERS, growth: 1 });
		const flowersOf = (r: typeof start) => r.grid.flat().filter((c) => c?.kind === 'flower').length;
		const stemsOf = (r: typeof start) => r.grid.flat().filter((c) => c?.kind === 'stem' || c?.kind === 'leaf').length;
		expect(flowersOf(start)).toBe(0);
		expect(stemsOf(mid)).toBeGreaterThan(10);
		expect(flowersOf(mid)).toBe(0);
		expect(flowersOf(late)).toBeGreaterThan(0);
		expect(flowersOf(late)).toBeLessThan(flowersOf(done));
		expect(flowersOf(done)).toBeGreaterThan(40);
		expect(start.done).toBe(false);
		expect(done.done).toBe(true);
	});

	it('keeps every flower head and the roots inside the grid at several densities', () => {
		const sizes = [
			{ cols: 60, rows: 38 },
			{ cols: 85, rows: 42 },
			{ cols: 150, rows: 84 },
		];
		const yaws = [0, Math.PI / 2, Math.PI];
		const kinds = new Set(['stem', 'leaf', 'flower']);
		for (const size of sizes) {
			for (const yaw of yaws) {
				const r = renderBouquetRetro({
					flowers: DEFAULT_FLOWERS,
					complete: true,
					yaw,
					time: 0,
					sway: false,
					particles: false,
					cols: size.cols,
					rows: size.rows,
				});
				const cells: { x: number; y: number; kind: string }[] = [];
				r.grid.forEach((row, y) => {
					row.forEach((c, x) => {
						if (c && kinds.has(c.kind)) cells.push({ x, y, kind: c.kind });
					});
				});
				const flowers = cells.filter((c) => c.kind === 'flower');
				expect(flowers.length, `${size.cols}x${size.rows} yaw=${yaw}`).toBeGreaterThan(20);
				const ys = cells.map((c) => c.y);
				const minY = Math.min(...ys);
				const maxY = Math.max(...ys);
				expect(minY).toBeGreaterThanOrEqual(1);
				expect(maxY).toBeLessThanOrEqual(size.rows - 2);
				expect(minY).toBeGreaterThanOrEqual(2);
				expect(size.rows - 1 - maxY).toBeLessThanOrEqual(Math.ceil(size.rows * 0.28));
			}
		}
	});

	it('draws ladybugs and bees after the bouquet has grown', () => {
		const hidden = renderBouquetRetro({
			flowers: DEFAULT_FLOWERS,
			growth: 0.5,
			critters: [{ id: 'bee' }, { id: 'ladybug' }],
			critterIntro: 0,
			time: 2,
			particles: false,
		});
		const shown = renderBouquetRetro({
			flowers: DEFAULT_FLOWERS,
			complete: true,
			critters: [{ id: 'bee' }, { id: 'ladybug' }, { id: 'butterfly' }],
			critterIntro: 1,
			time: 2.4,
			particles: false,
			animateCritters: true,
		});
		expect(hidden.grid.flat().filter((c) => c?.kind === 'critter').length).toBe(0);
		expect(shown.grid.flat().filter((c) => c?.kind === 'critter').length).toBeGreaterThan(4);
	});
});

describe('3D bouquet at chunky detail', () => {
	it('still frames the bunch at about 60 columns', () => {
		const size = { cols: 60, rows: 38 };
		const r = renderBouquet({
			flowers: DEFAULT_FLOWERS,
			complete: true,
			yaw: 0.6,
			time: 0,
			sway: false,
			particles: false,
			cols: size.cols,
			rows: size.rows,
		});
		const cells: { y: number; kind: string }[] = [];
		r.grid.forEach((row, y) => {
			row.forEach((c) => {
				if (c && (c.kind === 'stem' || c.kind === 'leaf' || c.kind === 'flower')) cells.push({ y, kind: c.kind });
			});
		});
		expect(cells.filter((c) => c.kind === 'flower').length).toBeGreaterThan(20);
		const ys = cells.map((c) => c.y);
		expect(Math.min(...ys)).toBeGreaterThanOrEqual(2);
		expect(Math.max(...ys)).toBeLessThanOrEqual(size.rows - 2);
	});
});
