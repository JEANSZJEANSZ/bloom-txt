import { writeFileSync } from 'node:fs';
import { flowerMesh, OPEN_KEYS } from '../src/lib/flora3d';
import { resolveFlowerColors } from '../src/lib/flowerColors';
import type { FlowerId, ColorId } from '../src/lib/types';

const ids = (process.argv[2] ?? 'lily').split(',') as FlowerId[];
const color = (process.argv[3] ?? 'red') as ColorId;
const opens = [0, 0.5, 1];
const views = [
	{ name: 'front', tilt: Math.PI / 2 - 0.25 },
	{ name: 'side', tilt: 0.25 },
];
const W = 70, H = 44;
const RAMP = '.,-~:;=!*#$@';
let html = `<html><body style="margin:0;background:#0b0e14;color:#888;font:11px monospace">`;
const L = (() => { const v = [-0.48, 0.68, 0.56]; const l = Math.hypot(...v); return v.map((x) => x / l); })();
for (const id of ids) {
	const mesh = flowerMesh(id, 0.008);
	const pal = resolveFlowerColors(id, color);
	html += `<div>${id}</div><div style="display:flex;flex-wrap:wrap">`;
	for (const v of views) {
		for (const o of opens) {
			const k = Math.round(o * (OPEN_KEYS - 1));
			const P = mesh.pos[k], N = mesh.nor[k];
			const z = new Float32Array(W * H).fill(-1e9);
			const cells: (string | null)[] = new Array(W * H).fill(null);
			const ct = Math.cos(v.tilt), st = Math.sin(v.tilt);
			for (let i = 0; i < mesh.count; i++) {
				const x = P[i * 3], y = P[i * 3 + 1], zz = P[i * 3 + 2];
				// rotate about X so the flower axis (+Y) tilts toward the camera (+Z)
				const ry = y * ct - zz * st, rz = y * st + zz * ct;
				let nx = N[i * 3], ny = N[i * 3 + 1] * ct - N[i * 3 + 2] * st, nz = N[i * 3 + 1] * st + N[i * 3 + 2] * ct;
				if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
				const col = Math.round(W / 2 + x * 55), row = Math.round(H / 2 - ry * 55 * 0.55);
				if (col < 0 || row < 0 || col >= W || row >= H) continue;
				const idx = row * W + col;
				if (rz <= z[idx]) continue;
				z[idx] = rz;
				const d = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2] + 0.35) / 1.35);
				const lum = 0.16 + 0.78 * d;
				const base = pal[mesh.slot[i]];
				const n = parseInt(base.slice(1), 16);
				const f = 0.3 + 0.9 * lum;
				const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((q) => Math.min(255, Math.round(q * f)));
				cells[idx] = `<span style="color:rgb(${c})">${RAMP[Math.min(11, Math.floor((0.2 + lum * 0.9) * 12))]}</span>`;
			}
			html += `<pre style="font:11px/11.5px monospace;margin:4px;border:1px solid #222">${v.name} o=${o}\n`;
			for (let r = 0; r < H; r++) { for (let c = 0; c < W; c++) html += cells[r * W + c] ?? ' '; html += '\n'; }
			html += '</pre>';
		}
	}
	html += '</div>';
}
writeFileSync('/tmp/mesh.html', html + '</body></html>');
