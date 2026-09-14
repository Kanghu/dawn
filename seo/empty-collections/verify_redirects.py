"""Check that every row of redirecturi-301-homepage.csv redirects in ONE hop.

DWF's rule for deleted categories: 301, single hop, to the homepage. A row
passes when the old URL answers 301 with Location = the homepage of the same
domain and the homepage itself answers 200 (so there is no second hop).

Run from the theme root after importing the CSV in Shopify admin
(Content > Menus > URL redirects > Import):

    python seo/empty-collections/verify_redirects.py
    python seo/empty-collections/verify_redirects.py --host www.alessandrodesign.hu --limit 10

URL redirects are store-wide, so the same paths should also redirect on the
other market domains. Keep --limit low there: .hu answers 429 after ~30 requests.
Writes verificare-redirecturi-<host>-<date>.csv next to this script.
"""
import argparse, csv, os, subprocess, sys, tempfile, time

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/128.0 Safari/537.36')
HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, 'redirecturi-301-homepage.csv')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--host', default='www.alessandrodesign.ro')
    ap.add_argument('--limit', type=int, default=0, help='check only the first N rows (0 = all)')
    args = ap.parse_args()
    sys.stdout.reconfigure(line_buffering=True)

    fd, jar = tempfile.mkstemp(suffix='.cookies')
    os.close(fd)

    def hop(url):
        for attempt in range(3):
            r = subprocess.run(['curl', '-s', '-o', os.devnull, '-A', UA, '-c', jar, '-b', jar,
                                '--max-time', '30', '-w', '%{http_code}\t%{redirect_url}', url],
                               capture_output=True, text=True)
            code, location = (r.stdout.split('\t') + [''])[:2]
            time.sleep(1.2)
            if code != '429':
                return code, location
            time.sleep(10 * (attempt + 1))
        return code, location

    home = 'https://%s/' % args.host
    home_code, home_location = hop(home)
    print('homepage %s -> %s %s' % (home, home_code, home_location))

    paths = [row['Redirect from'] for row in csv.DictReader(open(SOURCE, encoding='utf-8-sig'))]
    if args.limit:
        paths = paths[:args.limit]
    report = os.path.join(HERE, 'verificare-redirecturi-%s-%s.csv' % (args.host, time.strftime('%Y-%m-%d')))
    ok = 0
    with open(report, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['url', 'status', 'location', 'status_homepage', 'un_singur_pas_catre_homepage'])
        for i, path in enumerate(paths, 1):
            url = 'https://%s%s' % (args.host, path)
            code, location = hop(url)
            good = code == '301' and location == home and home_code == '200'
            ok += good
            w.writerow([url, code, location, home_code, 'da' if good else 'NU'])
            if not good:
                print('  NU  %s -> %s %s' % (path, code, location))
            if i % 25 == 0:
                print('  %d/%d checked' % (i, len(paths)))
    print('\n%d/%d single-hop 301 to %s; report: %s' % (ok, len(paths), home, os.path.basename(report)))
    sys.exit(0 if ok == len(paths) else 1)


if __name__ == '__main__':
    main()
