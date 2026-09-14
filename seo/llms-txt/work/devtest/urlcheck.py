import re, time, json, urllib.request, urllib.error, http.client, ssl, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
body = open('ro-llms.body', encoding='utf-8').read()
urls = sorted(set(re.findall(r'\]\((https?://[^)]+)\)', body)))
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
opener = urllib.request.build_opener(NoRedirect)
out = []
for u in urls:
    req = urllib.request.Request(u, headers={'User-Agent': UA})
    try:
        r = opener.open(req, timeout=30); st = r.status; loc = r.headers.get('Location'); data = r.read(300000).decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        st = e.code; loc = e.headers.get('Location'); data = ''
    extra = ''
    m = re.search(r'/collections/([^/?#]+)$', u)
    if st == 200 and m:
        time.sleep(0.8)
        try:
            pj = json.loads(opener.open(urllib.request.Request(u + '/products.json?limit=250', headers={'User-Agent': UA}), timeout=30).read())
            n = len(pj['products']); avail = sum(1 for p in pj['products'] if any(v.get('available') for v in p['variants']))
            extra = f'products={n}{"+" if n==250 else ""} available={avail}'
        except Exception as ex: extra = f'pj-error {ex}'
    can = re.search(r'<link rel="canonical" href="([^"]+)"', data)
    can = can.group(1) if can else ''
    flag = '' if st == 200 and (not can or can.rstrip('/') == u.rstrip('/')) else '  <<<'
    print(st, u, loc or '', ('canon=' + can) if can and can.rstrip('/') != u.rstrip('/') else '', extra, flag)
    out.append(dict(url=u, status=st, location=loc, canonical=can, extra=extra))
    time.sleep(0.8)
json.dump(out, open('final-urlcheck.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('unique urls:', len(urls), 'non-200:', sum(1 for o in out if o['status'] != 200))
