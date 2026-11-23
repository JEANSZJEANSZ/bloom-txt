import { describe, expect, it } from 'vitest';
import { DEFAULT_FLOWERS, sampleGift } from './defaults';
import { gridToPlainText, renderBouquet } from './render';
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
