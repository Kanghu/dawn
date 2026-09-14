import json,sys,re,html
for fn in sys.argv[1:]:
    d=json.load(open(fn,encoding='utf-8'))
    print("="*100); print(fn, "|", d.get('title'), "| created", d.get('created_at'), "| posts_count", d.get('posts_count'), "| stream", len(d['post_stream'].get('stream',[])))
    for p in d['post_stream']['posts']:
        t=re.sub(r'<[^>]+>','',p['cooked']); t=html.unescape(t); t=re.sub(r'\n\s*\n+','\n',t).strip()
        print("-"*60); print("#%s %s (%s) %s staff=%s"%(p['post_number'],p['username'],p.get('user_title') or '',p['created_at'],p.get('staff') or p.get('moderator')))
        print(t[:2500])
