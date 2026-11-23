import { drawGrid, drawGridFast, measureGrid, waitForFonts } from './draw';
import { gridToPlainText } from './render';
import type { Grid } from './types';

export function gridPlain(grid: Grid, note?: string): string {
	return gridToPlainText(grid, note ? { note } : undefined);
}

export async function copyPlainText(grid: Grid, note?: string): Promise<boolean> {
	const text = gridPlain(grid, note);
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		try {
			const ta = document.createElement('textarea');
			ta.value = text;
			ta.setAttribute('readonly', '');
			ta.style.position = 'fixed';
			ta.style.left = '-9999px';
			document.body.appendChild(ta);
			ta.select();
			const ok = document.execCommand('copy');
			ta.remove();
			return ok;
		} catch {
			return false;
		}
	}
}

export type PngOptions = {
	/** Use classic fillText glyphs (retro). Default is the shaded 3D blit. */
	plain?: boolean;
};

export async function downloadPng(grid: Grid, note?: string, filename = 'bloom.txt.png', opts?: PngOptions): Promise<void> {
	const blob = await bouquetToPngBlob(grid, note, opts);
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

export async function bouquetToPngBlob(grid: Grid, note?: string, opts?: PngOptions): Promise<Blob> {
	await waitForFonts();
	const cols = grid[0]?.length ?? 0;
	const rows = grid.length;
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas is not available');
	const metrics = measureGrid(ctx, cols, rows, Math.max(720, Math.min(2400, cols * 7 + 72)), note ?? '');
	canvas.width = metrics.width;
	canvas.height = metrics.height;
	if (opts?.plain) drawGrid(ctx, grid, note ?? '', metrics, 1);
	else drawGridFast(ctx, grid, note ?? '', metrics, 1, 1);
	return await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make a PNG'))), 'image/png');
	});
}
