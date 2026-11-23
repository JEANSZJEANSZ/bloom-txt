import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { isCritterId } from './critters';
import { isFlowerId } from './flowers';
import { COLOR_ORDER } from './palette';
import type { ColorId, CritterId, Gift, GiftPayload, OccasionId, Placement } from './types';
import { LIMITS } from './types';

const OCCASIONS: OccasionId[] = ['love', 'birthday', 'thanks', 'surprise', 'because'];

function isColorId(v: unknown): v is ColorId {
	return typeof v === 'string' && (COLOR_ORDER as string[]).includes(v);
}

function isOccasion(v: unknown): v is OccasionId {
	return typeof v === 'string' && (OCCASIONS as string[]).includes(v);
}

function clip(s: unknown, max: number): string {
	return String(s ?? '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, max);
}

export function toPayload(gift: Gift): GiftPayload {
	const critters = (gift.critters ?? [])
		.slice(0, LIMITS.critters)
		.map((c) => c.id)
		.filter((id): id is CritterId => isCritterId(id));
	const payload: GiftPayload = {
		v: 1,
		f: gift.flowers.slice(0, LIMITS.flowers).map((p) => [p.id, p.color]),
		t: clip(gift.letter.to, LIMITS.to),
		s: clip(gift.letter.from, LIMITS.from),
		n: clip(gift.letter.note, LIMITS.note),
		m: String(gift.letter.message ?? '')
			.replace(/\r\n/g, '\n')
			.slice(0, LIMITS.message),
		o: isOccasion(gift.letter.occasion) ? gift.letter.occasion : 'because',
	};
	if (critters.length) payload.c = critters;
	return payload;
}

export function fromPayload(p: GiftPayload): Gift {
	const flowers: Placement[] = (p.f ?? [])
		.slice(0, LIMITS.flowers)
		.filter((pair): pair is [Placement['id'], Placement['color']] => {
			return Array.isArray(pair) && isFlowerId(pair[0]) && isColorId(pair[1]);
		})
		.map(([id, color]) => ({ id, color }));

	const critters = (p.c ?? [])
		.slice(0, LIMITS.critters)
		.filter((id): id is CritterId => isCritterId(id))
		.map((id) => ({ id }));

	return {
		v: 1,
		flowers,
		letter: {
			to: clip(p.t, LIMITS.to),
			from: clip(p.s, LIMITS.from),
			note: clip(p.n, LIMITS.note),
			message: String(p.m ?? '').slice(0, LIMITS.message),
			occasion: isOccasion(p.o) ? p.o : 'because',
		},
		critters,
	};
}

export function encodeGift(gift: Gift): string {
	return compressToEncodedURIComponent(JSON.stringify(toPayload(gift)));
}

export function decodeGift(token: string): Gift | null {
	try {
		const raw = decompressFromEncodedURIComponent(token);
		if (!raw) return null;
		const data = JSON.parse(raw) as GiftPayload;
		if (!data || data.v !== 1 || !Array.isArray(data.f)) return null;
		return fromPayload(data);
	} catch {
		return null;
	}
}

export function parseRoute(
	hash: string,
): { page: 'builder' } | { page: 'gift'; token: string } {
	const h = hash.replace(/^#/, '').replace(/^\/+/, '');
	const m = h.match(/^gift\/(.+)$/);
	if (m) return { page: 'gift', token: decodeURIComponent(m[1]) };
	return { page: 'builder' };
}

export function giftHash(gift: Gift): string {
	return `#/gift/${encodeGift(gift)}`;
}

export function giftUrl(gift: Gift, origin?: string, path?: string): string {
	const baseOrigin = origin ?? (typeof location !== 'undefined' ? location.origin : '');
	const basePath = path ?? (typeof location !== 'undefined' ? location.pathname : '/');
	return `${baseOrigin}${basePath}${giftHash(gift)}`;
}

export function giftsEqual(a: Gift, b: Gift): boolean {
	return JSON.stringify(toPayload(a)) === JSON.stringify(toPayload(b));
}
