/**
 * Arrows for the product-page recommendation rows (sections/alc-related-products-dynamic,
 * sections/alc-recently-viewed). Delegated, because the recently-viewed cards are
 * inserted after load by alc-recently-viewed.js.
 */
(() => {
  if (window.alcRecs) return;
  window.alcRecs = true;

  const trackOf = (root) => root.querySelector('.alc-recs__grid');

  function sync(root) {
    const track = trackOf(root);
    const prev = root.querySelector('[data-alc-recs-prev]');
    const next = root.querySelector('[data-alc-recs-next]');
    if (!track || !prev || !next) return;
    const max = track.scrollWidth - track.clientWidth;
    root.classList.toggle('is-scrollable', max > 4);
    prev.disabled = track.scrollLeft < 4;
    next.disabled = track.scrollLeft > max - 4;
  }

  const syncAll = () => document.querySelectorAll('.alc-recs').forEach(sync);

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-alc-recs-prev], [data-alc-recs-next]');
    if (!btn) return;
    const track = trackOf(btn.closest('.alc-recs'));
    if (!track) return;
    const step = Math.max(track.clientWidth * 0.8, 240);
    track.scrollBy({ left: btn.hasAttribute('data-alc-recs-prev') ? -step : step, behavior: 'smooth' });
  });

  document.addEventListener(
    'scroll',
    (event) => {
      const root = event.target.closest?.('.alc-recs');
      if (root) sync(root);
    },
    true
  );

  window.addEventListener('resize', syncAll, { passive: true });
  document.querySelectorAll('.alc-recs').forEach((root) => {
    new MutationObserver(() => sync(root)).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  });
  syncAll();
})();
