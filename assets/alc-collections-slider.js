/**
 * Collections slider (blocks/alc-collections-slider.liquid): arrows, dots and mouse drag for a row of
 * cards that scrolls natively (swipe and trackpad need no script). Layout is read in one measure()
 * pass, cached, and refreshed only when the track resizes; scroll and drag handlers only write.
 * The page keeps scrolling with the mouse wheel over the row.
 */
if (!customElements.get('alc-collections-slider')) {
  customElements.define(
    'alc-collections-slider',
    class AlcCollectionsSlider extends HTMLElement {
      connectedCallback() {
        if (this.resizeObserver) {
          this.resizeObserver.observe(this.track);
          return;
        }
        this.track = this.querySelector('[data-track]');
        this.prevButton = this.querySelector('[data-prev]');
        this.nextButton = this.querySelector('[data-next]');
        this.dotsWrap = this.querySelector('[data-dots]');
        if (!this.track) return;

        this.step = 0;
        this.maxIndex = 0;
        this.index = -1;
        this.dots = [];
        this.frame = 0;
        this.measureFrame = 0;
        this.drag = null;
        this.dragged = false;

        this.onScroll = this.onScroll.bind(this);
        this.scheduleMeasure = this.scheduleMeasure.bind(this);
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.onClick = this.onClick.bind(this);
        this.onBlockSelect = this.onBlockSelect.bind(this);

        this.prevButton?.addEventListener('click', () => this.goTo(this.index - 1));
        this.nextButton?.addEventListener('click', () => this.goTo(this.index + 1));
        this.track.addEventListener('scroll', this.onScroll, { passive: true });
        this.track.addEventListener('pointerdown', this.onPointerDown);
        this.track.addEventListener('click', this.onClick, true);
        // A card is a link: without this the browser starts dragging the link instead of the row.
        this.track.addEventListener('dragstart', (event) => event.preventDefault());
        this.addEventListener('shopify:block:select', this.onBlockSelect);

        this.resizeObserver = new ResizeObserver(this.scheduleMeasure);
        this.resizeObserver.observe(this.track);
        this.scheduleMeasure();
      }

      disconnectedCallback() {
        this.resizeObserver?.disconnect();
        cancelAnimationFrame(this.frame);
        cancelAnimationFrame(this.measureFrame);
      }

      // The cards, or the elements Shopify wraps each card block in on the storefront.
      get cards() {
        return this.track.children;
      }

      scheduleMeasure() {
        if (this.measureFrame) return;
        this.measureFrame = requestAnimationFrame(() => {
          this.measureFrame = 0;
          this.measure();
        });
      }

      // The only place that reads layout: all reads first, then writes.
      measure() {
        const cards = this.cards;
        if (!cards.length) return;
        const clientWidth = this.track.clientWidth;
        const maxScroll = Math.max(0, this.track.scrollWidth - clientWidth);
        let step = cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : cards[0].offsetWidth;
        if (!step || step < 0) step = clientWidth || 1;

        this.step = step;
        this.position = this.track.scrollLeft;
        this.maxIndex = Math.round(maxScroll / step);
        this.syncDots();
        this.render();
      }

      syncDots() {
        if (!this.dotsWrap) return;
        const total = this.maxIndex + 1;
        if (this.dots.length === total) return;
        const label = this.dataset.dotLabel || '';
        this.dots = Array.from({ length: total }, (_, i) => {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'alc-csl__dot';
          dot.setAttribute('aria-label', `${label} ${i + 1}`.trim());
          dot.addEventListener('click', () => this.goTo(i));
          return dot;
        });
        this.dotsWrap.replaceChildren(...this.dots);
        this.dotsWrap.hidden = total <= 1;
        this.index = -1;
      }

      render() {
        const index = Math.min(this.maxIndex, Math.round(this.position / this.step));
        if (index !== this.index) {
          this.index = index;
          this.dots.forEach((dot, i) => dot.setAttribute('aria-current', i === index ? 'true' : 'false'));
        }
        if (this.prevButton) this.prevButton.disabled = index <= 0;
        if (this.nextButton) this.nextButton.disabled = index >= this.maxIndex;
      }

      onScroll() {
        if (this.frame) return;
        this.frame = requestAnimationFrame(() => {
          this.frame = 0;
          this.position = this.track.scrollLeft;
          this.render();
        });
      }

      goTo(index) {
        const target = Math.max(0, Math.min(index, this.maxIndex));
        this.track.scrollTo({ left: target * this.step });
      }

      // Mouse drag only: touch and pens scroll natively.
      onPointerDown(event) {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        this.drag = { x: event.clientX, scrollLeft: this.track.scrollLeft };
        this.dragged = false;
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp, { once: true });
        window.addEventListener('pointercancel', this.onPointerUp, { once: true });
      }

      onPointerMove(event) {
        if (!this.drag) return;
        const distance = event.clientX - this.drag.x;
        if (!this.dragged && Math.abs(distance) < 5) return;
        if (!this.dragged) {
          this.dragged = true;
          this.track.classList.add('is-dragging');
        }
        event.preventDefault();
        this.track.scrollLeft = this.drag.scrollLeft - distance;
      }

      onPointerUp() {
        window.removeEventListener('pointermove', this.onPointerMove);
        window.removeEventListener('pointerup', this.onPointerUp);
        window.removeEventListener('pointercancel', this.onPointerUp);
        if (!this.drag) return;
        this.drag = null;
        if (!this.dragged) return;
        this.track.classList.remove('is-dragging');
        // Let scroll snapping settle the row on the nearest card.
        this.goTo(Math.round(this.track.scrollLeft / this.step));
      }

      // A drag must not open the card it ended on.
      onClick(event) {
        if (!this.dragged) return;
        event.preventDefault();
        event.stopPropagation();
        this.dragged = false;
      }

      // Theme editor: bring the selected card into view.
      onBlockSelect(event) {
        let card = event.target;
        while (card && card.parentElement !== this.track) card = card.parentElement;
        if (!card) return;
        this.track.scrollTo({ left: card.offsetLeft - this.track.offsetLeft - 16 });
      }
    }
  );
}
