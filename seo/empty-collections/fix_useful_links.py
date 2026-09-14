"""Clean the "Link-uri utile" pills (collection metafield custom.useful_links).

Why: DWF asked (September 2026) that the deleted categories 301 to the homepage
in a single hop; redirecturi-301-homepage.csv next to this script is that
import. Nine categories still show a "Candelabre la comanda" pill pointing at
one of those deleted collections, so after the import the pill would drop
shoppers on the homepage. The same metafield also links to two other deleted
categories (iluminat-stradal, stalp-de-iluminat), sends 14 targets through old
redirects (/coloane-de-dus through two of them) and carries search-tracking
parameters (?_pos=1&_psq=...) on 62 links.

What it does, per collection (sections/main-collection-product-grid.liquid
renders the pills):
  - drops a link whose target is gone: 404, or a redirect that ends on the
    homepage (a deleted category once the import is done);
  - points every other link straight at the page it lands on today, without
    the query string, so no pill goes through a redirect;
  - drops a link that lands on the collection itself, and later duplicates;
  - keeps the pill text unchanged.
Targets that answer anything else (429, 5xx, a challenge page) are left as they
are and reported.

Run from the theme root (needs `shopify store auth` for the store):

    python seo/empty-collections/fix_useful_links.py --dry-run
    python seo/empty-collections/fix_useful_links.py --limit 1   # one collection first
    python seo/empty-collections/fix_useful_links.py

Every run saves the values it read to useful-links-backup-<timestamp>.json
before writing. metafieldsSet gets the compareDigest that was read, so a
collection edited in the admin in the meantime is skipped, not overwritten.
"""
import argparse, json, os, subprocess, sys, tempfile, time
from urllib.parse import urlsplit, urlunsplit

STORE = 'd8cgqq-8s.myshopify.com'
HOME = 'https://www.alessandrodesign.ro/'
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/128.0 Safari/537.36')
HERE = os.path.dirname(os.path.abspath(__file__))

READ = '''query($after: String) {
  collections(first: 100, after: $after) {
    nodes { id handle
      useful: metafield(namespace: "custom", key: "useful_links") { type value compareDigest } }
    pageInfo { hasNextPage endCursor }
  }
}'''
WRITE = '''mutation($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { value }
    userErrors { field message code }
  }
}'''


def temp_path(suffix):
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    return path


def shopify(query, variables, mutation=False):
    """Run one GraphQL operation through the Shopify CLI and return the data."""
    q, v, out = temp_path('.graphql'), temp_path('.json'), temp_path('.out.json')
    open(q, 'w', encoding='utf-8').write(query)
    json.dump(variables, open(v, 'w', encoding='utf-8'))
    cmd = ['shopify', 'store', 'execute', '-s', STORE, '--json',
           '--query-file', q, '--variable-file', v, '--output-file', out]
    if mutation:
        cmd.append('--allow-mutations')
    t0 = time.time()
    try:
        r = subprocess.run(cmd, shell=True, stdin=subprocess.DEVNULL, timeout=300)
        raw = open(out, encoding='utf-8', errors='replace').read() if os.path.exists(out) else ''
    finally:
        for p in (q, v, out):
            if os.path.exists(p):
                os.unlink(p)
    start = raw.find('{')
    if r.returncode != 0 or start < 0:
        raise RuntimeError('CLI exit %s after %.0fs, output file %s' % (
            r.returncode, time.time() - t0, 'empty' if start < 0 else 'present'))
    data = json.loads(raw[start:])
    if 'errors' in data and 'data' not in data:
        raise RuntimeError('GraphQL errors: %s' % json.dumps(data['errors'])[:1500])
    return data.get('data', data)


def bare(url):
    s = urlsplit(url.strip())
    return urlunsplit((s.scheme or 'https', s.netloc.lower(), s.path.rstrip('/') or '/', '', ''))


class Resolver:
    """Follow redirects one hop at a time with curl (the storefront sits behind
    Cloudflare: one request at a time, browser User-Agent, cookie jar)."""

    def __init__(self):
        self.jar = temp_path('.cookies')
        self.cache = {}

    def hop(self, url):
        for attempt in range(3):
            r = subprocess.run(['curl', '-s', '-o', os.devnull, '-A', UA, '-c', self.jar, '-b', self.jar,
                                '--max-time', '30', '-w', '%{http_code}\t%{redirect_url}', url],
                               capture_output=True, text=True)
            code, location = (r.stdout.split('\t') + [''])[:2]
            time.sleep(1.2)
            if code != '429':
                return code, location
            time.sleep(10 * (attempt + 1))
        return code, location

    def resolve(self, url):
        """Return (verdict, final_url, chain) with verdict ok | gone | unknown."""
        start = bare(url)
        if start in self.cache:
            return self.cache[start]
        chain, current = [], start
        for _ in range(5):
            code, location = self.hop(current)
            chain.append('%s %s' % (code, current))
            if code in ('301', '302', '307', '308') and location:
                current = bare(location)
                continue
            break
        if code == '200':
            result = ('gone', current, chain) if current == bare(HOME) else ('ok', current, chain)
        elif code in ('404', '410'):
            result = ('gone', current, chain)
        else:
            result = ('unknown', current, chain)
        self.cache[start] = result
        return result


def short(url):
    return url.replace('https://www.alessandrodesign.ro', '')


def plan(collection, links, resolver):
    own = bare('https://www.alessandrodesign.ro/collections/' + collection['handle'])
    new, seen, log = [], set(), []
    for link in links:
        verdict, final, chain = resolver.resolve(link['url'])
        label = link['text']
        if verdict == 'unknown':
            log.append('    ? keep  %-28s %s (%s)' % (label, short(link['url']), ' -> '.join(chain)))
            new.append(link)
            seen.add(bare(link['url']))
        elif verdict == 'gone':
            log.append('    - drop  %-28s %s (%s)' % (label, short(link['url']), ' -> '.join(chain)))
        elif final == own:
            log.append('    - drop  %-28s %s (lands on this collection)' % (label, short(link['url'])))
        elif final in seen:
            log.append('    - drop  %-28s %s (duplicate of %s)' % (label, short(link['url']), short(final)))
        else:
            seen.add(final)
            if link['url'] != final:
                log.append('    * fix   %-28s %s -> %s' % (label, short(link['url']), short(final)))
            new.append(dict(link, url=final))
    return new, log


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true', help='only report, change nothing')
    ap.add_argument('--limit', type=int, default=0, help='stop after writing N collections (0 = all)')
    args = ap.parse_args()
    sys.stdout.reconfigure(line_buffering=True, encoding='utf-8')

    print('reading collections ...')
    collections, after = [], None
    while True:
        page = shopify(READ, {'after': after})['collections']
        collections += [c for c in page['nodes'] if c['useful']]
        if not page['pageInfo']['hasNextPage']:
            break
        after = page['pageInfo']['endCursor']
    print('%d collections have custom.useful_links' % len(collections))

    if not args.dry_run:
        backup = os.path.join(HERE, 'useful-links-backup-%s.json' % time.strftime('%Y%m%d-%H%M%S'))
        json.dump([{'id': c['id'], 'handle': c['handle'], 'value': c['useful']['value']} for c in collections],
                  open(backup, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('current values saved to %s' % os.path.basename(backup))

    resolver = Resolver()
    written = unchanged = failed = 0
    for c in collections:
        links = json.loads(c['useful']['value'])
        new, log = plan(c, links, resolver)
        if new == links:
            unchanged += 1
            continue
        print('\n%s: %d -> %d links' % (c['handle'], len(links), len(new)))
        print('\n'.join(log))
        if args.dry_run:
            continue
        if not new:
            print('    ! nothing left, not writing an empty list'); failed += 1; continue
        try:
            res = shopify(WRITE, {'metafields': [{
                'ownerId': c['id'], 'namespace': 'custom', 'key': 'useful_links',
                'type': c['useful']['type'], 'value': json.dumps(new, ensure_ascii=False),
                'compareDigest': c['useful']['compareDigest'],
            }]}, mutation=True)['metafieldsSet']
        except RuntimeError as e:
            # e.g. ACCESS_DENIED: the stored CLI token needs write_products
            print('    ! write failed (%s); stopping, this and the remaining collections were not written' % e)
            failed += 1
            break
        if res['userErrors']:
            print('    ! %s' % res['userErrors']); failed += 1
        elif json.loads(res['metafields'][0]['value']) == new:
            print('    ok'); written += 1
        else:
            print('    ! saved value differs from what was sent'); failed += 1
        if args.limit and written >= args.limit:
            break
    verb = 'would change' if args.dry_run else 'written'
    print('\n%s: %d, unchanged: %d, failed: %d' % (
        verb, len(collections) - unchanged - failed if args.dry_run else written, unchanged, failed))
    unknown = [start for start, (verdict, _, _) in resolver.cache.items() if verdict == 'unknown']
    if unknown:
        print('! %d targets could not be checked and were left as they are: %s' % (
            len(unknown), ', '.join(short(u) for u in unknown)))
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
