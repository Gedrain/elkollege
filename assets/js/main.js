(function () {
  'use strict';
  var doc = document.documentElement;
  var ROOT = doc.getAttribute('data-root') || '';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {  } }
  };

  function fixLinks(scope) {
    if (location.protocol !== 'file:') return;
    $$('a[href]', scope).forEach(function (a) {
      var h = a.getAttribute('href');
      if (/^(?:[a-z]+:|#|\/\/)/i.test(h)) return;
      var parts = h.split('#');
      if (parts[0] === '' ) return;
      if (/\/$/.test(parts[0]) || parts[0] === './' || parts[0] === '..') {
        a.setAttribute('href', parts[0].replace(/\/?$/, '/') + 'index.html' + (parts[1] ? '#' + parts[1] : ''));
      }
    });
  }
  fixLinks(document);

  $$('[data-split]').forEach(function (el) {
    var i = 0;
    (function walk(node, cls) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) {
          var frag = document.createDocumentFragment();
          ch.textContent.split(/([ \t\n\r]+)/).forEach(function (part) {
            if (!part) return;
            if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'w';
            var s = document.createElement('span'); s.textContent = part; s.style.setProperty('--i', i++);
            if (cls) s.className = cls;
            w.appendChild(s); frag.appendChild(w);
          });
          node.replaceChild(frag, ch);
        } else if (ch.nodeType === 1) {
          var c = ch.classList.contains('hl') ? 'hl' : cls;
          if (c === 'hl') ch.classList.remove('hl');
          walk(ch, c);
        }
      });
    })(el, null);
  });

  var header = $('[data-header]');
  var toTop = $('.totop');
  var ring = toTop && $('circle', toTop);
  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle('is-scrolled', y > 60);
    if (toTop) {
      toTop.classList.toggle('is-shown', y > 700);
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (ring) ring.style.setProperty('--off', (138 - 138 * (max > 0 ? y / max : 0)).toFixed(1));
    }
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { onScroll(); ticking = false; });
  }, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); });

  var noHover = window.matchMedia('(hover: none)').matches;
  $$('.mainnav .top-item').forEach(function (item) {
    var link = $('.top-link', item);
    link.addEventListener('click', function (e) {
      if (noHover && !item.classList.contains('is-open')) {
        e.preventDefault();
        $$('.mainnav .top-item.is-open').forEach(function (o) { o.classList.remove('is-open'); });
        item.classList.add('is-open');
      }
    });
    item.addEventListener('keydown', function (e) { if (e.key === 'Escape') { item.classList.remove('is-open'); link.focus(); } });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.mainnav')) $$('.mainnav .top-item.is-open').forEach(function (o) { o.classList.remove('is-open'); });
  });

  var burger = $('.burger');
  var drawer = $('#drawer');
  function setDrawer(open) {
    document.body.classList.toggle('drawer-open', open);
    if (burger) { burger.setAttribute('aria-expanded', String(open)); }
    if (drawer) drawer.setAttribute('aria-hidden', String(!open));
  }
  if (burger) burger.addEventListener('click', function () { setDrawer(!document.body.classList.contains('drawer-open')); });
  $$('[data-drawer-close]').forEach(function (b) { b.addEventListener('click', function () { setDrawer(false); }); });
  $$('.acc > button').forEach(function (b) {
    b.addEventListener('click', function () {
      var acc = b.parentElement, open = !acc.classList.contains('is-open');
      acc.classList.toggle('is-open', open);
      b.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setDrawer(false); closeSearch(); closeModals(); } });

  $$('[data-stagger]').forEach(function (g) {
    var step = parseFloat(g.getAttribute('data-stagger')) || 0.07;
    $$('[data-reveal]', g).forEach(function (el, i) { el.style.setProperty('--d', (i * step).toFixed(2) + 's'); });
  });
  var revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else revealEls.forEach(function (el) { el.classList.add('is-in'); });

  $$('[data-count]').forEach(function (el) {
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    var target = parseFloat(el.getAttribute('data-count'));
    el.textContent = '0';
    var o = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      o.disconnect();
      var t0 = performance.now();
      (function tick(now) {
        var t = clamp((now - t0) / 1800, 0, 1);
        el.textContent = Math.round(target * (1 - Math.pow(2, -10 * t)));
        if (t < 1) requestAnimationFrame(tick);
      })(t0);
    }, { threshold: 0.5 });
    o.observe(el);
  });

  $$('.project').forEach(function (p) {
    p.addEventListener('pointermove', function (e) {
      var r = p.getBoundingClientRect();
      p.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      p.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  $$('[data-carousel]').forEach(function (c) {
    var track = $('.carousel__track', c), slides = $$('.carousel__slide', c), dotsBox = $('.carousel__dots', c), count = $('.carousel__count', c);
    var i = 0, timer = null, DUR = 6000, n = slides.length;
    c.style.setProperty('--dur', DUR / 1000 + 's');
    var dots = slides.map(function (_, k) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', 'Слайд ' + (k + 1));
      b.addEventListener('click', function () { go(k); });
      dotsBox.appendChild(b); return b;
    });
    function go(k) {
      i = (k + n) % n;
      track.style.transform = 'translateX(' + (-i * 100) + '%)';
      dots.forEach(function (d, j) { d.classList.remove('is-active'); void d.offsetWidth; if (j === i) d.classList.add('is-active'); });
      if (count) count.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
      slides.forEach(function (s, j) { s.setAttribute('aria-hidden', String(j !== i)); });
      clearTimeout(timer);
      if (!reduceMotion) timer = setTimeout(function () { go(i + 1); }, DUR);
    }
    $$('.carousel__arrow', c).forEach(function (b) { b.addEventListener('click', function () { go(i + parseInt(b.getAttribute('data-dir'), 10)); }); });
    var sx = null;
    c.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    c.addEventListener('pointerup', function (e) { if (sx !== null && Math.abs(e.clientX - sx) > 50) go(i + (e.clientX < sx ? 1 : -1)); sx = null; });
    go(0);
  });

  var search = $('#search');
  var input = search && $('input', search);
  var results = search && $('.search__results', search);
  var siteLink = search && $('[data-site-search]', search);
  var indexLoaded = false;
  function loadIndex(cb) {
    if (indexLoaded || window.SEARCH_INDEX) { indexLoaded = true; return cb(); }
    var s = document.createElement('script');
    s.src = ROOT + 'assets/js/search-index.js';
    s.onload = function () { indexLoaded = true; cb(); };
    document.head.appendChild(s);
  }
  function esc(t) { return t.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function highlight(t, q) {
    var i = t.toLowerCase().indexOf(q);
    return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length));
  }
  function runSearch() {
    var q = input.value.trim().toLowerCase();
    if (siteLink) siteLink.href = 'https://elkollege.ru/?s=' + encodeURIComponent(input.value.trim());
    if (q.length < 2) { results.innerHTML = '<div class="search__empty">Введите не менее двух символов — например, «расписание», «стипендии», «приём».</div>'; return; }
    var words = q.split(/\s+/);
    var found = (window.SEARCH_INDEX || []).map(function (it) {
      var hay = (it.t + ' ' + it.s + ' ' + it.h).toLowerCase();
      var score = 0;
      words.forEach(function (w) { if (it.t.toLowerCase().indexOf(w) >= 0) score += 3; else if (hay.indexOf(w) >= 0) score += 1; else score -= 10; });
      return { it: it, score: score };
    }).filter(function (r) { return r.score > 0; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 30);
    if (!found.length) { results.innerHTML = '<div class="search__empty">Ничего не найдено. Попробуйте поиск на официальном сайте.</div>'; return; }
    results.innerHTML = found.map(function (r) {
      return '<a href="' + ROOT + r.it.u + (location.protocol === 'file:' ? 'index.html' : '') + '">' + highlight(r.it.t, words[0]) + (r.it.s ? '<small>' + esc(r.it.s) + '</small>' : '') + '</a>';
    }).join('');
  }
  function openSearch() {
    if (!search) return;
    search.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    loadIndex(runSearch);
    setTimeout(function () { input.focus(); }, 50);
  }
  function closeSearch() {
    if (!search || !search.classList.contains('is-open')) return;
    search.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  $$('[data-search-open]').forEach(function (b) { b.addEventListener('click', openSearch); });
  $$('[data-search-close]').forEach(function (b) { b.addEventListener('click', closeSearch); });
  if (input) input.addEventListener('input', runSearch);
  document.addEventListener('keydown', function (e) {
    if ((e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
  });

  var a11y = store.get('ek-a11y') || { on: false, fs: '1', c: 'bw', img: 'on' };
  function applyA11y() {
    doc.classList.toggle('a11y', !!a11y.on);
    doc.dataset.fs = a11y.fs; doc.dataset.contrast = a11y.c; doc.dataset.img = a11y.img;
    $$('.a11y-panel [data-fs]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.fs === a11y.fs)); });
    $$('.a11y-panel [data-contrast]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.contrast === a11y.c)); });
    $$('.a11y-panel [data-img]').forEach(function (b) { b.setAttribute('aria-pressed', String(a11y.img === 'off')); b.textContent = a11y.img === 'off' ? 'Вкл' : 'Выкл'; });
    store.set('ek-a11y', a11y);
  }
  $$('[data-a11y-on]').forEach(function (b) { b.addEventListener('click', function () { a11y.on = !a11y.on; applyA11y(); window.scrollTo(0, 0); }); });
  $$('[data-a11y-off]').forEach(function (b) { b.addEventListener('click', function () { a11y.on = false; applyA11y(); }); });
  $$('.a11y-panel [data-fs]').forEach(function (b) { b.addEventListener('click', function () { a11y.fs = b.dataset.fs; applyA11y(); }); });
  $$('.a11y-panel [data-contrast]').forEach(function (b) { b.addEventListener('click', function () { a11y.c = b.dataset.contrast; applyA11y(); }); });
  $$('.a11y-panel [data-img]').forEach(function (b) { b.addEventListener('click', function () { a11y.img = a11y.img === 'off' ? 'on' : 'off'; applyA11y(); }); });
  applyA11y();

  function closeModals() { $$('.modal.is-open').forEach(function (m) { m.classList.remove('is-open'); document.body.style.overflow = ''; }); }
  $$('[data-modal-open]').forEach(function (b) {
    b.addEventListener('click', function () {
      var m = document.getElementById(b.getAttribute('data-modal-open'));
      if (!m) return;
      m.classList.add('is-open'); document.body.style.overflow = 'hidden';
      var f = $('input', m); if (f) setTimeout(function () { f.focus(); }, 50);
    });
  });
  $$('[data-modal-close]').forEach(function (b) { b.addEventListener('click', closeModals); });
  $$('form[data-mailto]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = new FormData(form);
      var body = 'Имя: ' + d.get('name') + '\nE-mail: ' + d.get('email') + '\n\n' + d.get('message');
      location.href = 'mailto:' + form.getAttribute('data-mailto') + '?subject=' + encodeURIComponent('Жалоба: ' + d.get('subject')) + '&body=' + encodeURIComponent(body);
      closeModals();
    });
  });

  var lbLinks = $$('a[data-lightbox]');
  if (lbLinks.length) {
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-label', 'Просмотр фотографии');
    lb.innerHTML = '<img alt=""><button type="button" class="lb-prev" aria-label="Предыдущее фото"><svg class="ico" viewBox="0 0 24 24"><path d="M19 12H5M11 18l-6-6 6-6"/></svg></button><button type="button" class="lb-next" aria-label="Следующее фото"><svg class="ico" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button><button type="button" class="lb-close" aria-label="Закрыть"><svg class="ico" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button><span class="lb-count"></span>';
    document.body.appendChild(lb);
    var lbImg = $('img', lb), lbCount = $('.lb-count', lb), lbI = 0;
    var show = function (k) {
      lbI = (k + lbLinks.length) % lbLinks.length;
      lbImg.src = lbLinks[lbI].href;
      lbImg.alt = ($('img', lbLinks[lbI]) || {}).alt || '';
      lbCount.textContent = (lbI + 1) + ' / ' + lbLinks.length;
    };
    var close = function () { lb.classList.remove('is-open'); document.body.style.overflow = ''; };
    lbLinks.forEach(function (a, k) {
      a.addEventListener('click', function (e) { e.preventDefault(); show(k); lb.classList.add('is-open'); document.body.style.overflow = 'hidden'; });
    });
    $('.lb-prev', lb).addEventListener('click', function () { show(lbI - 1); });
    $('.lb-next', lb).addEventListener('click', function () { show(lbI + 1); });
    $('.lb-close', lb).addEventListener('click', close);
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(lbI - 1);
      if (e.key === 'ArrowRight') show(lbI + 1);
    });
  }

  var cookie = $('#cookie');
  if (cookie && !store.get('ek-cookie')) {
    cookie.hidden = false;
    setTimeout(function () { cookie.classList.add('is-shown'); }, 1200);
    $('[data-cookie-ok]', cookie).addEventListener('click', function () {
      store.set('ek-cookie', 1);
      cookie.classList.remove('is-shown');
      setTimeout(function () { cookie.hidden = true; }, 600);
    });
  }
})();
