"""Swap the hero markup in the campaign Custom Liquid for {% render 'alc-hp-banner' %}.

Edits the raw JSON text in place (only the escaped custom_liquid string changes), so the
theme editor's formatting stays byte-identical. Usage: python hero_template_patch.py <template.json>...
"""
import json, sys

RENDER = """{%- render 'alc-hp-banner',
  desktop_filename: desktop_filename,
  mobile_filename: mobile_filename,
  url: target_url,
  alt: ALT
-%}"""

def patch(path):
    raw = open(path, encoding='utf-8', newline='').read()
    data = json.loads(raw[raw.index('{'):])
    hits = [(k, s) for k, s in data['sections'].items() if 'hp-banner' in (s.get('settings') or {}).get('custom_liquid', '')]
    if not hits:
        return f'{path}: no hp-banner section'
    for key, section in hits:
        old = section['settings']['custom_liquid']
        if "render 'alc-hp-banner'" in old:
            return f'{path}: already patched'
        start = old.index('{%- assign desktop_img')
        end = old.index('</style>') + len('</style>')
        t0 = old.index('{%- assign target_url')
        t1 = old.index('-%}', t0) + 3
        alt = old.split('alt="', 1)[1].split('"', 1)[0]
        new = old[:start] + old[t0:t1] + '\n\n' + RENDER.replace('ALT', json.dumps(alt).replace('"', "'")) + old[end:]
        esc_old, esc_new = json.dumps(old, ensure_ascii=False)[1:-1], json.dumps(new, ensure_ascii=False)[1:-1]
        assert raw.count(esc_old) == 1, f'{path}: escaped liquid found {raw.count(esc_old)}x'
        raw = raw.replace(esc_old, esc_new)
        check = json.loads(raw[raw.index('{'):])
        assert check['sections'][key]['settings']['custom_liquid'] == new
    open(path, 'w', encoding='utf-8', newline='').write(raw)
    return f'{path}: patched {[k for k, _ in hits]}\n---\n{new}'

for p in sys.argv[1:]:
    print(patch(p))
