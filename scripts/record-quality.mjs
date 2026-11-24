import { preview } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
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
		m: 'So I made them by hand.',
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
		message: 'So I made them by hand.',
		occasion: 'love',
	},
	critters: [{ id: 'bee' }, { id: 'ladybug' }],
	style: '3d',
	detail: 100,
	ribbon: 'pink',
	music: { kind: 'none' },
};

const port = 4190;
const server = await preview({ root, preview: { port, host: '127.0.0.1', strictPort: true } });
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();

try {
	const desk = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
	const page = await desk.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(String(e)));

	await page.addInitScript((d) => localStorage.setItem('bloom-txt:draft', JSON.stringify(d)), draft);

	// Studio: cheap paper background, no live sky
	await page.goto(`${base}/?studio&intro=done&pose=0.6#/`, { waitUntil: 'networkidle' });
	await page.locator('#studio canvas').first().waitFor({ timeout: 20_000 });
	await page.evaluate(() => document.fonts.ready);
	await page.locator('#studio').scrollIntoViewIfNeeded();
	await page.waitForTimeout(500);
	const canvases = await page.evaluate(() =>
		[...document.querySelectorAll('canvas')].map((c) => ({
			cls: c.className,
			w: c.width,
			css: Math.round(c.getBoundingClientRect().width),
		})),
	);
	console.log('studio canvases', canvases);
	await page.screenshot({ path: path.join(outDir, 'perf-studio.png') });
	await page.locator('#studio .drop-host, #studio canvas').first().screenshot({ path: path.join(outDir, 'quality-studio.png') });
	console.log('wrote perf-studio + quality-studio');

	// Reveal: pose 0.6, full bloom, same as stems-v3
	await page.setViewportSize({ width: 1440, height: 1400 });
	await page.goto(`${base}/?pose=0.6&open#/gift/${token()}`, { waitUntil: 'networkidle' });
	await page.locator('canvas').first().waitFor({ timeout: 20_000 });
	await page.evaluate(() => document.fonts.ready);
	for (let i = 0; i < 6; i++) {
		await page.keyboard.press('Space');
		await page.waitForTimeout(80);
	}
	await page.getByText('Dear you,').waitFor({ timeout: 10_000 });
	await page.waitForTimeout(400);
	const revealCanvas = await page.evaluate(() => {
		const c = document.querySelector('.bouquet-wrap canvas, .bloom canvas, canvas');
		if (!c) return null;
		const r = c.getBoundingClientRect();
		return { w: c.width, h: c.height, cssW: Math.round(r.width), cssH: Math.round(r.height) };
	});
	console.log('reveal canvas', revealCanvas);
	await page.screenshot({ path: path.join(outDir, 'quality-reveal.png') });
	console.log('wrote quality-reveal');
	if (errors.length) console.log('errors', errors);
} finally {
	await browser.close();
	await server.close();
}
