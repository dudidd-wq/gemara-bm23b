# -*- coding: utf-8 -*-
"""בוחנים חיצוניים מקומיים (בלי ElevenLabs): faster-whisper, עברית, תמלול "עיוור" – בלי initial_prompt ובלי הקשר קודם.
  ivrit = ivrit-ai/whisper-large-v3-turbo-ct2 (כוונון לעברית)   wlv3 = Systran/faster-whisper-large-v3
תמלול נשמר ליד הקובץ: <mp3>.<judge>.json"""
import os, json, threading, subprocess
import numpy as np
def pcm(path):  # ffmpeg -> 16kHz מונו (בלי PyAV)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()
JUDGES = {'ivrit': 'ivrit-ai/whisper-large-v3-turbo-ct2', 'wlv3': 'Systran/faster-whisper-large-v3'}
_models = {}
_GL = threading.Lock()   # מודל אחד בכל רגע בתהליך (הרצה מקבילה של שני מודלים בתהליך אחד נתנה פלט משובש)
_locks = {j: _GL for j in JUDGES}
import re
JUNK = re.compile(r'[A-Za-z\uFFFD\u0600-\u06FF\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]')
def model(j, threads=None):
    th = threads or int(os.environ.get('ASR_THREADS', '4')); mk = (j, th)
    if mk not in _models:
        from faster_whisper import WhisperModel
        _models[mk] = WhisperModel(JUDGES[j], device='cpu', compute_type='int8_float32', cpu_threads=th)
    return _models[mk]
def _run(j, a, threads=None):
    segs, info = model(j, threads).transcribe(a, language='he', task='transcribe', beam_size=5, temperature=0.0,
                                              initial_prompt=None, condition_on_previous_text=False, vad_filter=False, without_timestamps=True)
    return ' '.join(s.text.strip() for s in segs).strip()
def asr(path, j):
    out = f'{path}.{j}.json'
    if os.path.exists(out): return json.load(open(out, encoding='utf-8'))
    with _locks[j]:
        a = pcm(path); text = _run(j, a); tries = 1
        # ב-CPU רב-הליכי (int8) יוצאים לפעמים אסימונים משובשים באקראי (אותיות לטיניות וכו'); מריצים שוב עד שיוצא תמלול נקי
        while JUNK.search(text) and tries < 5:
            text = _run(j, a); tries += 1
    d = {'judge': j, 'model': JUDGES[j], 'text': text, 'blind': True, 'runs': tries, 'cfg': 'int8_float32/seq'}
    json.dump(d, open(out, 'w', encoding='utf-8'), ensure_ascii=False); return d

if __name__ == '__main__':   # python3 tools/asr_local.py <judge> <list-file>  – תהליך נפרד לכל בוחן
    import sys
    # הרצה של שני מודלים במקביל (באותו תהליך או בשני תהליכים) נתנה פלט משובש במכונה הזו – לכן תמיד בזה אחר זה
    js = list(JUDGES) if sys.argv[1] == 'all' else [sys.argv[1]]; files = [l.strip() for l in open(sys.argv[2]) if l.strip()]
    for n, f in enumerate(files):
        for j in js: asr(f, j)
        print(n + 1, len(files), flush=True)
    print('done', flush=True)
