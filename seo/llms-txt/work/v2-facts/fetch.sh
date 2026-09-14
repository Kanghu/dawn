#!/usr/bin/env bash
# usage: fetch.sh name url [name url ...]  -- sequential, paced
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
OUT="/e/SITES/Alessandro Design/dawn/seo/llms-txt/work/v2-facts/html"
while [ $# -ge 2 ]; do
  name="$1"; url="$2"; shift 2
  code=$(curl -s --compressed -A "$UA" -H 'Accept-Language: ro-RO,ro;q=0.9' -D "$OUT/$name.headers" -o "$OUT/$name.html" -w '%{http_code} %{size_download} %{url_effective}' "$url")
  echo "$name $code"
  sleep 1.2
done
