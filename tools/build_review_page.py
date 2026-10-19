#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""דף בדיקה לדודי: /review-audio/ (לא מקושר מהאתר). ציון הבוחן החיצוני לכל קטע, ציון לכל בוחן, תמלולים.
קטעים מוסתרים (פחות מ-9) מקבלים עותק שמע ב-review-audio/audio/."""
import os, sys, json, html, subprocess
sys.path.insert(0, os.path.dirname(__file__)); import part_b_tts as T
ROOT = T.ROOT; OUT = os.path.join(ROOT, 'review-audio'); os.makedirs(OUT + '/audio', exist_ok=True)
exam = json.load(open(T.EXAM, encoding='utf-8')); pub = json.load(open(ROOT + '/data/part_b_audio.json', encoding='utf-8'))['clips']
calib = json.load(open(ROOT + '/tools/part_b_exam_calib.json', encoding='utf-8'))
B = json.load(open(ROOT + '/data/part_b.json', encoding='utf-8'))
disp = {}
for u in B['units']:
    disp[u['id'] + '_intro'] = u['intro']
    for l in u['lines']: disp['%s_g%d' % (u['id'], l['n'])] = l['niqqud']; disp['%s_e%d' % (u['id'], l['n'])] = l['explanation']
e = html.escape; used = set(); rows = {'gemara': [], 'expl': []}
NAMES = {'ivrit': 'ivrit-ai whisper-large-v3-turbo', 'wlv3': 'whisper large-v3', 'scribe': 'ElevenLabs Scribe v2'}
for cid, kind, _ in T.plan():
    x = exam[cid]; b = T.best_take(x); live = cid in pub
    if live: src = '../' + pub[cid]['file']
    else:
        f = f"audio/{b['key']}.mp3"; used.add(os.path.basename(f))
        if not os.path.exists(f'{OUT}/{f}'):
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', f"{T.D}/{b['key']}.mp3", '-ac', '1', '-b:a', '48k', f'{OUT}/{f}'], check=True)
        src = f
    js = ''.join(f"<div><b>{NAMES[j]}</b> {b['judge_scores'].get(j, 0)} – {e(b['transcripts'].get(j, ''))}</div>" for j in b['transcripts'])
    weak = ' · '.join(f'{e(w)} ({c})' for w, c in b.get('weak', []))
    pen = ' · '.join(f'{e(p)} −{v}' for p, v in b.get('penalties', []))
    rows['gemara' if kind == 'gemara' else 'expl'].append((b['score'], f"""<tr class="{'ok' if live else 'bad'}"><td>{cid}<br><b class="sc">{b['score']}</b><br>{'✅ באתר' if live else '⛔ מוסתר'}</td>
<td><audio controls preload="none" src="{src}"></audio><br><small>{len(x['takes'])} הקלטות · {e(b.get('strategy') or b.get('tag', ''))}</small></td>
<td class="g">{e(disp[cid])}</td><td><small>{e(b.get('text') or '')}</small></td><td class="j">{js}</td><td><span class="f">{weak}</span><br><small>{pen}</small></td></tr>"""))
for f in os.listdir(OUT + '/audio'):
    if f not in used: os.remove(f'{OUT}/audio/{f}')
def table(r): return '<table><tr><th>קטע</th><th>שמע</th><th>טקסט מוצג</th><th>טקסט שנשלח להקראה</th><th>הבוחנים: ציון ותמלול</th><th>מילים חלשות · עונשים</th></tr>' + ''.join(h for _, h in sorted(r, key=lambda z: z[0])) + '</table>'
def cnt(k): l = rows[k]; return sum(s >= 9 for s, _ in l), len(l), round(sum(s for s, _ in l) / len(l), 2)
cal = ''.join(f'<tr><td>{e(k)}</td><td>{v.get("n")}</td><td>{v.get("mean")}</td><td>{v.get("median")}</td><td>{v.get("ge9")}</td><td>{v.get("lt5")}</td></tr>' for k, v in calib.items())
g, x_ = cnt('gemara'), cnt('expl')
page = f"""<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>בדיקת הקראה – חלק ב</title><style>body{{font-family:system-ui,Arial;margin:10px;background:#fafafa}}table{{border-collapse:collapse;width:100%;margin-bottom:18px}}td,th{{border:1px solid #ccc;padding:5px;vertical-align:top;font-size:14px}}
tr.bad{{background:#fde8e8}}tr.ok{{background:#eefaf0}}.g{{font-size:18px;font-family:'Frank Ruhl Libre',David,serif}}.f{{color:#b00}}.sc{{font-size:20px}}.j div{{margin-bottom:3px}}audio{{width:200px}}</style>
<h1>בדיקת הקראה – חלק ב (בוחן חיצוני)</h1>
<p>כל קטע נבדק על ידי שני בוחנים שמתמללים "עיוור" (בלי לקבל את הטקסט): ivrit-ai whisper-large-v3-turbo (רץ מקומית, faster-whisper) ו-ElevenLabs Scribe v2. ניסיתי גם whisper large-v3 כבוחן שלישי, אבל הוא היה כבד מדי לזיכרון ולזמן במכונה, והוסר.
הציון (0–10) משווה את ההגייה הצפויה (מהטקסט המנוקד) למה שכל בוחן שמע, מילה מילה. ציון מלא למילה רק כששני בוחנים מסכימים. יש עונש על שקט ארוך, קצב לא סביר וקטיעה. רק קטע עם 9 ומעלה מופיע באתר.</p>
<p>שורות גמרא: {g[0]} מתוך {g[1]} באתר (ממוצע {g[2]}). הסברים ופתיחות: {x_[0]} מתוך {x_[1]} באתר (ממוצע {x_[2]}). מסודר מהציון הנמוך לגבוה.</p>
<h2>כיול הבוחן</h2><table><tr><th>קבוצה</th><th>מספר</th><th>ממוצע</th><th>חציון</th><th>9 ומעלה</th><th>מתחת ל-5</th></tr>{cal}</table>
<h2>שורות הגמרא</h2>{table(rows['gemara'])}<h2>הסברים ופתיחות</h2>{table(rows['expl'])}</html>"""
open(OUT + '/index.html', 'w', encoding='utf-8').write(page); print('review', g, x_)
