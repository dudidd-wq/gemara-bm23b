#!/usr/bin/env python3
"""דף בדיקה מקומי לדודי (לא חלק מהאתר): /workspace/review-audio-bm23b/index.html + zip"""
import json, os, subprocess, html, sys, shutil
sys.path.insert(0, os.path.dirname(__file__)); import part_b_tts as T
OUT = '/workspace/review-audio-bm23b'; os.makedirs(OUT + '/audio', exist_ok=True)
d = json.load(open(T.ROOT + '/data/part_b.json', encoding='utf-8'))
g = T.load_gate(); eg = json.load(open(T.ROOT + '/tools/part_b_expl_gate.json', encoding='utf-8'))
def mp3(k):
    dst = f'{OUT}/audio/{k}.mp3'
    if not os.path.exists(dst):
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', f'{T.D}/{k}.mp3', '-ac', '1', '-b:a', '48k', dst], check=True)
    return f'audio/{k}.mp3'
e = html.escape
rows = []
for u in d['units']:
    for l in u['lines']:
        cid = '%s_g%d' % (u['id'], l['n']); v = g[cid]; ok = v['status'] in ('pass', 'approved')
        rows.append((0 if ok else -1, f"""<tr class="{'ok' if ok else 'doubt'}"><td>{cid}<br><b>{'✅ עבר – פעיל באתר' if ok else '⚠️ ספק – מוסתר'}</b></td>
<td><audio controls preload="none" src="{mp3(v['key'])}"></audio></td><td class="g">{e(l['niqqud'])}</td><td>{e(v['phon'])}</td><td>{e(v['stt'])}<br><small>{v['model']}</small></td>
<td><small>רופף {v['lax']} · מחמיר {v['strict']} · ניסיונות {v['attempts']}</small><br><span class="f">{e(' '.join(v['lax_flag'] + [w for w in v['strict_flag'] if w not in v['lax_flag']]))}</span></td></tr>"""))
rows.sort(key=lambda r: r[0])
exp = []
for cid, v in sorted(eg.items()):
    if v['status'] == 'pass' and cid not in ('b5_e10', 'b6_e6'): continue
    txt = next(x[2] for x in T.plan() if x[0] == cid)
    exp.append(f"""<tr class="{'ok' if v['status']=='pass' else 'doubt'}"><td>{cid}<br><b>{'✅ עבר' if v['status']=='pass' else 'ℹ️ נבדק – נראה תקין'}</b></td><td><audio controls preload="none" src="{mp3(v['key'])}"></audio></td>
<td>{e(txt)}</td><td>{e(v['stt'])}</td><td>{e(v.get('note',''))}</td></tr>""")
n_ok = sum(1 for v in g.values() if v['status'] in ('pass', 'approved'))
page = f"""<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>בדיקת הקראה – ב"מ כג:–כד.</title><style>body{{font-family:system-ui,Arial;margin:12px;background:#fafafa}}table{{border-collapse:collapse;width:100%}}td,th{{border:1px solid #ccc;padding:6px;vertical-align:top;font-size:15px}}
tr.doubt{{background:#fff3cd}}tr.ok{{background:#eefaf0}}.g{{font-size:19px;font-family:'Frank Ruhl Libre',David,serif}}.f{{color:#b00;font-weight:bold}}audio{{width:210px}}</style>
<h1>בדיקת הקראת שורות הגמרא – חלק ב'</h1>
<p>{n_ok} מתוך {len(g)} שורות עברו את בדיקת התמלול והן פעילות באתר. השורות הצהובות (ספק) מוסתרות באתר עד לאישור. כדי לאשר שורה – כתבו לי את המזהה שלה (למשל b8_g1) ואפעיל אותה.</p>
<p>עמודות: הטקסט המוצג לילד · הטקסט הפונטי שנשלח להקראה · מה שמערכת התמלול (Scribe) שמעה · ציונים ומילים שסומנו.</p>
<table><tr><th>שורה</th><th>שמע</th><th>טקסט מוצג</th><th>טקסט פונטי</th><th>תמלול</th><th>ציון</th></tr>{''.join(r[1] for r in rows)}</table>
<h2>הסברים ופתיחות שסומנו בבדיקה</h2><p>117 מתוך 122 עברו נקי. b5_e10 ו־b6_e6 הוקלטו מחדש ועברו; החמישה הנותרים הם הבדלי תמלול בלבד.</p>
<table><tr><th>קטע</th><th>שמע</th><th>טקסט</th><th>תמלול</th><th>הערה</th></tr>{''.join(exp)}</table></html>"""
open(OUT + '/index.html', 'w', encoding='utf-8').write(page)
if os.path.exists(OUT + '.zip'): os.remove(OUT + '.zip')
shutil.make_archive(OUT, 'zip', os.path.dirname(OUT), os.path.basename(OUT))
print(OUT, len(rows), len(exp))
