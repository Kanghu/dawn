/**
 * Margin calculator on the B2B dropshipping page (sections/alc-b2b.liquid).
 *
 * Starting prices are defined in RON (data-base) and converted with Shopify's
 * presentment rate, then rounded to a friendly step for the market's currency.
 */
(() => {
  if (customElements.get('alc-b2b-calc')) return;

  const nice = (v) => {
    if (v >= 5000) return Math.round(v / 100) * 100;
    if (v >= 500) return Math.round(v / 10) * 10;
    if (v >= 50) return Math.round(v / 5) * 5;
    return Math.max(1, Math.round(v));
  };

  class AlcB2bCalc extends HTMLElement {
    connectedCallback() {
      if (this.ready) return;
      this.ready = true;
      const rate = parseFloat(window.Shopify?.currency?.rate || '1') || 1;
      const currency = this.dataset.currency || 'RON';
      // Amounts follow the store's own money format ("1.234 Lei", "€1.234", "1 234 Ft"):
      // the sample's number is swapped for the formatted value, the symbol stays put.
      const sample = this.dataset.money || '';
      const match = sample.match(/\d[\d\s.,'\u00a0\u202f]*\d|\d/);
      // Thousands separator as the store prints it (the sample is 1234): "1.234" → ".".
      const sep = match ? match[0].replace(/\d/g, '').charAt(0) : '';
      const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
      this.fmt = {
        format: (n) => {
          const sign = n < 0 ? '−' : '';
          const num = group(Math.abs(Math.round(n)));
          return match ? sign + sample.replace(match[0], num) : `${sign}${num} ${currency}`;
        },
      };

      this.inputs = {};
      this.querySelectorAll('input[data-in]').forEach((input) => {
        const key = input.dataset.in;
        if (input.dataset.base) {
          const max = nice(parseFloat(input.dataset.max) * rate);
          const step = max >= 5000 ? 100 : max >= 500 ? 5 : 1;
          input.min = '0';
          input.max = String(max);
          input.step = String(step);
          input.value = String(nice(parseFloat(input.dataset.base) * rate));
        }
        this.inputs[key] = input;
        input.addEventListener('input', () => this.update());
      });
      this.update();
    }

    update() {
      const val = (k) => parseFloat(this.inputs[k]?.value || '0');
      const buy = val('buy');
      const sell = val('sell');
      const qty = val('qty');
      const margin = sell - buy;

      Object.values(this.inputs).forEach((input) => {
        const pct = ((parseFloat(input.value) - parseFloat(input.min || 0)) / (parseFloat(input.max) - parseFloat(input.min || 0))) * 100;
        input.style.setProperty('--fill', `${Math.max(0, Math.min(100, pct))}%`);
      });

      this.out('buy', this.fmt.format(buy));
      this.out('sell', this.fmt.format(sell));
      this.out('qty', String(qty));
      this.out('margin', this.fmt.format(margin));
      this.out('profit', this.fmt.format(margin * qty));
    }

    out(key, text) {
      this.querySelectorAll(`[data-out="${key}"]`).forEach((el) => {
        el.textContent = text;
      });
    }
  }

  customElements.define('alc-b2b-calc', AlcB2bCalc);
})();
