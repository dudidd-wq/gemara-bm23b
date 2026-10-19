#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
קריינות לחלק ב (ElevenLabs) – אותו קול, מודל והגדרות כמו בחלק א (/workspace/gemara_bm23b/tts.py).
  python3 tools/part_b_tts.py plan            # רק מכין את הטקסטים ומדפיס סיכום (בלי קריאות API)
  python3 tools/part_b_tts.py gen [ids...]    # יוצר קטעים חסרים (מטמון לפי hash; לא יוצר מחדש קטע קיים)
  python3 tools/part_b_tts.py encode          # MP3 מונו קטן אל audio/b/ + data/part_b_audio.json
המטמון הגולמי והיומן (ledger) נמצאים מחוץ למאגר: $TTS_B_DIR (ברירת מחדל /workspace/gemara_bm23b/tts_b).
"""
import os, re, sys, json, hashlib, base64, time, ssl, socket, subprocess, unicodedata, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
D = os.environ.get('TTS_B_DIR', '/workspace/gemara_bm23b/tts_b'); LED = D + '/ledger.jsonl'
VOICE = 'yGpVFXFoImvRvaURKypy'   # "Tomer – Calm, Curious Narrator" (כמו חלק א)
MODEL = 'eleven_v4'
VS = {'stability': 0.4, 'similarity_boost': 0.8, 'style': 0.35, 'speed': 0.9, 'use_speaker_boost': True}
NQ = re.compile(r'[\u0591-\u05C7]')
def plain(s): return NQ.sub('', s)
def key(text): return hashlib.sha1(json.dumps([text, VOICE, MODEL, VS], ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:14]

# ---------- הכנת הטקסט להקראה ----------
NAMES = set('ביבי נחמן זביד מרי זירא הושעיא אביי יעקב הונא רבה חייא זוטרא שמואל יהודה פפא שמעון אלעזר אבא'.split())
TERMS = set('אנפוריא ובאושפיזא אושפיזא ובפוריא בפוריא במסכת הברדלס סרטיא בסרטיא ופלטיא זוטו ומשלוליתו וצינוריות קרדומות גרוגרות במציף מציף ברשום רשום שוכי בדי מחטין צורבא מרבנן כופרא חלפי מחסם'.split())
def vocal_map(unit):
    m = {}
    for l in unit['lines']:
        for tok in l['niqqud'].split(' '):
            w = re.sub(r'[.,:;!?–״׳"\']+', '', tok)
            if not w: continue
            m.setdefault(plain(w), set()).add(w)
    return {k: next(iter(v)) for k, v in m.items() if len(v) == 1}
# ניקוד עזר להקראה בלבד (לא מוצג באתר) למילים דו-משמעיות
FIX = {'מברדלס': 'מִבַּרְדְּלָס', 'צבוע': 'צָבוֹעַ', 'בד': 'בַּד', 'בבד': 'בְּבַד', 'מנין': 'מִנְיָן', 'מעות': 'מָעוֹת'}
DAF = {'כ"ג ע"ב': 'דַּף כָּף גִּימֶל, עַמּוּד בֵּית', 'כ"ד ע"א': 'דַּף כָּף דָּלֶת, עַמּוּד אָלֶף', 'כ"ד ע"ב': 'דַּף כָּף דָּלֶת, עַמּוּד בֵּית'}
def tts_expl(t, vm):
    t = t.replace('▽', '')
    t = re.sub(r'\s*\((?:רש"י|שטיינזלץ)\)', '', t)
    t = re.sub(r'\s*–\s*רש"י\)', ')', t)
    t = t.replace('(חיה טורפת; רש"י: צבוע)', ', חיה טורפת, לפי רש"י: צבוע,')
    for a, b in DAF.items(): t = t.replace('בדף ' + a, 'בְּ' + b.replace('דַּף', 'דַף')).replace('דף ' + a, b).replace(a, b)
    for a, b in FIX.items(): t = re.sub(r'(?<![א-ת])' + re.escape(a) + r'(?![א-ת])', b, t)
    t = re.sub(r'\(([^)]*)\)', lambda m: ', ' + m.group(1).rstrip('.') + ',', t)
    out = []
    for w in t.split(' '):
        core = re.sub(r'^[",(]+|[",.:;!?)]+$', '', w)
        if core in NAMES or core in TERMS:
            if core in vm: w = w.replace(core, vm[core])
        out.append(w)
    t = ' '.join(out)
    t = re.sub(r'\s+,', ',', t); t = t.replace('.,', '.'); t = re.sub(r',\s*–', ' –', t)
    t = re.sub(r'\s*,\s*([,.:;!?])', r'\1', t); t = re.sub(r',\s*,', ',', t); t = re.sub(r'\s+', ' ', t).strip().rstrip(',')
    return t
def tts_gemara(t):
    t = t.replace('וְכוּ׳', 'וְכוּלֵּי').replace('״', '').replace('׳', '')
    t = re.sub(r'\s*–\s*', ', ', t)
    return re.sub(r'\s+', ' ', t).strip()

def plan():
    B = json.load(open(os.path.join(ROOT, 'data/part_b.json'), encoding='utf-8'))
    jobs = []
    for u in B['units']:
        vm = vocal_map(u)
        jobs.append((u['id'] + '_intro', 'intro', tts_expl(u['intro'], vm)))
        for l in u['lines']:
            jobs.append(('%s_g%d' % (u['id'], l['n']), 'gemara', tts_gemara(l['niqqud'])))
            jobs.append(('%s_e%d' % (u['id'], l['n']), 'expl', tts_expl(l['explanation'], vm)))
    return jobs

# ---------- API (זהה ללוגיקה של חלק א: יומן, סירוב לחזור על קריאה שאולי חויבה) ----------
K = os.environ.get('ELEVENLABS_API_KEY', '')
def led(d):
    with open(LED, 'a') as f: f.write(json.dumps(d, ensure_ascii=False) + '\n')
def ledstate():
    st = {}
    if os.path.exists(LED):
        for l in open(LED): d = json.loads(l); st.setdefault(d['key'], []).append(d['status'])
    return st
class Quota(Exception): pass
def tts(text, tag=''):
    k = key(text); mp3 = f'{D}/{k}.mp3'; js = f'{D}/{k}.json'
    if os.path.exists(mp3) and os.path.exists(js): return k, False
    st = ledstate().get(k, [])
    if st.count('sent') > st.count('ok') + st.count('ok_err'): raise RuntimeError(f'{k} {tag}: prior call may have succeeded; refusing to repeat (check history)')
    body = {'text': text, 'model_id': MODEL, 'language_code': 'he', 'voice_settings': VS}
    req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128', method='POST',
                                 headers={'xi-api-key': K, 'Content-Type': 'application/json'}, data=json.dumps(body).encode())
    for att in range(3):
        led({'key': k, 'tag': tag, 'status': 'sent', 'text': text, 'chars': len(text), 't': time.time()})
        try:
            with urllib.request.urlopen(req, timeout=240) as f: r = json.loads(f.read())
            open(mp3, 'wb').write(base64.b64decode(r['audio_base64']))
            json.dump({'text': text, 'alignment': r.get('alignment'), 'normalized': r.get('normalized_alignment')}, open(js, 'w'), ensure_ascii=False)
            led({'key': k, 'tag': tag, 'status': 'ok'}); return k, True
        except urllib.error.HTTPError as e:
            msg = e.read()[:400].decode('utf8', 'replace'); led({'key': k, 'tag': tag, 'status': 'http_err', 'code': e.code, 'msg': msg}); led({'key': k, 'tag': tag, 'status': 'ok_err'})
            if e.code in (401, 402, 429) and re.search(r'quota|credit|limit|exceed', msg, re.I): raise Quota(f'HTTP {e.code} {msg}')
            if e.code in (429, 500, 502, 503) and att < 2: time.sleep(15 * (att + 1)); continue
            raise RuntimeError(f'HTTP {e.code} {msg}')
        except urllib.error.URLError as e:
            if isinstance(e.reason, (ssl.SSLError, socket.gaierror, ConnectionRefusedError)):
                led({'key': k, 'tag': tag, 'status': 'ok_err', 'note': 'pre-send net err'}); time.sleep(6); continue
            raise RuntimeError(f'{k} maybe charged: {e!r}')
        except Exception as e: raise RuntimeError(f'{k} maybe charged: {e!r}')
    raise RuntimeError(f'{k} gave up')

def gen(only):
    jobs = [j for j in plan() if not only or j[0] in only or j[0].split('_')[0] in only]
    stop = {'q': None}
    def run(j):
        if stop['q']: return
        try: k, new = tts(j[2], j[0]); print(j[0], k, 'new' if new else 'cached', flush=True)
        except Quota as e: stop['q'] = str(e); print('QUOTA', j[0], e, flush=True)
        except Exception as e: print('ERR', j[0], e, flush=True)
    with ThreadPoolExecutor(3) as ex: list(ex.map(run, jobs))
    if stop['q']: print('STOPPED ON QUOTA:', stop['q']); sys.exit(2)

GATE = os.path.join(ROOT, 'tools/part_b_audio_gate.json')
def load_gate(): return json.load(open(GATE, encoding='utf-8')) if os.path.exists(GATE) else {}
def dur_of(p): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]).decode().strip())
def encode():
    out, missing, tot = {}, [], 0.0
    gate = load_gate()
    for cid, kind, text in plan():
        if kind == 'gemara' and gate.get(cid, {}).get('status') not in ('pass', 'approved'):
            continue  # שורות גמרא: רק קטעים שעברו את בדיקת התמלול (או אושרו ע"י דודי)
        k = key(text); src = f'{D}/{k}.mp3'
        if not os.path.exists(src): missing.append(cid); continue
        dst = os.path.join(ROOT, 'audio/b', k + '.mp3')
        if not os.path.exists(dst):
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '48k', dst], check=True)
        d = round(dur_of(dst), 2); tot += d
        out[cid] = {'file': 'audio/b/' + k + '.mp3', 'start': 0, 'end': d, 'kind': kind, 'tts_text': text}
    used = {os.path.basename(c['file']) for c in out.values()}
    for f in os.listdir(os.path.join(ROOT, 'audio/b')):
        if f not in used: os.remove(os.path.join(ROOT, 'audio/b', f))
    json.dump({'voice': VOICE, 'model': MODEL, 'clips': out}, open(os.path.join(ROOT, 'data/part_b_audio.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('encoded', len(out), 'missing', len(missing), 'total sec', round(tot, 1), missing[:10])

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'plan'
    if cmd == 'plan':
        j = plan(); print(len(j), 'clips,', sum(len(x[2]) for x in j), 'chars;', 'cached:', sum(os.path.exists(f'{D}/{key(x[2])}.mp3') for x in j))
        if '-v' in sys.argv:
            for x in j: print(x[0], '|', x[2])
    elif cmd == 'gen': gen(sys.argv[2:])
    elif cmd == 'encode': encode()
