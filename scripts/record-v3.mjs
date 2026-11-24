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
].map(([id, color]) => [id, color]);

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

const port = 4181;
const server = await preview({
	root,
	preview: { port, host: '127.0.0.1', strictPort: true },
});
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();

try {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 });
	const page = await ctx.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(String(e)));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

	async function shot(style, name, pose = '0.6') {
		const extra = style === 'retro' ? { r: 'retro', d: 40 } : {};
		const url = `${base}/?pose=${pose}&open#/gift/${token(extra)}`;
		await page.goto(url, { waitUntil: 'networkidle' });
		await page.locator('canvas').first().waitFor({ timeout: 20_000 });
		await page.evaluate(() => document.fonts.ready);
		// Skip the grow animation so we capture full bloom on the reveal page.
		for (let i = 0; i < 5; i++) {
			await page.keyboard.press('Space');
			await page.waitForTimeout(60);
		}
		await page.getByText('Dear you,').waitFor({ timeout: 8_000 });
		await page.waitForTimeout(250);
		if (errors.length) console.log('page errors', errors.splice(0));
		const full = path.join(outDir, name);
		await page.screenshot({ path: full });
		const canvas = page.locator('canvas').first();
		const box = await canvas.boundingBox();
		console.log('wrote', name, 'canvas box', box);
		return box;
	}

	const box3d = await shot('3d', 'stems-v3-3d.png', '0.6');
	const boxRot = await shot('3d', 'stems-v3-3d-rotated.png', '2.15');
	const boxRe = await shot('retro', 'stems-v3-retro.png', '0.6');
	console.log('boxes', { box3d, boxRot, boxRe });
} finally {
	await browser.close();
	await server.close();
}
