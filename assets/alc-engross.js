/**
 * Four-step quote request on the wholesale orders page (sections/alc-engross.liquid).
 *
 * The markup is one ordinary contact form; this element only shows it a step at a
 * time. Without JavaScript every step stays visible and the form still submits.
 */
(() => {
  if (customElements.get('alc-eg-quote')) return;

  class AlcEgQuote extends HTMLElement {
    connectedCallback() {
      if (this.ready) return;
      this.ready = true;
      this.steps = Array.from(this.querySelectorAll('[data-step]'));
      this.railSteps = Array.from(this.querySelectorAll('[data-go]'));
      this.back = this.querySelector('[data-back]');
      this.next = this.querySelector('[data-next]');
      this.submit = this.querySelector('[data-submit]');
      this.count = this.querySelector('[data-count]');
      this.total = this.steps.length;
      this.pointer = false;

      this.back.addEventListener('click', () => this.show(this.current - 1, true));
      this.next.addEventListener('click', () => this.show(this.current + 1, true));
      this.railSteps.forEach((button) => {
        button.addEventListener('click', () => this.show(Number(button.dataset.go), true));
      });

      // Enter in steps 1-3 moves on instead of sending a half-filled request.
      this.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'BUTTON') return;
        if (this.current < this.total) {
          event.preventDefault();
          this.show(this.current + 1, true);
        }
      });

      // Picking a project type with a click or tap moves straight to the products.
      const first = this.steps[0];
      first.addEventListener('pointerdown', () => {
        this.pointer = true;
      });
      first.addEventListener('change', () => {
        if (!this.pointer) return;
        this.pointer = false;
        window.setTimeout(() => this.show(2, true), 260);
      });

      this.show(Number(this.dataset.start) || 1, false);
    }

    show(index, userAction) {
      const step = Math.min(Math.max(index, 1), this.total);
      this.current = step;
      this.steps.forEach((fieldset, i) => {
        fieldset.hidden = i + 1 !== step;
      });
      this.railSteps.forEach((button, i) => {
        if (i + 1 === step) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
        button.classList.toggle('is-done', i + 1 < step);
      });
      this.style.setProperty('--eg-progress', `${(step / this.total) * 100}%`);
      this.back.hidden = step === 1;
      this.next.hidden = step === this.total;
      this.submit.hidden = step !== this.total;
      if (this.count) this.count.textContent = String(step);

      if (!userAction) return;
      const legend = this.steps[step - 1].querySelector('legend');
      if (legend) legend.focus({ preventScroll: true });
      const top = this.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.5) {
        this.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  customElements.define('alc-eg-quote', AlcEgQuote);
})();
