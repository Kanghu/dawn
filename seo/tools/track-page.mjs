// Tracking check for one page: dataLayer events and tracker network hits on load,
// then after clicking the first add-to-cart button.
// usage: node track-page.mjs <url> [desktop|mobile] [--atc=css selector]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const [url, mode = 'desktop', ...flags] = process.argv.slice(2);
const atcFlag = flags.find((f) => f.startsWith('--atc='));
const atcSel = atcFlag ? atcFlag.slice(6) : 'product-form button[name="add"]:not([disabled])';
const port = 9333 + Math.floor(Math.random() * 500);
const prof = path.join(tmpdir(), 'track-prof-' + port);
mkdirSync(prof, { recursive: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 50; i++) { try { await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(200); } }
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const listeners = [];
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); } else if (m.method) listeners.forEach((f) => f(m)); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Network.enable');
const mob = mode === 'mobile';
await send('Emulation.setDeviceMetricsOverride', { width: mob ? 390 : 1440, height: mob ? 844 : 900, deviceScaleFactor: 1, mobile: mob });
await send('Emulation.setUserAgentOverride', { userAgent: mob ? 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' });

const TRACKERS = [
  ['GA4', /google-analytics\.com\/g\/collect|analytics\.google\.com\/g\/collect/],
  ['Meta', /facebook\.com\/tr/],
  ['TikTok', /analytics\.tiktok\.com\/api\/v2\/pixel/],
  ['Google Ads', /googleadservices\.com\/pagead|google\.com\/pagead\/1p-conversion|googleads\.g\.doubleclick/],
  ['Elevar', /elevar/],
  ['Shopify', /monorail|\/api\/collect|shopifycloud\/web-pixels/],
];
let phase = 'load';
const hits = { load: {}, atc: {} };
listeners.push(({ method, params }) => {
  if (method !== 'Network.requestWillBeSent') return;
  const u = params.request.url;
  for (const [name, re] of TRACKERS) {
    if (re.test(u)) {
      let ev = '';
      const m = /[?&](?:en|ev)=([^&]+)/.exec(u) || /"event_name":"([^"]+)"/.exec(params.request.postData || '');
      if (m) ev = decodeURIComponent(m[1]);
      const key = ev ? `${name}:${ev}` : name;
      hits[phase][key] = (hits[phase][key] || 0) + 1;
    }
  }
});
const evaluate = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value;
const loaded = new Promise((r) => listeners.push(({ method }) => method === 'Page.loadEventFired' && r()));
await send('Page.navigate', { url });
await Promise.race([loaded, sleep(60000)]);
await sleep(9000);
const dlLoad = await evaluate(`(window.dataLayer||[]).map(e=>e && e.event).filter(Boolean)`);
phase = 'atc';
const clicked = await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(atcSel)}); if(!b) return 'no button'; b.scrollIntoView({block:'center'}); b.click(); return b.closest('[class*=alc-pc]')?.querySelector('.alc-pc__link')?.textContent.trim().slice(0,50) || 'clicked'})()`);
await sleep(7000);
const dlAll = await evaluate(`(window.dataLayer||[]).map(e=>e && e.event).filter(Boolean)`);
const atcEvent = await evaluate(`JSON.stringify((window.dataLayer||[]).filter(e=>e&&e.event==='dl_add_to_cart').map(e=>({id:e.ecommerce?.add?.products?.[0]?.id||e.ecommerce?.items?.[0]?.item_id, name:(e.ecommerce?.add?.products?.[0]?.name||'').slice(0,40), price:e.ecommerce?.add?.products?.[0]?.price, list:e.ecommerce?.add?.actionField?.list})))`);
const cartCount = await evaluate(`fetch('/cart.js').then(r=>r.json()).then(c=>c.item_count)`);
const after = await evaluate(`JSON.stringify({href: location.pathname + location.search, drawerOpen: !!document.querySelector('cart-drawer.active, cart-drawer[open], .drawer.active'), notification: !!document.querySelector('cart-notification.active, #cart-notification.active')})`);
console.log(JSON.stringify({ url, dataLayerOnLoad: dlLoad, dataLayerAfterAtc: dlAll.slice(dlLoad.length), clicked, after: JSON.parse(after||'{}'), atcEvent: JSON.parse(atcEvent || '[]'), cartCount, networkOnLoad: hits.load, networkAfterAtc: hits.atc }, null, 1));
chrome.kill(); process.exit(0);
