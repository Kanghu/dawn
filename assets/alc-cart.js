/**
 * <alc-cart-summary> (snippets/alc-cart-summary.liquid): free-delivery progress, the
 * shipping cost for the visitor's country, the estimated total and the delivery window.
 *
 * Shipping comes from the tables below, not from Shopify's /cart/shipping_rates.json: that
 * endpoint needs an address and keeps it on the cart, and checkout then pre-fills it (every
 * Bulgarian buyer got postcode 1000, every Romanian one 010011 / București).
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

  // Shipping fee under the free-delivery threshold, same shape as RULES. A country left out
  // shows "calculated at checkout" until its fee is added here.
  const FEES = {};

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

  // [amount, currency it is defined in] -> cents in the cart's currency, or null if it can't be converted.
  function toCents([amount, unit], currency) {
    const rate = parseFloat(window.Shopify?.currency?.rate || '0');
    if (unit === currency) return Math.round(amount * 100);
    if (unit === 'RON' && rate > 0) return Math.round(amount * rate * 100);
    if (unit === 'BGN' && currency === 'EUR') return Math.round((amount / BGN_PER_EUR) * 100);
    return null;
  }

  function thresholdCents(country, currency) {
    return toCents(RULES[country] || CENTRAL_EUROPE, currency);
  }

  function feeCents(country, currency) {
    return FEES[country] ? toCents(FEES[country], currency) : null;
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

    update() {
      const total = parseInt(this.dataset.total || '0', 10);
      if (!total) return;
      const fmt = moneyFormatter(this.dataset.money || '');
      const country = (this.dataset.country || '').toUpperCase();
      const threshold = thresholdCents(country, this.dataset.currency);
      const free = threshold !== null && total >= threshold;
      const cents = free ? 0 : feeCents(country, this.dataset.currency);

      // Progress towards free delivery (goal-gradient: show how close the reward is).
      const goal = this.querySelector('[data-goal]');
      if (goal && threshold) {
        const text = goal.querySelector('[data-goal-text]');
        const fill = goal.querySelector('[data-goal-fill]');
        if (free) {
          text.textContent = this.dataset.tFreeOk;
        } else {
          const left = fmt(threshold - total);
          text.innerHTML = this.escape(this.dataset.tFreeLeft).replace('{amount}', `<strong>${this.escape(left)}</strong>`);
        }
        goal.classList.toggle('is-done', free);
        fill.style.width = free ? '100%' : `${Math.min(96, Math.max(4, (total / threshold) * 100))}%`;
        goal.hidden = false;
      }

      // Shipping line + estimated total.
      const shippingEl = this.querySelector('[data-shipping]');
      const totalEl = this.querySelector('[data-grand-total]');
      if (shippingEl) {
        shippingEl.classList.toggle('is-muted', cents === null);
        shippingEl.classList.toggle('is-free', cents === 0);
        if (cents === null) {
          shippingEl.textContent = this.dataset.tAtCheckout;
        } else if (cents === 0) {
          shippingEl.textContent = this.dataset.tFree;
        } else {
          shippingEl.textContent = fmt(cents);
        }
      }
      if (totalEl && cents) totalEl.textContent = fmt(total + cents);

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

  // Until 20 Oct 2026 the summary estimated shipping through /cart/shipping_rates.json with one
  // placeholder address per country, and Shopify kept it on the cart: carts from that period
  // still open checkout with postcode 010011 / Județ București (1000 in Bulgaria, ...). Once per
  // browser, read the cart's delivery address through the Storefront API (tokenless) and remove
  // it when it is one of those placeholders; an address with a street is never touched.
  // Carts expire, so this can go in 2027.
  const PLACEHOLDER_ZIPS = {
    RO: '010011', HU: '1011', PL: '00-001', GR: '10431', BG: '1000', SK: '81101',
    FR: '75001', IT: '00118', DE: '10115', ES: '28001', BE: '1000', CZ: '11000',
    HR: '10000', AT: '1010', NL: '1011 AB', PT: '1100-148', IE: 'D01 F5P2', CH: '8001',
  };
  const ADDRESS_FLAG = 'alc-cart-address-checked';

  async function clearPlaceholderAddress() {
    try {
      if (localStorage.getItem(ADDRESS_FLAG)) return;
    } catch (e) {
      return;
    }
    try {
      const res = await originalFetch(`${window.Shopify?.routes?.root || '/'}cart.js`, { headers: { Accept: 'application/json' } });
      const { token } = await res.json();
      if (!token) return;
      const storefront = (query) =>
        originalFetch('/api/2025-10/graphql.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query, variables: { id: `gid://shopify/Cart/${token}` } }),
        }).then((r) => r.json());

      const read = await storefront(
        'query($id: ID!) { cart(id: $id) { delivery { addresses { address { ... on CartDeliveryAddress { address1 zip countryCode } } } } } }'
      );
      if (!read?.data) return;
      // No cart yet: a cart created from now on never gets a placeholder.
      const addresses = read.data.cart?.delivery?.addresses || [];
      const placeholder =
        addresses.length > 0 &&
        addresses.every(({ address: a }) => a && !a.address1 && PLACEHOLDER_ZIPS[a.countryCode] === a.zip);
      if (placeholder) {
        const done = await storefront(
          'mutation($id: ID!) { cartDeliveryAddressesReplace(cartId: $id, addresses: []) { userErrors { message } } }'
        );
        const result = done?.data?.cartDeliveryAddressesReplace;
        if (!result || result.userErrors.length) return;
      }
      localStorage.setItem(ADDRESS_FLAG, '1');
    } catch (e) {}
  }

  if (document.readyState === 'complete') setTimeout(clearPlaceholderAddress, 1500);
  else window.addEventListener('load', () => setTimeout(clearPlaceholderAddress, 1500), { once: true });
})();
