# -*- coding: utf-8 -*-
"""הבוחן החיצוני – ציון 0–10 דטרמיניסטי לקטע הקראה.
מפתח פונטי לכל מילה (עיצורים בקבוצות צליל + תנועות I/U), יישור Levenshtein משוקלל בין המפתח הצפוי
(מהטקסט המנוקד – ההגייה הנכונה) למה שכל בוחן שמע, ציון לכל מילה, קונצנזוס בין הבוחנים, ועונשים על בעיות שמע."""
import re, json, os, subprocess, statistics
NQ = re.compile(r'[\u0591-\u05C7]')
HIRIQ, TSERE, HOLAM, HOLAM2, QUBUTS, QQ, DAGESH = '\u05B4', '\u05B5', '\u05B9', '\u05BA', '\u05BB', '\u05C7', '\u05BC'
CLS = {'א': '', 'ה': '', 'ע': '', 'ו': 'U', 'י': 'I', 'ב': 'B', 'ג': 'G', 'ד': 'D', 'ז': 'Z', 'ח': 'X', 'ט': 'T', 'כ': '?', 'ך': 'X',
       'ל': 'L', 'מ': 'M', 'ם': 'M', 'נ': 'N', 'ן': 'N', 'ס': 'S', 'פ': 'P', 'ף': 'P', 'צ': 'C', 'ץ': 'C', 'ק': 'K', 'ר': 'R', 'ש': 'S', 'ת': 'T'}
VOW = set('IUiu')
# קיצורים שמערכות התמלול כותבות במקום מה שנאמר
ABBR = [('כ"ד', 'כף דלת'), ('כ"ג', 'כף גימל'), ('כ״ד', 'כף דלת'), ('כ״ג', 'כף גימל'), ('ע"א', 'עמוד אלף'), ('ע"ב', 'עמוד בית'), ('ע״א', 'עמוד אלף'), ('ע״ב', 'עמוד בית'),
        ("וכו'", 'וכולי'), ('וכו׳', 'וכולי'), ('רש"י', 'רשי'), ('רש״י', 'רשי'), ("ב'", 'בית'), ("א'", 'אלף'), ('ב׳', 'בית'), ('א׳', 'אלף')]
def tokens_of_word(w, vocalized):
    """w: מילה (אפשר עם ניקוד). מחזיר רשימת אסימונים."""
    out = []; letters = re.findall(r'[\u05D0-\u05EA][\u0591-\u05C7]*', w)
    for i, chunk in enumerate(letters):
        c, marks = chunk[0], chunk[1:]
        t = CLS[c]
        if c == 'כ': t = ('K' if DAGESH in marks else 'X') if vocalized else '?'
        if c == 'ו' and vocalized and DAGESH in marks and not NQ.sub('', marks.replace(DAGESH, '')) and i > 0: t = 'U'
        if t: out.append(t)
        if vocalized:
            if HIRIQ in marks or TSERE in marks: out.append('i')     # תנועה מהניקוד בלבד (לא כתובה) – אופציונלית
            elif HOLAM in marks or HOLAM2 in marks or QUBUTS in marks or QQ in marks: out.append('u')
    k = []
    for t in out:
        if k and k[-1].upper() == t.upper() and t in VOW:  # יי, וו, חיריק+י – צליל אחד (עיצור כפול כתוב, כמו ששת, נשאר)
            if t.isupper(): k[-1] = t        # אם יש אות כתובה – התנועה "כתובה"
            continue
        k.append(t)
    if len(k) >= 2 and k[-1] == 'M' and k[-2] == 'I' and NQ.sub('', w)[-1:] == 'ם': k[-1] = 'N'   # ים/ין
    return k
NUM = {'1': 'אחד', '2': 'שניים', '3': 'שלושה', '4': 'ארבעה', '5': 'חמישה', '10': 'עשרה', '24': 'כף דלת', '23': 'כף גימל'}
def words(text):
    for a, b in ABBR: text = text.replace(a, b)
    # מספרי דפים: "דף כ', ד', עמוד ב'" / "בדף כד עמוד ב" -> שמות האותיות, כמו שהוקרא
    LN = {'א': 'אלף', 'ב': 'בית', 'ג': 'גימל', 'ד': 'דלת', 'כ': 'כף'}
    text = re.sub(r'(דף)\s+([כ][\'"״׳,\s]*[א-ט]?)[\'"״׳,]*(?=\s|$)', lambda m: m.group(1) + ' ' + ' '.join(LN.get(c, c) for c in re.sub(r'[^א-ת]', '', m.group(2))), text)
    text = re.sub(r'(עמוד)\s+([אב])[\'"״׳]?(?=[\s.,]|$)', lambda m: m.group(1) + ' ' + LN[m.group(2)], text)
    text = re.sub(r'\d+', lambda m: ' ' + NUM.get(m.group(), m.group()) + ' ', text)
    text = text.replace('־', ' ').replace('-', ' ')
    ws = []
    for w in text.split():
        if re.search(r'[A-Za-z]', w): ws.append(('#junk', ['#'])); continue
        core = re.sub(r'[^\u05D0-\u05EA\u0591-\u05C7]', '', w)
        if core: ws.append((core, None))
    return ws
def key_words(text, vocalized):
    return [(w, k if k else tokens_of_word(w, vocalized and bool(NQ.search(w)))) for w, k in words(text)]
CLOSE = {frozenset('BP'): .5, frozenset('DT'): .5, frozenset('GK'): .5, frozenset('ZS'): .5, frozenset('CS'): .5, frozenset('ZC'): .5,
         frozenset('MN'): .5, frozenset('BU'): .2, frozenset('KX'): .7, }
def sub(a, b):
    if a == b or (a in VOW and b in VOW and a.upper() == b.upper()): return 0.0
    a2, b2 = a.upper() if a in VOW else a, b.upper() if b in VOW else b
    if a2 in VOW and b2 in VOW: return 0.4
    if '?' in (a, b):
        o = b if a == '?' else a
        return 0.0 if o in ('K', 'X') else 1.0
    return CLOSE.get(frozenset((a, b)), 1.0)
def indel(t): return 0.1 if t in ('i', 'u') else (0.4 if t in VOW else 1.0)   # מחיקה של צפוי: תנועה לא כתובה כמעט חינם; כתובה 0.4
def ins(t): return 0.6 if t in VOW else 1.0   # תנועה (ו/י) שנשמעה ואינה בהגייה הצפויה = כנראה תנועה שגויה (o/i במקום a)
def weight(t): return 0.25 if t in ('i', 'u') else (0.5 if t in VOW else 1.0)
def score_words(expected, heard):
    """expected/heard: רשימות (מילה, אסימונים). מחזיר דמיון 0..1 לכל מילה צפויה."""
    E, owner = [], []
    for i, (w, k) in enumerate(expected): E += k; owner += [i] * len(k)
    H = [t for w, k in heard for t in k]
    n, m = len(E), len(H)
    D = [[0.0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1): D[i][0] = D[i - 1][0] + indel(E[i - 1])
    for j in range(1, m + 1): D[0][j] = D[0][j - 1] + ins(H[j - 1])
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            D[i][j] = min(D[i - 1][j - 1] + sub(E[i - 1], H[j - 1]), D[i - 1][j] + indel(E[i - 1]), D[i][j - 1] + ins(H[j - 1]))
    cost = [0.0] * len(expected); i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0 and abs(D[i][j] - (D[i - 1][j - 1] + sub(E[i - 1], H[j - 1]))) < 1e-9:
            cost[owner[i - 1]] += sub(E[i - 1], H[j - 1]); i -= 1; j -= 1
        elif i > 0 and abs(D[i][j] - (D[i - 1][j] + indel(E[i - 1]))) < 1e-9:
            cost[owner[i - 1]] += indel(E[i - 1]); i -= 1
        else:
            if owner: cost[owner[min(max(i - 1, 0), len(owner) - 1)]] += ins(H[j - 1])
            j -= 1
    sims = []
    for (w, k), c in zip(expected, cost):
        wt = sum(weight(t) for t in k) or 1.0
        sims.append(max(0.0, 1.0 - c / wt))
    return sims
# ---------- בדיקות שמע ----------
def audio_stats(path):
    cache = path + '.astats.json'
    if os.path.exists(cache): return json.load(open(cache))
    r = subprocess.run(['ffmpeg', '-v', 'info', '-i', path, '-af', 'silencedetect=noise=-40dB:d=0.9,astats=metadata=0', '-f', 'null', '-'], capture_output=True, text=True).stderr
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).decode().strip())
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', r)]; en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r)]
    sil = []
    for k, s in enumerate(st):
        e = en[k] if k < len(en) else dur
        sil.append((s, e))
    lead = sum(e - s for s, e in sil if s < 0.05); trail = sum(e - s for s, e in sil if e > dur - 0.05)
    inner = [round(e - s, 2) for s, e in sil if s >= 0.05 and e <= dur - 0.05]
    pk = re.findall(r'Peak level dB: ([-\d.inf]+)', r); pc = re.findall(r'Peak count: ([\d.]+)', r)
    d = {'dur': dur, 'speech': max(0.1, dur - lead - trail), 'inner_sil': inner,
         'peak_db': float(pk[-1]) if pk and pk[-1] not in ('-inf',) else -99, 'peak_count': float(pc[-1]) if pc else 0}
    json.dump(d, open(cache, 'w')); return d
def letters(text): return len(re.findall(r'[\u05D0-\u05EA]', text))
RATE = (3.5, 22.0)   # אותיות לשנייה – רק קיצוניות (קטעים קצרים מדברים לאט יותר; כויל על ההסברים)
def examine(expected_text, transcripts, path, kind='gemara'):
    """transcripts: {judge: text}. מחזיר ציון ופירוט."""
    exp = key_words(expected_text, True)
    per = {j: score_words(exp, key_words(t or '', False)) for j, t in transcripts.items()}
    cons = []
    for i in range(len(exp)):
        s = sorted((per[j][i] for j in per), reverse=True) + [0.0, 0.0]
        cons.append(0.5 * s[0] + 0.5 * s[1])         # ציון מלא רק כששני בוחנים לפחות מסכימים
    mean = sum(cons) / len(cons) if cons else 0; mn = min(cons) if cons else 0
    base = 10 * (0.5 * mean + 0.5 * mn)
    a = audio_stats(path); pen = []; rate = letters(expected_text) / a['speech']
    if not RATE[0] <= rate <= RATE[1]: pen.append(('rate %.1f/s' % rate, 1.5))
    longs = [s for s in a['inner_sil'] if s >= 1.3]
    if longs: pen.append(('silence %s' % longs, min(2.0, 1.0 * len(longs))))
    if a['peak_db'] >= -0.1 and a['peak_count'] > 20: pen.append(('clipping', 0.5))
    score = max(0.0, round(base - sum(p for _, p in pen), 2))
    judge_scores = {j: round(10 * (0.5 * sum(v) / len(v) + 0.5 * min(v)), 2) if v else 0 for j, v in per.items()}
    worst = sorted(range(len(exp)), key=lambda i: cons[i])[:3]
    return {'score': score, 'base': round(base, 2), 'judge_scores': judge_scores, 'penalties': pen, 'rate': round(rate, 1),
            'weak': [(exp[i][0], round(cons[i], 2)) for i in worst if cons[i] < 0.9], 'words': [(exp[i][0], round(cons[i], 3)) for i in range(len(exp))], 'transcripts': transcripts}
