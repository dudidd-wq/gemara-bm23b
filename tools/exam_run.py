#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""הרצת הבוחן החיצוני על כל הקטעים של חלק ב.
  python3 tools/exam_run.py score [ids]     # בוחן את כל ההקלטות שכבר קיימות במטמון (בלי עלות TTS)
  python3 tools/exam_run.py calib           # כיול: הקלטות מקוריות (רעות) מול נוכחיות, קטע מול טקסט לא נכון
תוצאה: tools/part_b_exam.json"""
import os, sys, json, re, time
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, '/workspace/gemara_bm23b')
import part_b_tts as T, examiner as X, asr_local as A
import stt as S
ROOT = T.ROOT; OUT = os.path.join(ROOT, 'tools/part_b_exam.json')
JUDGES = ('ivrit', 'scribe')   # wlv3 הוסר: כבד מדי לזיכרון/זמן במכונה, ולא ניתן להריץ במקביל
# ההגייה הצפויה (לבוחן בלבד): "דְכַסְפָּא" נקרא dekaspa, כמו בכיתה
EXPECT_FIX = {'דְכַסְפָּא': 'דְכַּסְפָּא'}
def expected():
    ex = {}
    for cid, kind, text in T.plan():
        if kind == 'gemara':
            for a, b in EXPECT_FIX.items(): text = text.replace(a, b)
        ex[cid] = (kind, text)
    return ex
def takes(cid):
    out = _takes(cid)
    if not out:   # שורה זהה בטקסט לשורה אחרת (b9_g3 = b7_g6): אותן הקלטות
        ex = expected(); twin = next((c for c in ex if c != cid and ex[c] == ex[cid]), None)
        if twin: out = _takes(twin)
    return out
def _takes(cid):
    out, seen = [], set()
    for l in open(T.LED):
        d = json.loads(l)
        if d['status'] != 'sent' or d['key'] in seen: continue
        if not re.match(re.escape(cid) + r'(_[a-zA-Z]|$)', d.get('tag', '')): continue
        if os.path.exists(f"{T.D}/{d['key']}.mp3"): seen.add(d['key']); out.append({'key': d['key'], 'text': d.get('text', ''), 'tag': d['tag']})
    return out
def transcripts(key):
    p = f'{T.D}/{key}.mp3'; tr = {}
    for j in JUDGES:
        try: tr[j] = S.stt(p, model='scribe_v2')['text'] if j == 'scribe' else A.asr(p, j)['text']
        except Exception as e: tr[j] = ''; print('ASR ERR', key, j, e, flush=True)
    return tr
def score_take(cid, key, exp_text=None):
    ex = expected()[cid][1] if exp_text is None else exp_text
    r = X.examine(ex, transcripts(key), f'{T.D}/{key}.mp3'); r['key'] = key; return r
def load(): return json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
ORIG = re.compile(r'b\d+_g\d+$')
def save(res):
    # שורות גמרא: ההקלטה המקורית (מהניקוד) נפסלה ע"י דודי בהאזנה – לא מתפרסמת גם אם קיבלה ציון גבוה
    for e in res.values():
        for t in e['takes'].values(): t['excluded'] = bool(e['kind'] == 'gemara' and ORIG.match(t.get('tag', '')))
    tmp = OUT + '.tmp'; json.dump(res, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); os.replace(tmp, OUT)
def score(only):
    ex = expected(); res = load()
    ids = [c for c in ex if not only or c in only or c.split('_')[0] in only or ex[c][0] in only]
    jobs = [(c, t) for c in ids for t in takes(c)]
    if os.environ.get('ONLY_CACHED'):  # רק הקלטות שכבר תומללו מקומית (השאר ייבחנו בלולאה, לפי הצורך)
        jobs = [(c, t) for c, t in jobs if os.path.exists(f"{T.D}/{t['key']}.mp3.ivrit.json")]
    res = {c: e for c, e in res.items() if c in ex}
    for c, t in jobs: res.get(c, {}).get('takes', {}).pop(t['key'], None)
    print(len(ids), 'clips', len(jobs), 'takes', flush=True)
    def one(j):
        c, t = j; r = score_take(c, t['key'], ex[c][1]); r.update(text=t['text'], tag=t['tag']); return c, r
    done = 0
    with ThreadPoolExecutor(4) as pool:
        for c, r in pool.map(one, jobs):
            e = res.setdefault(c, {'kind': ex[c][0], 'expected': ex[c][1], 'takes': {}}); e['expected'] = ex[c][1]
            e['takes'][r['key']] = r; done += 1
            save(res)   # נקודת ביקורת אחרי כל הקלטה
            if done % 20 == 0: print(done, time.strftime('%H:%M'), flush=True)
    save(res); print('done', done)
def rescore():
    """בוחן מחדש את כל ההקלטות שכבר ב-JSON (כולל מחוברות) מהתמלולים השמורים – בלי ASR ובלי TTS"""
    res = load(); ex = expected()
    for c, e in res.items():
        e['expected'] = ex[c][1]
        for k, t in list(e['takes'].items()):
            r = X.examine(ex[c][1], {j: t['transcripts'].get(j, '') for j in JUDGES}, f'{T.D}/{k}.mp3'); r['key'] = k
            for f in ('text', 'tag', 'strategy', 'vs'):
                if f in t: r[f] = t[f]
            e['takes'][k] = r
    save(res)
def calib():
    import statistics as st
    res = load(); g = json.load(open(os.path.join(ROOT, 'tools/part_b_audio_gate.json'), encoding='utf-8')); ex = expected()
    orig, prev, mism, expl = [], [], [], []
    ids = [c for c in ex if c in res]
    for n, c in enumerate(ids):
        e = res[c]; tk = e['takes']
        if e['kind'] == 'gemara':
            o = [t for t in tk.values() if t['tag'] == c]
            if o: orig.append(o[0]['score'])
            if g.get(c, {}).get('key') in tk: prev.append(tk[g[c]['key']]['score'])
        else:
            k = T.key([x for x in T.plan() if x[0] == c][0][2])
            if k in tk: expl.append(tk[k]['score'])
        # קטע מול טקסט של קטע אחר מאותו סוג (צריך לקבל ציון נמוך מאוד)
        other = next((d for d in ids[n + 1:] + ids[:n] if res[d]['kind'] == e['kind']), None)
        b = max(tk.values(), key=lambda t: t['score'])
        r = X.examine(ex[other][1], b['transcripts'], f"{T.D}/{b['key']}.mp3"); mism.append(r['score'])
    def s(l): return {'n': len(l), 'mean': round(st.mean(l), 2), 'median': round(st.median(l), 2), 'ge9': sum(x >= 9 for x in l), 'lt5': sum(x < 5 for x in l)} if l else {}
    KB = {'b1_g4': 'דְּדָפְקָא', 'b3_g6': 'בְּרַקְתָּא', 'b3_g9': 'אִיכָּא', 'b3_g15': 'לֵימָא', 'b4_g4': 'דָמֵי', 'b8_g1': 'אִיבַּעְיָא', 'b5_g1': 'דְּאָמַר', 'b9_g4': 'דְּאָזֵיל', 'b5_g9': 'דְכַּסְפָּא'}
    kb = {}
    for c, w in KB.items():
        tk = res[c]['takes']; o = next((t for t in tk.values() if t['tag'] == c), None); b = max(tk.values(), key=lambda t: t['score'])
        f = lambda t: next((v for x, v in t.get('words', []) if X.NQ.sub('', x) == X.NQ.sub('', w)), None)
        kb[c + ' ' + w] = {'original_word': f(o) if o else None, 'original_line': o and o['score'], 'best_word': f(b), 'best_line': b['score']}
    out = {'known_bad_words (Scribe spot-check of original)': kb,
           'original_niqqud_gemara (Dudi: bad)': s(orig), 'previous_published_gemara (Scribe gate)': s(prev), 'explanations_intros_current': s(expl), 'mismatched_text (should be ~0)': s(mism)}
    json.dump(out, open(os.path.join(ROOT, 'tools/part_b_exam_calib.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps(out, ensure_ascii=False, indent=1))
if __name__ == '__main__':
    {'score': lambda: score(sys.argv[2:]), 'calib': calib, 'rescore': rescore}[sys.argv[1]]()
