/**
 * Cloudflare Worker: serves a sitemap with hreflang annotations for the
 * Chatwoot Help Center at help.alessandrodesign.ro.
 *
 * The Help Center itself cannot emit <link rel="alternate" hreflang> (Chatwoot
 * has no head-injection setting), so Google gets the hreflang mapping through
 * a sitemap instead - an officially supported, equivalent method.
 *
 * Routes to attach (Cloudflare dashboard > Workers > Triggers):
 *   alessandrodesign.ro/help-sitemap.xml      -> sitemap (submit this URL in Search Console)
 *   alessandrodesign.ro/help-hreflang.json    -> same mapping as JSON (optional, for the GTM tag)
 *
 * Data is read live from the public Chatwoot JSON endpoints and cached for 24h,
 * so new articles/translations show up without any manual step.
 */

const BASE = "https://help.alessandrodesign.ro";
const PORTAL = "alessandro-design";
const ARTICLE_PREFIX = `/hc/${PORTAL}/articles/`;
const LOCALES = { ro: "ro-RO", hu: "hu-HU", bg: "bg-BG", pl: "pl-PL" };
const X_DEFAULT = "ro";
const CACHE_TTL = 60 * 60 * 24;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== "/help-sitemap.xml" && url.pathname !== "/help-hreflang.json") {
      // Not ours: pass through to the origin (Shopify) untouched.
      return fetch(request);
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const groups = await buildGroups();
    let response;
    if (url.pathname === "/help-sitemap.xml") {
      response = new Response(renderSitemap(groups), {
        headers: { "content-type": "application/xml; charset=utf-8" },
      });
    } else {
      response = new Response(JSON.stringify(renderMap(groups)), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": BASE,
        },
      });
    }
    response.headers.set("cache-control", `public, max-age=${CACHE_TTL}`);
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};

async function fetchArticles(locale) {
  const out = [];
  for (let page = 1; page < 50; page++) {
    const res = await fetch(
      `${BASE}/hc/${PORTAL}/${locale}/articles.json?per_page=100&page=${page}`,
      { headers: { accept: "application/json", "user-agent": "hreflang-worker/1.0" } }
    );
    if (!res.ok) throw new Error(`Chatwoot ${locale} page ${page}: HTTP ${res.status}`);
    const data = await res.json();
    const payload = data.payload || [];
    out.push(...payload);
    const total = (data.meta && data.meta.articles_count) || 0;
    if (!payload.length || out.length >= total) break;
  }
  return out.filter((a) => a.status === "published");
}

/** Returns an array of translation groups: [{ ro: slug, hu: slug, ... }, ...] */
async function buildGroups() {
  const byId = new Map();
  const lists = await Promise.all(Object.keys(LOCALES).map((l) => fetchArticles(l).then((a) => [l, a])));
  for (const [locale, articles] of lists) {
    for (const a of articles) {
      byId.set(a.id, {
        locale,
        slug: a.slug,
        assoc: (a.associated_articles || []).filter((x) => x.status === "published").map((x) => x.id),
      });
    }
  }

  // union-find over associated_articles
  const parent = new Map([...byId.keys()].map((id) => [id, id]));
  const find = (i) => {
    while (parent.get(i) !== i) {
      parent.set(i, parent.get(parent.get(i)));
      i = parent.get(i);
    }
    return i;
  };
  for (const [id, a] of byId) {
    for (const j of a.assoc) if (parent.has(j)) parent.set(find(id), find(j));
  }

  const groups = new Map();
  for (const [id, a] of byId) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, {});
    const g = groups.get(root);
    if (!(a.locale in g)) g[a.locale] = a.slug; // first one wins on duplicates
  }
  return [...groups.values()];
}

function alternates(group) {
  const alts = [];
  for (const loc of Object.keys(group).sort()) {
    if (LOCALES[loc]) alts.push([LOCALES[loc], BASE + ARTICLE_PREFIX + group[loc]]);
  }
  if (group[X_DEFAULT]) alts.push(["x-default", BASE + ARTICLE_PREFIX + group[X_DEFAULT]]);
  return alts;
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderSitemap(groups) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];
  for (const group of groups) {
    const alts = alternates(group);
    for (const loc of Object.keys(group).sort()) {
      lines.push("  <url>");
      lines.push(`    <loc>${esc(BASE + ARTICLE_PREFIX + group[loc])}</loc>`);
      for (const [hl, href] of alts) {
        lines.push(`    <xhtml:link rel="alternate" hreflang="${hl}" href="${esc(href)}"/>`);
      }
      lines.push("  </url>");
    }
  }
  lines.push("</urlset>");
  return lines.join("\n") + "\n";
}

function renderMap(groups) {
  const map = {};
  for (const group of groups) {
    const entry = Object.fromEntries(alternates(group));
    for (const loc of Object.keys(group)) map[ARTICLE_PREFIX + group[loc]] = entry;
  }
  return map;
}
