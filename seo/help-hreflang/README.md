# Hreflang pentru help.alessandrodesign.ro

Task SEO: "Lipsă etichetă hreflang pe subdomeniu". Subdomeniul `help.alessandrodesign.ro`
nu face parte din tema Shopify: este un **Chatwoot Help Center** (cloud, `app.chatwoot.com`),
legat prin CNAME `help.alessandrodesign.ro -> chatwoot.help`.

## De ce nu se poate rezolva direct în Chatwoot

- Chatwoot nu generează `<link rel="alternate" hreflang>` în paginile portalului
  (verificat în sursa `app/views/layouts/_portal_head.html.erb` și
  `app/views/public/api/v1/portals/articles/_meta_head.html.erb`, branch `develop`).
- Setările portalului nu permit injectarea de HTML/cod în `<head>`. Singurele câmpuri
  de cod acceptate sunt ID-uri de analytics (GTM, GA4, Hotjar, Plausible, Clarity,
  Meta Pixel, Amplitude), adăugate în Chatwoot pe 3 aug 2026.
- Traducerile sunt legate corect în Chatwoot (`associated_articles`): fiecare articol RO are
  variantă HU, BG și PL publicată. Auditorul nu a găsit BG/PL pentru că URL-urile lor au
  slug gol (vezi "Problemă secundară" mai jos).

## Soluția: hreflang prin sitemap (metoda oficială Google) + opțional GTM

Google acceptă hreflang fie în `<head>`, fie în sitemap XML (`xhtml:link`), cu efect identic.
Sitemap-ul poate fi găzduit pe alt host dacă ambele host-uri sunt verificate în Search Console
(cross-site submission). Zona DNS `alessandrodesign.ro` este pe Cloudflare, deci un Worker
poate servi sitemap-ul.

### Pasul 1: Cloudflare Worker (sitemap dinamic)

1. Cloudflare Dashboard > Workers & Pages > Create Worker, lipește conținutul din `worker.js`.
2. Triggers > Routes: adaugă `alessandrodesign.ro/help-sitemap.xml` și
   `alessandrodesign.ro/help-hreflang.json` (zona `alessandrodesign.ro`).
   Alternativă fără să atingi apex-ul Shopify: Custom Domain `sitemaps.alessandrodesign.ro`.
3. Test: `https://alessandrodesign.ro/help-sitemap.xml` trebuie să întoarcă XML cu 112 URL-uri
   (28 articole x 4 limbi), fiecare cu 5 `xhtml:link` (ro-RO, hu-HU, bg-BG, pl-PL, x-default).

Worker-ul citește live endpoint-urile publice Chatwoot (`/hc/alessandro-design/{ro,hu,bg,pl}/articles.json`)
și cache-uiește 24h. Articolele/traducerile noi apar automat.

### Pasul 2: Google Search Console

1. Verifică proprietatea de tip **Domain** `alessandrodesign.ro` (TXT în DNS Cloudflare).
   Aceasta acoperă și `help.alessandrodesign.ro`, condiție pentru sitemap cross-host.
2. Sitemaps > Add: `https://alessandrodesign.ro/help-sitemap.xml`.
3. După câteva zile: Indexing > Pages / raportul International Targeting arată perechile hreflang.

### Pasul 3 (opțional): tag în `<head>` prin GTM

Dacă se vrea și tag-ul în HTML (cum cere auditul), Chatwoot acceptă un GTM Container ID
în setările portalului (Help Center > Settings > Analytics). Apoi în GTM:

1. Tag nou > Custom HTML, conținut din `help-hreflang-gtm.html`.
2. Triggers: `All Pages` + `History Change` (Chatwoot navighează cu Turbo, fără reload).
3. Publică containerul.

Injectarea este client-side; Google o preia la randare, dar sitemap-ul rămâne sursa sigură.
`help-hreflang-gtm.html` conține maparea statică, deci trebuie regenerat la articole noi
(`python help_hreflang.py`) și actualizat în GTM. Alternativ, tag-ul poate citi
`https://alessandrodesign.ro/help-hreflang.json` servit de Worker (are CORS pentru help.).

## Fișiere

| Fișier | Rol |
| --- | --- |
| `worker.js` | Cloudflare Worker: `/help-sitemap.xml` și `/help-hreflang.json`, generate live |
| `help_hreflang.py` | Generator offline (verificare, GTM, snapshot). `python help_hreflang.py` |
| `help-hreflang-sitemap.xml` | Snapshot static al sitemap-ului (fallback dacă nu se folosește Worker) |
| `help-hreflang-map.json` | Maparea path -> alternate URLs |
| `help-hreflang-gtm.html` | Tag GTM Custom HTML |
| `help-hreflang-report.txt` | Raport acoperire (grupuri incomplete, conflicte) |

## Problemă secundară găsită: slug-uri goale

26 din 112 articole au URL de forma `/articles/1764101720-` (doar timestamp și cratimă):
toate cele 28 BG (titluri chirilice, Chatwoot le transformă în slug gol) și câteva PL/RO
(ex. `1746013843-6`). Paginile răspund 200, hreflang-ul funcționează, dar URL-urile sunt slabe
pentru SEO. Chatwoot recalculează slug-ul doar la creare, deci fix-ul este re-crearea
articolelor cu titlu latin/ASCII (sau cerere de feature la Chatwoot pentru slug editabil).
Dacă se recreează, se re-rulează generatorul și Worker-ul preia automat noile URL-uri.

## Exemplu de rezultat pentru pagina din audit

```xml
<url>
  <loc>https://help.alessandrodesign.ro/hc/alessandro-design/articles/1763659675-statusul-comenzii-mele</loc>
  <xhtml:link rel="alternate" hreflang="bg-BG" href="https://help.alessandrodesign.ro/hc/alessandro-design/articles/1764101720-"/>
  <xhtml:link rel="alternate" hreflang="hu-HU" href="https://help.alessandrodesign.ro/hc/alessandro-design/articles/1763982639-rendelesem-allapota"/>
  <xhtml:link rel="alternate" hreflang="pl-PL" href="https://help.alessandrodesign.ro/hc/alessandro-design/articles/1764101957-jak-sprawdzic-status-zamowienia"/>
  <xhtml:link rel="alternate" hreflang="ro-RO" href="https://help.alessandrodesign.ro/hc/alessandro-design/articles/1763659675-statusul-comenzii-mele"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://help.alessandrodesign.ro/hc/alessandro-design/articles/1763659675-statusul-comenzii-mele"/>
</url>
```
