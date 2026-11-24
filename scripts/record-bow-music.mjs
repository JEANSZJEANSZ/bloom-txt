import { preview } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
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
	ribbon: 'gold',
	music: { kind: 'tune', id: 'musicbox' },
};

const port = 4182;
const server = await preview({ root, preview: { port, host: '127.0.0.1', strictPort: true } });
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();

try {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 1500 }, deviceScaleFactor: 2 });
	const page = await ctx.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(String(e)));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

	await page.goto(`${base}/?pose=0.6#/`, { waitUntil: 'networkidle' });
	await page.evaluate((d) => localStorage.setItem('bloom-txt:draft', JSON.stringify(d)), draft);
	await page.reload({ waitUntil: 'networkidle' });
	await page.locator('canvas').first().waitFor({ timeout: 20_000 });
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(600);
	if (errors.length) console.log('builder errors', errors.splice(0));

	const stage = page.locator('section.stage');
	await stage.scrollIntoViewIfNeeded();
	await page.waitForTimeout(200);
	await stage.screenshot({ path: path.join(outDir, 'bow-colours.png') });
	console.log('wrote bow-colours.png');

	const music = page.locator('section.music');
	await music.scrollIntoViewIfNeeded();
	await page.waitForTimeout(200);
	await music.screenshot({ path: path.join(outDir, 'music-picker.png') });
	console.log('wrote music-picker.png');

	await page.goto(`${base}/#/gift/${token({ b: 'gold', mu: 'musicbox' })}`, { waitUntil: 'networkidle' });
	await page.getByText('Open your letter').waitFor({ timeout: 15_000 });
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(400);
	await page.screenshot({ path: path.join(outDir, 'reveal-gate.png') });
	console.log('wrote reveal-gate.png');
	if (errors.length) console.log('gate errors', errors.splice(0));

	const poses = [0, 0.8, 1.57, 2.35, 3.14, 3.93, 4.71, 5.5];
	const clips = [];
	for (let i = 0; i < poses.length; i++) {
		const pose = poses[i];
		await page.goto(`${base}/?pose=${pose}&open#/gift/${token()}`, { waitUntil: 'networkidle' });
		await page.locator('canvas').first().waitFor({ timeout: 20_000 });
		await page.evaluate(() => document.fonts.ready);
		for (let k = 0; k < 5; k++) {
			await page.keyboard.press('Space');
			await page.waitForTimeout(50);
		}
		await page.getByText('Dear you,').waitFor({ timeout: 8_000 });
		await page.waitForTimeout(200);
		const file = path.join(outDir, `_pose_${i}.png`);
		await page.locator('canvas').first().screenshot({ path: file });
		clips.push(file);
		console.log('pose', pose, 'shot');
	}
	if (errors.length) console.log('sweep errors', errors.splice(0));

	const py = spawnSync(
		'python3',
		[
			'-',
			path.join(outDir, 'stems-rotation-sweep.png'),
			...clips,
			...poses.map(String),
		],
		{
			input: `
from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont

out = Path(sys.argv[1])
clips = [Path(p) for p in sys.argv[2:10]]
labels = sys.argv[10:]
imgs = [Image.open(p).convert('RGB') for p in clips]
# crop a little letterboxing if present, keep bouquet
w, h = imgs[0].size
cols, rows = 4, 2
gap, pad, cap = 16, 24, 36
cell_w, cell_h = w, h
canvas = Image.new('RGB', (pad * 2 + cols * cell_w + (cols - 1) * gap, pad * 2 + rows * (cell_h + cap) + (rows - 1) * gap), (36, 28, 26))
draw = ImageDraw.Draw(canvas)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 28)
except Exception:
    font = ImageFont.load_default()
for i, im in enumerate(imgs):
    r, c = divmod(i, cols)
    x = pad + c * (cell_w + gap)
    y = pad + r * (cell_h + cap + gap)
    canvas.paste(im, (x, y + cap))
    lab = f'yaw = {float(labels[i]):.2f}'
    draw.text((x + 8, y + 4), lab, fill=(255, 236, 220), font=font)
canvas.save(out, 'PNG')
print('wrote', out, 'size', canvas.size)
`,
			encoding: 'utf-8',
		},
	);
	if (py.stdout) process.stdout.write(py.stdout);
	if (py.stderr) process.stderr.write(py.stderr);
	if (py.status) throw new Error('compose failed');
} finally {
	await browser.close();
	await server.close();
}
