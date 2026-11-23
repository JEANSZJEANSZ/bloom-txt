import { preview } from 'vite';
import { chromium } from 'playwright';
import lz from 'lz-string';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.join(root, 'screenshots');

const payload = {
	v: 1,
	f: [
		['lily', 'red'],
		['lily', 'yellow'],
		['lily', 'white'],
		['lily', 'magenta'],
		['lily', 'orange'],
		['lily', 'pink'],
		['lily', 'red'],
		['lily', 'white'],
		['lily', 'yellow'],
		['lily', 'magenta'],
		['lily', 'red'],
		['lily', 'pink'],
	],
	t: 'you',
	s: 'me',
	n: 'she wanted wild flowers, they were out of season',
	m: 'So I made them by hand.\n\nA little bouquet that will not wilt, for whenever you need a handful of color.',
	o: 'love',
	c: ['bee', 'ladybug', 'butterfly'],
};

const token = lz.compressToEncodedURIComponent(JSON.stringify(payload));
const draft = {
	flowers: payload.f.map(([id, color]) => ({ id, color })),
	letter: {
		to: payload.t,
		from: payload.s,
		note: payload.n,
		message: payload.m,
		occasion: payload.o,
	},
	critters: payload.c.map((id) => ({ id })),
};

const server = await preview({
	root,
	preview: { port: 4173, host: '127.0.0.1', strictPort: true },
});
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();

try {
	const shotCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
	const page = await shotCtx.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(String(e)));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	await page.goto(`${base}/?open=1&pose=1.6#/gift/${token}`, { waitUntil: 'networkidle' });
	await page.locator('canvas').first().waitFor({ timeout: 15_000 });
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(6500);
	const fps = await page.evaluate(
		() =>
			new Promise((resolve) => {
				const ts = [];
				const step = (t) => {
					ts.push(t);
					if (ts.length < 121) requestAnimationFrame(step);
					else resolve(120000 / (ts[120] - ts[0]));
				};
				requestAnimationFrame(step);
			}),
	);
	console.log('fps (headless, dpr2)', fps.toFixed(1));
	const canvas = page.locator('canvas').first();
	const still = path.join(outDir, 'realistic.png');
	await canvas.screenshot({ path: still });
	console.log('wrote', still);
	await page.screenshot({ path: path.join(outDir, 'realistic-page.png'), fullPage: true });
	if (errors.length) console.log('page errors:', errors);
	await shotCtx.close();

	// Builder still on a phone-sized viewport.
	const mCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
	const mPage = await mCtx.newPage();
	await mPage.goto(`${base}/?open=1#/gift/${token}`, { waitUntil: 'networkidle' });
	await mPage.locator('canvas').first().waitFor({ timeout: 15_000 });
	await mPage.waitForTimeout(6500);
	await mPage.locator('canvas').first().screenshot({ path: path.join(outDir, 'realistic-mobile.png') });
	await mCtx.close();

	const videoDir = path.join(outDir, '.video-tmp');
	const vContext = await browser.newContext({
		viewport: { width: 1280, height: 900 },
		deviceScaleFactor: 1,
		recordVideo: { dir: videoDir, size: { width: 1280, height: 900 } },
	});
	const vPage = await vContext.newPage();
	await vPage.goto(`${base}/?open=1#/gift/${token}`, { waitUntil: 'networkidle' });
	await vPage.locator('canvas').first().waitFor({ timeout: 15_000 });
	await vPage.waitForTimeout(11000);
	const video = vPage.video();
	await vPage.close();
	await vContext.close();
	if (!video) throw new Error('no video');
	const rawVideo = await video.path();
	const mp4 = path.join(outDir, 'realistic.mp4');
	const res = spawnSync(
		'ffmpeg',
		['-y', '-i', rawVideo, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4],
		{ encoding: 'utf8' },
	);
	if (res.status !== 0) throw new Error(res.stderr.slice(-500));
	console.log('wrote', mp4);
} finally {
	await browser.close();
	await server.close();
}
