#!/usr/bin/env bash
# usage: fetch.sh name url [name url ...] -- sequential, 1.2 s apart, no redirect following
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
OUT="/e/SITES/Alessandro Design/dawn/seo/llms-txt/work/v2b-recheck/http"
while [ $# -ge 2 ]; do
  name="$1"; url="$2"; shift 2
  res=$(curl -s --compressed -A "$UA" -H 'Accept-Language: ro-RO,ro;q=0.9' -D "$OUT/$name.headers" -o "$OUT/$name.body" -w '%{http_code} %{size_download} %{redirect_url}' "$url")
  echo "$(date -u +%FT%TZ) $name $res $url" | tee -a "$OUT/../fetch.log"
  sleep 1.2
done
