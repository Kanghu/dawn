/*
  Factory page film (sections/alc-factory.liquid).

  <alc-fa-video> holds a poster that links to YouTube. A plain click swaps it for the
  privacy-enhanced player (youtube-nocookie.com), so nothing loads from YouTube before
  the visitor asks for the film. Links marked data-alc-fa-play (the hero button) scroll
  to the film and start it.
*/
if (!customElements.get('alc-fa-video')) {
  customElements.define(
    'alc-fa-video',
    class AlcFaVideo extends HTMLElement {
      connectedCallback() {
        this.link = this.querySelector('.alc-fa__player-link');
        if (!this.link) return;

        this.link.addEventListener('click', (event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          this.play();
        });

        const warm = () => this.warm();
        this.addEventListener('pointerover', warm, { once: true });
        this.addEventListener('focusin', warm, { once: true });
      }

      warm() {
        if (this.warmed) return;
        this.warmed = true;
        ['https://www.youtube-nocookie.com', 'https://i.ytimg.com'].forEach((href) => {
          const link = document.createElement('link');
          link.rel = 'preconnect';
          link.href = href;
          document.head.append(link);
        });
      }

      play() {
        if (this.frame || !this.dataset.id) return;
        const frame = document.createElement('iframe');
        frame.className = 'alc-fa__player-frame';
        frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(this.dataset.id)}?autoplay=1&rel=0&playsinline=1`;
        frame.title = this.dataset.title || '';
        frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        frame.allowFullscreen = true;
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        this.append(frame);
        this.frame = frame;
        this.classList.add('is-playing');
        this.link.setAttribute('tabindex', '-1');
        frame.focus({ preventScroll: true });
      }
    }
  );
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-alc-fa-play]');
  if (!trigger) return;
  const player = document.querySelector(trigger.getAttribute('href'));
  if (!player || typeof player.play !== 'function') return;
  event.preventDefault();
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  player.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  player.play();
});
