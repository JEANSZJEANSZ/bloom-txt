import type { CritterPlacement, Gift, Letter, Placement } from './types';

/** A mixed wildflower bunch — the first thing you see in the builder. */
export const DEFAULT_FLOWERS: Placement[] = [
	{ id: 'lavender', color: 'purple' },
	{ id: 'poppy', color: 'orange' },
	{ id: 'daisy', color: 'white' },
	{ id: 'sunflower', color: 'yellow' },
	{ id: 'cornflower', color: 'blue' },
	{ id: 'rose', color: 'red' },
	{ id: 'forgetmenot', color: 'blue' },
	{ id: 'peony', color: 'pink' },
	{ id: 'violet', color: 'purple' },
	{ id: 'tulip', color: 'magenta' },
	{ id: 'mum', color: 'orange' },
];

export const EMPTY_LETTER: Letter = {
	to: '',
	from: '',
	note: '',
	message: '',
	occasion: 'because',
};

export const SAMPLE_LETTER: Letter = {
	to: 'you',
	from: 'me',
	note: 'she wanted wild flowers, they were out of season',
	message:
		'So I made them by hand.\n\nA little bouquet that will not wilt, for whenever you need a handful of color.',
	occasion: 'love',
};

export const DEFAULT_CRITTERS: CritterPlacement[] = [
	{ id: 'bee' },
	{ id: 'ladybug' },
];

export function sampleGift(): Gift {
	return { v: 1, flowers: DEFAULT_FLOWERS, letter: SAMPLE_LETTER, critters: [...DEFAULT_CRITTERS] };
}

export function blankGift(): Gift {
	return { v: 1, flowers: [], letter: { ...EMPTY_LETTER }, critters: [] };
}
