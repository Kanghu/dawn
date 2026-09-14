"""Two paced requests: set preview cookie, then fetch path with cookie jar (no auto-follow)."""
import subprocess, sys, time, os
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
here = os.path.dirname(os.path.abspath(__file__))
name, first, second = sys.argv[1:4]
jar = os.path.join(here, name + ".jar")
if os.path.exists(jar):
    os.remove(jar)
for i, url in enumerate([first, second]):
    if i:
        time.sleep(1.5)
    h = os.path.join(here, f"{name}-{i}.headers.txt")
    b = os.path.join(here, f"{name}-{i}.body")
    r = subprocess.run(["curl", "-sS", "--compressed", "-A", UA, "-H", "Accept: */*", "-c", jar, "-b", jar,
                        "-D", h, "-o", b, "-w", "%{http_code} %{content_type} %{size_download} %{redirect_url}", url],
                       capture_output=True, text=True)
    print(i, url, "->", r.stdout, r.stderr.strip())
