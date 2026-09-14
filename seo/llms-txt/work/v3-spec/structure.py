import re, collections, sys, json
sys.stdout.reconfigure(encoding='utf-8')
p = r'E:\SITES\Alessandro Design\dawn\seo\llms-txt\dwf-llms.txt'
t = open(p, encoding='utf-8').read()
lines = t.split('\n')
link_re = re.compile(r'^-\s*\[([^\]]+)\]\(([^\)]+)\)(?::\s*(.*))?$')
sec = None; sub=None
secs = collections.OrderedDict()
links = []  # (line, h2, h3, title, url, note)
for i,l in enumerate(lines,1):
    if l.startswith('## '): sec=l[3:]; sub=None; secs[sec]={'start':i,'links':0,'prose':[],'bullets_nonlink':[],'h3':[]}; continue
    if l.startswith('### '): sub=l[4:]; secs[sec]['h3'].append((i,sub)); continue
    if sec is None: continue
    if not l.strip(): continue
    m = link_re.match(l)
    if m:
        secs[sec]['links']+=1; links.append((i,sec,sub,m.group(1),m.group(2),m.group(3)))
    elif l.startswith('- '):
        secs[sec]['bullets_nonlink'].append(i)
    else:
        secs[sec]['prose'].append(i)
print('total link lines', len(links), 'with notes', sum(1 for x in links if x[5]))
print('unique urls', len(set(x[4] for x in links)))
for k,v in secs.items():
    print(f"L{v['start']:>3} ## {k}: links={v['links']} prose_lines={v['prose']} nonlink_bullets={len(v['bullets_nonlink'])} {('L%d-%d'%(v['bullets_nonlink'][0],v['bullets_nonlink'][-1])) if v['bullets_nonlink'] else ''} h3={v['h3']}")
print()
by = collections.defaultdict(list)
for x in links: by[x[4]].append(x)
dups = {u:v for u,v in by.items() if len(v)>1}
print('URLs appearing >1:', len(dups), 'extra occurrences:', sum(len(v)-1 for v in dups.values()))
for u,v in sorted(dups.items(), key=lambda kv:(-len(kv[1]), kv[1][0][0])):
    print(len(v), u.replace('https://www.alessandrodesign.ro',''), ' | '.join(f"L{x[0]} [{x[1]}{' > '+x[2] if x[2] else ''}] '{x[3]}'" for x in v))
# same URL different anchor text
print()
for u,v in dups.items():
    names = set(x[3] for x in v)
    if len(names)>1: print('anchor variants', u.replace('https://www.alessandrodesign.ro',''), names)
# bare urls outside link syntax
for i,l in enumerate(lines,1):
    for m in re.finditer(r'(?<!\()https?://[^\s\)]+', l):
        print('bare url', i, m.group(0))
    if re.search(r'[\w.+-]+@[\w-]+\.\w+', l): print('email', i, l)
# reference parser emulation
def parse_link(txt):
    pat = r'-\s*\[(?P<title>[^\]]+)\]\((?P<url>[^\)]+)\)(?::\s*(?P<desc>.*))?'
    return re.search(pat, txt)
start,*rest = re.split(r'^##\s*(.*?$)', t, flags=re.MULTILINE)
d = dict(zip(rest[0::2], rest[1::2]))
print('\nreference-parser H2 split keys:', len(d))
fails = []
for k,v in d.items():
    for l in re.split(r'\n+', v.strip()):
        if l.strip() and parse_link(l) is None: fails.append((k,l[:60]))
print('reference parser: lines that would raise AttributeError:', len(fails))
for f in fails[:8]: print('  ', f)
print('H3 captured as section names by ^##\s*:', [k for k in d if k.startswith('#')])
json.dump([dict(line=x[0],h2=x[1],h3=x[2],title=x[3],url=x[4]) for x in links], open('dwf-links.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
