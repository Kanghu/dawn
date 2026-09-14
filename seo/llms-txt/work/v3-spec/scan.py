import re, collections, unicodedata, sys
sys.stdout.reconfigure(encoding='utf-8')
p = r'E:\SITES\Alessandro Design\dawn\seo\llms-txt\dwf-llms.txt'
b = open(p,'rb').read()
print('bytes', len(b))
print('BOM', b[:3] == b'\xef\xbb\xbf', b[:4])
print('CRLF', b.count(b'\r\n'), 'lone CR', b.count(b'\r') - b.count(b'\r\n'), 'LF total', b.count(b'\n'))
print('ends with newline', b.endswith(b'\n'), repr(b[-5:]))
t = b.decode('utf-8')  # strict
print('utf8 strict decode OK')
lines = t.split('\n')
print('lines (split)', len(lines))
for i,l in enumerate(lines,1):
    s = l.rstrip('\r')
    if s != s.rstrip(' \t'): print('trailing ws line', i, repr(s[-10:]))
    if '\t' in s: print('tab line', i)
# non-ascii chars
cnt = collections.Counter(ch for ch in t if ord(ch) > 127)
for ch,n in sorted(cnt.items(), key=lambda x:-x[1]):
    print(f'U+{ord(ch):04X} {ch!r} {unicodedata.name(ch,"?")} x{n}')
# lines with cedilla / comma forms
for name, chars in [('cedilla', 'şţŞŢ'), ('comma', 'șțȘȚ')]:
    ls = [i for i,l in enumerate(lines,1) if any(c in l for c in chars)]
    print(name, 'lines:', len(ls), ls[:80])
# combining marks
print('combining U+0326/U+0327:', t.count('\u0326'), t.count('\u0327'))
# NBSP, zero width, smart quotes
for c in ['\u00a0','\u200b','\u200c','\u200d','\ufeff','\u2013','\u2014','\u2019','\u201e','\u201d']:
    if c in t: print('special', hex(ord(c)), [i for i,l in enumerate(lines,1) if c in l])
# NFC check
print('NFC equal', unicodedata.normalize('NFC', t) == t)
# blank-line structure: multiple consecutive blank lines
prev=False
for i,l in enumerate(lines,1):
    blank = l.strip()==''
    if blank and prev: print('double blank at', i)
    prev=blank
# headings
for i,l in enumerate(lines,1):
    if l.startswith('#'): print('H', i, l)
