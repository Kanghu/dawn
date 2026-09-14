"""Paced single-connection fetcher. Usage: python fetch.py name url [name url ...]
Saves <name>.headers.txt and <name>.body in this directory. >=1.2 s between requests."""
import subprocess, sys, time, os
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
here = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[1:]
pairs = list(zip(args[0::2], args[1::2]))
for i, (name, url) in enumerate(pairs):
    if i:
        time.sleep(1.5)
    h = os.path.join(here, name + ".headers.txt")
    b = os.path.join(here, name + ".body")
    r = subprocess.run(["curl", "-sS", "--compressed", "-A", UA, "-H", "Accept: */*",
                        "-D", h, "-o", b, "-w", "%{http_code} %{content_type} %{size_download} %{redirect_url}",
                        url], capture_output=True, text=True)
    print(name, url, "->", r.stdout, r.stderr.strip())
