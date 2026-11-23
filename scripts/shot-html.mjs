import { chromium } from 'playwright';
const [inp, out, w, h] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(w || 760), height: Number(h || 760) } });
await p.goto('file://' + inp);
await p.screenshot({ path: out });
await b.close();
