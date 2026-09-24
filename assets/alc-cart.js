/**
 * <alc-cart-summary> (snippets/alc-cart-summary.liquid): free-delivery progress, the
 * shipping cost for the visitor's country, the estimated total and the delivery window.
 *
 * Dawn re-renders the cart drawer / cart footer HTML after every change; custom elements
 * upgrade on insertion, so connectedCallback runs again with the new cart total.
 */
(() => {
  if (customElements.get('alc-cart-summary')) return;

  // Free-delivery thresholds from Settings > Shipping and delivery (general profile).
  // [minimum order, currency the rule is defined in]. Rules in RON are converted with
  // Shopify's presentment rate; the Bulgarian rule is in BGN (fixed peg to EUR).
  const RULES = {
    RO: [400, 'RON'],
    HU: [32500, 'HUF'],
    PL: [419.99, 'PLN'],
    GR: [99.99, 'EUR'],
    BG: [200, 'BGN'],
    SK: [399.99, 'RON'],
    FR: [499.99, 'RON'],
  };
  const CENTRAL_EUROPE = [499.99, 'RON']; // every other shipping country
  const BGN_PER_EUR = 1.95583;

  // A representative address per country: rates are zone based, the postcode only has to be valid.
  const ADDRESS = {
    RO: ['Romania', '010011', 'București'],
    HU: ['Hungary', '1011'],
    PL: ['Poland', '00-001'],
    GR: ['Greece', '10431'],
    BG: ['Bulgaria', '1000'],
    SK: ['Slovakia', '81101'],
    FR: ['France', '75001'],
    IT: ['Italy', '00118', 'Roma'],
    DE: ['Germany', '10115'],
    ES: ['Spain', '28001', 'Madrid'],
    BE: ['Belgium', '1000'],
    CZ: ['Czech Republic', '11000'],
    HR: ['Croatia', '10000'],
    AT: ['Austria', '1010'],
    NL: ['Netherlands', '1011 AB'],
    PT: ['Portugal', '1100-148', 'Lisboa'],
    IE: ['Ireland', 'D01 F5P2', 'Dublin'],
    CH: ['Switzerland', '8001'],
  };

  const rateCache = new Map();

  function moneyFormatter(sample) {
    // sample = the store's own format for 1234.56, e.g. "1.234,56 Lei", "€1.234,56", "1 235 Ft".
    const match = sample.match(/\d[\d\s.,'  ]*\d/);
    if (!match) return (cents) => (cents / 100).toFixed(2);
    const num = match[0];
    const dec = /[.,](\d{2})$/.exec(num);
    const decimals = dec && num.replace(/\D/g, '').length === 6 ? 2 : 0;
    const decSep = decimals ? num.charAt(num.length - 3) : '';
    const body = decimals ? num.slice(0, -3) : num;
    const thouMatch = body.match(/\d(\D)\d{3}$/);
    const thouSep = thouMatch ? thouMatch[1] : '';
    return (cents) => {
      const value = decimals ? (cents / 100).toFixed(2) : String(Math.round(cents / 100));
      const [int, frac] = value.split('.');
      const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, thouSep);
      return sample.replace(num, frac ? grouped + decSep + frac : grouped);
    };
  }

  function thresholdCents(country, currency) {
    const [min, unit] = RULES[country] || CENTRAL_EUROPE;
    const rate = parseFloat(window.Shopify?.currency?.rate || '0');
    if (unit === currency) return Math.round(min * 100);
    if (unit === 'RON' && rate > 0) return Math.round(min * rate * 100);
    if (unit === 'BGN' && currency === 'EUR') return Math.round((min / BGN_PER_EUR) * 100);
    return null;
  }

  async function shippingCents(country, total) {
    const address = ADDRESS[country];
    if (!address) return null;
    const key = `${country}:${total}`;
    if (!rateCache.has(key)) {
      const [name, zip, province] = address;
      const params = new URLSearchParams({ 'shipping_address[country]': name, 'shipping_address[zip]': zip });
      if (province) params.set('shipping_address[province]', province);
      rateCache.set(
        key,
        fetch(`${window.Shopify?.routes?.root || '/'}cart/shipping_rates.json?${params}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            const rates = data?.shipping_rates;
            if (!rates || !rates.length) return null;
            return Math.min(...rates.map((r) => Math.round(parseFloat(r.price) * 100)));
          })
          .catch(() => null)
      );
    }
    return rateCache.get(key);
  }

  function addWorkingDays(from, n) {
    const d = new Date(from);
    while (n > 0) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) n -= 1;
    }
    return d;
  }

  class AlcCartSummary extends HTMLElement {
    connectedCallback() {
      this.update();
    }

    async update() {
      const total = parseInt(this.dataset.total || '0', 10);
      if (!total) return;
      const fmt = moneyFormatter(this.dataset.money || '');
      const country = (this.dataset.country || '').toUpperCase();
      const threshold = thresholdCents(country, this.dataset.currency);
      const free = threshold !== null && total >= threshold;

      // Shipping from Shopify is the source of truth (it knows the exact rounding per
      // currency); the threshold table only sizes the progress bar.
      const shippingEl = this.querySelector('[data-shipping]');
      const totalEl = this.querySelector('[data-grand-total]');
      let cents = await shippingCents(country, total);
      if (!this.isConnected) return;
      if (cents === null && free) cents = 0;
      const isFree = cents === 0;

      // Progress towards free delivery (goal-gradient: show how close the reward is).
      const goal = this.querySelector('[data-goal]');
      if (goal && (threshold || isFree)) {
        const text = goal.querySelector('[data-goal-text]');
        const fill = goal.querySelector('[data-goal-fill]');
        const done = isFree || (cents === null && free);
        if (done) {
          text.textContent = this.dataset.tFreeOk;
        } else {
          const left = fmt(Math.max(1, threshold - total));
          text.innerHTML = this.escape(this.dataset.tFreeLeft).replace('{amount}', `<strong>${this.escape(left)}</strong>`);
        }
        goal.classList.toggle('is-done', done);
        fill.style.width = done ? '100%' : `${Math.min(96, Math.max(4, (total / threshold) * 100))}%`;
        // Right at the boundary the table can say "free" while Shopify still charges: hide the bar.
        goal.hidden = !done && threshold - total <= 0;
      }

      // Shipping line + estimated total.
      if (shippingEl) {
        if (cents === null) {
          shippingEl.textContent = this.dataset.tAtCheckout;
          shippingEl.classList.add('is-muted');
        } else if (cents === 0) {
          shippingEl.textContent = this.dataset.tFree;
          shippingEl.classList.add('is-free');
        } else {
          shippingEl.textContent = fmt(cents);
          if (totalEl) totalEl.textContent = fmt(total + cents);
        }
      }

      // Delivery window: 2-4 working days, in the page language.
      const eta = this.querySelector('[data-eta]');
      if (eta && typeof Intl !== 'undefined') {
        try {
          const f = new Intl.DateTimeFormat(document.documentElement.lang || 'ro', { weekday: 'short', day: 'numeric', month: 'short' });
          const a = addWorkingDays(new Date(), 2);
          const b = addWorkingDays(new Date(), 4);
          eta.querySelector('[data-eta-text]').textContent = f.formatRange ? f.formatRange(a, b) : `${f.format(a)} – ${f.format(b)}`;
          eta.hidden = false;
        } catch (e) {}
      }
    }

    escape(s) {
      return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    }
  }

  customElements.define('alc-cart-summary', AlcCartSummary);

  // Apps (e.g. the Upcharge warranty fee) change the cart with their own requests, which
  // do not re-render the drawer. Watch cart mutations and refresh the summary numbers.
  let refreshTimer;
  function refreshSummaries() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      const summaries = document.querySelectorAll('alc-cart-summary');
      if (!summaries.length) return;
      try {
        const res = await originalFetch(`${window.Shopify?.routes?.root || '/'}cart.js`, { headers: { Accept: 'application/json' } });
        const cart = await res.json();
        summaries.forEach((el) => {
          if (String(cart.total_price) === el.dataset.total) return;
          const fmt = moneyFormatter(el.dataset.money || '');
          el.dataset.total = String(cart.total_price);
          const sub = el.querySelector('[data-subtotal]');
          if (sub) sub.textContent = fmt(cart.items_subtotal_price);
          const grand = el.querySelector('[data-grand-total]');
          if (grand) grand.textContent = fmt(cart.total_price);
          el.update();
        });
      } catch (e) {}
    }, 350);
  }

  const CART_MUTATION = /\/cart\/(add|change|update|clear)(\.js)?(\?|$)/;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (...args) => {
    const promise = originalFetch(...args);
    try {
      const target = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (CART_MUTATION.test(target)) promise.then(refreshSummaries, () => {});
    } catch (e) {}
    return promise;
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (CART_MUTATION.test(String(url))) this.addEventListener('loadend', refreshSummaries);
    return originalOpen.call(this, method, url, ...rest);
  };
})();
