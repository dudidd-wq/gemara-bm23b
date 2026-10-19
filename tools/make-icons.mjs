// מייצר icons/icon-192.png ו-icon-512.png מתוך icons/icon.svg (פעם אחת; הקבצים כבר במאגר)
import { chromium, CHROME } from './pw.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(ROOT, 'icons/icon.svg'), 'utf8');
const b = await chromium.launch({ executablePath: CHROME });
for (const s of [192, 512]) {
  const p = await b.newPage({ viewport: { width: s, height: s } });
  await p.setContent(`<style>body{margin:0}svg{width:${s}px;height:${s}px;display:block}</style>${svg}`);
  await p.screenshot({ path: path.join(ROOT, `icons/icon-${s}.png`) });
}
await b.close();
console.log('icons ok');
