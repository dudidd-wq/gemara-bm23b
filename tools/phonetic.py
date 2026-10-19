# -*- coding: utf-8 -*-
"""ממיר טקסט מנוקד (ספריא) לכתיב מלא "פונטי" להקראה (ElevenLabs). הטקסט באתר לא משתנה.
mode: 'plain' – כתיב מלא בלי ניקוד;  'marks' – כתיב מלא + דגש בבגד"כפת + סימני e (צירה/סגול) בלבד."""
import re, unicodedata
SHVA, HATAF_E, HATAF_A, HATAF_O = '\u05B0', '\u05B1', '\u05B2', '\u05B3'
HIRIQ, TSERE, SEGOL, PATAH, QAMATS, HOLAM, HOLAM_V, QUBUTS = '\u05B4', '\u05B5', '\u05B6', '\u05B7', '\u05B8', '\u05B9', '\u05BA', '\u05BB'
DAGESH, SHIN_DOT, SIN_DOT, QAMATS_Q = '\u05BC', '\u05C1', '\u05C2', '\u05C7'
LET = re.compile(r'([\u05D0-\u05EA])([\u0591-\u05C7]*)')
FINAL = {'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ'}
def vowel(marks):
    if HIRIQ in marks: return 'i'
    if TSERE in marks or SEGOL in marks or HATAF_E in marks: return 'e'
    if PATAH in marks or QAMATS in marks or HATAF_A in marks: return 'a'
    if HOLAM in marks or HOLAM_V in marks or HATAF_O in marks or QAMATS_Q in marks: return 'o'
    if QUBUTS in marks: return 'u'
    return ''
def word(w, mode='plain', rafe_ch=False):
    w = unicodedata.normalize('NFC', w)
    units = LET.findall(w)  # [(letter, marks)]
    if not units: return w
    out = []
    n = len(units)
    i = 0
    while i < n:
        L, m = units[i]
        nxt = units[i + 1] if i + 1 < n else None
        # ו כאות-תנועה (שורוק / חולם מלא) – כבר נכתבה
        if L == 'ו' and i > 0 and (m == DAGESH or m in (HOLAM, HOLAM_V)) and vowel(units[i - 1][1]) == '':
            out.append('ו'); i += 1; continue
        if L == 'י' and i > 0 and vowel(m) == '' and DAGESH not in m:  # יו"ד נחה (אם קריאה) – נשארת
            out.append('י'); i += 1; continue
        if L == 'א' and i > 0 and vowel(m) == '':
            out.append('א'); i += 1; continue
        if L == 'ה' and i == n - 1 and vowel(m) == '' and DAGESH not in m:
            out.append('ה'); i += 1; continue
        c = L
        if L == 'ש' and SIN_DOT in m: c = 'ס'
        if L in 'בכפ':
            if DAGESH in m:
                c = L + ('\u05BC' if mode == 'marks' else '')
            elif L == 'כ' and i < n - 1 and rafe_ch: c = 'ח'      # כ רפה = ח (רק במילים ארמיות שברשימה)
        if L == 'כ' and DAGESH in m and mode == 'plain' and i > 1: c = 'ק'   # כּ דגושה באמצע מילה = ק
        pv = vowel(units[i - 1][1]) if i > 0 else ''
        if L == 'ו' and i > 0 and vowel(m) and pv: c = 'וו'  # ו עיצורית באמצע מילה
        if L == 'י' and i > 0 and vowel(m) and nxt is not None and pv: c = 'יי'
        v = vowel(m)
        nxt_l = nxt[0] if nxt else ''
        nxt_is_mater = nxt is not None and ((nxt_l == 'ו' and (nxt[1] == DAGESH or HOLAM in nxt[1])) or (nxt_l == 'י' and vowel(nxt[1]) == ''))
        if mode == 'marks' and v == 'e':
            c += TSERE if TSERE in m else SEGOL
        out.append(c)
        if v == 'i' and nxt_l != 'י' and not (nxt is not None and vowel(nxt[1]) == '' and not nxt_is_mater): out.append('י')
        elif v in ('o', 'u') and not nxt_is_mater and not (nxt_l == 'א' and vowel(nxt[1]) == ''): out.append('ו')
        elif v == 'a' and nxt is None and L not in 'חעה': out.append('א')  # פתח גנובה – לא מוסיפים
        i += 1
    s = ''.join(out)
    s = re.sub('י{3,}', 'יי', s); s = re.sub('ו{3,}', 'וו', s)
    # אותיות סופיות
    if s and s[-1] in FINAL: s = s[:-1] + FINAL[s[-1]]
    s = re.sub('([כמנפצ])(\u05BC?)$', lambda mm: FINAL[mm.group(1)] + mm.group(2), s)
    return s
PUN = re.compile(r'^([^\u05D0-\u05EA]*)(.*?)([^\u05D0-\u05EA\u0591-\u05C7]*)$')
def text(t, mode='plain', overrides=None, rafe=None):
    t = t.replace('וְכוּ׳', 'וְכוּלֵּי').replace('״', '').replace('׳', '')
    t = re.sub(r'\s*–\s*', ', ', t)
    res = []
    for tok in t.split():
        a, core, z = PUN.match(tok).groups()
        key = re.sub(r'[\u0591-\u05C7]', '', core)
        if overrides and core in overrides: res.append(a + overrides[core] + z)
        elif overrides and key in overrides: res.append(a + overrides[key] + z)
        else: res.append(a + word(core, mode, key in (rafe or ())) + z)
    return ' '.join(res)
