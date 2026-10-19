// בדיקה אוטומטית בדפדפן (Chrome headless, תצוגת Samsung 412x915).
// הרצה:  node tools/test-site.mjs [תיקיית-צילומים]      (צריך playwright-core: npm i --no-save playwright-core, או PW_DIR=...)
import { chromium, CHROME } from './pw.mjs';
import { start } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.resolve(process.argv[2] || path.join(ROOT, '..', 'gemara-bm23b-site-shots'));
fs.mkdirSync(SHOTS, { recursive: true });
let BASE = '';
const results = []; let failed = 0;
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); if (!cond) failed++; console.log((cond ? '✔' : '✖') + ' ' + name + (info ? '  — ' + info : '')); };
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/site_data.json'), 'utf8'));
const ROUTES = ['', 'learn', 'text', 'flashcards', 'fill_in', 'multiple_choice', 'matching', 'true_false', 'order', 'self_check', 'video', 'answers', 'progress'];

// 1) בדיקת תוכן (שם ה', אמוג'י של אנשים)
try { const out = execFileSync('python3', [path.join(ROOT, 'tools/check-content.py')], { encoding: 'utf8' }); ok('content check (divine names / people emoji)', true, out.trim()); }
catch (e) { ok('content check (divine names / people emoji)', false, (e.stdout || '') + (e.stderr || '')); }
try { execFileSync('python3', [path.join(ROOT, 'tools/check-content.py'), '--self-test'], { encoding: 'utf8' }); ok('content checker self-test catches forbidden strings', true); }
catch (e) { ok('content checker self-test catches forbidden strings', false, e.stdout); }

// 2) כל קבצי השמע שמופיעים בנתונים קיימים
const files = new Set();
(function walk(o) { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (typeof v === 'string' && /^audio\/.+\.mp3$/.test(v)) files.add(v); else walk(v); } })(data);
const missing = [...files].filter(f => !fs.existsSync(path.join(ROOT, f)));
ok(`all ${files.size} audio files referenced in site_data.json exist`, !missing.length, missing.join(', '));
const extra = fs.readdirSync(path.join(ROOT, 'audio')).filter(f => !files.has('audio/' + f));
ok('no unreferenced audio files', !extra.length, extra.join(', '));
// כל הקבצים ב-service worker קיימים
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const swFiles = JSON.parse(/var FILES = (\[[\s\S]*?\]);/.exec(sw)[1]);
const swMissing = swFiles.filter(f => f !== './' && !fs.existsSync(path.join(ROOT, f)));
ok('service-worker precache list matches files', !swMissing.length && files.size === swFiles.filter(f => f.startsWith('audio/')).length, swMissing.join(','));
// דף העבודה: איות כמו בדף
const ws = data.worksheet, q5 = ws.questions.find(q => q.id === '5');
ok('worksheet spelling ולהוי / דציידי kept', q5.items.some(i => i.word === 'ולהוי') && q5.items.some(i => i.word === 'דציידי') && !JSON.stringify(ws.questions).includes('ולחזי') && !JSON.stringify(data.quiz).includes('ולחזי'));
ok('word bank: 10 words in sheet order, ושיהי\'ה with geresh', ws.word_bank.join(',') === "עופרת,ככה,שכל העולם,בקשר,מדוע,שאלו,ושיהי'ה,של דייגים,חתיכות,ממנו");
ok('5 worksheet questions', ws.questions.length === 5);

const srv = process.env.BASE_URL ? null : await start(0);
BASE = process.env.BASE_URL ? process.env.BASE_URL.replace(/\/?$/, '/') : `http://127.0.0.1:${srv.address().port}/`;
console.log('BASE', BASE);
const browser = await chromium.launch({ executablePath: CHROME, args: ['--autoplay-policy=no-user-gesture-required'] });
const UA = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: UA, locale: 'he-IL' });
const page = await ctx.newPage();
const errors = [], bad = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', r => { if (r.url().startsWith(BASE) && r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
page.on('dialog', d => d.accept());
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(SHOTS, name) }); };
const go = async (r) => { await page.goto(BASE + '#/' + r); await page.waitForSelector('#app > :not(.loading)'); await page.evaluate(() => document.fonts.ready); };

// 3) כל העמודים נטענים בלי שגיאות JS
for (const r of ROUTES) {
  const before = errors.length;
  await go(r);
  const info = await page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, len: document.getElementById('app').innerText.length, overflow: document.documentElement.scrollWidth > window.innerWidth + 1 }));
  ok(`page #/${r || ''} loads (rtl, no JS errors, no horizontal overflow)`, info.dir === 'rtl' && info.lang === 'he' && info.len > 40 && errors.length === before && !info.overflow, JSON.stringify(info) + ' ' + errors.slice(before).join(' | '));
}
await go('');
await shot('01-home.png');

// 4) ניקוד: הגופן העברי נטען ומשמש בפועל לטקסט המנוקד
await go('text');
const cdp = await ctx.newCDPSession(page);
await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
const doc = await cdp.send('DOM.getDocument');
const fontOf = async (sel) => { const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: sel }); const f = await cdp.send('CSS.getPlatformFontsForNode', { nodeId }); return f.fonts; };
const fAr = await fontOf('.w'), fUi = await fontOf('.tb-title');
ok('niqqud text rendered with bundled Frank Ruhl Libre (all glyphs from it)', fAr.length === 1 && /Frank Ruhl/.test(fAr[0].familyName), JSON.stringify(fAr));
ok('UI rendered with bundled Rubik', fUi.some(f => /Rubik/.test(f.familyName)), JSON.stringify(fUi));
const nq = await page.evaluate(() => {
  const el = document.querySelector('.w'); const t = el.childNodes[0].textContent;
  const hasMarks = /[\u05B0-\u05C7]/.test(t);
  // הניקוד לא נחתך: גובה השורה גדול מגובה הגופן + שוליים לניקוד
  const cs = getComputedStyle(el); const lh = parseFloat(cs.lineHeight), fs = parseFloat(cs.fontSize);
  return { t, hasMarks, ratio: lh / fs, fonts: document.fonts.check('30px "Frank Ruhl Libre"', 'אַמַּאי') };
});
ok('niqqud present and line-height ≥ 1.8', nq.hasMarks && nq.ratio >= 1.8 && nq.fonts, JSON.stringify(nq));
// פתיחת חלונית תרגום
await page.locator('button.w').nth(1).click();
ok('tap on word opens translation popup', await page.locator('.pop').isVisible());
await shot('03-gemara-word-popup.png');
await page.locator('.pop .play[aria-label="סְגִירָה"]').click();
for (const b of await page.locator('.gline button.btn').all()) await b.click();
await page.evaluate(() => document.querySelectorAll('button.w').forEach(b => b.click()));
await page.evaluate(() => document.querySelector('.pop') && document.querySelector('.pop').remove());
ok('interactive gemara records stars', await page.evaluate(() => U.state.activities.text && U.state.activities.text.stars === 3));

// 5) שמע: קטע מתנגן ונעצר בזמן
const stopTest = await page.evaluate(async (clip) => {
  U.play(clip);
  const t0 = performance.now();
  await new Promise(r => setTimeout(r, 300));
  const a = U._audio(); let playedAt = null;
  while (performance.now() - t0 < 6000) { if (!a.paused && playedAt == null) playedAt = a.currentTime; if (a.paused && a.currentTime > clip.start) break; await new Promise(r => setTimeout(r, 50)); }
  return { start: clip.start, end: clip.end, playedAt, stoppedAt: a.currentTime, paused: a.paused };
}, data.glossary[1].audio);
ok('audio clip plays and stops at its end time (±0.25s)', stopTest.paused && stopTest.playedAt != null && stopTest.stoppedAt >= stopTest.end && stopTest.stoppedAt <= stopTest.end + 0.3, JSON.stringify(stopTest));
// כל קבצי השמע נטענים (מטא-דאטה) בדפדפן
const audioLoad = await page.evaluate(async (list) => {
  const res = [];
  for (const f of list) res.push(await new Promise(r => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => r([f, a.duration]); a.onerror = () => r([f, -1]); a.src = f; }));
  return res;
}, [...files]);
const badAudio = audioLoad.filter(x => !(x[1] > 0));
ok(`all ${audioLoad.length} audio files decode in Chrome`, !badAudio.length, JSON.stringify(badAudio));
// כל קטעי השמע (start/end) בתוך אורך הקובץ
const dur = Object.fromEntries(audioLoad);
const clips = []; (function walk(o) { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o.file && o.end != null && /^audio\//.test(o.file)) clips.push(o); for (const v of Object.values(o)) walk(v); } })(data);
const outOfRange = clips.filter(c => !(c.start >= 0 && c.end > c.start && c.end <= dur[c.file] + 0.1));
ok(`all ${clips.length} audio clip ranges are inside their files`, !outOfRange.length, JSON.stringify(outOfRange.slice(0, 3)));

// 6) לומדים צעד אחר צעד – עד הסוף
await go('learn');
await shot('02-learn-rule.png');
await page.click('#learnNext');
for (let s = 0; s < data.texts.flow.length; s++) {
  const ids = ['mc1', 'mc2', 'mc3', 'mc4', 'mc5', 'mc6', 'mc9', 'mc10'];
  const q = data.quiz.multiple_choice.find(x => x.id === ids[s]);
  if (s === 1) { // טעות אחת כדי לבדוק משוב עדין
    const wrongTxt = q.options.find((o, i) => i !== q.correct);
    await page.locator('.opt', { hasText: wrongTxt }).first().click();
    const fb = await page.locator('.feedback').first().innerText();
    ok('wrong answer gives gentle feedback (no "טעות")', /כִּמְעַט|נִסָּיוֹן/.test(fb) && !/טעות/.test(fb), fb);
  }
  await page.locator('.opt', { hasText: q.options[q.correct] }).first().click();
  if (s === 2) { await page.evaluate(() => window.scrollTo(0, 200)); await shot('04-learn-card.png'); }
  await page.click('#learnNext');
}
ok('learn: all 8 cards completed', await page.evaluate(() => !!(U.state.activities.learn && U.state.activities.learn.done)));

// 7) כרטיסיות
await go('flashcards');
await page.locator('button', { hasText: '10' }).first().click();
for (let k = 0; k < 10; k++) {
  await page.locator('.face:not(.back)').click();
  if (k === 0) { await page.waitForTimeout(600); await shot('05-flashcard-back.png'); }
  await page.locator('.btn', { hasText: 'יָדַעְתִּי' }).click();
}
ok('flashcards: deck of 10 completed with 3 stars', await page.evaluate(() => U.state.activities.flashcards && U.state.activities.flashcards.stars === 3));

// 8) דף העבודה
await go('fill_in');
const isOk = await page.evaluate((b) => [U.isOk('מכריזים', b), U.isOk('מחזירים', b), U.isOk('סימן', b), U.isOk('מַכְרִיזִים', b), U.isOk('דגים', b)], ws.questions[0].parts[1].blanks[0]);
ok('Q1ב first blank accepts מכריזים / מחזירים / סימן (and rejects unrelated)', isOk[0] && isOk[1] && isOk[2] && isOk[3] && !isOk[4], JSON.stringify(isOk));
const q3 = ws.questions.find(q => q.id === '3').blanks[0], q4 = ws.questions.find(q => q.id === '4').blanks[0];
const lenient = await page.evaluate(([a, b]) => [U.isOk('טוב', a), U.isOk('לא טוב', a), U.isOk('מנין ומשקל', b), U.isOk('מידה', b)], [q3, q4]);
ok('checker: "טוב" ok, "לא טוב" rejected, "מנין ומשקל" ok for Q4', lenient[0] && !lenient[1] && lenient[2] && lenient[3], JSON.stringify(lenient));
const parts = [...ws.questions[0].parts, ...ws.questions.filter(q => q.id === '2' || q.id === '3' || q.id === '4')];
const rows = page.locator('.ws-part');
for (let i = 0; i < parts.length; i++) {
  const p = parts[i], row = rows.nth(i);
  if (p.blanks.some(b => b.free_text)) {
    await row.locator('textarea').fill(p.blanks[0].answer);
    await row.locator('button', { hasText: 'לְדֻגְמָה' }).click();
    await row.locator('button', { hasText: 'כָּתַבְתִּי' }).click();
  } else {
    const inputs = row.locator('input');
    for (let j = 0; j < p.blanks.length; j++) await inputs.nth(j).fill(p.id === '1b' && j === 0 ? 'מחזירים' : p.blanks[j].answer.replace(/\s*\(.*\)/, ''));
    await row.locator('button', { hasText: 'בְּדֹק' }).click();
    const done = await row.locator('input.ok').count();
    if (done !== p.blanks.length) ok('worksheet part ' + p.id + ' auto-check', false, await row.innerText());
  }
}
// שאלה 5: גרירה אחת אמיתית (מגע/עכבר) + השאר בהקשה
const items = [q5.items[4], ...q5.items.filter((x, i) => i !== 4)]; // גוררים את "הכי" (השורה האחרונה, ליד התרמילון)
const dragChip = page.locator('.chip', { hasText: new RegExp('^' + items[0].answer + '$') });
const dragSlot = page.locator(`.slot[data-word="${items[0].word}"]`);
await page.evaluate(() => document.querySelector('.bank').scrollIntoView({ block: 'center' }));
const cb = await dragChip.boundingBox(), sb = await dragSlot.boundingBox();
await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2); await page.mouse.down();
await page.mouse.move(cb.x + 20, cb.y - 20, { steps: 4 }); await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2, { steps: 8 }); await page.mouse.up();
ok('Q5: drag from word bank to line works', (await dragSlot.innerText()).trim() === items[0].answer, await dragSlot.innerText());
for (const it of items.slice(1)) {
  await page.locator('.chip', { hasText: new RegExp('^' + it.answer.replace(/'/g, "'") + '$') }).tap();
  await page.locator(`.slot[data-word="${it.word}"]`).tap();
}
await page.evaluate(() => document.querySelector('.q5').scrollIntoView());
await shot('06-worksheet-q5-filled.png');
await page.locator('.ws-q').last().locator('button', { hasText: 'בְּדֹק' }).click();
ok('Q5: all 10 words correct via tap+drag', (await page.locator('.slot.ok').count()) === 10);
await page.locator('button', { hasText: 'סִיַּמְתִּי אֶת הַדַּף' }).click();
ok('worksheet completed', await page.evaluate(() => !!(U.state.activities.fill_in && U.state.activities.fill_in.done)));
await shot('07-worksheet-done.png');

// 9) אמריקאיות
await go('multiple_choice');
for (let k = 0; k < data.quiz.multiple_choice.length; k++) {
  await page.locator('.opt[data-correct="1"]').click();
  if (k === 0) await shot('08-mcq.png');
  await page.click('#mcNext');
}
ok('multiple choice: 15/15 → 3 stars', await page.evaluate(() => U.state.activities.multiple_choice.stars === 3));

// 10) נכון / לא נכון
await go('true_false');
for (const q of data.quiz.true_false) { await page.locator(`.opt[data-v="${q.answer}"]`).click(); await page.click('#tfNext'); }
ok('true/false: 8 completed', await page.evaluate(() => U.state.activities.true_false.stars === 3));

// 11) התאמה – 4 סטים
await go('matching');
for (let s = 0; s < data.quiz.matching.length; s++) {
  const n = data.quiz.matching[s].pairs.length;
  for (let k = 0; k < n; k++) { await page.locator(`.mi[data-side="r"][data-i="${k}"]`).click(); await page.locator(`.mi[data-side="l"][data-i="${k}"]`).click(); }
  if (s === 0) await shot('09-matching.png');
  if (s < data.quiz.matching.length - 1) await page.click('#matchNext');
}
ok('matching: 4 sets completed', await page.evaluate(() => !!(U.state.activities.matching && U.state.activities.matching.done)));

// 12) סדר – גרירה אחת אמיתית, ואז חצים
await go('order');
await shot('10-order.png');
const h0 = page.locator('.order li').nth(0).locator('.handle'), l2 = page.locator('.order li').nth(2);
const hb = await h0.boundingBox(), lb = await l2.boundingBox();
const firstK = await page.locator('.order li').nth(0).getAttribute('data-k');
await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down();
await page.mouse.move(hb.x + hb.width / 2, lb.y + lb.height - 4, { steps: 10 }); await page.mouse.up();
const movedTo = await page.evaluate((k) => [...document.querySelectorAll('.order li')].findIndex(li => li.dataset.k === k), firstK);
ok('order: drag reorders items', movedTo >= 1, 'moved to ' + movedTo);
for (let target = 0; target < 8; target++) {
  let pos = await page.evaluate((t) => [...document.querySelectorAll('.order li')].findIndex(li => li.dataset.k === String(t)), target);
  while (pos > target) { await page.locator('.order li').nth(pos).locator('button[aria-label="להזיז למעלה"]').click(); pos--; }
}
await page.click('#orderCheck');
ok('order: correct order accepted', await page.evaluate(() => !!(U.state.activities.order && U.state.activities.order.done)));

// 13) הסבר במילים שלך
await go('self_check');
for (let k = 0; k < data.quiz.self_check.length; k++) {
  const card = page.locator('.card.q').nth(k);
  await card.locator('textarea').fill('בדיקה');
  await card.locator('button', { hasText: 'בּוֹא נִבְדֹּק' }).click();
  for (const c of await card.locator('input[type=checkbox]').all()) await c.check();
  await card.locator('button', { hasText: 'לְדֻגְמָה' }).click();
}
await page.evaluate(() => document.querySelector('.card.q').scrollIntoView());
await shot('11-self-check.png');
ok('self check: 3 prompts completed', await page.evaluate(() => U.state.activities.self_check && U.state.activities.self_check.stars === 3));

// 14) סרטון (קובץ מקומי, נגן מובנה)
ok('video file exists, < 50MB', fs.existsSync(path.join(ROOT, data.video.local_file)) && fs.statSync(path.join(ROOT, data.video.local_file)).size < 50e6);
ok('video NOT in service-worker precache', !swFiles.some(f => /\.mp4$/.test(f)));
await go('video');
ok('video: native <video controls playsinline preload=metadata> with local file', await page.evaluate((f) => { const v = document.querySelector('video'); return !!v && v.controls && v.hasAttribute('playsinline') && v.preload === 'metadata' && v.getAttribute('src') === f && !document.querySelector('iframe'); }, data.video.local_file));
const meta = await page.evaluate(() => new Promise(r => { const v = document.querySelector('video'); if (v.readyState >= 1) r(v.duration); v.addEventListener('loadedmetadata', () => r(v.duration)); v.addEventListener('error', () => r(-1)); setTimeout(() => r(-2), 20000); }));
ok('video: metadata loads, duration ≈ 395s', Math.abs(meta - data.video.duration) < 1, 'duration=' + meta);
ok('video: 19 chapters listed with timestamps', (await page.locator('.chapters button').count()) === data.video.chapters.length);
const jumps = [];
for (const i of [5, 13, 18, 0]) {
  await page.locator('.chapters button').nth(i).click();
  const r = await page.evaluate(() => new Promise(res => { const v = document.querySelector('video'); const t0 = performance.now();
    (function poll() { if ((!v.seeking && v.readyState >= 2) || performance.now() - t0 > 15000) res({ t: v.currentTime, paused: v.paused, cur: [...document.querySelectorAll('.chapters button')].findIndex(b => b.classList.contains('cur')) }); else setTimeout(poll, 50); })(); }));
  jumps.push({ i, want: data.video.chapters[i].start, got: +r.t.toFixed(2), playing: !r.paused, cur: r.cur });
}
ok('video: chapter buttons seek to exact start and play', jumps.every(j => j.got >= j.want - 0.05 && j.got < j.want + 1.5 && j.playing && j.cur === j.i), JSON.stringify(jumps));
await page.evaluate(() => document.querySelector('video').pause());
ok('video: optional Drive fallback link', (await page.locator(`a[href="${data.video.drive_url}"]`).count()) === 1);
await page.locator('button', { hasText: 'צָפִיתִי' }).click();
await page.evaluate(() => window.scrollTo(0, 0));
await shot('12-video.png');

// 15) התקדמות נשמרת אחרי טעינה מחדש, מסך סיום, איפוס
await page.reload(); await go('progress');
const st = await page.evaluate(() => JSON.parse(localStorage.getItem('bm23b_progress_v1')));
ok('progress persisted in localStorage (bm23b_progress_v1) after reload', data.progress.activities.every(a => st.activities[a] && st.activities[a].done));
ok('all-done banner "כל הכבוד! בהצלחה רבה במבחן!"', await page.locator('.done-banner').isVisible());
await shot('13-progress-all-done.png');
await page.click('#resetBtn');
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('bm23b_progress_v1')));
ok('reset clears progress', Object.keys(after.activities).length === 0);

// 16) הדפסה: עמוד A4 אחד
await go('answers');
await page.emulateMedia({ media: 'screen' });
await shot('14-answer-key.png');
const pdfPath = path.join(SHOTS, 'answer-key-print.pdf');
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
await page.emulateMedia({ media: 'screen' });
let pages = -1; try { pages = +/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' }))[1]; } catch (e) {}
ok('print answer key fits one A4 page', pages === 1, 'pages=' + pages);

// 17) PWA: service worker + עבודה בלי רשת
await go('');
const swOk = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
await page.waitForTimeout(1500);
await ctx.setOffline(true);
await page.reload(); await page.waitForSelector('#app > :not(.loading)', { timeout: 8000 }).catch(() => {});
const offline = await page.evaluate(() => document.querySelectorAll('.tile').length);
await go('flashcards').catch(() => {});
const offAudio = await page.evaluate(async (f) => new Promise(r => { const a = new Audio(); a.onloadedmetadata = () => r(a.duration); a.onerror = () => r(-1); a.src = f; }), [...files][0]);
await ctx.setOffline(false);
ok('PWA: service worker active, site + audio work offline', swOk && offline >= 10 && offAudio > 0, `tiles=${offline} audio=${offAudio}`);

ok('no JS errors during the whole run', errors.length === 0, errors.join(' | '));
ok('no 4xx/5xx for local files', bad.length === 0, bad.join(' | '));

await browser.close(); if (srv) srv.close();
fs.writeFileSync(path.join(SHOTS, 'test-results.json'), JSON.stringify(results, null, 1));
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
