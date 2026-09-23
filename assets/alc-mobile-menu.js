/**
 * Mobile / tablet drawer menu (snippets/alc-header-drawer-stacked.liquid).
 *
 * Dawn's <header-drawer> keeps opening/closing the drawer; this only drives the UI
 * inside it: tabs (arrow keys supported), the slide-in sub-panel for a category and
 * its accordion. Esc closes an open sub-panel before Dawn gets to close the drawer,
 * and everything resets when the drawer closes.
 */
(() => {
  const root = document.querySelector('[data-alc-md]');
  if (!root || root.dataset.alcMdReady) return;
  root.dataset.alcMdReady = 'true';

  const tabs = Array.from(root.querySelectorAll('[data-alc-md-tab]'));
  const views = Array.from(root.querySelectorAll('[data-alc-md-view]'));
  const scroller = root.querySelector('[data-alc-md-views]');
  let openSub = null;
  let opener = null;

  function selectTab(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    views.forEach((v) => {
      v.hidden = v.id !== tab.getAttribute('aria-controls');
    });
    if (scroller) scroller.scrollTop = 0;
    if (focus) tab.focus();
    // Keep the chosen tab visible in the scrollable tab row, without scrolling the page.
    const row = tab.parentElement;
    if (row && row.scrollWidth > row.clientWidth) {
      const t = tab.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      if (t.left < r.left) row.scrollLeft -= r.left - t.left + 16;
      else if (t.right > r.right) row.scrollLeft += t.right - r.right + 16;
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      selectTab(tabs[(index + step + tabs.length) % tabs.length], true);
    });
  });

  function openPanel(sub, button) {
    sub.hidden = false;
    sub.querySelector('.alc-md__sub-body').scrollTop = 0;
    // Force a style flush so the slide-in transition starts from the off-screen position.
    void sub.offsetWidth;
    sub.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    openSub = sub;
    opener = button;
    const back = sub.querySelector('[data-alc-md-back]');
    if (back) back.focus({ preventScroll: true });
  }

  function closePanel(immediate) {
    if (!openSub) return;
    const sub = openSub;
    const button = opener;
    openSub = null;
    opener = null;
    sub.classList.remove('is-open');
    if (button) button.setAttribute('aria-expanded', 'false');
    if (immediate) {
      sub.hidden = true;
      return;
    }
    // A timer rather than transitionend, which never fires under reduced motion.
    setTimeout(() => {
      if (!sub.classList.contains('is-open')) sub.hidden = true;
    }, 320);
    if (button) button.focus({ preventScroll: true });
  }

  function toggleAccordion(button) {
    const body = document.getElementById(button.getAttribute('aria-controls'));
    const expand = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(expand));
    if (body) body.hidden = !expand;
  }

  // Dawn's MenuDrawer (global.js) binds every <button> inside <header-drawer> as a
  // "close submenu" button, which would close the whole drawer on each tap here. A
  // capture-phase listener on the menu root runs before those button listeners, so it
  // handles our buttons and stops the event there. Links are left alone.
  root.addEventListener(
    'click',
    (event) => {
      const tab = event.target.closest('[data-alc-md-tab]');
      const open = event.target.closest('[data-alc-md-open]');
      const back = event.target.closest('[data-alc-md-back]');
      const acc = event.target.closest('[data-alc-md-acc]');
      if (!tab && !open && !back && !acc) return;
      event.stopPropagation();
      event.preventDefault();
      if (tab) {
        selectTab(tab);
      } else if (open) {
        const sub = document.getElementById(open.dataset.alcMdOpen);
        if (sub) openPanel(sub, open);
      } else if (back) {
        closePanel(false);
      } else if (acc) {
        toggleAccordion(acc);
      }
    },
    true
  );

  root.addEventListener('keyup', (event) => {
    if (event.key === 'Escape' && openSub) {
      event.stopPropagation();
      closePanel(false);
    }
  });

  const drawer = root.closest('details');
  if (drawer) {
    drawer.addEventListener('toggle', () => {
      if (!drawer.open) {
        closePanel(true);
        if (tabs[0]) selectTab(tabs[0]);
      }
    });
  }
})();
