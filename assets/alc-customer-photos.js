/**
 * <alc-customer-photos> (sections/alc-customer-photos.liquid): opens a customer photo in
 * a lightbox with the product it shows. Tiles are plain links, so without JS (or with a
 * modifier key held) they simply open the product.
 *
 * Keyboard: Esc closes, arrows browse. Touch: swipe left/right to browse.
 */
(() => {
  if (customElements.get('alc-customer-photos')) return;

  const ICON = {
    close: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    prev: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
    next: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>',
    arrow: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  };

  class AlcCustomerPhotos extends HTMLElement {
    connectedCallback() {
      if (this.bound) return;
      this.bound = true;
      this.tiles = [...this.querySelectorAll('.alc-cp__tile')];
      this.addEventListener('click', (event) => {
        const tile = event.target.closest('.alc-cp__tile');
        if (!tile || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        if (typeof HTMLDialogElement !== 'function') return;
        event.preventDefault();
        this.open(this.tiles.indexOf(tile), tile);
      });
    }

    build() {
      const d = this.dataset;
      const dialog = document.createElement('dialog');
      dialog.className = 'alc-cp-lb';
      dialog.setAttribute('aria-label', document.querySelector('.alc-cp__title')?.textContent.trim() || '');
      dialog.innerHTML = `
        <button type="button" class="alc-cp-lb__btn alc-cp-lb__btn--close" data-act="close">${ICON.close}</button>
        <button type="button" class="alc-cp-lb__btn alc-cp-lb__btn--prev" data-act="prev">${ICON.prev}</button>
        <button type="button" class="alc-cp-lb__btn alc-cp-lb__btn--next" data-act="next">${ICON.next}</button>
        <div class="alc-cp-lb__stage">
          <figure class="alc-cp-lb__figure"><img class="alc-cp-lb__img" alt=""></figure>
          <div class="alc-cp-lb__panel">
            <p class="alc-cp-lb__count" aria-live="polite"></p>
            <div class="alc-cp-lb__product">
              <img class="alc-cp-lb__thumb" alt="" width="64" height="64">
              <p class="alc-cp-lb__name"></p>
            </div>
            <p class="alc-cp-lb__price"><span class="alc-cp-lb__now"></span><s></s></p>
            <p class="alc-cp-lb__note"></p>
            <a class="alc-cp-lb__cta"><span></span>${ICON.arrow}</a>
          </div>
        </div>`;
      dialog.querySelector('[data-act="close"]').setAttribute('aria-label', d.tClose || 'Close');
      dialog.querySelector('[data-act="prev"]').setAttribute('aria-label', d.tPrev || 'Previous');
      dialog.querySelector('[data-act="next"]').setAttribute('aria-label', d.tNext || 'Next');

      dialog.addEventListener('click', (event) => {
        const act = event.target.closest('[data-act]')?.dataset.act;
        if (act === 'close') dialog.close();
        else if (act === 'prev') this.go(-1);
        else if (act === 'next') this.go(1);
        else if (event.target === dialog || event.target.classList.contains('alc-cp-lb__stage')) dialog.close();
      });
      dialog.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') this.go(-1);
        if (event.key === 'ArrowRight') this.go(1);
      });
      dialog.addEventListener('close', () => {
        document.documentElement.classList.remove('alc-cp-locked');
        this.opener?.focus({ preventScroll: true });
      });

      let x0 = null;
      let y0 = null;
      dialog.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
      dialog.addEventListener('touchend', (e) => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        const dy = e.changedTouches[0].clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) this.go(dx < 0 ? 1 : -1);
      }, { passive: true });

      document.body.appendChild(dialog);
      this.dialog = dialog;
    }

    open(index, opener) {
      if (!this.dialog) this.build();
      this.opener = opener;
      this.show(index);
      document.documentElement.classList.add('alc-cp-locked');
      if (!this.dialog.open) this.dialog.showModal();
    }

    go(step) {
      const n = this.tiles.length;
      this.show((this.index + step + n) % n);
    }

    show(index) {
      this.index = index;
      const t = this.tiles[index].dataset;
      const q = (s) => this.dialog.querySelector(s);

      const img = q('.alc-cp-lb__img');
      const fresh = img.cloneNode(); // restart the entrance animation
      fresh.src = t.full;
      fresh.width = +t.w || 1080;
      fresh.height = +t.h || 1080;
      fresh.alt = this.tiles[index].querySelector('img')?.alt || '';
      img.replaceWith(fresh);

      q('.alc-cp-lb__count').textContent = `${index + 1} / ${this.tiles.length}`;
      const panel = q('.alc-cp-lb__panel');
      const hasInfo = Boolean(t.caption);
      q('.alc-cp-lb__product').hidden = !hasInfo;
      q('.alc-cp-lb__name').textContent = t.caption || '';
      const thumb = q('.alc-cp-lb__thumb');
      thumb.hidden = !t.thumb;
      if (t.thumb) thumb.src = t.thumb;

      const price = q('.alc-cp-lb__price');
      price.hidden = !t.price;
      price.classList.toggle('is-sale', Boolean(t.was));
      q('.alc-cp-lb__now').textContent = t.price || '';
      q('.alc-cp-lb__price s').textContent = t.was || '';

      const note = q('.alc-cp-lb__note');
      note.hidden = !t.note;
      note.textContent = t.note || '';

      const cta = q('.alc-cp-lb__cta');
      cta.hidden = !t.url;
      if (t.url) cta.href = t.url;
      cta.querySelector('span').textContent = t.cta || '';
      panel.classList.toggle('is-bare', !hasInfo);

      // Warm the neighbours so browsing feels instant.
      [1, -1].forEach((s) => {
        const n = this.tiles[(index + s + this.tiles.length) % this.tiles.length];
        if (n) new Image().src = n.dataset.full;
      });
    }
  }

  customElements.define('alc-customer-photos', AlcCustomerPhotos);
})();
