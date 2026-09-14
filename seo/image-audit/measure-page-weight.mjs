// Headless Chrome page-weight probe over CDP (Node 24: global WebSocket/fetch).
// usage: node measure.mjs <url> <desktop|mobile> <label> [--scroll-desc]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const [url, mode = 'desktop', label = 'run', ...flags] = process.argv.slice(2);
const scrollDesc = flags.includes('--scroll-desc');
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const port = 9333 + Math.floor(Math.random() * 500);
const prof = path.join(tmpdir(), 'measure-chrome-prof-' + port);
mkdirSync(prof, { recursive: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver;
for (let i = 0; i < 50; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(200); } }
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const listeners = [];
ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result ?? msg); pending.delete(msg.id); }
  else if (msg.method) listeners.forEach(fn => fn(msg));
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

const reqs = new Map();
listeners.push(({ method, params }) => {
  if (method === 'Network.requestWillBeSent') reqs.set(params.requestId, { url: params.request.url, type: params.type, prio: params.request.initialPriority, t: params.timestamp });
  if (method === 'Network.responseReceived') Object.assign(reqs.get(params.requestId) || {}, { status: params.response.status, mime: params.response.mimeType });
  if (method === 'Network.loadingFinished') Object.assign(reqs.get(params.requestId) || {}, { bytes: params.encodedDataLength, done: true });
});

await send('Network.enable');
await send('Page.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
if (mode === 'mobile') {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
} else {
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
}
const loaded = new Promise(r => listeners.push(({ method }) => method === 'Page.loadEventFired' && r()));
await send('Page.navigate', { url });
await Promise.race([loaded, sleep(60000)]);
await sleep(6000);

const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
const pageInfo = await evaluate(`(async () => {
  const lcp = await new Promise(res => { let last; new PerformanceObserver(l => { const e = l.getEntries(); last = e[e.length - 1]; }).observe({ type: 'largest-contentful-paint', buffered: true }); setTimeout(() => res(last), 500); });
  const hero = document.querySelector('.hp-banner__img');
  const hd = document.querySelector('header-drawer');
  return {
    lcpMs: lcp && Math.round(lcp.startTime), lcpEl: lcp && lcp.element && (lcp.element.className || lcp.element.tagName), lcpUrl: lcp && (lcp.url || '').replace(/^https?:\\/\\/[^/]+/, '').slice(0, 120),
    hero: hero && { currentSrc: hero.currentSrc.replace(/^https?:\\/\\/[^/]+/, ''), natural: hero.naturalWidth + 'x' + hero.naturalHeight, box: Math.round(hero.getBoundingClientRect().width) + 'x' + Math.round(hero.getBoundingClientRect().height), loading: hero.getAttribute('loading'), fetchpriority: hero.getAttribute('fetchpriority') },
    drawerDisplay: hd && getComputedStyle(hd).display,
    cls: performance.getEntriesByType('layout-shift').reduce((s, e) => s + (e.hadRecentInput ? 0 : e.value), 0),
  };
})()`);

const snapshot = () => [...reqs.values()].filter(r => r.done && (r.type === 'Image' || /^image\//.test(r.mime || '')));
const summarize = list => {
  const kb = a => Math.round(a.reduce((s, r) => s + (r.bytes || 0), 0) / 1024);
  const drawer = list.filter(r => /_120x120\.|MOBILE_OUTLET|drawer/.test(r.url));
  const desc = list.filter(r => /\/files\/[^?]+\?v=\d+(&width=\d+)?$/.test(r.url) && !/logo|HP_B2S/.test(r.url));
  return { images: list.length, imagesKB: kb(list), drawer: drawer.length, drawerKB: kb(drawer),
    heroReqs: list.filter(r => /HP_B2S/.test(r.url)).map(r => `${Math.round(r.bytes / 1024)}KB ${r.mime} ${r.prio} ${r.url.replace(/^https?:\/\/[^/]+/, '')}`),
    top: [...list].sort((a, b) => b.bytes - a.bytes).slice(0, 8).map(r => `${Math.round(r.bytes / 1024)}KB ${r.mime} ${r.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 110)}`) };
};
const out = { label, mode, url, page: pageInfo, initial: summarize(snapshot()) };

if (scrollDesc) {
  await evaluate(`(() => { const d = document.querySelector('.accordion__content.rte'); if (d) { d.closest('.accordion__content-preview')?.classList.remove('is-collapsed'); d.scrollIntoView(); } })()`);
  for (let y = 0; y < 8; y++) { await evaluate('window.scrollBy(0, 700)'); await sleep(700); }
  await sleep(4000);
  out.descImgs = await evaluate(`[...document.querySelectorAll('.accordion__content.rte img')].map(i => ({ src: i.currentSrc.replace(/^https?:\\/\\/[^/]+/, '').slice(-90), natural: i.naturalWidth + 'x' + i.naturalHeight, box: Math.round(i.getBoundingClientRect().width) + 'x' + Math.round(i.getBoundingClientRect().height), loading: i.getAttribute('loading'), sizes: i.getAttribute('sizes') }))`);
  out.descContainer = await evaluate(`(() => { const d = document.querySelector('.accordion__content.rte'); return d && Math.round(d.getBoundingClientRect().width); })()`);
  out.afterScroll = summarize(snapshot());
}

writeFileSync(path.join(here, `m-${label}-${mode}.json`), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
ws.close(); chrome.kill();
process.exit(0);
