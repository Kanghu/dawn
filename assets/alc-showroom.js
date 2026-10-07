/* alc-showroom.js — gallery (zone filter, "see all", lightbox), deferred map,
   deferred video and the minute tick of the open/closed status. Reveal on
   scroll is Dawn's own (animations.js), as on the other pages.
   No dependencies; every widget is opt-in through data attributes so the
   section degrades to plain content when JS is unavailable. */
(function () {
  'use strict';

  var ICON = {
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    prev: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>'
  };

  function button(cls, label, icon) {
    return (
      '<button type="button" class="alcshow-lightbox__btn alcshow-lightbox__btn--' + cls + '" aria-label="' + label + '">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icon + '</svg></button>'
    );
  }

  /* ----------------------------------------------------------------------
     Lightbox: steps through every photo of the zone being shown, including
     the ones still folded away behind "see all".
     ---------------------------------------------------------------------- */

  function Lightbox(grid, getTiles) {
    this.grid = grid;
    this.getTiles = getTiles;
    this.tiles = [];
    this.index = 0;
    this.lastFocus = null;
    this.build();

    var self = this;
    grid.addEventListener('click', function (event) {
      var tile = event.target.closest('[data-alcshow-tile]');
      if (!tile || !grid.contains(tile)) return;
      self.tiles = self.getTiles();
      self.open(self.tiles.indexOf(tile));
    });
  }

  Lightbox.prototype.build = function () {
    // Labels come from the section, which resolves them through the theme's
    // locale files, so they follow the language the visitor selected.
    var grid = this.grid;
    var label = function (name, fallback) {
      return (grid.getAttribute('data-alcshow-label-' + name) || fallback).replace(/"/g, '&quot;');
    };

    var el = document.createElement('div');
    el.className = 'alcshow-lightbox';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('data-open', 'false');
    el.innerHTML =
      '<p class="alcshow-lightbox__count" aria-hidden="true"></p>' +
      button('close', label('close', 'Close'), ICON.close) +
      button('prev', label('prev', 'Previous'), ICON.prev) +
      button('next', label('next', 'Next'), ICON.next) +
      '<img alt="" decoding="async">' +
      '<p class="alcshow-lightbox__caption" aria-live="polite"></p>';

    document.body.appendChild(el);

    this.el = el;
    this.img = el.querySelector('img');
    this.count = el.querySelector('.alcshow-lightbox__count');
    this.caption = el.querySelector('.alcshow-lightbox__caption');
    this.closeBtn = el.querySelector('.alcshow-lightbox__btn--close');
    this.prevBtn = el.querySelector('.alcshow-lightbox__btn--prev');
    this.nextBtn = el.querySelector('.alcshow-lightbox__btn--next');

    var self = this;
    this.img.addEventListener('load', function () {
      self.img.classList.add('is-loaded');
    });

    this.closeBtn.addEventListener('click', this.close.bind(this));
    this.prevBtn.addEventListener('click', this.step.bind(this, -1));
    this.nextBtn.addEventListener('click', this.step.bind(this, 1));

    el.addEventListener('click', function (event) {
      if (event.target === el) self.close();
    });

    // Swipe left/right on phones; a mostly vertical drag is left alone.
    var x0 = null, y0 = 0;
    el.addEventListener(
      'touchstart',
      function (event) {
        if (event.touches.length !== 1) return;
        x0 = event.touches[0].clientX;
        y0 = event.touches[0].clientY;
      },
      { passive: true }
    );
    el.addEventListener(
      'touchend',
      function (event) {
        if (x0 === null) return;
        var dx = event.changedTouches[0].clientX - x0;
        var dy = event.changedTouches[0].clientY - y0;
        x0 = null;
        if (self.tiles.length > 1 && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) self.step(dx < 0 ? 1 : -1);
      },
      { passive: true }
    );

    document.addEventListener('keydown', function (event) {
      if (self.el.getAttribute('data-open') !== 'true') return;
      var multi = self.tiles.length > 1;
      if (event.key === 'Escape') self.close();
      if (multi && event.key === 'ArrowLeft') self.step(-1);
      if (multi && event.key === 'ArrowRight') self.step(1);
      if (event.key === 'Tab') {
        // Keep focus inside the dialog.
        var focusable = Array.prototype.filter.call(self.el.querySelectorAll('button'), function (b) {
          return !b.hidden && b.offsetParent !== null;
        });
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
    });
  };

  Lightbox.prototype.show = function (index) {
    var total = this.tiles.length;
    if (!total) return;
    this.index = ((index % total) + total) % total;

    var tile = this.tiles[this.index];
    var src = tile.getAttribute('data-alcshow-full') || '';
    if (this.img.getAttribute('src') !== src) {
      this.img.classList.remove('is-loaded');
      this.img.src = src;
      if (this.img.complete && this.img.naturalWidth) this.img.classList.add('is-loaded');
    }
    this.img.alt = tile.getAttribute('data-alcshow-alt') || '';
    this.caption.textContent = tile.getAttribute('data-alcshow-caption') || '';

    var multi = total > 1;
    this.count.textContent = multi ? this.index + 1 + ' / ' + total : '';
    this.prevBtn.hidden = !multi;
    this.nextBtn.hidden = !multi;

    // Warm the neighbours so stepping through feels instant.
    if (multi) {
      [1, -1].forEach(
        function (d) {
          var n = this.tiles[(this.index + d + total) % total];
          if (n && n !== tile) new Image().src = n.getAttribute('data-alcshow-full') || '';
        }.bind(this)
      );
    }
  };

  Lightbox.prototype.open = function (index) {
    if (index < 0) return;
    this.lastFocus = document.activeElement;
    this.show(index);
    this.el.setAttribute('data-open', 'true');
    document.documentElement.style.overflow = 'hidden';

    // The dialog is still visibility:hidden in this frame, so focus() would be
    // a no-op; wait for the style to apply first.
    var closeBtn = this.closeBtn;
    requestAnimationFrame(function () {
      closeBtn.focus();
    });
  };

  Lightbox.prototype.close = function () {
    this.el.setAttribute('data-open', 'false');
    document.documentElement.style.overflow = '';
    if (this.lastFocus && this.lastFocus.focus) this.lastFocus.focus();
  };

  Lightbox.prototype.step = function (delta) {
    this.show(this.index + delta);
  };

  /* ----------------------------------------------------------------------
     Gallery: zone chips and "see all". "All" keeps the first rows and folds
     the rest behind the button; a single zone shows all of its photos.
     ---------------------------------------------------------------------- */

  function initGallery(section) {
    var grid = section.querySelector('[data-alcshow-gallery]');
    if (!grid) return;

    var items = Array.prototype.slice.call(grid.children);
    var cap = parseInt(grid.getAttribute('data-alcshow-cap'), 10) || items.length;
    var more = section.querySelector('[data-alcshow-more]');
    var moreWrap = more && more.parentElement;
    var zone = 'all';
    var expanded = false;

    var render = function () {
      var shown = 0;
      items.forEach(function (item) {
        var match = zone === 'all' || item.getAttribute('data-zone') === zone;
        var visible = match && (expanded || zone !== 'all' || shown < cap);
        if (match && visible) shown++;
        item.hidden = !visible;
      });
      if (moreWrap) moreWrap.hidden = expanded || zone !== 'all' || items.length <= cap;
    };

    if (more) {
      more.addEventListener('click', function () {
        expanded = true;
        render();
        // Move focus to the first newly shown photo.
        var next = items[cap] && items[cap].querySelector('button');
        if (next) next.focus({ preventScroll: true });
      });
    }

    var filter = section.querySelector('[data-alcshow-filter]');
    if (filter) {
      filter.addEventListener('click', function (event) {
        var btn = event.target.closest('[data-zone]');
        if (!btn) return;
        zone = btn.getAttribute('data-zone');
        Array.prototype.forEach.call(filter.querySelectorAll('[data-zone]'), function (b) {
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        render();
      });
    }

    new Lightbox(grid, function () {
      return items
        .filter(function (item) {
          return zone === 'all' || item.getAttribute('data-zone') === zone;
        })
        .map(function (item) {
          return item.querySelector('[data-alcshow-tile]');
        });
    });
  }

  /* ----------------------------------------------------------------------
     Deferred Google Maps embed: the iframe is only created on click, so the
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

  /* ---------------------------------------------------------------------- */

  function init(scope) {
    var roots = (scope || document).querySelectorAll('.alcshow');

    Array.prototype.forEach.call(roots, function (root) {
      if (root.dataset.alcshowReady === 'true') return;
      root.dataset.alcshowReady = 'true';

      Array.prototype.forEach.call(root.querySelectorAll('[data-alcshow-gallery-section]'), initGallery);
      Array.prototype.forEach.call(root.querySelectorAll('[data-alcshow-map-open]'), initMap);
      Array.prototype.forEach.call(root.querySelectorAll('[data-alcshow-video-open]'), initVideo);

      // The open/closed status is drawn by the inline script in the section;
      // keep it current for visitors who leave the tab open.
      if (window.alcShowStatus && root.hasAttribute('data-hours')) {
        window.alcShowStatus(root);
        setInterval(function () {
          window.alcShowStatus(root);
        }, 60000);
      }
    });
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
    init(event.target);
  });
})();
