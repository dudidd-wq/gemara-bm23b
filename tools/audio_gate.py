# -*- coding: utf-8 -*-
"""השוואת תמלול (Scribe) לטקסט הצפוי: "שלד" צלילי – בלי ניקוד, בלי אמות קריאה, ואותיות שנשמעות אותו דבר מאוחדות."""
import re, difflib
NQ = re.compile(r'[\u0591-\u05C7]')
MAP = str.maketrans({'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ', 'ק': 'כ', 'ח': 'כ', 'ט': 'ת', 'ס': 'ש', 'ע': '', 'א': '', 'ה': '', 'י': '', 'ו': ''})
def words(t): return [w for w in re.sub(r'[^\u05D0-\u05EA ]', ' ', NQ.sub('', t)).split()]
def skel(w): return w.translate(MAP)
def compare(expected, heard):
    ew, hw = words(expected), words(heard)
    es = ''.join(skel(w) for w in ew); hs = ''.join(skel(w) for w in hw)
    sm = difflib.SequenceMatcher(None, es, hs, autojunk=False)
    # מיפוי תו בשלד -> מילה צפויה
    owner = []
    for i, w in enumerate(ew): owner += [i] * len(skel(w))
    bad = set()
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal': continue
        if i2 > i1: bad.update(owner[i1:i2])
        elif owner: bad.add(owner[min(i1, len(owner) - 1)])
    return round(sm.ratio(), 3), [ew[i] for i in sorted(bad)]

# מדד מחמיר: משווים לכתיב המלא הפונטי שנשלח להקראה; אמות הקריאה נשמרות (מנורמלות)
SMAP = str.maketrans({'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ', 'ק': 'כ', 'ח': 'כ', 'ט': 'ת', 'ס': 'ש', 'ע': 'א', 'ה': 'א'})
def sskel(w):
    w = w.translate(SMAP)
    w = re.sub(r'(.)\1+', r'\1', w)            # וו→ו, יי→י, כפולות
    w = re.sub(r'^א(?=[יו])', '', w)           # א בתחילת מילה לפני תנועה
    return w
def compare_strict(intended, heard):
    ew, hw = words(intended), words(heard)
    es = ''.join(sskel(w) for w in ew); hs = ''.join(sskel(w) for w in hw)
    sm = difflib.SequenceMatcher(None, es, hs, autojunk=False)
    owner = []
    for i, w in enumerate(ew): owner += [i] * len(sskel(w))
    bad = set()
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal': continue
        if i2 > i1: bad.update(owner[i1:i2])
        elif owner: bad.add(owner[min(i1, len(owner) - 1)])
    return round(sm.ratio(), 3), [ew[i] for i in sorted(bad)]
