import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

// usage: node scripts/gallery.mjs <out.png> [query]
const [out, query = 'mode=gallery'] = process.argv.slice(2);
mkdirSync('/tmp/gal', { recursive: true });
execSync('npx rolldown scripts/gallery-entry.ts --format iife --platform browser -o /tmp/gal/entry.js', { stdio: 'pipe' });
writeFileSync('/tmp/gal/index.html', '<!doctype html><html><body><script src="entry.js"></script></body></html>');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1700, height: 1000 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto('file:///tmp/gal/index.html?' + query);
await p.waitForFunction(() => window.__done === true, null, { timeout: 60000 }).catch(() => { console.log('timeout; errors', errs); process.exit(1); });
await p.waitForTimeout(300);
await p.screenshot({ path: out, fullPage: true });
if (errs.length) console.log('errors', errs);
await b.close();
