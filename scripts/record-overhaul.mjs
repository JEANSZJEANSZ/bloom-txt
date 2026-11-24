import { preview } from 'vite';
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import pkg from 'lz-string';

const { compressToEncodedURIComponent } = pkg;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.join(root, 'screenshots');

const flowers = [
	['rose', 'red'],
	['sunflower', 'yellow'],
	['tulip', 'magenta'],
	['peony', 'pink'],
	['daisy', 'white'],
	['poppy', 'red'],
	['cornflower', 'blue'],
	['lily', 'orange'],
	['mum', 'magenta'],
	['rose', 'pink'],
	['violet', 'purple'],
	['lavender', 'purple'],
];

function token(extra = {}) {
	const payload = {
		v: 1,
		f: flowers,
		t: 'you',
		s: 'me',
		n: 'she wanted wild flowers, they were out of season',
		m: 'So I made them by hand, and I hoped the light would find you.',
		o: 'love',
		c: ['bee', 'ladybug'],
		...extra,
	};
	return compressToEncodedURIComponent(JSON.stringify(payload));
}

const draft = {
	flowers: flowers.map(([id, color]) => ({ id, color })),
	letter: {
		to: 'you',
		from: 'me',
		note: 'she wanted wild flowers, they were out of season',
		message: 'So I made them by hand, and I hoped the light would find you.',
		occasion: 'love',
	},
	critters: [{ id: 'bee' }, { id: 'ladybug' }],
	style: '3d',
	detail: 100,
	ribbon: 'gold',
	music: { kind: 'tune', id: 'musicbox' },
};

const port = 4183;
const server = await preview({ root, preview: { port, host: '127.0.0.1', strictPort: true } });
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
await mkdir(outDir, { recursive: true });
const gift = `${base}/#/gift/${token({ b: 'gold' })}`;

const browser = await chromium.launch();
const errors = [];

try {
	const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
	const page = await desk.newPage();
	page.on('pageerror', (e) => errors.push(String(e)));

	// Landing, assembled
	await page.goto(`${base}/?intro=done#/`, { waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(700);
	await page.screenshot({ path: path.join(outDir, 'overhaul-landing.png') });
	console.log('landing');

	// Mid-intro frames for review
	await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(200);
	await page.screenshot({ path: path.join(outDir, '_intro-0.png') });
	await page.waitForTimeout(900);
	await page.screenshot({ path: path.join(outDir, '_intro-1.png') });
	await page.waitForTimeout(1200);
	await page.screenshot({ path: path.join(outDir, '_intro-2.png') });
	console.log('intro frames');

	// Builder
	await page.evaluate((d) => localStorage.setItem('bloom-txt:draft', JSON.stringify(d)), draft);
	await page.setViewportSize({ width: 1440, height: 1100 });
	await page.goto(`${base}/?studio&intro=done#/`, { waitUntil: 'networkidle' });
	await page.evaluate(() => document.fonts.ready);
	await page.locator('#studio').waitFor();
	await page.locator('#studio canvas').first().waitFor({ timeout: 20_000 });
	await page.waitForTimeout(500);
	await page.locator('#studio').scrollIntoViewIfNeeded();
	await page.waitForTimeout(250);
	await page.locator('#studio').screenshot({ path: path.join(outDir, 'overhaul-builder.png') });
	console.log('builder');

	// Reveal stills
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(gift, { waitUntil: 'networkidle' });
	await page.getByText('Open your letter').waitFor({ timeout: 15_000 });
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(1100);
	await page.screenshot({ path: path.join(outDir, 'overhaul-reveal-1.png') });
	console.log('reveal-1 sealed');

	await page.getByLabel('Open your letter').click();
	await page.waitForTimeout(280);
	await page.screenshot({ path: path.join(outDir, 'overhaul-reveal-2.png') });
	console.log('reveal-2 opening');

	await page.waitForTimeout(2400);
	await page.screenshot({ path: path.join(outDir, 'overhaul-reveal-3.png') });
	console.log('reveal-3 blooming');

	for (let k = 0; k < 6; k++) {
		await page.keyboard.press('Space');
		await page.waitForTimeout(80);
	}
	await page.getByText('Dear you,').waitFor({ timeout: 10_000 });
	await page.waitForTimeout(1800);
	await page.screenshot({ path: path.join(outDir, 'overhaul-reveal-4.png') });
	console.log('reveal-4 letter');

	if (errors.length) console.log('desk errors', errors.splice(0));
	await desk.close();

	// Mobile sealed + letter
	const phone = await browser.newContext({
		viewport: { width: 390, height: 844 },
		deviceScaleFactor: 3,
		isMobile: true,
		hasTouch: true,
	});
	const mobile = await phone.newPage();
	mobile.on('pageerror', (e) => errors.push(String(e)));
	await mobile.goto(gift, { waitUntil: 'networkidle' });
	await mobile.getByText('Open your letter').waitFor({ timeout: 15_000 });
	await mobile.evaluate(() => document.fonts.ready);
	await mobile.waitForTimeout(1000);
	await mobile.screenshot({ path: path.join(outDir, 'overhaul-reveal-mobile.png') });
	console.log('reveal-mobile');
	if (errors.length) console.log('mobile errors', errors.splice(0));
	await phone.close();

	// Desktop reveal video
	const tmp = path.join(outDir, '_video');
	await rm(tmp, { recursive: true, force: true });
	await mkdir(tmp, { recursive: true });
	const rec = await browser.newContext({
		viewport: { width: 1280, height: 720 },
		deviceScaleFactor: 1,
		recordVideo: { dir: tmp, size: { width: 1280, height: 720 } },
	});
	const vpage = await rec.newPage();
	await vpage.goto(gift, { waitUntil: 'networkidle' });
	await vpage.getByText('Open your letter').waitFor({ timeout: 15_000 });
	await vpage.evaluate(() => document.fonts.ready);
	await vpage.waitForTimeout(1400);
	await vpage.getByLabel('Open your letter').click();
	await vpage.waitForTimeout(1300);
	// let it grow a bit, then skip to the letter so the video stays short
	await vpage.waitForTimeout(2800);
	for (let k = 0; k < 6; k++) {
		await vpage.keyboard.press('Space');
		await vpage.waitForTimeout(60);
	}
	await vpage.getByText('Dear you,').waitFor({ timeout: 10_000 }).catch(() => {});
	await vpage.waitForTimeout(2200);
	const video = vpage.video();
	await rec.close();
	const webm = video ? await video.path() : '';
	const mp4 = path.join(outDir, 'overhaul-reveal.mp4');
	if (webm) {
		const ff = spawnSync(
			'ffmpeg',
			['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4],
			{ encoding: 'utf-8' },
		);
		if (ff.status) {
			console.log(ff.stderr);
			throw new Error('ffmpeg failed');
		}
		console.log('wrote', mp4);
	} else {
		throw new Error('no video file');
	}
} finally {
	await browser.close();
	await server.close();
}
