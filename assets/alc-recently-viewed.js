/**
 * Recently viewed products (sections/alc-recently-viewed.liquid).
 *
 * The list lives only in the visitor's browser (localStorage). On each product page we:
 *   1. read the stored product ids (excluding the current product),
 *   2. ask the storefront search for exactly those products, rendered by the static
 *      section `alc-recently-viewed-results` (same product cards as the rest of the theme),
 *   3. insert the returned slider, in the order the products were viewed,
 *   4. remember the current product for next time.
 * Nothing is requested when the list is empty, and the section stays hidden.
 */
class AlcRecentlyViewed extends HTMLElement {
  connectedCallback() {
    this.storageKey = this.dataset.storageKey || 'alc:recently-viewed';
    this.productId = String(this.dataset.productId || '');
    this.limit = parseInt(this.dataset.limit || '8', 10);
    this.storageLimit = parseInt(this.dataset.storageLimit || '12', 10);
    this.results = this.querySelector('[data-results]');

    const clearButton = this.querySelector('[data-clear]');
    if (clearButton) clearButton.addEventListener('click', () => this.clear());

    const ids = this.read().filter((id) => id !== this.productId);
    this.remember();

    if (ids.length && this.results) this.load(ids.slice(0, this.limit));
  }

  read() {
    try {
      const value = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      return Array.isArray(value) ? value.map(String) : [];
    } catch (e) {
      return [];
    }
  }

  write(ids) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(ids));
    } catch (e) {
      /* storage unavailable: the feature silently degrades */
    }
  }

  remember() {
    if (!this.productId) return;
    const ids = [this.productId, ...this.read().filter((id) => id !== this.productId)];
    this.write(ids.slice(0, this.storageLimit));
  }

  clear() {
    this.write([]);
    this.hidden = true;
  }

  async load(ids) {
    const query = ids.map((id) => `id:${id}`).join(' OR ');
    const params = new URLSearchParams({
      type: 'product',
      'options[unavailable_products]': 'hide',
      q: query,
      section_id: this.dataset.section || 'alc-recently-viewed-results',
    });
    const url = `${this.dataset.searchUrl || '/search'}?${params.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) return;

      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const slider = doc.querySelector('slider-component');
      const list = slider ? slider.querySelector('ul') : null;
      if (!slider || !list) return;

      // Keep the order in which the products were viewed and drop anything not returned.
      const byId = new Map();
      list.querySelectorAll('li[data-product-id]').forEach((li) => byId.set(li.dataset.productId, li));
      list.innerHTML = '';

      const showLabels = this.dataset.showLabels !== 'false';
      let position = 0;
      ids.forEach((id) => {
        const li = byId.get(id);
        if (!li) return;
        position += 1;
        li.dataset.position = String(position);

        const reason = li.querySelector('[data-reason]');
        if (reason) {
          if (!showLabels) {
            reason.remove();
          } else if (position === 1 && this.dataset.labelLatest) {
            reason.textContent = this.dataset.labelLatest;
            reason.classList.add('alc-recs__reason--recent-latest');
          } else if (this.dataset.labelRecent) {
            reason.textContent = this.dataset.labelRecent;
          } else {
            reason.remove();
          }
        }
        list.appendChild(li);
      });

      if (!position) return;

      if (this.dataset.columns) {
        list.className = list.className.replace(/grid--\d-col-desktop/, `grid--${this.dataset.columns}-col-desktop`);
      }

      this.results.replaceChildren(slider);
      this.hidden = false;
      this.dispatchEvent(new CustomEvent('alc:recently-viewed:loaded', { detail: { count: position } }));
    } catch (e) {
      console.error('[alc-recently-viewed]', e);
    }
  }
}

if (!customElements.get('alc-recently-viewed')) {
  customElements.define('alc-recently-viewed', AlcRecentlyViewed);
}
