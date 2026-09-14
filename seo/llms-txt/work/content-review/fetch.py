import urllib.request, urllib.error, time, json, re, sys, os, collections, html as H
BASE='https://www.alessandrodesign.ro'
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
OUT=os.path.dirname(os.path.abspath(__file__))
paths=sys.argv[1:]
class NoRedir(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*a,**k): return None
op=urllib.request.build_opener(NoRedir)
log=open(os.path.join(OUT,'requests.log'),'a',encoding='utf-8')
for i,p in enumerate(paths):
    if i: time.sleep(2.5)
    req=urllib.request.Request(BASE+p,headers={'User-Agent':UA,'Accept-Language':'ro-RO,ro;q=0.9','Accept':'text/html,application/json;q=0.9,*/*;q=0.8'})
    t=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
    try:
        r=op.open(req,timeout=30); code=r.status; hdrs=dict(r.headers); body=r.read()
    except urllib.error.HTTPError as e:
        code=e.code; hdrs=dict(e.headers); body=e.read()
    name=re.sub(r'[^A-Za-z0-9]+','_',p).strip('_')
    open(os.path.join(OUT,name+'.body'),'wb').write(body)
    log.write(f"{t} {code} {p} loc={hdrs.get('Location')}\n"); log.flush()
    print('=====',t,code,p,'Location:',hdrs.get('Location'))
    txt=body.decode('utf-8','replace')
    if p.endswith('.json') or 'products.json' in p:
        try:
            d=json.loads(txt); prods=d['products']
            av=sum(1 for x in prods if any(v.get('available') for v in x['variants']))
            print('products',len(prods),'available',av)
            print('types',collections.Counter(x['product_type'] for x in prods).most_common(8))
            print('sample titles',[x['title'][:70] for x in prods[:6]])
            kw=collections.Counter()
            for x in prods:
                s=(x['title']+' '+' '.join(x.get('tags',[]))).lower()
                for k in ['industrial','metal','led','bec','e27','cristal','vintage','copac','arbore','dezaburire','instalat','craciun','exterior','ip44','ip65']:
                    if k in s: kw[k]+=1
            print('keywords in title+tags',dict(kw))
        except Exception as e: print('json err',e, txt[:200])
    else:
        flat=re.sub(r'\s+',' ',txt)
        m=re.search(r'<title>(.*?)</title>',flat); print('title:',H.unescape(m.group(1).strip()) if m else None)
        print('h1:',[H.unescape(re.sub('<[^>]+>','',x)).strip() for x in re.findall(r'<h1[^>]*>(.*?)</h1>',flat)][:3])
        m=re.search(r'<link rel="canonical" href="([^"]+)"',flat); print('canonical:',m.group(1) if m else None)
        for k in ['renovari','108bis','108 BIS','730.478','730478880','0723','723 029','725665925','Politica de utilizare cookie','Duminica','Sambata','14 zile']:
            for mm in list(re.finditer(re.escape(k),flat))[:3]:
                print('  ctx[%s]:'%k, re.sub('<[^>]+>',' ',flat[max(0,mm.start()-160):mm.end()+100]).strip()[:260])
