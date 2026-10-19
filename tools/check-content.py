#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
בדיקת תוכן אוטומטית לאתר. נכשלת (exit 1) אם נמצא:
  1. שם ה' המלא (או צורה דומה) בכל קובץ טקסט במאגר – גם עם ניקוד, טעמים, או מפרידים בין האותיות.
  2. אמוג'י של אנשים או פרצופים (כלל: בלי ציור פנים ובלי דמויות).
האותיות של השמות כתובות כאן כקודי יוניקוד (\\uXXXX), כדי שהקובץ הזה עצמו לא יכיל אותם.
הרצה:  python3 tools/check-content.py   (מתיקיית השורש של האתר)
"""
import os, re, sys, subprocess, unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TEXT_EXT = {'.html', '.htm', '.css', '.js', '.mjs', '.json', '.webmanifest', '.md', '.txt', '.svg', '.py', '.sh', '.yml', '.yaml', ''}
SKIP_DIRS = {'.git', 'node_modules'}

# אותיות
YOD, HE, VAV, ALEF, LAMED, MEM, DALET, NUN, QOF, KAF = '\u05D9', '\u05D4', '\u05D5', '\u05D0', '\u05DC', '\u05DD', '\u05D3', '\u05E0', '\u05E7', '\u05DB'
HEB = '[\u05D0-\u05EA]'
FORBIDDEN = [
    ('שם בן ארבע אותיות', re.compile(YOD + HE + VAV + HE)),
    ('אלקים בה"א (וכל הנטיות)', re.compile(ALEF + LAMED + VAV + '?' + HE + '(?:' + YOD + MEM + '|' + YOD + '(?:' + NUN + VAV + '|' + KAF + '|' + VAV + '|' + HE + '|' + HE + MEM + '|' + KAF + MEM + ')?)(?!' + HEB + ')')),
    ('אלקים בה"א (שם עצם)', re.compile('(?<!' + HEB + ')' + ALEF + LAMED + VAV + '?' + HE + YOD)),
    # תעתיק לועזי (נבנה מחלקים כדי שהקובץ עצמו לא יכיל את המילים)
    ('English transliteration', re.compile(r'\b(?:' + '|'.join(a + b for a, b in [('YH', 'WH'), ('YH', 'VH'), ('Yah', 'weh'), ('Jeho', 'vah'), ('Elo', 'him')]) + r')\b', re.I)),
]
# אמוג'י של אנשים / פרצופים / חלקי גוף עם פנים
PEOPLE = re.compile('[\U0001F466-\U0001F487\U0001F600-\U0001F64F\U0001F910-\U0001F92F\U0001F930-\U0001F93E\U0001F970-\U0001F97A'
                    '\U0001F9B0-\U0001F9B9\U0001F9CD-\U0001F9FF\U0001F574-\U0001F57A\U0001F6B4-\U0001F6B6\U0001F3C2-\U0001F3CC'
                    '\U0001F46A-\U0001F46F\U0001F926\U0001F937\U0001F9D1-\U0001F9DD\u263A\u2639\U0001F383\U0001F5E3\U0001F464\U0001F465]')
MARKS = re.compile('[\u0591-\u05C7\u034F\u200B-\u200F\u2060\uFEFF]')
SEPS = re.compile('(?<=[\u05D0-\u05EA])[\\-\u05BE.\'"\u05F3\u05F4*_·\u2027]+(?=[\u05D0-\u05EA])')

def variants(text):
    t = unicodedata.normalize('NFC', text)
    t = MARKS.sub('', t)
    yield t
    yield SEPS.sub('', t)

def scan_text(rel, text, problems):
    for lineno, line in enumerate(text.splitlines(), 1):
        found = []
        for v in variants(line):
            for name, rx in FORBIDDEN:
                if rx.search(v) and name not in found:
                    found.append(name)
        for name in found:
            problems.append('%s:%d  [%s]' % (rel, lineno, name))
        if PEOPLE.search(line):
            problems.append('%s:%d  [אמוג\'י של אדם/פרצוף: %s]' % (rel, lineno, ' '.join('U+%04X' % ord(c) for c in PEOPLE.findall(line))))

def main():
    problems, n = [], 0
    for dp, dns, fns in os.walk(ROOT):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for fn in fns:
            p = os.path.join(dp, fn); rel = os.path.relpath(p, ROOT); ext = os.path.splitext(fn)[1].lower()
            if ext == '.pdf':
                try:
                    txt = subprocess.run(['pdftotext', '-enc', 'UTF-8', p, '-'], capture_output=True, text=True, timeout=60).stdout
                    scan_text(rel, txt, problems); n += 1
                except FileNotFoundError:
                    print('הערה: pdftotext לא מותקן – דילגתי על', rel)
                continue
            if ext not in TEXT_EXT: continue
            try: txt = open(p, encoding='utf-8').read()
            except UnicodeDecodeError: continue
            scan_text(rel, txt, problems); n += 1
    if problems:
        print('✖ נמצאו %d בעיות תוכן:' % len(problems))
        for x in problems: print('   ', x)
        sys.exit(1)
    print('✔ בדיקת תוכן עברה: %d קבצים נסרקו – אין שם ה\' מלא ואין אמוג\'י של אנשים/פרצופים.' % n)

def self_test():
    # מוודא שהבדיקה באמת תופסת: בונה קבצים אסורים בתיקייה זמנית (מקודי יוניקוד) ומריץ עליהם.
    import tempfile
    global ROOT
    bad = ['\u05D9\u05B0\u05D4\u05B9\u05D5\u05B8\u05D4', '\u05D4\u05B8\u05D0\u05B1\u05DC\u05B9\u05D4\u05B4\u05D9\u05DD',
           '\u05D9-\u05D4-\u05D5-\u05D4', '\u05D0\u05DC\u05D5\u05D4\u05D9\u05DD', '\u05D0\u05DC\u05D4\u05D9\u05E0\u05D5', 'Je' + 'hovah', '\U0001F466']
    good = ['\u05D0\u05DC\u05E7\u05D9\u05DD', "\u05D4'", '\u05D0\u05DC\u05D4 \u05D4\u05D0\u05DC\u05D4', '\U0001F41F']
    ok = True
    for s, expect in [(x, True) for x in bad] + [(x, False) for x in good]:
        probs = []; scan_text('t', s, probs)
        if bool(probs) != expect: ok = False; print('self-test failed on', ascii(s))
    print('✔ self-test passed' if ok else '✖ self-test FAILED'); sys.exit(0 if ok else 1)

if __name__ == '__main__':
    self_test() if '--self-test' in sys.argv else main()
