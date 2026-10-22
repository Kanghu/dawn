/**
 * Black Friday page (sections/alc-black-friday.liquid).
 *
 * <alc-bf-countdown data-start="YYYY-MM-DD" data-end="YYYY-MM-DD">: counts down to the
 * start (00:00, Bucharest time) while it is ahead, then to 23:59:59 of the end day, and
 * hides itself when there is nothing left to count. Crossing the start also switches the
 * line above the title ("Coming soon" -> "Starts today"), so a cached page catches up.
 * Category chips, sorting and the terms date come from assets/alc-offer-page.js.
 */
(() => {
  if (customElements.get('alc-bf-countdown')) return;

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
    return '+02:00';
  }

  function at(day, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) return null;
    return new Date(`${day}T${time}${bucharestOffset(new Date(`${day}T12:00:00Z`))}`);
  }

  // Today's date in Bucharest, as YYYY-MM-DD.
  function todayInBucharest() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) {
      return '';
    }
  }

  class AlcBfCountdown extends HTMLElement {
    connectedCallback() {
      this.start = at(this.dataset.start, '00:00:00');
      this.end = at(this.dataset.end, '23:59:59');
      this.root = this.closest('.alc-bf');
      this.kicker = this.root && this.root.querySelector('[data-kicker]');
      this.tick();
      this.timer = setInterval(() => this.tick(), 1000);
    }

    disconnectedCallback() {
      clearInterval(this.timer);
    }

    syncState() {
      if (!this.root || !this.kicker || !this.dataset.start) return;
      const today = todayInBucharest();
      if (!today) return;
      let state = 'live';
      if (today < this.dataset.start) state = 'soon';
      else if (today === this.dataset.start) state = 'today';
      if (state === this.root.dataset.state || state === 'soon') return;
      this.root.dataset.state = state;
      this.kicker.textContent = state === 'today' ? this.kicker.dataset.today : this.kicker.dataset.live;
    }

    tick() {
      const now = Date.now();
      let target = null;
      let label = this.dataset.labelEnd;
      if (this.start && now < this.start) {
        target = this.start;
        label = this.dataset.labelStart;
      } else if (this.end && now < this.end) {
        target = this.end;
      }
      this.syncState();
      if (!target) {
        clearInterval(this.timer);
        this.hidden = true;
        return;
      }
      this.hidden = false;
      let left = Math.max(0, Math.floor((target - now) / 1000));
      const d = Math.floor(left / 86400);
      left -= d * 86400;
      const h = Math.floor(left / 3600);
      left -= h * 3600;
      const m = Math.floor(left / 60);
      const s = left - m * 60;
      const q = (sel) => this.querySelector(sel);
      q('[data-label]').textContent = label;
      q('[data-d-unit]').hidden = d === 0;
      q('[data-d]').textContent = d;
      q('[data-d-label]').textContent = d === 1 ? this.dataset.day : this.dataset.days;
      q('[data-h]').textContent = pad(h);
      q('[data-m]').textContent = pad(m);
      q('[data-s]').textContent = pad(s);
    }
  }

  customElements.define('alc-bf-countdown', AlcBfCountdown);

  /**
   * <alc-bf-rail data-src="/collections/<handle>?section_id=alc-bf-rail">: one category row.
   * Fetches its cards (sections/alc-bf-rail) when it comes within about a screen of the
   * viewport, swaps them in for the placeholder tiles, shows the category's "up to -X%",
   * and drives the arrow buttons. A row that comes back empty, or fails, is removed along
   * with its chip.
   */
  // Two rows at a time at most: a quick scroll or a jump from the chips must not fire dozens
  // of requests at once (Shopify's bot protection answers bursts with 429). A failed request
  // is tried once more after a pause.
  const waiting = [];
  let running = 0;
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function request(url) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (response.ok) return await response.text();
      } catch (e) {}
      if (attempt === 0) await pause(1500);
    }
    throw new Error('failed');
  }

  function pump() {
    while (running < 2 && waiting.length) {
      const job = waiting.shift();
      running++;
      request(job.url)
        .then(job.resolve, job.reject)
        .finally(() => {
          running--;
          pump();
        });
    }
  }

  function queued(url) {
    return new Promise((resolve, reject) => {
      waiting.push({ url, resolve, reject });
      pump();
    });
  }

  const observer =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              observer.unobserve(entry.target);
              entry.target.load();
            });
          },
          { rootMargin: '900px 0px' }
        )
      : null;

  class AlcBfRail extends HTMLElement {
    connectedCallback() {
      if (this.bound) return;
      this.bound = true;
      this.block = this.closest('.alc-bf__cat');
      this.track = this.querySelector('[data-track]');
      this.prev = this.block && this.block.querySelector('[data-prev]');
      this.next = this.block && this.block.querySelector('[data-next]');
      this.prev?.addEventListener('click', () => this.page(-1));
      this.next?.addEventListener('click', () => this.page(1));
      this.track.addEventListener('scroll', () => this.updateArrows(), { passive: true });
      if (observer) observer.observe(this);
      else this.load();
    }

    async load() {
      if (this.loading) return;
      this.loading = true;
      try {
        const html = await queued(this.dataset.src);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const source = doc.querySelector('.alc-bf-rail-src');
        const items = source ? [...source.children] : [];
        if (!items.length || source.dataset.count === '0') throw new Error('empty');
        this.track.replaceChildren(...items.map((item) => document.adoptNode(item)));
        this.classList.add('is-loaded');
        const max = parseInt(source.dataset.max, 10);
        const pct = this.block && this.block.querySelector('[data-pct]');
        if (pct && max > 0) {
          pct.querySelector('[data-pct-value]').textContent = max;
          pct.hidden = false;
        }
        this.updateArrows();
      } catch (e) {
        this.drop();
      }
    }

    drop() {
      const handle = this.dataset.handle;
      const root = this.closest('.alc-bf');
      root?.querySelector(`[data-chip="${CSS.escape(handle)}"]`)?.remove();
      (this.block || this).remove();
    }

    // One "page" = the visible width minus one card, so the next page starts with the last card seen.
    page(direction) {
      const card = this.track.querySelector('.alc-bf__rail-item');
      const step = Math.max(card ? card.getBoundingClientRect().width : 0, this.track.clientWidth - (card ? card.getBoundingClientRect().width : 0));
      this.track.scrollBy({ left: direction * step, behavior: 'smooth' });
    }

    updateArrows() {
      if (!this.prev || !this.next) return;
      const max = this.track.scrollWidth - this.track.clientWidth - 2;
      this.prev.disabled = this.track.scrollLeft <= 2;
      this.next.disabled = this.track.scrollLeft >= max;
    }
  }

  customElements.define('alc-bf-rail', AlcBfRail);
})();
