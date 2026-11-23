import { resolveRoles } from './palette';
import type { CenterStyle, ColorId, ColorRole, FlowerId } from './types';

export type GlyphFrame = {
	art: string[];
};

export type FlowerDef = {
	id: FlowerId;
	name: string;
	blurb: string;
	defaultColor: ColorId;
	centerStyle: CenterStyle;
	frames: GlyphFrame[];
};

/** Character → color role. Spaces are empty. */
const ROLE: Record<string, ColorRole> = {
	'@': 'petal',
	'#': 'petal',
	'&': 'petal',
	W: 'petal',
	M: 'petal',
	O: 'petal',
	'%': 'petalDim',
	o: 'petalDim',
	',': 'petalDim',
	a: 'petalDim',
	c: 'center',
	C: 'center',
	'0': 'centerHot',
	Q: 'centerHot',
	x: 'stamen',
	'+': 'stamen',
	'*': 'accent',
	'~': 'leaf',
	j: 'leaf',
	r: 'leaf',
	v: 'leaf',
	"'": 'leaf',
	'`': 'leaf',
};

export function roleFor(ch: string): ColorRole | null {
	if (ch === ' ' || ch === '') return null;
	return ROLE[ch] ?? 'petal';
}

function F(...art: string[]): GlyphFrame {
	return { art };
}

export const FLOWERS: FlowerDef[] = [
	{
		id: 'rose',
		name: 'Rose',
		blurb: 'A dense, classic bloom',
		defaultColor: 'red',
		centerStyle: 'dark',
		frames: [
			F(' ,@, ', ' #@# ', " '%' "),
			F(' .@%. ', ' #@C# ', ' %@C@% ', ' .@#. '),
			F('  @@%@@  ', ' @@#C#@@ ', ' @#C0C#@ ', ' @@#C#@@ ', '  @@%@@  '),
			F('  .@@#@@.  ', ' @@&#C#&@@ ', ' @#&C0C&#@ ', ' @@&#C#&@@ ', '  .@@#@@.  '),
			F(
				'   ,@@%@@,   ',
				'  @@@#&#@@@  ',
				' @@&#C0C#&@@ ',
				' @#&C000C&#@ ',
				' @@&#C0C#&@@ ',
				'  @@@#&#@@@  ',
				"   '@@%@@'   ",
			),
		],
	},
	{
		id: 'daisy',
		name: 'Daisy',
		blurb: 'Open petals, sunny eye',
		defaultColor: 'white',
		centerStyle: 'yellow',
		frames: [
			F('  *  ', ' *c* ', '  *  '),
			F(' .o*o. ', ' o*C*o ', ' .o*o. '),
			F('  * o *  ', ' o *C* o ', '  * o *  '),
			F('   . * .   ', '  * o o *  ', ' * o C o * ', '  * o o *  ', '   . * .   '),
			F(
				'    * * *    ',
				'  *  o o  *  ',
				' * o  C0  o * ',
				'  *  o o  *  ',
				'    * * *    ',
			),
		],
	},
	{
		id: 'tulip',
		name: 'Tulip',
		blurb: 'A cup of spring',
		defaultColor: 'pink',
		centerStyle: 'warm',
		frames: [
			F(' ,%, ', ' %@% ', ' #@# ', '  v  '),
			F(' .@%@. ', ' @@C@@ ', ' #@#@# ', '  ~v~  '),
			F(' .@@%@@. ', ' @@#C#@@ ', '  @@C@@  ', '   \\v/   '),
			F(' .@@#@#@@. ', ' @@##C##@@ ', '  @@#C#@@  ', "   '\\v/'   "),
			F(' .@@#@#@#@@. ', ' @@##C0C##@@ ', '  @@@#C#@@@  ', '   @@%C%@@   ', "    '~v~'    "),
		],
	},
	{
		id: 'sunflower',
		name: 'Sunflower',
		blurb: 'A wide, golden face',
		defaultColor: 'yellow',
		centerStyle: 'brown',
		frames: [
			F('  %%%  ', ' %#C#% ', '  %%%  '),
			F(' .%%%%%. ', ' %%#C#%% ', ' %%C0C%% ', ' .%%%%%. '),
			F(' .@%%%%%@. ', ' %@%%C%%@% ', ' %%#C0C#%% ', ' %@%%C%%@% ', ' .@%%%%%@. '),
			F(
				'  *@%%%@*  ',
				' @%%@#@%%@ ',
				' %%#C0C#%% ',
				' @%%C000C%%@ ',
				' %%#C0C#%% ',
				' @%%@#@%%@ ',
				'  *@%%%@*  ',
			),
			F(
				'   *@%#%#@*   ',
				'  @%%@#@#%%@  ',
				' @%%#C000C#%%@ ',
				' %%@C0QQ0C@%% ',
				' @%%#C000C#%%@ ',
				'  @%%@#@#%%@  ',
				'   *@%#%#@*   ',
			),
		],
	},
	{
		id: 'lavender',
		name: 'Lavender',
		blurb: 'A tall, quiet spike',
		defaultColor: 'purple',
		centerStyle: 'gold',
		frames: [
			F(' % ', ' @ ', ' | '),
			F(' % ', ' @ ', ' @ ', ' % ', ' v '),
			F('  %  ', ' @%@ ', ' %@% ', ' @%@ ', '  v  '),
			F('  %  ', ' @%@ ', ' %@% ', ' @%@ ', ' %@% ', '  v  '),
			F('  .%.  ', '  %@%  ', '  @%@  ', '  %@%  ', '  @%@  ', '  %@%  ', '  .v.  '),
		],
	},
	{
		id: 'poppy',
		name: 'Poppy',
		blurb: 'Papery petals, inky eye',
		defaultColor: 'orange',
		centerStyle: 'dark',
		frames: [
			F(' ,@, ', ' %C% ', " '*' "),
			F(' .@%@. ', ' @@C@@ ', ' %@0@% ', ' .#x#. '),
			F('  @@%@@  ', ' @@@C@@@ ', ' @@C0C@@ ', '  @x+x@  '),
			F('  ,@@%@@,  ', ' @@@@C@@@@ ', ' @@#C0C#@@ ', ' @@@x+x@@@ ', "  '%%x%%'  "),
			F(
				'   ,@@%@@,   ',
				'  @@@@#@@@@  ',
				' @@@@C0C@@@@ ',
				' @@#C0x0C#@@ ',
				' @@@@x+x@@@@ ',
				"  '%#x+#%'  ",
			),
		],
	},
	{
		id: 'violet',
		name: 'Violet',
		blurb: 'A little five-petal face',
		defaultColor: 'purple',
		centerStyle: 'gold',
		frames: [
			F('  *  ', ' *c* ', '  *  '),
			F(' .o*o. ', ' o*C*o ', ' .o*o. '),
			F('  o*o  ', ' o*C*o ', ' *oC0Co* ', ' o*C*o ', '  o*o  '),
			F('  .o*o.  ', ' o*oCo*o ', ' *oC0Co* ', ' o*oCo*o ', '  .o*o.  '),
			F('   o * o   ', '  o*oCo*o  ', ' * oC0Co * ', '  o*oCo*o  ', '   o * o   '),
		],
	},
	{
		id: 'lily',
		name: 'Lily',
		blurb: 'A starry trumpet',
		defaultColor: 'white',
		centerStyle: 'gold',
		frames: [
			F('  |  ', '  *  '),
			F('  \\*/  ', '  |C|  ', '  / \\  '),
			F('  \\ | /  ', '   \\|/   ', '   *C*   ', '   /|\\   ', '  / | \\  '),
			F('    |    ', '  \\ | /  ', ' --*C*-- ', '  / | \\  ', '    |    '),
			F(
				'     .     ',
				'   \\ | /   ',
				' --@*C0*@-- ',
				'   / | \\   ',
				"     '     ",
			),
		],
	},
	{
		id: 'peony',
		name: 'Peony',
		blurb: 'The fluffiest handful',
		defaultColor: 'pink',
		centerStyle: 'warm',
		frames: [
			F(' %@@% ', ' @CC@ ', ' %@@% '),
			F('  @@%@@  ', ' @@@C@@@ ', ' @@C0C@@ ', '  @@%@@  '),
			F('  .@@%@@.  ', ' @@@@C@@@@ ', ' @@#C0C#@@ ', ' @@@@C@@@@ ', '  .@@%@@.  '),
			F(
				'   @@#@#@@   ',
				'  @@@&#&@@@  ',
				' @@@#C0C#@@@ ',
				' @@&#C0C#&@@ ',
				' @@@#C0C#@@@ ',
				'  @@@&#&@@@  ',
				'   @@#@#@@   ',
			),
			F(
				'    ,@#@#@,    ',
				'   @@&#&#&@@   ',
				'  @@@#&0&#@@@  ',
				' @@@&#C0C#&@@@ ',
				' @@#&C000C&#@@ ',
				' @@@&#C0C#&@@@ ',
				'  @@@#&0&#@@@  ',
				'   @@&#&#&@@   ',
				"    '@#@#@'    ",
			),
		],
	},
	{
		id: 'cornflower',
		name: 'Cornflower',
		blurb: 'Frilly and a little wild',
		defaultColor: 'blue',
		centerStyle: 'gold',
		frames: [
			F(' *%* ', ' %C% ', ' *%* '),
			F(' *%*%* ', ' %*C*% ', ' *%*%* '),
			F('  * % *  ', ' *%*%*%* ', ' %*C0C*% ', ' *%*%*%* ', '  * % *  '),
			F('   * * *   ', ' *%* % *%* ', ' * %C0C% * ', ' *%* % *%* ', '   * * *   '),
			F(
				'    * % *    ',
				'  *%* * *%*  ',
				' * % *C* % * ',
				' *%* C0C *%* ',
				' * % *C* % * ',
				'  *%* * *%*  ',
				'    * % *    ',
			),
		],
	},
	{
		id: 'mum',
		name: 'Chrysanthemum',
		blurb: 'Many little spiky petals',
		defaultColor: 'orange',
		centerStyle: 'gold',
		frames: [
			F(' \\/\\/ ', '  \\C/  ', ' /\\/\\ '),
			F(' \\//\\/ ', ' \\/C\\/ ', ' /\\/C\\ ', ' \\/\\/\\ '),
			F('  \\//\\/\\  ', ' //\\C/\\\\ ', ' \\/C0C/\\ ', ' /\\\\C\\// ', '  \\\\\\/\\/  '),
			F(
				'  `,/\\/\\,`  ',
				' \\//\\/\\/\\\\ ',
				' //\\/C\\/\\\\ ',
				' \\/C000C/\\ ',
				' /\\\\/C/\\// ',
				'  \\\\\\/\\/\\  ',
				"   `/\\/\\'   ",
			),
			F(
				'   *%/\\/%*   ',
				'  @\\//\\/\\/@  ',
				' %//\\/C\\/\\\\% ',
				' @\\/C0Q0C/\\@ ',
				' %/\\\\/C/\\\\/% ',
				'  @\\/\\/\\/@  ',
				'   *%/\\/%*   ',
			),
		],
	},
	{
		id: 'forgetmenot',
		name: 'Forget-me-not',
		blurb: 'A tiny cluster of sky',
		defaultColor: 'blue',
		centerStyle: 'yellow',
		frames: [
			F('  *  ', ' *c* '),
			F('  *    ', ' *c* * ', '    *c* '),
			F('  *o*    ', ' *oCo* * ', '     *o* ', '    *oCo* '),
			F(
				'  *o*  *  ',
				' *oCo*o*o ',
				'  *o* oCo ',
				'     *o*  ',
			),
			F(
				'   *o*  *o*  ',
				'  *o0o*o*o* ',
				'   *o* *o0o* ',
				'  *o*o*  *o* ',
				'     *o*     ',
			),
		],
	},
];

export const FLOWER_BY_ID: Record<FlowerId, FlowerDef> = Object.fromEntries(
	FLOWERS.map((f) => [f.id, f]),
) as Record<FlowerId, FlowerDef>;

export const FLOWER_IDS = FLOWERS.map((f) => f.id);

export function isFlowerId(v: unknown): v is FlowerId {
	return typeof v === 'string' && v in FLOWER_BY_ID;
}

export function frameCount(id: FlowerId): number {
	return FLOWER_BY_ID[id].frames.length;
}

export function maxFrameCount(): number {
	return Math.max(...FLOWERS.map((f) => f.frames.length));
}

export function flowerWidth(id: FlowerId, frameIndex?: number): number {
	const frames = FLOWER_BY_ID[id].frames;
	const frame = frames[frameIndex ?? frames.length - 1];
	return Math.max(...frame.art.map((l) => l.length));
}

export function flowerHeight(id: FlowerId, frameIndex?: number): number {
	const frames = FLOWER_BY_ID[id].frames;
	const frame = frames[frameIndex ?? frames.length - 1];
	return frame.art.length;
}

export function colorsFor(id: FlowerId, petal: ColorId): Record<ColorRole, string> {
	return resolveRoles(petal, FLOWER_BY_ID[id].centerStyle);
}
