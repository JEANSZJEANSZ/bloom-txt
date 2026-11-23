import type { OccasionId } from './types';

export type Occasion = {
	id: OccasionId;
	label: string;
	blurb: string;
	greeting: string;
	seal: string;
	hue: string;
};

export const OCCASIONS: Occasion[] = [
	{
		id: 'love',
		label: 'Love',
		blurb: 'A soft, rosy card',
		greeting: 'for someone I love',
		seal: '♥',
		hue: '#c45c7a',
	},
	{
		id: 'birthday',
		label: 'Birthday',
		blurb: 'Warm gold and cream',
		greeting: 'happy birthday',
		seal: '★',
		hue: '#c4892a',
	},
	{
		id: 'thanks',
		label: 'Thank you',
		blurb: 'A sage little note',
		greeting: 'thank you',
		seal: '✿',
		hue: '#4f7a58',
	},
	{
		id: 'surprise',
		label: 'Surprise',
		blurb: 'Lilac, just because they should smile',
		greeting: 'a little surprise',
		seal: '!',
		hue: '#6b4d9a',
	},
	{
		id: 'because',
		label: 'Just because',
		blurb: 'A quiet sky-blue card',
		greeting: 'just because',
		seal: '·',
		hue: '#4a6d8c',
	},
];

export const OCCASION_BY_ID: Record<OccasionId, Occasion> = Object.fromEntries(
	OCCASIONS.map((o) => [o.id, o]),
) as Record<OccasionId, Occasion>;
