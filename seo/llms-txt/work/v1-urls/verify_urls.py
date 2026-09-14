#!/usr/bin/env python3
"""Verify every URL in the DWF llms.txt (seo/llms-txt/dwf-urls.txt).

READ-ONLY. One HTTP connection at a time, 0.6-0.8 s sleep before every request.

Phases (all resumable, re-run safely):
  python verify_urls.py refs     -> refs/ : sitemap.xml, sitemap children, homepage, collections.json
  python verify_urls.py crawl    -> results.jsonl (one line per URL; URLs already present are skipped)
  python verify_urls.py suggest  -> suggestions.jsonl (fetches each SUGGEST_MAP target + EXTRA_CHECK)
  python verify_urls.py report   -> results.json + results.csv (automatic flags + fuzzy candidates; no network)
  python verify_urls.py final    -> final.json (reviewed issues + suggested_url; no network)
  python verify_urls.py all      -> refs + crawl + suggest + report + final
"""
import gzip
import html
import io
import json
import random
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
LLMS_DIR = HERE.parent.parent  # seo/llms-txt
URLS_FILE = LLMS_DIR / "dwf-urls.txt"
LLMS_FILE = LLMS_DIR / "dwf-llms.txt"
ROBOTS_FILE = LLMS_DIR / "live" / "robots.ro.txt"
OUT_JSONL = HERE / "results.jsonl"
REFS = HERE / "refs"
BASE = "https://www.alessandrodesign.ro"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36")
HEADERS_HTML = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate",
}
HEADERS_JSON = dict(HEADERS_HTML, Accept="application/json")

MIN_SLEEP, MAX_SLEEP = 0.65, 0.8
_last_request = [0.0]
LOG = []


def log(*a):
    msg = " ".join(str(x) for x in a)
    print(msg, flush=True)


# --------------------------------------------------------------------------- HTTP
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPENER = urllib.request.build_opener(NoRedirect())


def _pace():
    wait = random.uniform(MIN_SLEEP, MAX_SLEEP) - (time.time() - _last_request[0])
    if wait > 0:
        time.sleep(wait)


def fetch(url, headers=None, max_body=12_000_000):
    """Single GET, no redirect following. Returns dict(status, headers, body(bytes), error)."""
    headers = headers or HEADERS_HTML
    for attempt in range(5):
        _pace()
        _last_request[0] = time.time()
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            resp = OPENER.open(req, timeout=40)
            status, hdrs, raw = resp.status, resp.headers, resp.read(max_body)
        except urllib.error.HTTPError as e:
            status, hdrs = e.code, e.headers
            try:
                raw = e.read(max_body)
            except Exception:
                raw = b""
        except Exception as e:  # network error
            if attempt < 4:
                log(f"   ! network error {e!r}, retry in {5 * (attempt + 1)} s")
                time.sleep(5 * (attempt + 1))
                continue
            return {"status": 0, "headers": {}, "body": b"", "error": repr(e)}
        _last_request[0] = time.time()
        enc = (hdrs.get("Content-Encoding") or "").lower()
        try:
            if enc == "gzip":
                raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
            elif enc == "deflate":
                raw = zlib.decompress(raw)
        except Exception:
            pass
        if status == 429 and attempt < 4:
            delay = 20 * (attempt + 1)
            log(f"   ! 429 on {url}, sleeping {delay} s")
            time.sleep(delay)
            continue
        return {"status": status, "headers": {k.lower(): v for k, v in hdrs.items()},
                "body": raw, "error": None}
    return {"status": 429, "headers": {}, "body": b"", "error": "429 after retries"}


def text_of(r):
    ct = r["headers"].get("content-type", "")
    m = re.search(r"charset=([\w-]+)", ct)
    enc = m.group(1) if m else "utf-8"
    try:
        return r["body"].decode(enc, errors="replace")
    except LookupError:
        return r["body"].decode("utf-8", errors="replace")


# --------------------------------------------------------------------------- parsing helpers
def extract_title(doc):
    m = re.search(r"<title[^>]*>(.*?)</title>", doc, re.S | re.I)
    return re.sub(r"\s+", " ", html.unescape(m.group(1))).strip() if m else None


def extract_canonical(doc):
    for tag in re.findall(r"<link\b[^>]*>", doc, re.I):
        if re.search(r"""rel\s*=\s*["']?canonical["'\s>]""", tag, re.I):
            m = re.search(r"""href\s*=\s*["']([^"']+)["']""", tag, re.I)
            if m:
                return html.unescape(m.group(1)).strip()
    return None


def extract_h1(doc):
    m = re.search(r"<h1\b[^>]*>(.*?)</h1>", doc, re.S | re.I)
    if not m:
        return None
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", m.group(1)))).strip() or None


def extract_meta_robots(doc):
    for tag in re.findall(r"<meta\b[^>]*>", doc, re.I):
        if re.search(r"""name\s*=\s*["']robots["']""", tag, re.I):
            m = re.search(r"""content\s*=\s*["']([^"']*)["']""", tag, re.I)
            return m.group(1) if m else ""
    return None


def page_type(r):
    st = r["headers"].get("server-timing", "")
    m = re.search(r'pageType;desc="([^"]+)"', st)
    return m.group(1) if m else None


def norm_url(u):
    if not u:
        return u
    p = urllib.parse.urlsplit(urllib.parse.urljoin(BASE + "/", u))
    path = p.path or "/"
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")
    return urllib.parse.urlunsplit((p.scheme.lower(), p.netloc.lower(), urllib.parse.unquote(path), p.query, ""))


# --------------------------------------------------------------------------- robots.txt
def load_robots_group(agent="*"):
    raw = ROBOTS_FILE.read_bytes().decode("utf-8", errors="replace")
    lines = re.split(r"\r\n|\r|\n", raw)
    groups, cur, in_agents = [], None, False
    for line in lines:
        line = line.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        key, val = [x.strip() for x in line.split(":", 1)]
        key = key.lower()
        if key == "user-agent":
            if not in_agents:
                cur = {"agents": [], "rules": []}
                groups.append(cur)
            cur["agents"].append(val.lower())
            in_agents = True
        elif key in ("allow", "disallow") and cur is not None:
            in_agents = False
            if val:
                cur["rules"].append((key, val))
        else:
            in_agents = False
    for g in groups:
        if agent in g["agents"]:
            return g["rules"]
    return []


def _rule_regex(pat):
    anchored = pat.endswith("$")
    if anchored:
        pat = pat[:-1]
    rx = "".join(".*" if ch == "*" else re.escape(ch) for ch in pat)
    return re.compile("^" + rx + ("$" if anchored else ""))


def robots_check(url, rules):
    p = urllib.parse.urlsplit(url)
    target = (p.path or "/") + (("?" + p.query) if p.query else "")
    best = None  # (len, allow?, rule)
    for kind, pat in rules:
        if _rule_regex(pat).match(target):
            cand = (len(pat), kind == "allow", f"{kind.capitalize()}: {pat}")
            if best is None or cand[:2] > best[:2]:
                best = cand
    if best is None:
        return False, None
    return (not best[1]), best[2]


# --------------------------------------------------------------------------- labels from llms.txt
def load_labels():
    text = LLMS_FILE.read_text(encoding="utf-8")
    occ = {}
    lines = text.splitlines()
    section = None
    for i, line in enumerate(lines, 1):
        if line.startswith("#"):
            section = line.lstrip("#").strip()
        for label, url in re.findall(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", line):
            d = occ.setdefault(url, {"labels": [], "count": 0, "lines": [], "sections": []})
            d["count"] += 1
            d["lines"].append(i)
            if label not in d["labels"]:
                d["labels"].append(label)
            if section not in d["sections"]:
                d["sections"].append(section)
        # bare URLs (e.g. "Website: https://...")
        for url in re.findall(r"(?<!\()(https?://[^\s)\]]+)", line):
            if f"]({url})" in line:
                continue
            d = occ.setdefault(url, {"labels": [], "count": 0, "lines": [], "sections": []})
            d["count"] += 1
            d["lines"].append(i)
            if section not in d["sections"]:
                d["sections"].append(section)
    return occ


# --------------------------------------------------------------------------- refs phase
def refs_phase():
    REFS.mkdir(exist_ok=True)

    def get_cached(name, url, headers=None):
        path = REFS / name
        meta = REFS / (name + ".meta.json")
        if path.exists() and meta.exists():
            return path.read_text(encoding="utf-8"), json.loads(meta.read_text(encoding="utf-8"))
        log(f"refs GET {url}")
        r = fetch(url, headers)
        t = text_of(r)
        path.write_text(t, encoding="utf-8")
        m = {"url": url, "status": r["status"], "location": r["headers"].get("location"),
             "content_type": r["headers"].get("content-type"), "fetched": time.strftime("%Y-%m-%d %H:%M:%S %z")}
        meta.write_text(json.dumps(m, indent=1), encoding="utf-8")
        return t, m

    idx, _ = get_cached("sitemap.xml", BASE + "/sitemap.xml")
    for loc in re.findall(r"<loc>([^<]+)</loc>", idx):
        loc = html.unescape(loc)
        kind = re.search(r"sitemap_(\w+?)_\d+\.xml", loc)
        if kind and kind.group(1) in ("collections", "pages", "blogs"):
            name = re.sub(r"[^\w.]+", "_", urllib.parse.urlsplit(loc).path.strip("/") + "_" +
                          urllib.parse.urlsplit(loc).query)[:120] + ".xml"
            get_cached(name, loc)
    get_cached("homepage.html", BASE + "/")
    # all published collections with titles
    page = 1
    while True:
        t, m = get_cached(f"collections_p{page}.json", f"{BASE}/collections.json?limit=250&page={page}", HEADERS_JSON)
        try:
            n = len(json.loads(t).get("collections", []))
        except Exception:
            n = 0
        if n < 250 or page >= 4:
            break
        page += 1


def load_refs():
    refs = {"sitemap_collections": set(), "sitemap_pages": set(), "sitemap_blogs": set(),
            "menu": [], "collections": {}}
    if not REFS.exists():
        return refs
    for f in REFS.glob("sitemap_*.xml"):
        t = f.read_text(encoding="utf-8")
        for loc in re.findall(r"<loc>([^<]+)</loc>", t):
            u = norm_url(html.unescape(loc))
            path = urllib.parse.urlsplit(u).path
            if path.startswith("/collections/"):
                refs["sitemap_collections"].add(path.split("/")[2])
            elif path.startswith("/pages/"):
                refs["sitemap_pages"].add(path.split("/")[2])
            elif path.startswith("/blogs/"):
                refs["sitemap_blogs"].add("/".join(path.split("/")[:4]))
    hp = REFS / "homepage.html"
    if hp.exists():
        doc = hp.read_text(encoding="utf-8")
        seen = set()
        for m in re.finditer(r"<a\b([^>]*)>(.*?)</a>", doc, re.S | re.I):
            attrs, inner = m.group(1), m.group(2)
            hm = re.search(r"""href\s*=\s*["']([^"']+)["']""", attrs)
            if not hm:
                continue
            href = html.unescape(hm.group(1))
            if not re.match(r"^(https://www\.alessandrodesign\.ro)?/(collections|pages|blogs)/", href):
                continue
            label = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", inner))).strip()
            idm = re.search(r"""id\s*=\s*["']([^"']+)["']""", attrs)
            key = (norm_url(href), label)
            if key in seen:
                continue
            seen.add(key)
            refs["menu"].append({"href": norm_url(href), "label": label,
                                 "id": idm.group(1) if idm else None})
    for f in sorted(REFS.glob("collections_p*.json")):
        try:
            for c in json.loads(f.read_text(encoding="utf-8")).get("collections", []):
                refs["collections"][c["handle"]] = {"title": c.get("title"),
                                                    "products_count": c.get("products_count")}
        except Exception:
            pass
    return refs


# --------------------------------------------------------------------------- crawl phase
def crawl_one(url, rules, labels):
    rec = {"url": url, "checked_at": time.strftime("%Y-%m-%d %H:%M:%S %z")}
    lab = labels.get(url, {"labels": [], "count": 0, "lines": [], "sections": []})
    rec["labels"] = lab["labels"]
    rec["occurrences_in_file"] = lab["count"]
    rec["lines_in_file"] = lab["lines"]
    rec["sections"] = lab["sections"]
    host = urllib.parse.urlsplit(url).netloc
    rec["location"] = "help center" if host.startswith("help.") else urllib.parse.urlsplit(url).path.split("/")[1] or "home"
    blocked, rule = robots_check(url, rules) if host == "www.alessandrodesign.ro" else (False, None)
    rec["blocked_by_robots"], rec["robots_rule"] = blocked, rule

    log(f"GET {url}")
    r = fetch(url)
    rec["status"] = r["status"]
    rec["first_location"] = r["headers"].get("location")
    rec["first_page_type"] = page_type(r)
    rec["error"] = r["error"]
    chain = [{"url": url, "status": r["status"], "location": r["headers"].get("location")}]
    cur, cur_r = url, r
    hops = 0
    while cur_r["status"] in (301, 302, 303, 307, 308) and cur_r["headers"].get("location") and hops < 10:
        nxt = urllib.parse.urljoin(cur, cur_r["headers"]["location"])
        log(f"   -> {cur_r['status']} {nxt}")
        cur, cur_r = nxt, fetch(nxt)
        hops += 1
        chain.append({"url": cur, "status": cur_r["status"], "location": cur_r["headers"].get("location")})
    rec["redirect_chain"] = chain
    rec["final_url"], rec["final_status"] = cur, cur_r["status"]
    rec["final_page_type"] = page_type(cur_r)
    ct = cur_r["headers"].get("content-type", "")
    rec["content_type"] = ct

    if host.startswith("help."):
        doc = text_of(cur_r) if "html" in ct else ""
        rec["page_title"] = extract_title(doc) if doc else None
        return rec

    if cur_r["status"] == 200 and "html" in ct:
        doc = text_of(cur_r)
        rec["page_title"] = extract_title(doc)
        rec["canonical"] = extract_canonical(doc)
        rec["h1"] = extract_h1(doc)
        rec["meta_robots"] = extract_meta_robots(doc)
        fpath = urllib.parse.urlsplit(cur).path
        if fpath.startswith("/blogs/"):
            bhandle = fpath.split("/")[2]
            arts = set(re.findall(r"""href=["'](?:https://www\.alessandrodesign\.ro)?/blogs/%s/([^"'?#/]+)["']""" % re.escape(bhandle), doc))
            arts.discard("tagged")
            rec["blog_article_links"] = len(arts)
            rec["blog_article_sample"] = sorted(arts)[:5]
    else:
        rec["page_title"] = None
        rec["canonical"] = None
        if cur_r["status"] in (404, 410) and "html" in ct:
            rec["page_title"] = extract_title(text_of(cur_r))

    # collections: count products the storefront exposes
    path = urllib.parse.urlsplit(url).path
    if path.startswith("/collections/"):
        handle = path.split("/")[2]
        fpath = urllib.parse.urlsplit(rec["final_url"]).path
        target_handle = handle
        if rec["final_status"] == 200 and fpath.startswith("/collections/"):
            target_handle = fpath.split("/")[2]
        if rec["final_status"] == 200 and fpath.startswith("/collections/"):
            total, avail, pages = 0, 0, []
            for page in (1, 2, 3):
                pj = f"{BASE}/collections/{target_handle}/products.json?limit=250&page={page}"
                log(f"   products.json page {page}")
                jr = fetch(pj, HEADERS_JSON)
                pages.append({"page": page, "status": jr["status"]})
                if jr["status"] != 200:
                    break
                try:
                    prods = json.loads(text_of(jr)).get("products", [])
                except Exception as e:
                    pages[-1]["error"] = repr(e)
                    break
                total += len(prods)
                avail += sum(1 for p in prods if any(v.get("available") for v in p.get("variants", [])))
                pages[-1]["n"] = len(prods)
                if len(prods) < 250:
                    break
            rec["products_json_handle"] = target_handle
            rec["products_json_pages"] = pages
            rec["product_count"] = total
            rec["product_count_capped"] = total >= 750
            rec["available_count"] = avail
        else:
            rec["product_count"] = None
    return rec


def crawl_phase():
    rules = load_robots_group("*")
    labels = load_labels()
    urls = [u.strip() for u in URLS_FILE.read_text(encoding="utf-8").splitlines() if u.strip()]
    done = set()
    if OUT_JSONL.exists():
        for line in OUT_JSONL.read_text(encoding="utf-8").splitlines():
            try:
                rec = json.loads(line)
                if rec.get("status") not in (0, 429):
                    done.add(rec["url"])
            except Exception:
                pass
    todo = [u for u in urls if u not in done]
    log(f"{len(urls)} URLs, {len(done)} done, {len(todo)} to do")
    for u in todo:
        rec = crawl_one(u, rules, labels)
        with OUT_JSONL.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
        log(f"   = {rec['status']} -> {rec['final_status']} | {rec.get('page_title')} | products={rec.get('product_count')}")


# --------------------------------------------------------------------------- suggest phase
# Manual old->new mapping, decided from the live homepage menu (HeaderDrawer-* ids + labels),
# /collections.json titles and sitemap_collections / sitemap_pages (refs/), 2026-09-14.
SUGGEST_MAP = {
    "/collections/aplice-baie": "/collections/aplice-de-baie",
    "/collections/aplice-exterior": "/collections/aplice-de-exterior",
    "/collections/aplice-interior": "/collections/aplice-de-interior",
    "/collections/baterii-baie": "/collections/baterii-de-baie",
    "/collections/baterii-bucatarie": "/collections/baterii-de-bucatarie",
    "/collections/brazi-craciun": "/collections/brad-de-craciun",
    "/collections/cadite-dus": "/collections/cadite-de-dus",
    "/collections/calorifer-electric": "/collections/calorifel-electric",
    "/collections/cazi-baie-freestanding": "/collections/cazi-de-baie-freestanding",
    "/collections/chiuvete": "/collections/chiuvete-lavoare",
    "/collections/coloane-baterii-dus": "/collections/baterii-coloane-de-dus",
    "/collections/copaci-artificiali": "/collections/copac-artificial",
    "/collections/iluminat-exterior": "/collections/iluminat-de-exterior",
    "/collections/instalatii-exterior": "/collections/instalatii",
    "/collections/lustre": "/collections/lustre-cu-bec",
    "/collections/lustre-camera-copii": "/collections/lustre-camera-copiilor",
    "/collections/lustre-industriale": "/collections/lustre-metalice",
    "/collections/oglinzi-led-multifunctionale": "/collections/oglinzi-baie-cu-led-si-dezaburire",
    "/collections/oglinzi-led-standard": "/collections/oglinzi-led-simple",
    "/collections/panouri-artificiale": "/collections/panou-artificial",
    "/collections/para-dus": "/collections/para-de-dus",
    "/collections/paravane-dus-walk-in": "/collections/dus-walk-in",
    "/collections/plafoniere-led": "/collections/plafoniere-led-1",
    "/collections/proiectoare-exterior": "/collections/proiectoare-de-exterior",
    "/collections/tablouri-led": "/collections/tablou-led",
    "/collections/tablouri-sticla": "/collections/tablou-sticla",
    "/collections/tufe-artificiale": "/collections/tufa-artificiala",
    "/collections/uscatoare-maini": "/collections/uscatoare-de-maini",
    "/blogs/idei-de-amenajare": "/pages/idei-de-amenajare",
    "/pages/colaborari": "/pages/colaborari-marketing",
    "/pages/comenzi-en-gross": "/pages/comenzi-engross",
    "/pages/dropshipping": "/pages/dropshipment",
    "/policies/cookie-policy": "/policies/privacy-policy",
}
# extra URLs worth checking as alternatives (not suggestions by themselves)
EXTRA_CHECK = ["/blogs/sfaturi-de-amenajare", "/pages/livrare"]
OUT_SUGG = HERE / "suggestions.jsonl"


def suggest_phase():
    rules = load_robots_group("*")
    targets = list(dict.fromkeys(list(SUGGEST_MAP.values()) + EXTRA_CHECK))
    done = set()
    if OUT_SUGG.exists():
        for line in OUT_SUGG.read_text(encoding="utf-8").splitlines():
            rec = json.loads(line)
            if rec.get("status") not in (0, 429):
                done.add(rec["url"])
    for p in targets:
        u = BASE + p
        if u in done:
            continue
        rec = crawl_one(u, rules, {})
        with OUT_SUGG.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
        log(f"   = {rec['status']} -> {rec['final_status']} | {rec.get('page_title')} | products={rec.get('product_count')} avail={rec.get('available_count')}")


# --------------------------------------------------------------------------- report phase
STOP = {"de", "din", "pentru", "si", "cu", "la", "by", "a", "al", "ale", "in", "pe", "the", "|", "-",
        "alessandro", "design", "alessandrodesign", "ro", "alessandrodesign.ro"}


def fold(s):
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(ch for ch in s if not unicodedata.combining(ch)).lower()


def toks(s):
    return [t for t in re.findall(r"[a-z0-9]+", fold(s)) if t not in STOP]


def tok_match(a, b):
    n = min(len(a), len(b), 6)
    if n < 3:
        return a == b
    return a[:max(n - 1, 3)] == b[:max(n - 1, 3)]


def overlap(label, title):
    lt, tt = toks(label), toks(title)
    if not lt:
        return 1.0
    return sum(1 for a in lt if any(tok_match(a, b) for b in tt)) / len(lt)


def best_candidates(label, handle, refs, n=5, kind="collections"):
    q = toks(label) + toks(handle.replace("-", " "))
    q = list(dict.fromkeys(q))
    scored = []
    pool = {}
    if kind == "collections":
        for h, c in refs["collections"].items():
            pool[h] = c.get("title") or h
        for h in refs["sitemap_collections"]:
            pool.setdefault(h, h)
    else:  # pages + blogs, keyed by path
        for h in refs["sitemap_pages"]:
            pool["/pages/" + h] = h
        for b in {"/".join(x.split("/")[:3]) for x in refs["sitemap_blogs"]}:
            pool[b] = b.split("/")[2]
        for m in refs["menu"]:
            p = urllib.parse.urlsplit(m["href"]).path
            if p.startswith(("/pages/", "/blogs/")):
                pool[p] = (pool.get(p, "") + " " + m["label"]).strip()
    for h, title in pool.items():
        cand = toks(title) + toks(h.replace("-", " "))
        if not cand:
            continue
        hit = sum(1 for a in q if any(tok_match(a, b) for b in cand))
        prec = sum(1 for b in set(cand) if any(tok_match(a, b) for a in q)) / len(set(cand))
        score = hit / max(len(q), 1) + 0.5 * prec
        if hit:
            scored.append((round(score, 3), h, title, refs["collections"].get(h, {}).get("products_count")))
    scored.sort(reverse=True)
    return scored[:n]


def report_phase():
    refs = load_refs()
    recs = {}
    for line in OUT_JSONL.read_text(encoding="utf-8").splitlines():
        rec = json.loads(line)
        recs[rec["url"]] = rec  # last write wins
    urls = [u.strip() for u in URLS_FILE.read_text(encoding="utf-8").splitlines() if u.strip()]
    menu_by_href = {}
    for m in refs["menu"]:
        menu_by_href.setdefault(m["href"], []).append(m["label"])
    out = []
    for u in urls:
        rec = recs.get(u)
        if not rec:
            out.append({"url": u, "status": 0, "issue": "not crawled"})
            continue
        issues = []
        st, fst = rec["status"], rec["final_status"]
        label = rec["labels"][0] if rec["labels"] else ""
        path = urllib.parse.urlsplit(u).path
        handle = path.split("/")[2] if path.count("/") >= 2 and path.startswith(("/collections/", "/pages/", "/blogs/")) else ""
        if st in (301, 302, 303, 307, 308):
            issues.append(f"first hop {st} -> {rec.get('first_location')} (final {fst} {rec['final_url']})")
        elif st != 200:
            issues.append(f"HTTP {st}" + (f" (final {fst})" if fst != st else ""))
        if rec.get("blocked_by_robots"):
            issues.append(f"blocked by robots.txt User-agent: * ({rec.get('robots_rule')})")
        if fst == 200 and rec.get("canonical"):
            if norm_url(rec["canonical"]) != norm_url(rec["final_url"]):
                issues.append(f"canonical {rec['canonical']} != final URL {rec['final_url']}")
            elif norm_url(rec["canonical"]) != norm_url(u):
                issues.append(f"canonical {rec['canonical']} != listed URL")
        pc = rec.get("product_count")
        if path.startswith("/collections/") and fst == 200:
            if pc == 0:
                issues.append("empty collection (products.json returns 0 products)")
            elif pc is not None and rec.get("available_count") == 0:
                issues.append(f"all {pc} products out of stock (0 available)")
        if path.startswith("/blogs/") and fst == 200 and rec.get("blog_article_links", 0) == 0:
            issues.append("blog lists no articles")
        title_ok = None
        if fst == 200 and rec.get("page_title") and label and not u.startswith("https://help."):
            ov = max(overlap(label, rec.get("page_title") or ""), overlap(label, rec.get("h1") or ""))
            title_ok = round(ov, 2)
            if ov < 0.5:
                issues.append(f"label '{label}' vs title '{rec['page_title']}' (h1 '{rec.get('h1')}') low match {ov:.2f}")
        # suggestions
        suggested = None
        cands = []
        if path.startswith("/collections/"):
            if st in (301, 302, 303, 307, 308) and fst == 200:
                suggested = norm_url(rec["final_url"])
            if fst != 200 or (title_ok is not None and title_ok < 0.5) or st != 200:
                cands = best_candidates(label, handle, refs)
                if suggested is None and cands:
                    suggested = f"{BASE}/collections/{cands[0][1]}"
        elif st in (301, 302, 303, 307, 308) and fst == 200:
            suggested = norm_url(rec["final_url"])
        elif path.startswith(("/pages/", "/blogs/")) and fst != 200:
            cands = best_candidates(label, handle, refs, kind="pages")
            if cands:
                c0 = cands[0][1]
                suggested = BASE + c0 if c0.startswith("/") else f"{BASE}/collections/{c0}"
        in_sitemap = None
        if path.startswith("/collections/"):
            in_sitemap = handle in refs["sitemap_collections"]
        elif path.startswith("/pages/"):
            in_sitemap = handle in refs["sitemap_pages"]
        elif path.startswith("/blogs/"):
            in_sitemap = any(b.startswith(f"/blogs/{handle}/") for b in refs["sitemap_blogs"]) or None
        out.append({
            "url": u,
            "location": rec.get("location"),
            "label_in_file": " / ".join(rec["labels"]) if rec["labels"] else "",
            "occurrences_in_file": rec["occurrences_in_file"],
            "lines_in_file": rec["lines_in_file"],
            "status": st,
            "first_location": rec.get("first_location"),
            "final_url": rec["final_url"],
            "final_status": fst,
            "page_title": rec.get("page_title"),
            "h1": rec.get("h1"),
            "canonical": rec.get("canonical"),
            "meta_robots": rec.get("meta_robots"),
            "page_type": rec.get("final_page_type"),
            "product_count": pc,
            "product_count_capped": rec.get("product_count_capped"),
            "available_count": rec.get("available_count"),
            "blog_article_links": rec.get("blog_article_links"),
            "blocked_by_robots": rec.get("blocked_by_robots"),
            "robots_rule": rec.get("robots_rule"),
            "in_sitemap": in_sitemap,
            "in_homepage_menu": norm_url(u) in menu_by_href,
            "menu_labels": menu_by_href.get(norm_url(u)),
            "label_title_overlap": title_ok,
            "issue": "; ".join(issues) if issues else None,
            "suggested_url": suggested,
            "candidates": cands,
            "checked_at": rec.get("checked_at"),
        })
    (HERE / "results.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    import csv
    cols = ["url", "label_in_file", "occurrences_in_file", "status", "first_location", "final_url", "final_status",
            "page_title", "canonical", "product_count", "available_count", "blog_article_links", "blocked_by_robots",
            "in_sitemap", "in_homepage_menu", "issue", "suggested_url"]
    with (HERE / "results.csv").open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for row in out:
            w.writerow(row)
    n_issue = sum(1 for r in out if r.get("issue"))
    log(f"report: {len(out)} rows, {n_issue} with issues; collections in refs={len(refs['collections'])}, "
        f"sitemap collections={len(refs['sitemap_collections'])}, menu links={len(refs['menu'])}")


# --------------------------------------------------------------------------- final phase
# Reviewed manually on 2026-09-14: the automatic label/title heuristic flagged the homepage
# ("Pagina principala" vs "Alessandro Design") and /blogs/news ("Blog" vs "News", menu label "Blog")
# - both are false positives and are dropped here.
LABEL_FALSE_POSITIVES = {BASE + "/", BASE + "/blogs/news"}
EXTRA_NOTES = {
    "/collections/lustre": "label 'Lustre' but the URL redirect lands on Candelabre (title 'Candelabre | Comanda online', h1 'Candelabre'), a different category; the main menu's 'Lustre' entry is /collections/lustre-cu-bec (h1 'Lustre', >=750 products)",
    "/blogs/idei-de-amenajare": "no blog with this handle - 'Idei de amenajare' is a page, not a blog; existing blogs are /blogs/news (12 article links, the one the menu calls 'Blog') and /blogs/sfaturi-de-amenajare (200, 2 articles)",
    "/pages/colaborari": "no 'colaborari'/'parteneriate' page in sitemap_pages; /pages/colaborari-marketing is already listed separately in the file (label 'Colaborari de marketing') - drop this line or reuse that URL",
    "/policies/cookie-policy": "the URL is 404 (inference: Shopify's built-in policy types include no cookie policy); the live footer link 'Politica de utilizare cookie-uri' points to /policies/privacy-policy, which is also under Disallow: /policies/",
    "/policies/shipping-policy": "Disallow: /policies/ comes from Shopify robots.default_groups (templates/robots.txt.liquid only adds filter rules); crawlable alternative /pages/livrare: 200, self-canonical, title 'Livrare'",
    "/collections/decoratiuni-perete": "not empty: templates/collection.json uses main-collection-product-grid, which shows sold-out items; the two sub-collections under 'Decoratiuni' are also 100% sold out (tablou-led 0/14, tablou-sticla 0/7)",
    "/collections/oglinzi-led-multifunctionale": "link the target directly; target title 'Oglinzi LED Multifunctionale | Vezi ofertele', menu label 'Oglinzi LED Multifunctionale' - label matches",
    "/collections/plafoniere-led": "link the target directly; it is the main-menu 'Plafoniere LED' collection (82 products) - label matches",
    "/collections/chiuvete": "link the target directly; target h1 'Chiuvete & Lavoare', menu label 'Chiuvete' - label matches; only 4 of 17 products available",
    "/collections/tablouri-sticla": "target has 0 of 7 products in stock",
    "/collections/tablouri-led": "target has 0 of 14 products in stock",
    "/collections/aplice-interior": "target SEO title says 'Aplice clasice' but h1 and menu say 'Aplice de Interior'",
    "/collections/calorifer-electric": "the live handle is spelled 'calorifel' (sic)",
    "/collections/lustre-camera-copii": "a second collection lustre-camera-copiilor-1 (same title) also exists; the menu uses lustre-camera-copiilor",
}


def final_phase():
    refs = load_refs()
    menu_by_href = {}
    for m in refs["menu"]:
        menu_by_href.setdefault(m["href"], []).append(m["label"])
    recs = {}
    for line in OUT_JSONL.read_text(encoding="utf-8").splitlines():
        rec = json.loads(line)
        recs[rec["url"]] = rec
    sugg = {}
    if OUT_SUGG.exists():
        for line in OUT_SUGG.read_text(encoding="utf-8").splitlines():
            rec = json.loads(line)
            sugg[rec["url"]] = rec
    urls = [u.strip() for u in URLS_FILE.read_text(encoding="utf-8").splitlines() if u.strip()]
    out = []
    for u in urls:
        r = recs[u]
        path = urllib.parse.urlsplit(u).path or "/"
        st, fst = r["status"], r["final_status"]
        issues = []
        if st in (301, 302, 303, 307, 308):
            loc = urllib.parse.urljoin(u, r["first_location"])
            issues.append(f"{st} redirect -> {loc} (final {fst}; that page's canonical is {r.get('canonical')})")
        elif st != 200:
            issues.append(f"HTTP {st}")
        if r.get("blocked_by_robots"):
            issues.append(f"blocked by live robots.txt User-agent: * ({r['robots_rule']})")
        if fst == 200 and r.get("canonical") and norm_url(r["canonical"]) != norm_url(r["final_url"]):
            issues.append(f"canonical {r['canonical']} differs from final URL")
        pc = r.get("product_count")
        if path.startswith("/collections/") and fst == 200:
            if pc == 0:
                issues.append("empty collection (products.json: 0 products)")
            elif r.get("available_count") == 0:
                issues.append(f"all {pc} product{'s' if pc != 1 else ''} out of stock (products.json: 0 of {pc} available)")
        if path.startswith("/blogs/") and fst == 200 and not r.get("blog_article_links"):
            issues.append("blog lists no articles")
        suggested = None
        target = SUGGEST_MAP.get(path)
        if target:
            suggested = BASE + target
            s = sugg.get(suggested)
            if s and path != "/policies/cookie-policy" and st not in (301, 302, 303, 307, 308):
                desc = f"suggested {target}: {s['status']}, title '{s.get('page_title')}'"
                if s.get("product_count") is not None:
                    cnt = f">={s['product_count']}" if s.get("product_count_capped") else str(s["product_count"])
                    desc += f", {cnt} product{'s' if s['product_count'] != 1 else ''} ({s.get('available_count')} available)"
                ml = [x for x in menu_by_href.get(norm_url(suggested), []) if x and not x.startswith(("Vezi", "Afi"))]
                if ml:
                    desc += f", homepage menu/footer label '{ml[0]}'"
                issues.append(desc)
        if path in EXTRA_NOTES:
            issues.append(EXTRA_NOTES[path])
        label = " / ".join(r["labels"])
        row = {
            "url": u,
            "label_in_file": label,
            "occurrences_in_file": r["occurrences_in_file"],
            "status": st,
            "final_status": fst,
            "final_url": norm_url(r["final_url"]) if not u.startswith("https://help.") else r["final_url"],
            "page_title": r.get("page_title") or "",
            "blocked_by_robots": bool(r.get("blocked_by_robots")),
            "product_count": pc if path.startswith("/collections/") else None,
            "issue": "; ".join(issues) if issues else None,
            "suggested_url": suggested,
        }
        if r.get("first_location"):
            row["location"] = urllib.parse.urljoin(u, r["first_location"])
        if path in ("/policies/shipping-policy",) and not suggested:
            row["suggested_url"] = BASE + "/pages/livrare"
        out.append(row)
    (HERE / "final.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    log(f"final: {len(out)} rows, {sum(1 for x in out if x['issue'])} with issues")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd in ("refs", "all"):
        refs_phase()
    if cmd in ("crawl", "all"):
        crawl_phase()
    if cmd in ("suggest", "all"):
        suggest_phase()
    if cmd in ("report", "all"):
        report_phase()
    if cmd in ("final", "all"):
        final_phase()
