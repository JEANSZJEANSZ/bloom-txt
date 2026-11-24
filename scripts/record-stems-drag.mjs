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
	critters: [{ id: 'bee' }, { id: 'ladybug' }],
};

const port = 4178;
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

	async function load(style, detail) {
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
		await page.waitForTimeout(800);
		if (errors.length) console.log('page errors', errors.splice(0));
	}

	await load('3d', 100);
	await page.screenshot({ path: path.join(outDir, 'stems-full-bloom-3d.png') });
	console.log('wrote stems-full-bloom-3d.png');

	await load('retro', 40);
	await page.screenshot({ path: path.join(outDir, 'stems-full-bloom-retro.png') });
	console.log('wrote stems-full-bloom-retro.png');

	await load('3d', 100);
	const grab = page.locator('.grab').first();
	await grab.waitFor();
	const stage = page.locator('.drop-host').first();
	const g = await grab.boundingBox();
	const s = await stage.boundingBox();
	if (!g || !s) throw new Error('missing grab or stage boxes');
	const startX = g.x + g.width / 2;
	const startY = g.y + Math.min(40, g.height / 3);
	const midX = s.x + s.width / 2;
	const midY = s.y + s.height * 0.45;
	await page.mouse.move(startX, startY);
	await page.mouse.down();
	// Move past the drag threshold, then onto the stage.
	await page.mouse.move(startX + 20, startY - 20, { steps: 8 });
	await page.mouse.move(midX, midY, { steps: 16 });
	await page.waitForTimeout(250);
	await page.screenshot({ path: path.join(outDir, 'drag-drop.png') });
	console.log('wrote drag-drop.png');
	await page.mouse.up();
} finally {
	await browser.close();
	await server.close();
}
