/**
 * Homepage product sections that change per visitor (snippets/alc-pz-pool, sections/alc-pz-cards).
 *
 * Every featured-collection section on the homepage used to show the first products of its
 * collection, the same for weeks. Now each section shows, in this order:
 *   1. products the visitor opened from that collection, most recent first,
 *   2. products priced at the visitor's level within that collection: around the median of
 *      the ones viewed there (10% up), else the collection's 65th / 10th price percentile for
 *      a premium / budget device (same levels as the campaign spotlight); two places stay
 *      for 3,
 *   3. a random pick from the collection's first 30 in-stock products, new each browser
 *      session (stable within one, so going back to the homepage shows the same cards).
 * 1 and 2 are for the matched-deals group only (A, see snippets/alc-cs-personal); the
 * standard group (B) gets 3, so both groups rotate and the A/B test measures the personal
 * part. A product appears in one section only, and never a sold-out one: the sections list
 * in-stock products only on the homepage, and a section with none in this market is hidden.
 *
 * Missing cards come from the Section Rendering API (alc-pz-cards) in a few requests. A
 * section the visitor can already see, or has scrolled past, is left alone, so nothing moves
 * under their eyes; without JavaScript the sections keep the collection's first products.
 */
(() => {
  if (window.alcPzSections) return;
  window.alcPzSections = {};

  const read = (store, key) => {
    try {
      return JSON.parse(store.getItem(key) || 'null');
    } catch (e) {
      return null;
    }
  };

  // Seeded shuffle (mulberry32), seed kept for the browser session.
  let seed = Number(read(sessionStorage, 'alc:pz-seed'));
  if (!seed) {
    seed = Math.floor(Math.random() * 2147483647) + 1;
    try {
      sessionStorage.setItem('alc:pz-seed', String(seed));
    } catch (e) {}
  }
  const random = (salt) => {
    let s = (seed ^ salt) | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const shuffle = (list, rand) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const median = (sorted) => {
    const m = sorted.length >> 1;
    return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
  };

  // Group and level as decided by the campaign spotlight (window.alcPz), else as stored.
  const level = () => {
    const pz = window.alcPz;
    if (pz) return { group: pz.group === 'p' ? 'A' : 'B', tier: pz.tier };
    const code = /^([AB])([123])/.exec((read(localStorage, 'alc:pz') || {}).v || '');
    if (code) return { group: code[1], tier: ['budget', 'standard', 'premium'][code[2] - 1] };
    return { group: 'B', tier: 'standard' };
  };

  const cardId = (li) => {
    const link = li.querySelector('[id^="CardLink-"]');
    return link ? Number(link.id.split('-').pop()) : 0;
  };

  const fetchLog = [];
  async function fetchCards(ids) {
    const cards = new Map();
    const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    const chunks = [];
    for (let i = 0; i < ids.length; i += 12) chunks.push(ids.slice(i, i + 12));
    // In parallel: 12 products per request keeps the search query short.
    await Promise.all(
      chunks.map(async (chunk) => {
        const params = new URLSearchParams({
          type: 'product',
          'options[unavailable_products]': 'hide',
          q: chunk.map((id) => `id:${id}`).join(' OR '),
          section_id: 'alc-pz-cards',
        });
        try {
          const response = await fetch(`${root}search?${params}`);
          const html = await response.text();
          fetchLog.push(`${response.status} ${html.length}`);
          if (!response.ok) return;
          const doc = new DOMParser().parseFromString(html, 'text/html');
          doc.querySelectorAll('[data-pid]').forEach((el) => cards.set(Number(el.dataset.pid), el.innerHTML));
        } catch (e) {
          /* a failed request leaves those sections as they are */
          fetchLog.push(String(e));
        }
      })
    );
    return cards;
  }

  async function run() {
    const pools = [...document.querySelectorAll('script[data-alc-pz-pool]')]
      .map((el) => {
        try {
          return JSON.parse(el.textContent);
        } catch (e) {
          return null;
        }
      })
      .filter((pool) => pool && document.getElementById(`Slider-${pool.section}`));
    if (!pools.length) return;

    const { group, tier } = level();
    const currency = window.Shopify && window.Shopify.currency && window.Shopify.currency.active;
    const viewed = (read(localStorage, 'alc:pz-prices') || []).filter((v) => v && v.i);
    const used = new Set();
    const plans = [];

    pools.forEach((pool) => {
      const ul = document.getElementById(`Slider-${pool.section}`);
      const lis = [...ul.children].filter((el) => el.tagName === 'LI');
      // Nothing in stock in this market: the server rendered no card, so hide the section.
      if (!lis.length) {
        const wrapper = ul.closest('.shopify-section');
        if (wrapper) wrapper.hidden = true;
        return;
      }
      const current = lis.map(cardId);
      const soldOut = new Set(lis.filter((li) => li.querySelector('.alc-pc--sold-out')).map(cardId));
      const n = lis.length;
      const candidates = pool.candidates.filter(([id]) => !used.has(id));
      const rand = random(pool.col % 2147483647);
      const picks = [];
      const reasons = {};
      const add = (id, reason) => {
        if (picks.length < n && id && !picks.includes(id) && !used.has(id)) {
          picks.push(id);
          reasons[id] = reason;
        }
      };

      if (group === 'A') {
        const here = viewed.filter((v) => Array.isArray(v.k) && v.k.includes(pool.col));
        here.forEach((v) => add(v.i, 'viewed'));

        const herePrices = here.filter((v) => v.c === currency && v.p > 0).map((v) => v.p).sort((a, b) => a - b);
        const prices = candidates.map(([, p]) => p).sort((a, b) => a - b);
        let target = 0;
        if (herePrices.length) target = median(herePrices) * 1.1;
        else if (tier === 'premium' && prices.length) target = prices[Math.floor(prices.length * 0.65)];
        else if (tier === 'budget' && prices.length) target = prices[Math.floor(prices.length * 0.1)];
        if (target > 0) {
          shuffle(candidates.filter(([, p]) => p > 0 && Math.abs(Math.log(p / target)) <= Math.log(1.5)), rand).forEach(
            ([id]) => picks.length < n - 2 && add(id, 'level')
          );
        }
      }
      const rest = shuffle(candidates, rand).map(([id]) => id);
      rest.forEach((id) => add(id, 'random'));
      // Two spares per section in case a viewed product has sold out since.
      const spares = rest.filter((id) => !picks.includes(id)).slice(0, 2);

      picks.forEach((id) => used.add(id));
      plans.push({ pool, ul, lis, current, soldOut, picks, spares, reasons });
    });

    const missing = new Set();
    plans.forEach(({ current, picks, spares }) =>
      picks.concat(spares).forEach((id) => current.includes(id) || missing.add(id))
    );
    const cards = await fetchCards([...missing]);

    const shown = new Set();
    plans.forEach((plan) => {
      const { pool, ul, lis, current, soldOut } = plan;
      // Never a sold-out card, not even as a filler.
      const have = (id) => (current.includes(id) && !soldOut.has(id)) || cards.has(id);
      const taken = (id) => shown.has(id) || (used.has(id) && !plan.picks.includes(id));
      const final = plan.picks.filter(have);
      plan.spares.concat(current).forEach((id) => {
        if (final.length < lis.length && have(id) && !final.includes(id) && !taken(id)) final.push(id);
      });
      final.forEach((id) => shown.add(id));
      plan.final = final;
      if (!final.length || final.join() === current.join()) return;

      const box = ul.getBoundingClientRect();
      if (box.top < window.innerHeight) {
        plan.skipped = 'in view';
        return;
      }

      // The first card carries the card stylesheet: keep it in the section.
      ul.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => ul.before(el));
      const existing = new Map(lis.map((li, i) => [current[i], [...li.childNodes]]));
      // Fewer in-stock products than places: drop the extra places.
      lis.slice(final.length).forEach((li) => li.remove());
      lis.slice(0, final.length).forEach((li, i) => {
        const id = final[i];
        if (existing.has(id)) {
          li.replaceChildren(...existing.get(id));
          return;
        }
        const template = document.createElement('template');
        template.innerHTML = cards.get(id).replaceAll('alc-pz-cards', pool.section);
        if (!pool.secondary) {
          template.content.querySelectorAll('.alc-pc__img--secondary').forEach((img) => img.closest('picture').remove());
        }
        li.replaceChildren(template.content);
      });
      ul.dataset.pz = final.map((id) => plan.reasons[id] || 'kept').join(',');
    });

    window.alcPzSections = {
      group,
      tier,
      requested: missing.size,
      received: cards.size,
      log: fetchLog,
      plans: plans.map(({ pool, final, reasons, skipped }) => ({ section: pool.section, final, reasons, skipped })),
    };
  }

  run();
})();
