/**
 * Collection view switch (snippets/alc-view-switch.liquid) and the collapsible
 * description of the info block under the grid.
 * Stores the choice in localStorage and sets data-alc-view on the [data-alc-coll]
 * wrapper; the layouts are pure CSS (assets/alc-collection-view.css). One delegated
 * listener, so the buttons keep working after facets.js re-renders the grid.
 */
(() => {
  if (window.alcCollectionView) return;
  window.alcCollectionView = true;

  const KEY = 'alc:collection-view';
  const VIEWS = ['grid', 'large', 'list'];

  function syncButtons(root) {
    const view = root.dataset.alcView || 'grid';
    root.querySelectorAll('[data-alc-view-btn]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.alcViewBtn === view));
    });
  }

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-alc-view-btn]');
    if (!btn) return;
    const root = btn.closest('[data-alc-coll]');
    const view = btn.dataset.alcViewBtn;
    if (!root || !VIEWS.includes(view)) return;
    root.dataset.alcView = view;
    try {
      localStorage.setItem(KEY, view);
    } catch (e) {}
    syncButtons(root);
  });

  // Collection info block: collapse a long description behind "read all". The full
  // text is always in the DOM; only its visible height changes. On desktop the
  // collapsed text runs down to the bottom of the FAQ card beside it.
  const desktop = window.matchMedia('(min-width: 990px)');

  function clampAbout(body) {
    const text = body.closest('.alc-about__text');
    const faq = body.closest('.alc-about').querySelector('.alc-about__faq');
    let limit = desktop.matches ? 300 : 260;
    if (desktop.matches && faq) limit = Math.max(limit, faq.offsetHeight - (text.offsetHeight - body.offsetHeight));
    body.style.setProperty('--alc-ab-clamp', limit + 'px');
    return limit;
  }

  function initAbout(scope) {
    scope.querySelectorAll('[data-alc-about-body]').forEach((body) => {
      if (body.dataset.alcAboutReady) return;
      body.dataset.alcAboutReady = 'true';
      // Descriptions come from the admin editor with blank spacer paragraphs and headings.
      body.querySelectorAll('p, h1, h2, h3, h4, h5, h6').forEach((el) => {
        if (!el.textContent.trim() && !el.querySelector('img, iframe, video')) el.remove();
      });
      const toggle = body.parentElement.querySelector('[data-alc-about-toggle]');
      if (!toggle) return;
      toggle.hidden = false;
      body.classList.add('is-collapsed');
      if (body.scrollHeight <= clampAbout(body) + 40) {
        body.classList.remove('is-collapsed');
        toggle.hidden = true;
      }
    });
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      document.querySelectorAll('[data-alc-about-body].is-collapsed').forEach(clampAbout);
    }, 150);
  });

  function setAbout(toggle, open) {
    const body = document.getElementById(toggle.getAttribute('aria-controls'));
    if (!body) return;
    body.classList.toggle('is-collapsed', !open);
    toggle.setAttribute('aria-expanded', String(open));
  }

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-alc-about-toggle]');
    if (toggle) {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      setAbout(toggle, open);
      if (!open) toggle.closest('.alc-about__text').scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    // The header's "read more" teaser jumps here: open the text on the way.
    const jump = event.target.closest('a[href="#AlcCollAbout"]');
    if (jump) {
      const t = document.querySelector('[data-alc-about-toggle]');
      if (t) setAbout(t, true);
    }
  });

  initAbout(document);
  document.querySelectorAll('[data-alc-coll]').forEach((root) => {
    syncButtons(root);
    // facets.js replaces the grid container (buttons included) on each filter change.
    const container = root.querySelector('#ProductGridContainer');
    if (container) new MutationObserver(() => syncButtons(root)).observe(container, { childList: true });
  });
})();
