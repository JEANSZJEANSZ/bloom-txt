import { preview } from 'vite';
import { chromium } from 'playwright';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const label = process.argv[2] || 'run';
const port = Number(process.argv[3] || 4188);
const server = await preview({ root, preview: { port, host: '127.0.0.1', strictPort: true } });
const base = server.resolvedUrls.local[0].replace(/\/$/, '');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto(`${base}/?studio&intro=done&pose=0.6&perf=1#/`, { waitUntil: 'networkidle' });
await page.locator('#studio canvas').first().waitFor({ timeout: 20_000 });
await page.evaluate(() => document.fonts.ready);
await page.locator('#studio').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);

const result = await page.evaluate(async () => {
	const w = window;
	w.__bloomStagePerf = { times: [], stamps: [] };
	const rafIntervals = [];
	let last = performance.now();
	let handle = 0;
	const tick = (t) => {
		rafIntervals.push(t - last);
		last = t;
		handle = requestAnimationFrame(tick);
	};
	handle = requestAnimationFrame(tick);
	await new Promise((r) => setTimeout(r, 3000));
	cancelAnimationFrame(handle);
	const times = w.__bloomStagePerf.times.slice();
	const stamps = w.__bloomStagePerf.stamps.slice();
	const drop = (a) => a.slice(Math.floor(a.length * 0.1)); // warm-up
	const work = drop(times);
	const iv = drop(rafIntervals);
	const avg = (a) => a.reduce((s, n) => s + n, 0) / Math.max(1, a.length);
	const pct = (a, p) => {
		const s = [...a].sort((x, y) => x - y);
		return s[Math.min(s.length - 1, Math.floor(s.length * p))];
	};
	const canvases = [...document.querySelectorAll('canvas')].map((c) => ({
		w: c.width,
		h: c.height,
		cssW: Math.round(c.getBoundingClientRect().width),
		cssH: Math.round(c.getBoundingClientRect().height),
		cls: c.className,
	}));
	const stage = document.querySelector('#studio canvas');
	const stageBox = stage ? stage.getBoundingClientRect() : null;
	return {
		stageWorkMs: {
			n: work.length,
			avg: avg(work),
			p50: pct(work, 0.5),
			p95: pct(work, 0.95),
			max: Math.max(0, ...work),
		},
		rafIntervalMs: {
			n: iv.length,
			avg: avg(iv),
			p50: pct(iv, 0.5),
			p95: pct(iv, 0.95),
			fps: 1000 / Math.max(0.001, avg(iv)),
		},
		canvasCount: canvases.length,
		canvases,
		stageCss: stageBox ? { w: Math.round(stageBox.width), h: Math.round(stageBox.height) } : null,
		dpr: window.devicePixelRatio,
	};
});

console.log(JSON.stringify({ label, ...result }, null, 2));
await writeFile(path.join(root, 'screenshots', `perf-${label}.json`), JSON.stringify({ label, ...result }, null, 2));
await browser.close();
await server.close();
