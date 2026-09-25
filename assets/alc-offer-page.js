/**
 * Offer page (sections/alc-offer-page.liquid).
 *
 * <alc-offer-countdown data-end="YYYY-MM-DD">: counts down to 23:59:59 of that day,
 * Bucharest time (the store's time zone), and switches to "offer ended" afterwards.
 *
 * <alc-offer-grid>: category chips filter the cards, the select re-orders them
 * (recommended = the server's order, discount, price; sold out always last), and the
 * terms line gets a localised date.
 */
(() => {
  const pad = (n) => String(n).padStart(2, '0');

  // UTC offset of Europe/Bucharest on a given day ("+03:00" in summer, "+02:00" in winter).
  function bucharestOffset(date) {
    try {
      const part = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Bucharest', timeZoneName: 'longOffset' })
        .formatToParts(date)
        .find((p) => p.type === 'timeZoneName');
      const m = part && /GMT([+-]\d{2}:\d{2})/.exec(part.value);
      if (m) return m[1];
    } catch (e) {}
    return '+03:00';
  }

  function endOf(day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    const noon = new Date(`${day}T12:00:00Z`);
    return new Date(`${day}T23:59:59${bucharestOffset(noon)}`);
  }

  if (!customElements.get('alc-offer-countdown')) {
    class AlcOfferCountdown extends HTMLElement {
      connectedCallback() {
        this.end = endOf(this.dataset.end || '');
        if (!this.end) {
          this.hidden = true;
          return;
        }
        this.tick();
        // The clock keeps its space while it waits for the first tick (no layout shift).
        this.classList.remove('is-pending');
        this.timer = setInterval(() => this.tick(), 1000);
      }

      disconnectedCallback() {
        clearInterval(this.timer);
      }

      tick() {
        let left = Math.max(0, Math.floor((this.end - Date.now()) / 1000));
        if (left === 0) {
          clearInterval(this.timer);
          this.classList.add('is-ended');
          this.querySelector('[data-ended]').hidden = false;
          return;
        }
        const d = Math.floor(left / 86400);
        left -= d * 86400;
        const h = Math.floor(left / 3600);
        left -= h * 3600;
        const m = Math.floor(left / 60);
        const s = left - m * 60;
        this.querySelector('[data-d]').textContent = d;
        this.querySelector('[data-h]').textContent = pad(h);
        this.querySelector('[data-m]').textContent = pad(m);
        this.querySelector('[data-s]').textContent = pad(s);
      }
    }
    customElements.define('alc-offer-countdown', AlcOfferCountdown);
  }

  if (!customElements.get('alc-offer-grid')) {
    class AlcOfferGrid extends HTMLElement {
      connectedCallback() {
        if (this.bound) return;
        this.bound = true;
        this.grids = [...this.querySelectorAll('[data-grid]')];
        this.items = this.grids.flatMap((grid) => [...grid.children]);

        // Grid layout: the chips are buttons that filter. Grouped layout: they are plain
        // links to each category block, so the browser handles them.
        this.addEventListener('click', (event) => {
          const chip = event.target.closest('button.alc-of__chip');
          if (!chip) return;
          this.querySelectorAll('button.alc-of__chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
          const cat = chip.dataset.cat;
          this.items.forEach((li) => {
            li.hidden = Boolean(cat) && li.dataset.cat !== cat;
          });
        });

        // Sorting re-orders each grid on its own (one per category when grouped).
        // Sold-out products stay at the end whatever the order.
        this.querySelector('[data-sort]')?.addEventListener('change', (event) => {
          const mode = event.target.value;
          const num = (li, key) => parseFloat(li.dataset[key]) || 0;
          const compare = (a, b) => {
            const soldOut = num(a, 'soldout') - num(b, 'soldout');
            if (soldOut) return soldOut;
            if (mode === 'price-asc') return num(a, 'price') - num(b, 'price');
            if (mode === 'price-desc') return num(b, 'price') - num(a, 'price');
            if (mode === 'discount') return num(b, 'pct') - num(a, 'pct') || num(a, 'order') - num(b, 'order');
            return num(a, 'order') - num(b, 'order');
          };
          this.grids.forEach((grid) => {
            [...grid.children].sort(compare).forEach((li) => grid.appendChild(li));
          });
        });

        // "30.09.2026" -> "30 septembrie 2026" in the page language.
        const terms = this.querySelector('[data-terms]');
        const template = this.querySelector('[data-terms-template]');
        const end = endOf(terms?.dataset.date || '');
        const lang = document.documentElement.lang || 'ro';
        // Hungarian attaches the suffix to the date ("…-ig"), so it keeps the numeric form.
        if (terms && template && end && typeof Intl !== 'undefined' && !lang.startsWith('hu')) {
          try {
            const label = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest' }).format(end);
            terms.textContent = template.innerHTML.trim().replace('{date}', label);
          } catch (e) {}
        }
      }
    }
    customElements.define('alc-offer-grid', AlcOfferGrid);
  }
})();
