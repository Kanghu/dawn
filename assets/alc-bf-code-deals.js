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

      if (!this.classList.contains('is-out')) this.convertPrice();
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
