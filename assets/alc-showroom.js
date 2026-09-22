/* alc-showroom.js — lightbox, deferred map, deferred video, scroll reveal.
   No dependencies. Every widget is opt-in through data attributes so the
   section degrades to plain content when JS is unavailable. */
(function () {
  'use strict';

  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------------------
     Lightbox
     ---------------------------------------------------------------------- */

  function Lightbox(root) {
    this.root = root;
    this.tiles = Array.prototype.slice.call(root.querySelectorAll('[data-alcshow-tile]'));
    if (!this.tiles.length) return;

    this.index = 0;
    this.lastFocus = null;
    this.build();

    this.tiles.forEach(
      function (tile, i) {
        tile.addEventListener(
          'click',
          function () {
            this.open(i);
          }.bind(this)
        );
      }.bind(this)
    );
  }

  Lightbox.prototype.build = function () {
    // Labels come from the section, which resolves them through the theme's
    // locale files — so they follow the language the visitor selected.
    var label = function (name, fallback) {
      return this.root.getAttribute('data-alcshow-label-' + name) || fallback;
    }.bind(this);

    var el = document.createElement('div');
    el.className = 'alcshow-lightbox';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('data-open', 'false');
    el.hidden = false;
    el.innerHTML =
      '<button type="button" class="alcshow-lightbox__btn alcshow-lightbox__btn--close" aria-label="' +
      label('close', 'Close') +
      '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button>' +
      '<button type="button" class="alcshow-lightbox__btn alcshow-lightbox__btn--prev" aria-label="' +
      label('prev', 'Previous') +
      '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<button type="button" class="alcshow-lightbox__btn alcshow-lightbox__btn--next" aria-label="' +
      label('next', 'Next') +
      '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>' +
      '<img alt="">' +
      '<p class="alcshow-lightbox__caption"></p>';

    document.body.appendChild(el);

    this.el = el;
    this.img = el.querySelector('img');
    this.caption = el.querySelector('.alcshow-lightbox__caption');
    this.closeBtn = el.querySelector('.alcshow-lightbox__btn--close');

    el.querySelector('.alcshow-lightbox__btn--close').addEventListener('click', this.close.bind(this));
    el.querySelector('.alcshow-lightbox__btn--prev').addEventListener('click', this.step.bind(this, -1));
    el.querySelector('.alcshow-lightbox__btn--next').addEventListener('click', this.step.bind(this, 1));

    el.addEventListener(
      'click',
      function (event) {
        if (event.target === el || event.target === this.img) this.close();
      }.bind(this)
    );

    document.addEventListener(
      'keydown',
      function (event) {
        if (this.el.getAttribute('data-open') !== 'true') return;
        if (event.key === 'Escape') this.close();
        if (event.key === 'ArrowLeft') this.step(-1);
        if (event.key === 'ArrowRight') this.step(1);
        if (event.key === 'Tab') {
          // Only three controls are focusable; keep focus inside the dialog.
          var focusable = Array.prototype.slice.call(this.el.querySelectorAll('button'));
          var first = focusable[0];
          var last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }.bind(this)
    );
  };

  Lightbox.prototype.show = function (index) {
    var total = this.tiles.length;
    this.index = ((index % total) + total) % total;

    var tile = this.tiles[this.index];
    this.img.src = tile.getAttribute('data-alcshow-full') || '';
    this.img.alt = tile.getAttribute('data-alcshow-alt') || '';
    this.caption.textContent = tile.getAttribute('data-alcshow-caption') || '';
  };

  Lightbox.prototype.open = function (index) {
    this.lastFocus = document.activeElement;
    this.show(index);
    this.el.setAttribute('data-open', 'true');
    document.documentElement.style.overflow = 'hidden';

    // The dialog is still visibility:hidden in this frame, so focus() would be
    // a no-op — wait for the style to apply first.
    var closeBtn = this.closeBtn;
    requestAnimationFrame(function () {
      closeBtn.focus();
    });
  };

  Lightbox.prototype.close = function () {
    this.el.setAttribute('data-open', 'false');
    document.documentElement.style.overflow = '';
    this.img.src = '';
    if (this.lastFocus && this.lastFocus.focus) this.lastFocus.focus();
  };

  Lightbox.prototype.step = function (delta) {
    this.show(this.index + delta);
  };

  /* ----------------------------------------------------------------------
     Deferred Google Maps embed — the iframe is only created on click, so the
     page never ships a third-party frame to visitors who don't want one.
     ---------------------------------------------------------------------- */

  function initMap(button) {
    button.addEventListener('click', function () {
      var holder = button.closest('[data-alcshow-map]');
      if (!holder) return;

      var src = holder.getAttribute('data-alcshow-map-src');
      if (!src) return;

      var frame = document.createElement('iframe');
      frame.src = src;
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer-when-downgrade';
      frame.allowFullscreen = true;
      frame.title = holder.getAttribute('data-alcshow-map-title') || 'Google Maps';

      holder.appendChild(frame);
      button.remove();
    });
  }

  /* ----------------------------------------------------------------------
     Deferred video
     ---------------------------------------------------------------------- */

  function initVideo(button) {
    button.addEventListener('click', function () {
      var holder = button.closest('[data-alcshow-video]');
      if (!holder) return;

      var src = holder.getAttribute('data-alcshow-video-src');
      if (!src) return;

      var video = document.createElement('video');
      video.src = src;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = 'auto';

      var poster = holder.getAttribute('data-alcshow-video-poster');
      if (poster) video.poster = poster;

      holder.appendChild(video);
      button.remove();
    });
  }

  /* ----------------------------------------------------------------------
     Scroll reveal
     ---------------------------------------------------------------------- */

  function initReveal(scope) {
    var targets = scope.querySelectorAll('[data-alcshow-reveal]');
    if (!targets.length) return;

    // Without IntersectionObserver (or with reduced motion) leave the content
    // in its default, visible state rather than hiding it and hoping.
    if (reduceMotion || !('IntersectionObserver' in window)) return;

    Array.prototype.forEach.call(scope.querySelectorAll('.alcshow'), function (root) {
      root.classList.add('alcshow--animate');
    });
    if (scope.classList && scope.classList.contains('alcshow')) {
      scope.classList.add('alcshow--animate');
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
    );

    Array.prototype.forEach.call(targets, function (el) {
      observer.observe(el);
    });
  }

  /* ---------------------------------------------------------------------- */

  function init(scope) {
    var root = scope || document;

    Array.prototype.forEach.call(root.querySelectorAll('[data-alcshow-gallery]'), function (gallery) {
      if (gallery.dataset.alcshowReady === 'true') return;
      gallery.dataset.alcshowReady = 'true';
      new Lightbox(gallery);
    });

    Array.prototype.forEach.call(root.querySelectorAll('[data-alcshow-map-open]'), initMap);
    Array.prototype.forEach.call(root.querySelectorAll('[data-alcshow-video-open]'), initVideo);

    initReveal(root === document ? document.body : root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
    });
  } else {
    init();
  }

  // Theme editor: re-init when the section is re-rendered.
  document.addEventListener('shopify:section:load', function (event) {
    if (event.target.querySelector('.alcshow')) init(event.target);
  });
})();
