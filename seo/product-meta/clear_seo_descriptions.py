"""Clear the admin "SEO description" field on the products listed in the backup.

Why: since September 2026 the theme builds the product meta description itself
(snippets/alc-seo-head.liquid: "Cumpara acum [nume] de pe alessandrodesign.ro!
Pret de producator, 14 zile drept de retur gratuit.") and only lets an admin
SEO description override it. Of the 29 admin descriptions that existed, 23 were
the ZABINA lustre text copy-pasted onto other products and the rest were
700-1200 characters long, so all of them are cleared. The original values are
kept in seo-description-backup-2026-09-09.json next to this script.

Run from the theme root (needs `shopify store auth` for the store):

    python seo/product-meta/clear_seo_descriptions.py --dry-run
    python seo/product-meta/clear_seo_descriptions.py --limit 1   # one product first
    python seo/product-meta/clear_seo_descriptions.py

Every Shopify CLI call takes a few seconds; progress is printed before each one.
The mutation sends the SEO title back unchanged: productUpdate replaces the
whole `seo` object, so omitting `title` would wipe it.
"""
import argparse, json, os, subprocess, sys, tempfile, time

STORE = 'd8cgqq-8s.myshopify.com'
HERE = os.path.dirname(os.path.abspath(__file__))
BACKUP = os.path.join(HERE, 'seo-description-backup-2026-09-09.json')

READ = 'query($id: ID!) { product(id: $id) { id handle status seo { title description } } }'
CLEAR = '''mutation($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product { id handle seo { title description } }
    userErrors { field message }
  }
}'''


def shopify(query, variables, mutation=False):
    """Run one GraphQL operation through the Shopify CLI and return the data."""
    with tempfile.NamedTemporaryFile('w', suffix='.graphql', delete=False, encoding='utf-8') as q:
        q.write(query)
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as v:
        json.dump(variables, v)
    cmd = ['shopify', 'store', 'execute', '-s', STORE, '--json',
           '--query-file', q.name, '--variable-file', v.name]
    if mutation:
        cmd.append('--allow-mutations')
    t0 = time.time()
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, shell=True,
                           stdin=subprocess.DEVNULL, encoding='utf-8', errors='replace',
                           timeout=180)
    finally:
        os.unlink(q.name)
        os.unlink(v.name)
    out = r.stdout or ''
    start = out.find('{')
    if start < 0:
        raise RuntimeError('no JSON in CLI output after %.0fs (exit %s):\n%s\n%s' % (
            time.time() - t0, r.returncode, out[-1500:], (r.stderr or '')[-1500:]))
    data = json.loads(out[start:])
    if 'errors' in data and 'data' not in data:
        raise RuntimeError('GraphQL errors: %s' % json.dumps(data['errors'])[:1500])
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true', help='only report, change nothing')
    ap.add_argument('--limit', type=int, default=0, help='stop after N products (0 = all)')
    args = ap.parse_args()
    sys.stdout.reconfigure(line_buffering=True)

    entries = json.load(open(BACKUP, encoding='utf-8'))
    if args.limit:
        entries = entries[:args.limit]
    print('%d products to process from %s' % (len(entries), os.path.basename(BACKUP)))
    cleared = skipped = failed = 0
    for i, e in enumerate(entries, 1):
        print('[%d/%d] %s' % (i, len(entries), e['handle']))
        print('    reading current SEO fields ...')
        current = shopify(READ, {'id': e['id']})['product']
        if current is None:
            print('    ? product no longer exists'); skipped += 1; continue
        if not (current['seo']['description'] or '').strip():
            print('    - already empty'); skipped += 1; continue
        if args.dry_run:
            print('    * would clear %d chars (seo.title=%r)' % (
                len(current['seo']['description']), current['seo']['title']))
            continue
        print('    clearing (%d chars) ...' % len(current['seo']['description']))
        res = shopify(CLEAR, {'product': {
            'id': e['id'],
            'seo': {'title': current['seo']['title'], 'description': ''},
        }}, mutation=True)
        payload = res['productUpdate']
        if payload['userErrors']:
            print('    ! %s' % payload['userErrors']); failed += 1
        else:
            after = payload['product']['seo']
            print('    ok -> description=%r title=%r' % (after['description'], after['title']))
            cleared += 1
    print('\ncleared %d, skipped %d, failed %d' % (cleared, skipped, failed))
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
