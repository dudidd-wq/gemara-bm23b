#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""לולאת שיפור: כל קטע שקיבל פחות מ-9 אצל הבוחן החיצוני מוקלט מחדש באסטרטגיות שונות (עד MAXNEW ניסיונות חדשים),
והטוב ביותר נשמר.  python3 tools/exam_loop.py [ids]     BUDGET=תווים (ברירת מחדל 60000), T0=זמן התחלה (ledger)"""
import os, sys, json, re, time, hashlib, subprocess
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, '/workspace/gemara_bm23b')
import threading
LOCK = threading.Lock(); RES = {}
import part_b_tts as T, part_b_phonetic as PH, exam_run as R, examiner as X
BUDGET = int(os.environ.get('BUDGET', '60000')); T0 = float(os.environ.get('T0', '0')) or time.time()
MAXNEW = int(os.environ.get('MAXNEW', '6')); PASS = 9.0
SLOW = dict(T.VS, speed=0.8)
def spent():
    n = 0
    for l in open(T.LED):
        d = json.loads(l)
        if d['status'] == 'sent' and d.get('t', 0) >= T0: n += d.get('chars', 0)
    return n
PUNCT = re.compile(r'^([^\u05D0-\u05EA]*)(.*?)([^\u05D0-\u05EA\u0591-\u05C7]*)$')
def split_tok(t): m = PUNCT.match(t); return m.group(1), m.group(2), m.group(3)
PREF = 'דובלהכמש'
def hyph(w_plain):  # תחילית נפרדת במקף: "דדאפקא" -> "ד-דאפקא"
    return w_plain[0] + '-' + w_plain[1:] if len(w_plain) > 3 and w_plain[0] in PREF else w_plain
def line_tokens(cid, kind, disp_text):
    """(טוקן מוצג/מנוקד, טוקן פונטי) לכל מילה"""
    nq = disp_text.split()
    if kind == 'gemara':
        for a, b in R.EXPECT_FIX.items(): nq = [x.replace(a, b) for x in nq]
        ph = PH.phon(disp_text).split()
        if len(ph) != len(nq): ph = [PH.phon(x) for x in nq]
    else: ph = nq[:]
    return nq, ph
def weak_idx(take, nq):
    ws = take.get('words', [])
    # מיפוי מילים מהבוחן לטוקנים (לפי סדר, רק טוקנים עם אותיות)
    idx = [i for i, t in enumerate(nq) if re.search(r'[\u05D0-\u05EA]', t)]
    pairs = [(idx[k], c) for k, (w, c) in enumerate(ws) if k < len(idx)]
    bad = [i for i, c in sorted(pairs, key=lambda p: p[1]) if c < 0.92][:2]
    return bad or ([min(pairs, key=lambda p: p[1])[0]] if pairs else [])
def build(tokens_base, nq, ph, weak, how):
    out = []
    for i, base in enumerate(tokens_base):
        if i not in weak: out.append(base); continue
        a, core_ph, z = split_tok(ph[i]); _, core_nq, _ = split_tok(nq[i])
        if how == 'nq': out.append(a + core_nq + z)
        elif how == 'hyph': out.append(a + hyph(X.NQ.sub('', core_ph)) + z)
        elif how == 'comma': out.append(a + core_ph + (z if z else ','))
        else: out.append(base)
    t = ' '.join(out)
    if how == 'comma': t = re.sub(r',,+', ',', t)
    return t
def trimmed(src, dst):
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse', '-ar', '44100', '-ac', '1', dst], check=True)
def concat(keys):
    ck = 'cat_' + hashlib.sha1('|'.join(keys).encode()).hexdigest()[:10]; out = f'{T.D}/{ck}.mp3'
    if os.path.exists(out): return ck
    tmp = []
    for n, k in enumerate(keys):
        p = f'/tmp/cat_{ck}_{n}.wav'; trimmed(f'{T.D}/{k}.mp3', p); tmp.append(p)
    sil = f'/tmp/cat_{ck}_sil.wav'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '0.18', sil], check=True)
    lst = f'/tmp/cat_{ck}.txt'; open(lst, 'w').write(''.join(f"file '{p}'\nfile '{sil}'\n" for p in tmp[:-1]) + f"file '{tmp[-1]}'\n")
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-af', 'adelay=150,apad=pad_dur=0.25', '-c:a', 'libmp3lame', '-b:a', '128k', out], check=True)
    return ck
def gen_text(cid, text, vs=None):
    if spent() + len(text) > BUDGET: raise RuntimeError('BUDGET')
    k, new = T.tts(text, cid + '_ex', vs=vs); return k
def improve(cid, res):
    e = res[cid]; kind = e['kind']; disp = [x for x in T.plan() if x[0] == cid][0][2]
    nq, ph = line_tokens(cid, kind, disp)
    tried = set(t.get('text') + '|' + str(t.get('vs')) for t in e['takes'].values())
    best = lambda: T.best_take(e)
    plan_ = ['nq', 'hyph', 'comma', 'slow', 'split', 'nq_slow', 'hyph_slow'] if kind == 'gemara' else ['comma', 'slow', 'split', 'hyph', 'comma_slow']
    n = 0; log = []
    # קודם: הקלטות קיימות במטמון שעוד לא נבחנו (חינם)
    for t in R.takes(cid):
        if t['key'] in e['takes'] or best()['score'] >= PASS: continue
        r = R.score_take(cid, t['key'], e['expected']); r.update(text=t['text'], tag=t['tag'], strategy='cached')
        with LOCK:
            e['takes'][t['key']] = r; R.save(json.loads(json.dumps(RES)))
        log.append(f"cached:{r['score']}")
    for how in plan_:
        b = best()
        if b['score'] >= PASS or n >= MAXNEW: break
        weak = weak_idx(b, nq)
        base_toks = (b.get('text') or ' '.join(ph)).split()
        if len(base_toks) != len(nq): base_toks = ph[:]
        try:
            if how == 'split':
                lo, hi = min(weak), max(weak)
                parts = [' '.join(base_toks[:lo]), ' '.join(base_toks[lo:hi + 1]), ' '.join(base_toks[hi + 1:])]
                parts = [p for p in parts if re.search(r'[\u05D0-\u05EA]', p)]
                if len(parts) < 2: continue
                keys = [gen_text(cid, p) for p in parts]; k = concat(keys); text = ' ⟂ '.join(parts); vs = None
            else:
                h = how.replace('_slow', ''); vs = SLOW if how.endswith('slow') else None
                text = ' '.join(base_toks) if h == 'slow' else build(base_toks, nq, ph, weak, h)
                if h == 'comma' and kind != 'gemara': text = build(base_toks, nq, nq, weak, 'comma')
                if text + '|' + str(vs) in tried: continue
                k = gen_text(cid, text, vs)
        except RuntimeError as ex:
            if 'BUDGET' in str(ex): log.append('BUDGET'); break
            log.append(f'ERR {ex}'); continue
        tried.add(text + '|' + str(vs)); n += 1
        r = R.score_take(cid, k, e['expected']); r.update(text=text, tag=cid + '_ex:' + how, strategy=how, vs=vs)
        with LOCK:
            e['takes'][k] = r; R.save(json.loads(json.dumps(RES)))   # נקודת ביקורת אחרי כל ניסיון
        log.append(f'{how}:{r["score"]}')
    return cid, best()['score'], log
if __name__ == '__main__':
    res = R.load(); RES = res; only = sys.argv[1:]
    ids = [c for c, e in res.items() if (not only or c in only or c.split('_')[0] in only or e['kind'] in only)
           and T.best_take(e)['score'] < PASS]
    print(len(ids), 'clips below', PASS, 'spent so far', spent(), flush=True)
    with ThreadPoolExecutor(3) as pool:
        for k, (cid, sc, log) in enumerate(pool.map(lambda c: improve(c, res), ids)):
            print(cid, sc, log, 'spent', spent(), flush=True)
            if k % 5 == 0:
                with LOCK: R.save(json.loads(json.dumps(res)))
    R.save(res); print('spent', spent())
