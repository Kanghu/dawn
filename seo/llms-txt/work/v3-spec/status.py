import subprocess, time, json, sys, re
sys.stdout.reconfigure(encoding='utf-8')
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
urls=[u.strip() for u in open(r'E:\SITES\Alessandro Design\dawn\seo\llms-txt\dwf-urls.txt',encoding='utf-8') if u.strip().startswith('https://www.alessandrodesign.ro')]
extra=['/pages/showroom','/pages/testimoniale','/collections/outlet','/pages/dropshipment','/pages/comenzi-engross','/policies/refund-policy','/policies/contact-information','/pages/formular-retur','/pages/idei-de-amenajare','/collections/lustre-cu-bec','/collections/iluminat-de-exterior','/collections/flori-decorative','/collections/all']
urls += ['https://www.alessandrodesign.ro'+p for p in extra]
out=[]
for u in urls:
    r=subprocess.run(['curl','-s','--compressed','-A',UA,'-H','Accept-Language: ro-RO,ro;q=0.9','-o','body.tmp','-w','%{http_code}\t%{redirect_url}\t%{content_type}',u],capture_output=True,text=True)
    code,loc,ct=(r.stdout.split('\t')+['',''])[:3]
    title=''
    try:
        b=open('body.tmp',encoding='utf-8',errors='replace').read()
        m=re.search(r'<title>(.*?)</title>',b,re.S)
        if m: title=' '.join(m.group(1).split())[:90]
    except Exception: pass
    rec=dict(url=u,code=code,location=loc,title=title)
    out.append(rec); print(code, u.replace('https://www.alessandrodesign.ro',''), '->', loc.replace('https://www.alessandrodesign.ro',''), '|', title, flush=True)
    if code=='429': print('429 hit, stopping'); break
    time.sleep(0.9)
json.dump(out,open('status-ro.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
