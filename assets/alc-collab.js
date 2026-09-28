/**
 * Collaboration formats as tabs on the marketing collaborations page
 * (sections/alc-collab.liquid). Follows the WAI-ARIA tabs pattern: arrow keys,
 * Home and End move between tabs, and only the selected tab is in the tab order.
 */
(() => {
  if (customElements.get('alc-cl-tabs')) return;

  class AlcClTabs extends HTMLElement {
    connectedCallback() {
      if (this.ready) return;
      this.ready = true;
      this.tabs = Array.from(this.querySelectorAll('[role="tab"]'));
      this.tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => this.select(index, false));
        tab.addEventListener('keydown', (event) => this.onKey(event, index));
      });
    }

    onKey(event, index) {
      const last = this.tabs.length - 1;
      let next = null;
      if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
      if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = last;
      if (next === null) return;
      event.preventDefault();
      this.select(next, true);
    }

    select(index, focus) {
      this.tabs.forEach((tab, i) => {
        const on = i === index;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      const tab = this.tabs[index];
      if (focus) tab.focus();
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }

  customElements.define('alc-cl-tabs', AlcClTabs);
})();
