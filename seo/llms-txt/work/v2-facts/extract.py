import sys, re, html
from html.parser import HTMLParser
class T(HTMLParser):
    def __init__(self):
        super().__init__(); self.out=[]; self.skip=0
    def handle_starttag(self, tag, attrs):
        if tag in ('script','style','noscript','svg','template'): self.skip+=1
        if tag in ('br','p','div','li','h1','h2','h3','h4','h5','h6','tr','section','footer','header','ul','table'): self.out.append('\n')
        if tag=='a':
            href=dict(attrs).get('href')
            if href and self.skip==0: self.out.append(' [%s] '%href)
    def handle_endtag(self, tag):
        if tag in ('script','style','noscript','svg','template'): self.skip=max(0,self.skip-1)
        if tag in ('p','div','li','h1','h2','h3','h4','h5','h6','tr'): self.out.append('\n')
    def handle_data(self, d):
        if self.skip==0: self.out.append(d)
for f in sys.argv[1:]:
    raw=open(f,encoding='utf-8',errors='replace').read()
    t=T(); t.feed(raw)
    txt=''.join(t.out)
    txt=re.sub(r'[ \t\r\xa0]+',' ',txt)
    txt=re.sub(r'\n\s*\n+','\n',txt)
    open(f.replace('.html','.txt'),'w',encoding='utf-8').write(txt)
    print(f, len(txt))
