import subprocess, time, json, sys, re
sys.stdout.reconfigure(encoding='utf-8')
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
st=json.load(open('status-ro.json',encoding='utf-8'))
handles=[]
for r in st:
    p=r['url'].replace('https://www.alessandrodesign.ro','')
    if p.startswith('/collections/') and r['code']=='200': handles.append(p.split('/')[2])
live=['oglinzi-baie-cu-led-si-dezaburire','oglinzi-led-simple','lustre-cu-bec','plafoniere-led-1','lustre-metalice','aplice-de-interior','aplice-de-baie','lustre-camera-copiilor','iluminat-de-exterior','proiectoare-de-exterior','instalatii','aplice-de-exterior','baterii-coloane-de-dus','baterii-de-bucatarie','baterii-de-baie','uscatoare-de-maini','cazi-de-baie-freestanding','chiuvete-lavoare','cadite-de-dus','para-de-dus','dus-walk-in','calorifel-electric','copac-artificial','panou-artificial','tufa-artificiala','brad-de-craciun','tablou-sticla','tablou-led','ingrijire-dentara','gen%C8%9Bi-%C8%99i-rucsacuri']
for h in live:
    if h not in handles: handles.append(h)
out={}
for h in handles:
    u=f'https://www.alessandrodesign.ro/collections/{h}/products.json?limit=250&fields=id'
    r=subprocess.run(['curl','-s','--compressed','-A',UA,'-w','\n%{http_code}',u],capture_output=True,text=True,encoding='utf-8')
    body,_,code=r.stdout.rpartition('\n')
    try: n=len(json.loads(body)['products'])
    except Exception: n=None
    out[h]=(code,n); print(code, n, h, flush=True)
    if code=='429': break
    time.sleep(0.8)
json.dump(out,open('counts-ro.json','w'),indent=1)
