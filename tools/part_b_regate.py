#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""הקלטה מחדש של שורות הגמרא בכתיב פונטי + בדיקת תמלול (Scribe). תוצאה: tools/part_b_audio_gate.json
  python3 tools/part_b_regate.py gemara [ids]   # עד 3 ניסיונות לשורה, שומר את הטוב ביותר
  python3 tools/part_b_regate.py expl          # בדיקת תמלול להסברים ולפתיחות (בלי הקלטה מחדש)
תקרת תקציב: BUDGET תווים (סכום כל הקריאות החדשות בהרצה, לפי היומן)."""
import os, sys, json, re
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, '/workspace/gemara_bm23b')
import part_b_tts as T, part_b_phonetic as PH, audio_gate as G
import stt as S
ROOT = T.ROOT; GATE = T.GATE
BUDGET = int(os.environ.get('BUDGET', '36000'))
def spent_since(t0):
    n = 0
    for l in open(T.LED):
        d = json.loads(l)
        if d['status'] == 'sent' and d.get('t', 0) >= t0: n += d.get('chars', 0)
    return n
def transcribe(key):
    out = []
    for m in ('scribe_v1', 'scribe_v2'):
        try: out.append((m, S.stt(f'{T.D}/{key}.mp3', model=m)['text']))
        except Exception as e: out.append((m, ''))
    return out
def judge(display, phon, key):
    best = None
    for m, h in transcribe(key):
        lr, lbad = G.compare(T.tts_gemara(display), h); sr, sbad = G.compare_strict(PH.phon(phon) if G.NQ.search(phon) else phon, h)
        cand = {'model': m, 'stt': h, 'lax': lr, 'lax_flag': lbad, 'strict': sr, 'strict_flag': sbad}
        score = (not lbad, sr, lr)
        if best is None or score > best[0]: best = (score, cand)
    c = best[1]
    c['status'] = 'pass' if (not c['lax_flag'] and c['strict'] >= 0.95) else 'doubt'
    return c
ALT = json.load(open(os.path.join(ROOT, 'tools/part_b_phon_alt.json'), encoding='utf-8'))
def variants(phon, cid=''):
    yield phon
    yield phon.rstrip('.,:!?') + '.' if not phon.endswith('.') else phon.rstrip('.') + '!'
    yield re.sub(r',\s*', ' ', phon)  # בלי פסיקים – קצב אחר
    yield from ALT.get(cid, [])        # כתיב חלופי ידני (אותן מילים, איות אחר)
def gemara(only):
    d = json.load(open(os.path.join(ROOT, 'data/part_b.json'), encoding='utf-8'))
    gate = T.load_gate(); t0 = float(os.environ.get('T0', '0')) or __import__('time').time()
    lines = [('%s_g%d' % (u['id'], l['n']), l['niqqud']) for u in d['units'] for l in u['lines']]
    lines = [x for x in lines if not only or x[0] in only or x[0].split('_')[0] in only]
    def one(x):
        cid, disp = x
        g = gate.get(cid)
        if g and g.get('status') in ('pass', 'approved') and g.get('phon') == PH.phon(disp): return cid, g
        tries = []
        for v in variants(PH.phon(disp), cid):
            if spent_since(t0) + len(v) > BUDGET: break
            try: k, new = T.tts(v, cid + '_ph')
            except Exception as e: print('ERR', cid, e, flush=True); break
            j = judge(disp, v, k); j.update({'key': k, 'phon': v}); tries.append(j)
            if j['status'] == 'pass': break
        if not tries: return cid, g
        best = max(tries, key=lambda j: (j['status'] == 'pass', not j['lax_flag'], j['strict'], j['lax']))
        best['attempts'] = len(tries); best['phon_base'] = PH.phon(disp)
        print(cid, best['status'], best['attempts'], best['strict'], best['lax_flag'], best['strict_flag'], flush=True)
        return cid, best
    with ThreadPoolExecutor(3) as ex:
        for cid, g in ex.map(one, lines):
            if g: gate[cid] = g
    json.dump(gate, open(GATE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('spent this run', spent_since(t0))
def expl():
    jobs = [j for j in T.plan() if j[1] != 'gemara']
    res = {}
    def one(j):
        k = T.key(j[2]); c = judge(j[2], j[2], k); c['key'] = k; return j[0], c
    with ThreadPoolExecutor(6) as ex:
        for cid, c in ex.map(one, jobs): res[cid] = c
    json.dump(res, open(os.path.join(ROOT, 'tools/part_b_expl_gate.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    bad = {k: v for k, v in res.items() if v['status'] != 'pass'}
    print('expl/intro', len(res), 'doubt', len(bad))
    for k, v in sorted(bad.items()): print(k, v['strict'], v['lax_flag'], v['strict_flag'], '|', v['stt'])
if __name__ == '__main__':
    {'gemara': lambda: gemara(sys.argv[2:]), 'expl': expl}[sys.argv[1]]()
