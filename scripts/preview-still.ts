import { writeFileSync } from 'node:fs';
import { renderBouquet } from '../src/lib/render';
import { DEFAULT_FLOWERS } from '../src/lib/defaults';
import type { Placement } from '../src/lib/types';

const args = process.argv.slice(2);
const growth = Number(args[0] ?? 1);
const yaw = Number(args[1] ?? 0.4);
const cols = Number(args[2] ?? 260);
const rows = Number(args[3] ?? 164);
const which = args[4] ?? 'default';
const lilies: Placement[] = [
	{ id: 'lily', color: 'red' },
	{ id: 'lily', color: 'yellow' },
	{ id: 'lily', color: 'white' },
	{ id: 'lily', color: 'magenta' },
	{ id: 'lily', color: 'orange' },
	{ id: 'lily', color: 'pink' },
	{ id: 'lily', color: 'red' },
	{ id: 'lily', color: 'white' },
	{ id: 'lily', color: 'yellow' },
	{ id: 'lily', color: 'magenta' },
	{ id: 'lily', color: 'red' },
	{ id: 'lily', color: 'pink' },
];
const MIX: Placement[] = [['rose','red'],['sunflower','yellow'],['tulip','magenta'],['peony','pink'],['daisy','white'],['poppy','red'],['cornflower','blue'],['lily','orange'],['mum','magenta'],['rose','pink'],['violet','purple'],['lavender','purple']].map(([id, color]) => ({ id, color })) as Placement[];
const flowers = which === 'lilies' ? lilies : which === 'mix' ? MIX : DEFAULT_FLOWERS;
const t0 = performance.now();
const r = renderBouquet({ flowers, growth, yaw, cols, rows, time: 3, particles: true, critters: [{ id: 'bee' }, { id: 'ladybug' }], critterIntro: growth >= 1 ? 1 : 0 });
const t1 = performance.now();
let n = 0;
for (let i = 0; i < 20; i++) renderBouquet({ flowers, growth, yaw: yaw + i * 0.1, cols, rows, time: 3 + i * 0.016, particles: true, sway: true });
const t2 = performance.now();
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
let html = `<html><body style="margin:0;background:#0b0e14"><pre style="font:bold 4px/4.2px 'IBM Plex Mono',monospace;margin:12px;letter-spacing:0">`;
for (const row of r.grid) {
	for (const c of row) {
		if (!c) html += ' ';
		else { const v = c.rgb ?? parseInt(c.color.slice(1), 16); const bg = `rgb(${((v >> 16) & 255) * 0.32 | 0},${((v >> 8) & 255) * 0.32 | 0},${(v & 255) * 0.32 | 0})`; html += `<span style="color:${c.color};background:${c.kind === 'sparkle' ? 'none' : bg}">${esc(c.ch)}</span>`; n++; }
	}
	html += '\n';
}
html += '</pre></body></html>';
writeFileSync('/tmp/still.html', html);
console.log('cells', n, 'first ms', (t1 - t0).toFixed(1), 'avg ms', ((t2 - t1) / 20).toFixed(2));
