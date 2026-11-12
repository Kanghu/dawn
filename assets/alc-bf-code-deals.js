/*
 * Black Friday deals sold only with a code (snippets/alc-bf-code-deals.liquid).
 *
 * <alc-code-deal> wraps one card and does three things:
 * - Before the add to cart it puts the card's code on the cart, so the cart drawer opens with
 *   the reduced price. The add itself stays Dawn's product-form (the tracking listens to it).
 *   If the code can't be applied the product is still added, at its normal price.
 * - After the add it checks that the cart accepted the code, and says so on the card if not.
 * - Abroad it converts the reduction, set in lei, at the day's rate (Liquid has no rate), for
 *   the price, the seal and the saving, rounding to the nearest unit as the cart does.
 * - It greys out a card whose code no longer applies (see deadCodes below).
 */
(() => {
  if (customElements.get('alc-code-deal')) return;

  /* Cart and checkout honour the first five codes of a list; the rest stay at the normal price. */
  const MAX_CODES = 5;

  const sameCode = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

  const fetchCart = () =>
    fetch(`${window.routes.cart_url}.js`, { headers: { Accept: 'application/json' } }).then((response) =>
      response.json()
    );

  /*
   * The cart takes its whole list of codes at once, so the ones already on it go along. A code
   * whose product left the cart stays listed, inapplicable, and gives up its place only when the
   * list is full: a code just applied is inapplicable too until its product arrives.
   * Says whether this code found a place.
   */
  const applyCode = async (code) => {
    const cart = await fetchCart();
    const discounts = cart.discount_codes || [];
    if (discounts.some((discount) => sameCode(discount.code, code))) return true;

    const kept = discounts.length < MAX_CODES ? discounts : discounts.filter((discount) => discount.applicable);
    if (kept.length >= MAX_CODES) return false;

    await fetch(`${window.routes.cart_update_url}.js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ discount: [...kept.map((discount) => discount.code), code].join(',') }),
    });
    return true;
  };

  /*
   * Liquid greys out a card only once the job in alessandro-automations has set
   * custom.bf_code_exhausted, and the job runs a few times a day. Meanwhile a code that ran out
   * would still be on show. So the page asks the shop: throwaway carts, made without the
   * visitor's cookies, each holding up to five deals' products and codes, say which codes no
   * longer apply. Only a code whose product made it into the cart counts; stock is Liquid's job.
   * One request per visit, kept five minutes. Without an answer the cards stay as drawn.
   */
  const STOREFRONT_API = '/api/2026-10/graphql.json';
  const DEAD_KEY = 'alc-bfcd-dead';
  const DEAD_TTL = 5 * 60 * 1000;
  let deadAnswer = null;

  const readDead = () => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(DEAD_KEY));
      if (saved && Array.isArray(saved.codes) && Date.now() - saved.at < DEAD_TTL) return saved.codes;
    } catch (error) {}
    return null;
  };

  const saveDead = (codes) => {
    try {
      sessionStorage.setItem(DEAD_KEY, JSON.stringify({ at: Date.now(), codes }));
    } catch (error) {}
  };

  const askShop = async (deals) => {
    const groups = [];
    for (let i = 0; i < deals.length; i += MAX_CODES) groups.push(deals.slice(i, i + MAX_CODES));

    const country = (window.Shopify && window.Shopify.country) || '';
    const context = /^[A-Z]{2}$/.test(country) ? ` @inContext(country: ${country})` : '';
    const variables = {};
    const params = groups.map((group, i) => {
      variables[`in${i}`] = {
        lines: group.map((deal) => ({ merchandiseId: `gid://shopify/ProductVariant/${deal.dataset.variantId}`, quantity: 1 })),
        discountCodes: group.map((deal) => deal.dataset.code),
      };
      return `$in${i}: CartInput!`;
    });
    const carts = groups.map(
      (group, i) =>
        `c${i}: cartCreate(input: $in${i}) { cart { discountCodes { code applicable } lines(first: ${MAX_CODES}) { nodes { merchandise { ... on ProductVariant { id } } } } } }`
    );
    const query = `mutation BfCodeCheck(${params.join(', ')})${context} { ${carts.join(' ')} }`;

    const response = await fetch(STOREFRONT_API, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`Storefront API ${response.status}`);
    const { data } = await response.json();

    const dead = [];
    groups.forEach((group, i) => {
      const cart = data && data[`c${i}`] && data[`c${i}`].cart;
      if (!cart) return;
      const inCart = cart.lines.nodes.map((line) => line.merchandise && line.merchandise.id);
      group.forEach((deal) => {
        const found = cart.discountCodes.find((discount) => sameCode(discount.code, deal.dataset.code));
        const hasProduct = inCart.includes(`gid://shopify/ProductVariant/${deal.dataset.variantId}`);
        if (found && !found.applicable && hasProduct) dead.push(deal.dataset.code);
      });
    });
    return dead;
  };

  /* The codes that no longer apply, asked once for all the deals on the page. */
  const deadCodes = () => {
    if (deadAnswer) return deadAnswer;
    const saved = readDead();
    if (saved) {
      deadAnswer = Promise.resolve(saved);
      return deadAnswer;
    }
    const seen = new Set();
    const deals = [...document.querySelectorAll('alc-code-deal:not(.is-out)')].filter((deal) => {
      const key = String(deal.dataset.code).toLowerCase();
      if (!deal.dataset.variantId || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    deadAnswer = deals.length
      ? askShop(deals).then((codes) => {
          saveDead(codes);
          return codes;
        })
      : Promise.resolve([]);
    deadAnswer = deadAnswer.catch(() => []);
    return deadAnswer;
  };

  /* The shop's money format, read from a sample rendered by Liquid: 12345.00 in that format. */
  const parseFormat = (sample) => {
    const match = /^(\D*)12(\D?)345(?:(\D)00)?(\D*)$/.exec((sample || '').trim());
    if (!match) return null;
    return { prefix: match[1], thousands: match[2], decimal: match[3] || '', suffix: match[4] };
  };

  const formatMoney = (minorUnits, format) => {
    const value = format.decimal ? Math.round(minorUnits) : Math.round(minorUnits / 100) * 100;
    const whole = String(Math.floor(value / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, format.thousands);
    const cents = format.decimal ? String(value % 100).padStart(2, '0') : '';
    return {
      whole: format.prefix + whole,
      cents,
      tail: format.suffix.trim(),
      text: format.prefix + whole + (cents ? format.decimal + cents : '') + format.suffix,
    };
  };

  const span = (className, text) => {
    const element = document.createElement('span');
    element.className = className;
    if (text) element.textContent = text;
    return element;
  };

  class AlcCodeDeal extends HTMLElement {
    connectedCallback() {
      if (this.isSetUp) return;
      this.isSetUp = true;
      this.code = this.dataset.code;

      /* Capture: runs before product-form's own listener on the form. */
      this.addEventListener('submit', (event) => this.onSubmit(event), true);

      const copyButton = this.querySelector('[data-copy]');
      if (copyButton) copyButton.addEventListener('click', () => this.copyCode(copyButton));

      if (!this.classList.contains('is-out')) {
        this.convertPrice();
        deadCodes().then((codes) => {
          if (codes.some((code) => sameCode(code, this.code))) this.markOut();
        });
      }
    }

    /* The sold-out card Liquid draws for an exhausted code, made from a live one. */
    markOut() {
      if (this.classList.contains('is-out')) return;
      this.classList.add('is-out');
      this.querySelectorAll('.alc-bf__seal, .alc-bf__now, .alc-bf__save, .alc-bfcd__coupon, .alc-bfcd__limit').forEach(
        (element) => element.remove()
      );

      const button = this.querySelector('.alc-bf__buy');
      if (button) {
        button.disabled = true;
        const label = button.querySelector(':scope > span');
        if (label && this.dataset.soldText) label.textContent = this.dataset.soldText;
        button.querySelectorAll(':scope > svg').forEach((icon) => icon.remove());
      }

      /* To the end of the row, as Liquid sorts it, unless the row is on screen: a card jumping
         away under the visitor's eyes is worse than one greyed out in its place. */
      const item = this.closest('li');
      const track = item && item.parentElement;
      if (!track) return;
      const box = track.getBoundingClientRect();
      if (box.top >= window.innerHeight || box.bottom <= 0) track.append(item);
    }

    onSubmit(event) {
      if (this.passThrough) {
        this.passThrough = false;
        return;
      }

      const form = event.target;
      const button = form.querySelector('[type="submit"]');
      event.preventDefault();
      event.stopPropagation();

      if (this.isBusy || !button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
      this.isBusy = true;

      button.classList.add('loading');
      const spinner = button.querySelector('.loading__spinner');
      if (spinner) spinner.classList.remove('hidden');

      this.watchAdd();
      this.hasNoPlace = false;
      applyCode(this.code)
        .then((hasPlace) => {
          this.hasNoPlace = !hasPlace;
        })
        .catch(() => {})
        .finally(() => {
          this.isBusy = false;
          this.passThrough = true;
          button.classList.remove('loading');
          form.requestSubmit(button);
        });
    }

    watchAdd() {
      if (typeof subscribe !== 'function' || typeof PUB_SUB_EVENTS === 'undefined') return;
      if (this.stopWatching) this.stopWatching();

      this.stopWatching = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
        if (event.source !== 'product-form' || String(event.productVariantId) !== this.dataset.variantId) return;
        this.stopWatching();
        this.stopWatching = null;

        fetchCart()
          .then((cart) => {
            const onCart = (cart.discount_codes || []).find((discount) => sameCode(discount.code, this.code));
            this.showRefused(!onCart || !onCart.applicable);
          })
          .catch(() => {});
      });
    }

    showRefused(isRefused) {
      const slot = this.querySelector('[data-refused-slot]');
      if (!slot) return;
      const message = this.hasNoPlace ? this.dataset.noPlace : this.dataset.refused;
      slot.textContent = isRefused ? message : '';
      slot.hidden = !isRefused;
    }

    copyCode(button) {
      if (!navigator.clipboard) return;
      navigator.clipboard
        .writeText(this.code)
        .then(() => {
          const status = this.querySelector('[data-copy-status]');
          button.classList.add('is-copied');
          if (status) status.textContent = button.dataset.done;
          clearTimeout(this.copiedTimer);
          this.copiedTimer = setTimeout(() => {
            button.classList.remove('is-copied');
            if (status) status.textContent = '';
          }, 2000);
        })
        .catch(() => {});
    }

    convertPrice() {
      const rate = parseFloat(window.Shopify && window.Shopify.currency && window.Shopify.currency.rate);
      if (!rate || rate === 1) return;

      const holder = this.closest('[data-money-sample]');
      const format = holder && parseFormat(holder.dataset.moneySample);
      if (!format) return;

      const price = Number(this.dataset.price);
      const reduction = Math.round(Number(this.dataset.reduction) * rate);
      if (!(reduction > 0) || reduction >= price) return;

      const now = formatMoney(price - reduction, format);

      const amount = this.querySelector('[data-amount]');
      if (amount) {
        amount.textContent = now.whole;
        if (now.cents) {
          const decimals = span('alc-bf__dec');
          decimals.append(span('alc-bf__sep', format.decimal), now.cents);
          amount.append(decimals);
        }
        if (now.tail) amount.append(span('alc-bf__cur', now.tail));
      }

      const hiddenPrice = this.querySelector('[data-now-text]');
      if (hiddenPrice) {
        const label = hiddenPrice.textContent.trim().split(/\s+\S*\d.*$/)[0];
        hiddenPrice.textContent = `${label} ${now.text}`;
      }

      const seal = this.querySelector('[data-seal]');
      if (seal) seal.textContent = `-${Math.round((reduction * 100) / price)}%`;

      const saving = this.querySelector('[data-save]');
      if (saving) saving.textContent = formatMoney(reduction, format).text;
    }
  }

  customElements.define('alc-code-deal', AlcCodeDeal);
})();
