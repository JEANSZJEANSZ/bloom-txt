// Browser entry: renders each flower alone (and mixed bouquets) with the real renderer + canvas path.
import { renderBouquet } from '../src/lib/render';
import { drawGridFast, measureGrid, waitForFonts } from '../src/lib/draw';
import { FLOWERS } from '../src/lib/flowers';
import type { ColorId, FlowerId, Placement } from '../src/lib/types';

const SHOW: Record<string, string> = { rose: 'red', daisy: 'white', tulip: 'magenta', sunflower: 'yellow', lavender: 'purple', poppy: 'red', violet: 'purple', lily: 'orange', peony: 'pink', cornflower: 'blue', mum: 'magenta', forgetmenot: 'blue' };
const q = new URLSearchParams(location.search);
const mode = q.get('mode') ?? 'gallery';
const yaw = Number(q.get('yaw') ?? 0);
const only = q.get('only');
const colorOverride = q.get('color') as ColorId | null;

async function tile(host: HTMLElement, label: string, flowers: Placement[], cols: number, rows: number, cssW: number, focus: boolean, y: number) {
	const wrap = document.createElement('figure');
	wrap.style.cssText = 'margin:0;position:relative;display:inline-block';
	const c = document.createElement('canvas');
	const ctx = c.getContext('2d', { willReadFrequently: true })!;
	const m = measureGrid(ctx, cols, rows, cssW, '');
	const dpr = 2;
	c.width = Math.round(m.width * dpr);
	c.height = Math.round(m.height * dpr);
	c.style.width = m.width + 'px';
	c.style.height = m.height + 'px';
	const r = renderBouquet({ flowers, complete: true, growth: 1, yaw: y, time: 0, cols, rows, focus, particles: false, stars: true, sway: false });
	drawGridFast(ctx, r.grid, '', m, 1, dpr);
	wrap.appendChild(c);
	if (label) {
		const cap = document.createElement('figcaption');
		cap.textContent = label;
		cap.style.cssText = 'position:absolute;left:10px;top:6px;font:600 13px ui-monospace,monospace;color:#9fb0c8;letter-spacing:.08em;text-transform:uppercase';
		wrap.appendChild(cap);
	}
	host.appendChild(wrap);
}

(async () => {
	await waitForFonts();
	document.body.style.cssText = 'margin:0;background:#0b0e14';
	const host = document.createElement('div');
	host.style.cssText = 'display:grid;grid-template-columns:repeat(3,auto);gap:0;width:max-content';
	document.body.appendChild(host);
	if (mode === 'gallery') {
		for (const f of FLOWERS) {
			if (only && f.id !== only) continue;
			const color = (colorOverride ?? SHOW[f.id] ?? f.defaultColor) as ColorId;
			await tile(host, f.name, [{ id: f.id as FlowerId, color }], 170, 104, 560, true, yaw);
		}
	}
	(window as unknown as { __done: boolean }).__done = true;
})();
