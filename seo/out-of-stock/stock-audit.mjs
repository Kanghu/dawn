// Per-collection in-stock vs sold-out counts as shoppers see them (storefront products.json).
// Input collections.json (run in the same folder first):
//   shopify store execute -s d8cgqq-8s.myshopify.com --json -q '{ collections(first: 250) { nodes { handle title sortOrder templateSuffix productsCount { count } ruleSet { appliedDisjunctively rules { column relation condition } } } } }' > collections.json
// Output stock-audit.json; `order` keeps handle:1/0 (in stock / sold out) in storefront order.
import fs from 'node:fs';

const BASE = 'https://alessandrodesign.ro';
const PAGE_SIZE = 36; // products_per_page in templates/collection.json
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cols = JSON.parse(fs.readFileSync('collections.json', 'utf8')).collections.nodes;

async function get(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(450);
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (stock-audit)' } });
    if (res.status === 429) { await sleep(3000 * (attempt + 1)); continue; }
    return res;
  }
  throw new Error('429 loop ' + url);
}

const rows = [];
for (const c of cols) {
  const products = [];
  let status = 200;
  for (let page = 1; ; page++) {
    const res = await get(`${BASE}/collections/${c.handle}/products.json?limit=250&page=${page}`);
    status = res.status;
    if (!res.ok) break;
    const batch = (await res.json()).products;
    products.push(...batch);
    if (batch.length < 250) break;
  }
  const avail = products.map((p) => p.variants.some((v) => v.available));
  const soldOut = avail.filter((a) => !a).length;
  const firstSoldOut = avail.indexOf(false);
  const lastInStock = avail.lastIndexOf(true);
  rows.push({
    handle: c.handle,
    title: c.title,
    template: c.templateSuffix || 'default',
    inventoryRule: !!c.ruleSet?.rules.some((r) => r.column === 'VARIANT_INVENTORY' && r.relation === 'GREATER_THAN' && r.condition === '0'),
    status,
    total: products.length,
    inStock: products.length - soldOut,
    soldOut,
    pctSoldOut: products.length ? Math.round((soldOut / products.length) * 100) : 0,
    soldOutOnPage1: avail.slice(0, PAGE_SIZE).filter((a) => !a).length,
    soldOutAtEnd: soldOut === 0 || firstSoldOut > lastInStock,
    firstSoldOutPos: firstSoldOut + 1,
    order: products.map((p, i) => `${p.handle}:${avail[i] ? 1 : 0}`),
  });
  process.stdout.write(`${c.handle} ${status} ${products.length}/${soldOut}\n`);
}
fs.writeFileSync('stock-audit.json', JSON.stringify(rows, null, 2));
console.log('done', rows.length);
