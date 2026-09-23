/**
 * Desktop header menu (snippets/aless-mega-menu.liquid).
 *
 * - Pointer: opens on hover after a short intent delay and closes shortly after
 *   the pointer leaves, so crossing the menu bar does not flash panels.
 * - Click/tap on a trigger toggles its panel (touch laptops, tablets).
 * - Keyboard: Enter/Space toggles, Esc closes and returns focus to the trigger.
 * - Mega panels: hovering or focusing a category on the left shows its pane on
 *   the right. The last active category is kept, so a panel never opens empty.
 */
(() => {
  const nav = document.querySelector('.alc-mm');
  if (!nav || nav.dataset.alcMmReady) return;
  nav.dataset.alcMmReady = 'true';

  const OPEN_DELAY = 120;
  const CLOSE_DELAY = 220;
  const backdrop = document.querySelector('[data-alc-mm-backdrop]');
  const items = Array.from(nav.querySelectorAll('[data-alc-mm-item]'));
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  let openItem = null;
  let timer = 0;

  const parts = (item) => ({
    trigger: item.querySelector('[data-alc-mm-trigger]'),
    panel: item.querySelector('[data-alc-mm-panel]'),
  });

  function activateCat(panel, cat) {
    if (!cat) return;
    const id = cat.dataset.alcMmCat;
    panel.querySelectorAll('[data-alc-mm-cat]').forEach((c) => c.classList.toggle('is-active', c === cat));
    panel.querySelectorAll('[data-alc-mm-pane]').forEach((p) => {
      p.hidden = p.dataset.alcMmPane !== id;
    });
  }

  function open(item) {
    if (openItem === item) return;
    close();
    const { trigger, panel } = parts(item);
    if (!trigger || !panel) return;
    if (!panel.querySelector('.alc-mm__cat.is-active')) {
      activateCat(panel, panel.querySelector('[data-alc-mm-cat]'));
    }
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    if (backdrop && item.classList.contains('alc-mm__item--mega')) backdrop.hidden = false;
    openItem = item;
  }

  function close() {
    if (!openItem) return;
    const { trigger, panel } = parts(openItem);
    if (panel) panel.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (backdrop) backdrop.hidden = true;
    openItem = null;
  }

  function schedule(fn, delay) {
    clearTimeout(timer);
    timer = setTimeout(fn, delay);
  }

  items.forEach((item) => {
    const { trigger, panel } = parts(item);
    if (!trigger || !panel) return;

    item.addEventListener('mouseenter', () => {
      if (!canHover.matches) return;
      schedule(() => open(item), openItem ? 0 : OPEN_DELAY);
    });
    item.addEventListener('mouseleave', () => {
      if (!canHover.matches) return;
      schedule(close, CLOSE_DELAY);
    });

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      clearTimeout(timer);
      if (openItem === item) close();
      else open(item);
    });

    panel.querySelectorAll('[data-alc-mm-cat]').forEach((cat) => {
      cat.addEventListener('mouseenter', () => activateCat(panel, cat));
      cat.addEventListener('focus', () => activateCat(panel, cat));
    });

    item.addEventListener('focusout', (event) => {
      if (!item.contains(event.relatedTarget)) schedule(close, 0);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !openItem) return;
    const { trigger } = parts(openItem);
    close();
    if (trigger) trigger.focus();
  });

  document.addEventListener('click', (event) => {
    if (openItem && !openItem.contains(event.target)) close();
  });
})();
