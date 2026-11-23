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
		['lavender', 'purple'],
		['poppy', 'orange'],
		['daisy', 'white'],
		['sunflower', 'yellow'],
		['cornflower', 'blue'],
		['rose', 'red'],
		['forgetmenot', 'blue'],
		['peony', 'pink'],
		['violet', 'purple'],
		['tulip', 'magenta'],
		['mum', 'orange'],
	],
	t: 'you',
	s: 'me',
	n: 'she wanted wild flowers, they were out of season',
	m: 'So I made them by hand.\n\nA little bouquet that will not wilt, for whenever you need a handful of color.',
	o: 'love',
	c: ['bee', 'ladybug', 'butterfly', 'bee', 'ladybug'],
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
	const shotCtx = await browser.newContext({
		viewport: { width: 1024, height: 640 },
		deviceScaleFactor: 2,
	});
	const page = await shotCtx.newPage();
	await page.addInitScript((raw) => {
		localStorage.setItem('bloom-txt:draft', raw);
	}, JSON.stringify(draft));
	await page.goto(`${base}/`, { waitUntil: 'networkidle' });
	await page.getByRole('heading', { name: 'Bloom.txt' }).waitFor();
	await page.locator('canvas').first().waitFor();
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(1600); // let bees fly in
	const panel = page.locator('figure.panel').first();
	await panel.scrollIntoViewIfNeeded();
	await page.waitForTimeout(200);
	const framed = path.join(outDir, 'builder-1024.png');
	await panel.screenshot({ path: framed });
	console.log('wrote', framed);
	const full = path.join(outDir, 'builder-1024-page.png');
	await page.screenshot({ path: full, fullPage: true });
	console.log('wrote', full);
	await shotCtx.close();

	const videoDir = path.join(outDir, '.video-tmp');
	const vContext = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		deviceScaleFactor: 1,
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
	});
	const vPage = await vContext.newPage();
	await vPage.goto(`${base}/?open=1#/gift/${token}`, { waitUntil: 'networkidle' });
	await vPage.locator('canvas').first().waitFor({ timeout: 15_000 });
	await vPage.waitForTimeout(9000);
	const video = vPage.video();
	await vPage.close();
	await vContext.close();
	if (!video) throw new Error('no video');
	const rawVideo = await video.path();
	const mp4 = path.join(outDir, 'critters.mp4');
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
