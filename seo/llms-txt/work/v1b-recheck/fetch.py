# Independent re-check fetcher (v1b-recheck). Sequential, paced, no redirect following.
import sys, json, time, re, gzip, html, urllib.request, urllib.error, datetime, os

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36")
GAP = 1.2
OUT = os.path.dirname(os.path.abspath(__file__))
_last = [0.0]

class NoRedir(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None

opener = urllib.request.build_opener(NoRedir)

def fetch(url, accept="text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", tries=3):
    for attempt in range(tries):
        wait = GAP - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        req = urllib.request.Request(url, headers={
            "User-Agent": UA, "Accept": accept,
            "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip"})
        t0 = time.time()
        try:
            r = opener.open(req, timeout=40)
            status, hdrs, body = r.status, r.headers, r.read()
        except urllib.error.HTTPError as e:
            status, hdrs, body = e.code, e.headers, e.read()
        except Exception as e:
            _last[0] = time.time()
            status, hdrs, body = -1, {}, str(e).encode()
        _last[0] = time.time()
        if hdrs and hdrs.get("Content-Encoding") == "gzip":
            try:
                body = gzip.decompress(body)
            except Exception:
                pass
        stamp = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
        with open(os.path.join(OUT, "requests.log"), "a", encoding="utf-8") as f:
            f.write(f"{stamp}\t{status}\t{url}\t{hdrs.get('Location','') if hdrs else ''}\n")
        if status == 429 and attempt < tries - 1:
            time.sleep(15 * (attempt + 1))
            continue
        return {"url": url, "status": status, "location": hdrs.get("Location") if hdrs else None,
                "content_type": hdrs.get("Content-Type") if hdrs else None,
                "x_robots": hdrs.get("X-Robots-Tag") if hdrs else None, "x_redirect_reason": hdrs.get("x-redirect-reason") if hdrs else None,
                "server_timing_pagetype": (re.search(r'pageType;desc="([^"]+)"', hdrs.get("Server-Timing","") or "") or [None, None])[1] if hdrs else None,
                "fetched_utc": stamp, "elapsed": round(time.time() - t0, 2)}, body.decode("utf-8", "replace")

def text(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()

def parse_html(body):
    d = {}
    m = re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I)
    d["title"] = text(m.group(1)) if m else None
    m = re.search(r'<link[^>]+rel="canonical"[^>]*href="([^"]+)"', body, re.I) or \
        re.search(r'<link[^>]+href="([^"]+)"[^>]*rel="canonical"', body, re.I)
    d["canonical"] = html.unescape(m.group(1)) if m else None
    m = re.search(r'<meta[^>]+name="robots"[^>]*content="([^"]+)"', body, re.I)
    d["meta_robots"] = m.group(1) if m else None
    d["h1"] = [text(x) for x in re.findall(r"<h1[^>]*>(.*?)</h1>", body, re.S | re.I)][:3]
    return d

def products_json(handle, base="https://www.alessandrodesign.ro"):
    total = avail = 0
    page = 1
    statuses = []
    while True:
        meta, body = fetch(f"{base}/collections/{handle}/products.json?limit=250&page={page}",
                           accept="application/json")
        statuses.append(meta["status"])
        if meta["status"] != 200:
            return {"handle": handle, "ok": False, "statuses": statuses}
        prods = json.loads(body).get("products", [])
        total += len(prods)
        avail += sum(1 for p in prods if any(v.get("available") for v in p.get("variants", [])))
        if len(prods) < 250:
            break
        page += 1
    return {"handle": handle, "ok": True, "products": total, "available": avail, "pages": page}

if __name__ == "__main__":
    mode = sys.argv[1]
    inp = sys.argv[2]
    outp = os.path.join(OUT, sys.argv[3])
    items = [l.strip() for l in open(inp, encoding="utf-8") if l.strip() and not l.startswith("#")]
    with open(outp, "a", encoding="utf-8") as f:
        for it in items:
            if mode == "page":
                meta, body = fetch(it)
                if meta["status"] == 200 and "html" in (meta["content_type"] or ""):
                    meta.update(parse_html(body))
                f.write(json.dumps(meta, ensure_ascii=False) + "\n")
            elif mode == "pj":
                f.write(json.dumps(products_json(it), ensure_ascii=False) + "\n")
            elif mode == "raw":
                meta, body = fetch(it)
                name = re.sub(r"[^A-Za-z0-9._-]+", "_", it.split("://", 1)[1])[:120]
                open(os.path.join(OUT, "raw", name), "w", encoding="utf-8").write(body)
                f.write(json.dumps(meta, ensure_ascii=False) + "\n")
            f.flush()
            print(it, flush=True)
