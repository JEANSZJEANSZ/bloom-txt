import { FLOWER_BY_ID } from './flowers';
import { INKS, PETAL, resolveRoles } from './palette';
import { SLOT_COUNT } from './flora3d';
import type { ColorId, FlowerId } from './types';

function mix(a: string, b: string, t: number): string {
	const pa = parseInt(a.slice(1), 16);
	const pb = parseInt(b.slice(1), 16);
	const ch = (s: number) => {
		const x = (pa >> s) & 255;
		const y = (pb >> s) & 255;
		return Math.round(x + (y - x) * t);
	};
	return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** Rich, saturated lily tones (crimson, peach, cream…) like real Asiatic lilies. */
const LILY_TONE: Record<ColorId, string> = {
	red: '#e3142e',
	orange: '#ff8140',
	yellow: '#ffdc2e',
	green: '#a6e25a',
	blue: '#5f8dff',
	purple: '#a440e0',
	magenta: '#ff2a9c',
	pink: '#ff6cc0',
	white: '#fff6e8',
};

/** Base colors per mesh slot (throat, petal, tip, center, centerHot, filament, anther, sepal, speck). */
export function resolveFlowerColors(id: FlowerId, color: ColorId): string[] {
	const p = PETAL[color];
	const roles = resolveRoles(color, FLOWER_BY_ID[id].centerStyle);
	let throat = mix(p.mid, p.dim, 0.6);
	let speck = mix(p.dim, '#1a0a0a', 0.55);
	let anther: string = INKS.gold;
	let center = roles.center;
	let centerHot = roles.centerHot;
	const filament = id === 'poppy' ? '#2a2418' : '#e4efc0';
	if (id === 'lily') {
		// One solid colour per bloom; the mesh's tone carries the dark heart and crease.
		const tone = LILY_TONE[color] ?? p.mid;
		return [tone, tone, tone, roles.center, '#9be27a', '#efe6b0', '#a8481a', '#3fae55', tone];
	}
	if (id === 'violet') throat = '#fff3c0';
	if (id === 'forgetmenot') throat = '#f2f6ff';
	if (id === 'poppy') throat = '#4a0a14';
	const petalMid = id === 'daisy' && color === 'white' ? '#ffffff' : p.mid;
	if (id === 'daisy' || id === 'forgetmenot' || id === 'violet') {
		center = color === 'yellow' ? '#c47a12' : '#ffc928';
		centerHot = color === 'yellow' ? '#8a4a10' : '#ffe680';
	}
	if (id === 'sunflower') {
		center = '#5a3414';
		centerHot = '#8a5a22';
	}
	if (id === 'poppy') {
		center = '#2a3020';
		centerHot = '#1a1a14';
		anther = '#20160f';
	}
	if (id === 'cornflower') {
		center = mix(p.dim, '#1a1030', 0.4);
	}
	const out = [throat, petalMid, p.bright, center, centerHot, filament, anther, '#3fae55', speck];
	if (out.length !== SLOT_COUNT) throw new Error('slot palette mismatch');
	return out;
}
