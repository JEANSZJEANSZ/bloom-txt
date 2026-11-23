import { preview } from 'vite';
import { chromium } from 'playwright';
import lz from 'lz-string';
const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } = lz;
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
};

const token = compressToEncodedURIComponent(JSON.stringify(payload));
const roundTrip = JSON.parse(decompressFromEncodedURIComponent(token));
if (JSON.stringify(roundTrip) !== JSON.stringify(payload)) {
	throw new Error('Share token did not round-trip the bouquet and letter exactly.');
}

const draft = {
	flowers: payload.f.map(([id, color]) => ({ id, color })),
	letter: {
		to: payload.t,
		from: payload.s,
		note: payload.n,
		message: payload.m,
		occasion: payload.o,
	},
};

const viewports = {
	desktop: { width: 1440, height: 900 },
	mobile: { width: 390, height: 844 },
};

async function waitForFonts(page) {
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(200);
}

async function shot(page, name) {
	const file = path.join(outDir, name);
	await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
	console.log('wrote', file);
}

const server = await preview({
	root,
	preview: { port: 4173, host: '127.0.0.1', strictPort: true },
});
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
console.log('preview', base);
console.log('sample gift', `${base}/#/gift/${token}`);

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();

try {
	for (const [label, viewport] of Object.entries(viewports)) {
		const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
		const page = await context.newPage();

		await page.addInitScript((raw) => {
			localStorage.setItem('bloom-txt:draft', raw);
		}, JSON.stringify(draft));

		await page.goto(`${base}/`, { waitUntil: 'networkidle' });
		await page.getByRole('heading', { name: 'Bloom.txt' }).waitFor();
		await page.locator('canvas').first().waitFor();
		await waitForFonts(page);
		await page.waitForTimeout(1200);
		await shot(page, `builder-${label}.png`);

		// Sealed envelope
		await page.goto(`${base}/#/gift/${token}`, { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: 'Open the envelope' }).waitFor();
		await waitForFonts(page);
		await shot(page, `reveal-envelope-${label}.png`);

		// Opened gift with letter
		await page.goto(`${base}/?open=1#/gift/${token}`, { waitUntil: 'networkidle' });
		await page.locator('canvas').first().waitFor({ timeout: 15_000 });
		await page.getByText('Dear you,').waitFor({ timeout: 15_000 });
		const body = await page.getByText('So I made them by hand.').textContent();
		if (!body?.includes('So I made them by hand.')) {
			throw new Error(`Reveal page did not show the letter body (${label})`);
		}
		await waitForFonts(page);
		await page.waitForTimeout(800);
		await shot(page, `reveal-${label}.png`);

		await context.close();
	}

	// Short clip of the gift page: bloom while the bouquet turns.
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
	if (!video) throw new Error('Playwright did not record a video');
	const rawVideo = await video.path();
	console.log('raw video', rawVideo);

	const { spawnSync } = await import('node:child_process');
	const encode = (dest, label) => {
		const mp4Res = spawnSync(
			'ffmpeg',
			['-y', '-i', rawVideo, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dest],
			{ encoding: 'utf8' },
		);
		if (mp4Res.status === 0) {
			console.log('wrote', dest);
			return true;
		}
		console.warn(`${label} mp4 failed`, mp4Res.stderr?.slice(-400));
		return false;
	};
	const growMp4 = path.join(outDir, 'grow.mp4');
	const rotMp4 = path.join(outDir, 'rotation.mp4');
	const gif = path.join(outDir, 'rotation.gif');
	const ok = encode(growMp4, 'grow') && encode(rotMp4, 'rotation');
	if (!ok) {
		const gifRes = spawnSync(
			'ffmpeg',
			['-y', '-i', rawVideo, '-vf', 'fps=16,scale=960:-1:flags=lanczos', gif],
			{ encoding: 'utf8' },
		);
		if (gifRes.status !== 0) {
			throw new Error(`Could not encode grow video: ${gifRes.stderr?.slice(-400)}`);
		}
		console.log('wrote', gif);
	}
} finally {
	await browser.close();
	await server.close();
}

console.log('sample token length', token.length);
console.log('round-trip ok');
