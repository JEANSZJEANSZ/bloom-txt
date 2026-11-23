import { preview } from 'vite';
import { chromium } from 'playwright';
import lz from 'lz-string';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = '/workspace/ascii-bouquet';
const outDir = path.join(root, 'screenshots');
const videoDir = path.join(outDir, '.video-tmp');

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
};
const token = lz.compressToEncodedURIComponent(JSON.stringify(payload));

const server = await preview({
	root,
	preview: { port: 4173, host: '127.0.0.1', strictPort: true },
});
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
await mkdir(videoDir, { recursive: true });
const browser = await chromium.launch();
try {
	const vContext = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		deviceScaleFactor: 1,
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
	});
	const vPage = await vContext.newPage();
	await vPage.goto(`${base}/?open=1#/gift/${token}`, { waitUntil: 'networkidle' });
	await vPage.locator('canvas').first().waitFor({ timeout: 15_000 });
	await vPage.waitForTimeout(8500);
	const video = vPage.video();
	await vPage.close();
	await vContext.close();
	if (!video) throw new Error('no video');
	const rawVideo = await video.path();
	const mp4 = path.join(outDir, 'grow.mp4');
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
