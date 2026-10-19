// טוען playwright-core מהמקום שבו הותקן (node_modules מקומי, או PW_DIR=/path/to/dir-with-node_modules)
import { createRequire } from 'node:module';
import path from 'node:path';
const tries = [process.env.PW_DIR && path.join(process.env.PW_DIR, 'package.json'), path.join(process.cwd(), 'package.json'), import.meta.url].filter(Boolean);
let pw = null;
for (const t of tries) { try { pw = createRequire(t)('playwright-core'); break; } catch (e) {} }
if (!pw) { console.error('playwright-core לא נמצא. הריצו: npm i --no-save playwright-core  (או PW_DIR=...)'); process.exit(2); }
export const chromium = pw.chromium;
export const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
