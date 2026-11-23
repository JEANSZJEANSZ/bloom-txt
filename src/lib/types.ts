export const COLS = 85;
export const ROWS = 42;
export const MAX_FLOWERS = 16;
export const BLOOM_FPS = 4;
export const TICK_MS = Math.round(1000 / BLOOM_FPS);

export const MAX_CRITTERS = 6;

export const LIMITS = {
	to: 40,
	from: 40,
	note: 72,
	message: 600,
	flowers: MAX_FLOWERS,
	critters: MAX_CRITTERS,
} as const;

export type ColorId =
	| 'red'
	| 'orange'
	| 'yellow'
	| 'green'
	| 'blue'
	| 'purple'
	| 'magenta'
	| 'pink'
	| 'white';

export type FlowerId =
	| 'rose'
	| 'daisy'
	| 'tulip'
	| 'sunflower'
	| 'lavender'
	| 'poppy'
	| 'violet'
	| 'lily'
	| 'peony'
	| 'cornflower'
	| 'mum'
	| 'forgetmenot';

export type OccasionId = 'love' | 'birthday' | 'thanks' | 'surprise' | 'because';

export type CritterId = 'ladybug' | 'bee' | 'butterfly';

export type CritterPlacement = {
	id: CritterId;
};

export type ColorRole =
	| 'petal'
	| 'petalDim'
	| 'center'
	| 'centerHot'
	| 'stamen'
	| 'leaf'
	| 'accent';

export type CenterStyle = 'gold' | 'dark' | 'warm' | 'yellow' | 'white' | 'brown';

export type Cell = {
	ch: string;
	color: string;
	kind: 'stem' | 'leaf' | 'flower' | 'sparkle' | 'heart' | 'critter';
	/** Packed 0xRRGGBB of `color`, when the renderer already knows it. */
	rgb?: number;
};

export type Grid = (Cell | null)[][];

export type Placement = {
	id: FlowerId;
	color: ColorId;
};

export type Letter = {
	to: string;
	from: string;
	note: string;
	message: string;
	occasion: OccasionId;
};

export type Gift = {
	v: 1;
	flowers: Placement[];
	letter: Letter;
	/** Optional on older gifts; treat missing as []. */
	critters: CritterPlacement[];
};

export type GiftPayload = {
	v: 1;
	f: [FlowerId, ColorId][];
	t: string;
	s: string;
	n: string;
	m: string;
	o: OccasionId;
	/** Optional so older share links keep working. */
	c?: CritterId[];
};
