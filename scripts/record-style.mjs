import { preview } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.join(root, 'screenshots');

const draft = {
	flowers: [
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
	].map(([id, color]) => ({ id, color })),
	letter: {
		to: 'you',
		from: 'me',
		note: 'she wanted wild flowers, they were out of season',
		message: 'So I made them by hand.',
		occasion: 'love',
	},
	critters: [{ id: 'bee' }, { id: 'ladybug' }, { id: 'butterfly' }],
};

const port = 4177;
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

	async function shot(style, detail, filename) {
		await page.goto(`${base}/?pose=0.6#/`, { waitUntil: 'networkidle' });
		await page.evaluate(
			({ draft, style, detail }) => {
				localStorage.setItem('bloom-txt:draft', JSON.stringify({ ...draft, style, detail }));
			},
			{ draft, style, detail },
		);
		await page.reload({ waitUntil: 'networkidle' });
		await page.locator('canvas').first().waitFor({ timeout: 15_000 });
		await page.evaluate(() => document.fonts.ready);
		await page.waitForTimeout(1200);
		if (errors.length) {
			console.log('page errors for', filename, errors.splice(0));
		}
		const out = path.join(outDir, filename);
		await page.screenshot({ path: out, fullPage: false });
		console.log('wrote', out);
	}

	// Retro at ~85 columns (the original sprite grid on a desktop stage).
	await shot('retro', 40, 'retro-mode.png');
	await shot('3d', 0, 'detail-low.png');
	await shot('3d', 100, 'detail-high.png');
} finally {
	await browser.close();
	await server.close();
}
