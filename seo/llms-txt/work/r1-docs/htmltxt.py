import re,html,sys
for fn in sys.argv[1:]:
    s=open(fn,encoding='utf-8').read()
    m=re.search(r'<main.*?</main>',s,re.S)
    t=m.group(0) if m else s
    t=re.sub(r'<script.*?</script>|<style.*?</style>|<svg.*?</svg>','',t,flags=re.S)
    t=re.sub(r'<(h[1-6])[^>]*>',r'\n\n## ',t)
    t=re.sub(r'<(li)[^>]*>',r'\n- ',t)
    t=re.sub(r'<(p|tr|br|div|pre)[^>]*>',r'\n',t)
    t=re.sub(r'<td[^>]*>',' | ',t)
    t=re.sub(r'<[^>]+>','',t)
    t=html.unescape(t)
    t=re.sub(r'[ \t]+\n','\n',t)
    t=re.sub(r'\n\s*\n+','\n\n',t)
    open(fn.rsplit('.',1)[0]+'.txt','w',encoding='utf-8').write(t)
    print(fn,len(t))
