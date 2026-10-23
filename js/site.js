/* HAYKALAH site script. One deferred file, progressive enhancement only: every page works without it.
   Handles: inline form validation (form[data-validate]), header state, Expertise mega panel, mobile menu, language switch memory, reveal on scroll,
   background parallax, hero video pause/play (WCAG 2.2.2) and the cookie consent that gates GA4.
   Also: window.HK (the shared EN/AR text normalisation and DOM helpers used by the Knowledge Center search and the
   Phase 5a tools) and the homepage Ask HAYKALAH box, which sends its question in the URL fragment.
   Motion follows DIRECTION.md (ease-out, UI transitions ≤300ms). Motion v2 at the end adds stacking cards and scroll-linked
   effects, chosen by Hisham on 2026-10-23 ("bold and cinematic"). */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var smallMQ = window.matchMedia('(max-width: 767px)');
  var desktopMQ = window.matchMedia('(min-width: 1200px)');

  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage blocked: fine */ } }
  };
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function onMQ(mq, fn) { if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn); }

  doc.classList.remove('no-js');
  doc.classList.add('js');

  /* ------------------------------------------------------------ Shared text normalisation (window.HK.norm)
     Used by the Knowledge Center search (js/knowledge.js) and Ask HAYKALAH (js/ask.js), which load after this file.
     Ignores case, Latin accents, Arabic diacritics and tatweel, alef / yaa / taa marbuta variants, apostrophes and
     hyphens, so "istisna", "Istisna'a" and «استصناع» all meet. */
  var HK = window.HK = window.HK || {};
  HK.norm = function (s) {
    s = String(s || '').toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s
      .replace(/[ً-ٰٟـ]/g, '')         // Arabic diacritics, dagger alef, tatweel
      .replace(/[آأإٱ]/g, 'ا')     // alef forms
      .replace(/ى/g, 'ي')                          // alef maqsura → yaa
      .replace(/ة/g, 'ه')                          // taa marbuta → haa
      .replace(/['‘’ʼ`]/g, '')                // Istisna'a = istisnaa
      .replace(/[\s‐-―\-\/·.,;:()«»"“”،؛]+/g, ' ')
      .trim();
  };

  /* ------------------------------------------------------------ Shared DOM helpers for the tools
     (js/finder.js, js/readiness.js, js/ask.js). Their copy arrives as inline JSON "segments": a string, or an array of
     strings, { b } (an LTR <bdi> isolate) and { t } (a visible [TBD] marker). Nodes are built with textContent only:
     nothing from the data is ever parsed as HTML. */
  HK.put = function (el, v) {
    if (v === null || v === undefined) return el;
    (Array.isArray(v) ? v : [v]).forEach(function (s) {
      var n;
      if (typeof s === 'string') n = document.createTextNode(s);
      else if (s && s.b !== undefined) { n = document.createElement('bdi'); n.textContent = s.b; }
      else if (s && s.t !== undefined) { n = document.createElement('span'); n.className = 'tbd tbd-wrap'; n.textContent = s.t; }
      if (n) el.appendChild(n);
    });
    return el;
  };
  HK.text = function (v) {
    return (Array.isArray(v) ? v : [v]).map(function (s) { return typeof s === 'string' ? s : (s && (s.b !== undefined ? s.b : s.t)) || ''; }).join('');
  };
  HK.el = function (tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') HK.put(el, v); else el.setAttribute(k, v === true ? '' : String(v));
    });
    (kids || []).forEach(function (kid) { if (kid) el.appendChild(kid); });
    return el;
  };
  HK.arrow = function (w, h) { // the site's arrow; .flip mirrors it in Arabic so it always points along the reading direction
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
    [['class', 'flip'], ['width', w || 16], ['height', h || 12], ['viewBox', '0 0 18 14'], ['aria-hidden', 'true'], ['focusable', 'false']].forEach(function (a) { svg.setAttribute(a[0], a[1]); });
    [['d', 'M1 7h15M10 1l6 6-6 6'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '1.75'], ['stroke-linecap', 'square']].forEach(function (a) { p.setAttribute(a[0], a[1]); });
    svg.appendChild(p);
    return svg;
  };
  HK.data = function (id) { var s = document.getElementById(id); try { return s ? JSON.parse(s.textContent) : null; } catch (e) { return null; } };
  HK.reduce = reduceMQ;

  /* ------------------------------------------------------------ Homepage Ask HAYKALAH box
     The question travels in the URL fragment (ask.html#q=…), which browsers never send to the server, so it stays out
     of hosting logs. ask.html reads it in its <head> and removes it from the address bar before analytics could see it.
     Without JS the input has no name, so nothing is put in the URL at all. */
  $$('form[data-ask-fragment]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      var input = f.querySelector('input[type="text"], input[type="search"]');
      var q = input ? input.value.trim() : '';
      e.preventDefault();
      window.location.href = (f.getAttribute('action') || 'ask.html') + (q ? '#q=' + encodeURIComponent(q) : '');
    });
  });

  /* ------------------------------------------------------------ Inline validation: the homepage consultation form and the
     Structuring Brief signup (form[data-validate]; contact.html's request form has its own, js/contact.js).
     Each <p class="ferr" data-for="<control id>"> holds that control's messages (data-msg="required" / "format"). On submit
     the page's own messages replace the browser's bubbles (which speak the browser's language, not the page's): each
     problem field is marked aria-invalid and described by its message, and focus goes to the first one. Fields re-check as
     they are corrected. Without JS the browser's own validation applies (required, type=email). Valid: posts as usual. */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE = /^\+?[0-9][0-9\s()\-]{6,}$/; // digits, starting with the country code; spaces and hyphens allowed
  $$('form[data-validate]').forEach(function (f) {
    var boxes = $$('.ferr[data-for]', f).filter(function (b) { return document.getElementById(b.getAttribute('data-for')); });
    if (!boxes.length) return;
    f.noValidate = true;
    var tried = false;
    function problem(c) {
      var v = c.type === 'checkbox' ? (c.checked ? 'x' : '') : String(c.value || '').trim();
      if (c.required && !v) return 'required';
      if (v && c.type === 'email' && !EMAIL.test(v)) return 'format';
      if (v && c.type === 'tel' && !PHONE.test(v)) return 'format';
      return null;
    }
    function check(box) {
      var c = document.getElementById(box.getAttribute('data-for'));
      var k = problem(c);
      var msgs = $$('[data-msg]', box);
      if (!msgs.some(function (s) { return s.getAttribute('data-msg') === k; })) k = null;
      box.hidden = !k;
      msgs.forEach(function (s) { s.hidden = s.getAttribute('data-msg') !== k; });
      var ids = (c.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (x) { return x && x !== box.id; });
      if (k) { ids.push(box.id); c.setAttribute('aria-invalid', 'true'); } else c.removeAttribute('aria-invalid');
      if (ids.length) c.setAttribute('aria-describedby', ids.join(' ')); else c.removeAttribute('aria-describedby');
      return k ? c : null;
    }
    f.addEventListener('submit', function (e) {
      tried = true;
      var bad = boxes.map(check).filter(Boolean);
      if (!bad.length) return;
      e.preventDefault();
      bad[0].focus();
    });
    function recheck(e) {
      if (!tried || !e.target || !e.target.id) return;
      boxes.forEach(function (b) { if (b.getAttribute('data-for') === e.target.id) check(b); });
    }
    f.addEventListener('input', recheck);
    f.addEventListener('change', recheck);
  });

  /* ------------------------------------------------------------ Header: transparent over the hero at the very top */
  var header = $('.site-header');
  var hero = $('[data-hero]');
  function syncHeader() {
    if (!header || !hero) return;
    var solid = window.scrollY >= 8 || header.classList.contains('is-open') || doc.classList.contains('menu-open');
    header.classList.toggle('is-solid', solid);
  }

  /* ------------------------------------------------------------ Expertise mega panel (disclosure) */
  var megaToggle = $('.mega-toggle');
  var mega = megaToggle ? document.getElementById(megaToggle.getAttribute('aria-controls')) : null;
  var megaItem = megaToggle ? megaToggle.closest('.has-mega') : null;

  function setMega(open, returnFocus) {
    if (!mega) return;
    mega.classList.toggle('is-open', open);
    megaToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (header) header.classList.toggle('is-open', open);
    syncHeader();
    if (!open && returnFocus) megaToggle.focus();
  }
  if (megaToggle && mega) {
    megaToggle.addEventListener('click', function () {
      setMega(megaToggle.getAttribute('aria-expanded') !== 'true');
    });
    megaItem.addEventListener('focusout', function (e) {
      if (e.relatedTarget && !megaItem.contains(e.relatedTarget)) setMega(false);
    });
    document.addEventListener('click', function (e) {
      if (megaToggle.getAttribute('aria-expanded') === 'true' && !megaItem.contains(e.target)) setMega(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && megaToggle.getAttribute('aria-expanded') === 'true') { setMega(false, true); }
    });
    $$('a', mega).forEach(function (a) { a.addEventListener('click', function () { setMega(false); }); });
    onMQ(desktopMQ, function () { if (!desktopMQ.matches) setMega(false); });
  }

  /* ------------------------------------------------------------ Mobile menu: full-screen dialog */
  var menuBtn = $('.menu-btn');
  var menu = menuBtn ? document.getElementById(menuBtn.getAttribute('aria-controls')) : null;

  function focusables(root) {
    return $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', root)
      .filter(function (el) { return el.offsetParent !== null; });
  }
  function setMenu(open) {
    if (!menu) return;
    menu.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    doc.classList.toggle('menu-open', open);
    syncHeader();
    if (open) {
      var first = $('.mmenu-close', menu) || focusables(menu)[0];
      if (first) first.focus();
    } else {
      // The menu button is the only way in, so focus always goes back to it
      // (Safari does not focus buttons on tap, so remembering activeElement is unreliable).
      menuBtn.focus();
    }
  }
  if (menuBtn && menu) {
    menuBtn.hidden = false;
    menuBtn.addEventListener('click', function () { setMenu(true); });
    $$('[data-menu-close]', menu).forEach(function (b) { b.addEventListener('click', function () { setMenu(false); }); });
    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); setMenu(false); return; }
      if (e.key !== 'Tab') return;
      var f = focusables(menu);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { if (!a.hasAttribute('data-lang-switch')) setMenu(false); });
    });
    $$('.mm-link[aria-controls]', menu).forEach(function (b) {
      var sub = document.getElementById(b.getAttribute('aria-controls'));
      b.addEventListener('click', function () {
        var open = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (sub) sub.classList.toggle('is-open', open);
      });
    });
    onMQ(desktopMQ, function () { if (desktopMQ.matches && menu.classList.contains('is-open')) setMenu(false); });
  }

  /* ------------------------------------------------------------ Language switch: remember the choice
     localStorage feeds the root gateway (index.html). GitHub Pages has no server-side language redirect, so no cookie is set. */
  $$('[data-lang-switch]').forEach(function (a) {
    a.addEventListener('click', function () {
      store.set('hk-lang', a.getAttribute('data-lang-switch'));
    });
  });

  /* ------------------------------------------------------------ Reveal on scroll (opacity + 14px rise, once)
     A block reveals as its top crosses 88% of the viewport, however tall it is (threshold 0: a ratio of the block's own
     height would keep a long ledger blank for a third of a phone screen). Blocks that enter together in one group
     cascade 60 ms apart (data-stagger may lower it; never above 80 ms), and a long group's whole cascade fits in
     360 ms. The delay travels as --rd, so a child can wait for its own block (the heritage chapter markers). */
  var revealEls = $$('[data-reveal]');
  if (revealEls.length && 'IntersectionObserver' in window) {
    var vh = window.innerHeight || doc.clientHeight;
    revealEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) el.classList.add('is-in'); // already on screen: show, no animation
    });
    doc.classList.add('reveal-ready');
    var STAGGER = 60, STAGGER_MAX = 80, CASCADE_MAX = 360;
    var io = new IntersectionObserver(function (entries) {
      var batch = entries.filter(function (en) { return en.isIntersecting; }).map(function (en) { return en.target; });
      batch.sort(function (a, b) { return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1; });
      var groups = new Map();
      batch.forEach(function (el) {
        var group = el.closest('[data-reveal-group]') || el.parentNode;
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(el);
      });
      groups.forEach(function (els, group) {
        var step = Math.min(STAGGER_MAX, parseInt((group.getAttribute && group.getAttribute('data-stagger')) || STAGGER, 10) || STAGGER);
        if (els.length > 1) step = Math.min(step, Math.floor(CASCADE_MAX / (els.length - 1)));
        els.forEach(function (el, n) {
          var d = n * step;
          if (d) el.style.setProperty('--rd', d + 'ms');
          el.classList.add('is-in');
          io.unobserve(el);
          if (d) window.setTimeout(function () { el.style.removeProperty('--rd'); }, d + 600);
        });
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });
    revealEls.forEach(function (el) { if (!el.classList.contains('is-in')) io.observe(el); });
  }

  /* ------------------------------------------------------------ Parallax: background imagery only, ~0.85× scroll speed */
  var layers = $$('[data-parallax]');
  var visible = new Set();
  var ticking = false;
  var parallaxOn = false;

  function paint() {
    ticking = false;
    var vhNow = window.innerHeight, moves = [];
    // read every layer's geometry first, then write the transforms (no read-after-write layout in the frame)
    visible.forEach(function (el) {
      var host = el.closest('[data-parallax-host]') || el.parentElement;
      var r = host.getBoundingClientRect();
      var y = el.getAttribute('data-parallax') === 'top'
        ? -r.top * 0.15
        : -((r.top + r.height / 2) - vhNow / 2) * 0.15;
      // Never move the layer further than its overscan, so the photo always covers its frame (tall screens, zoom).
      var max = Math.max(0, (el.offsetHeight - r.height) / 2);
      if (y > max) y = max; else if (y < -max) y = -max;
      moves.push([el, y]);
    });
    moves.forEach(function (m) { m[0].style.transform = 'translate3d(0,' + m[1].toFixed(1) + 'px,0)'; });
  }
  function onScroll() {
    syncHeader();
    if (parallaxOn && !ticking) { ticking = true; window.requestAnimationFrame(paint); }
  }
  var pio = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var el = en.target.__layer;
      if (!el) return;
      if (en.isIntersecting) visible.add(el); else visible.delete(el);
    });
    if (parallaxOn) paint();
  }, { rootMargin: '10% 0px' }) : null;

  function setParallax() {
    var want = !!(pio && layers.length && !reduceMQ.matches && !smallMQ.matches);
    if (want === parallaxOn) return;
    parallaxOn = want;
    layers.forEach(function (el) {
      var host = el.closest('[data-parallax-host]') || el.parentElement;
      host.__layer = el;
      if (want) { el.classList.add('is-parallax'); pio.observe(host); }
      else { el.classList.remove('is-parallax'); el.style.transform = ''; if (pio) pio.unobserve(host); visible.delete(el); }
    });
    if (want) paint();
  }
  setParallax();
  onMQ(reduceMQ, setParallax);
  onMQ(smallMQ, setParallax);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { if (parallaxOn) paint(); }, { passive: true });
  syncHeader();

  /* ------------------------------------------------------------ Hero video: pause/play control (WCAG 2.2.2)
     The button ships disabled; it activates as soon as a <video class="hero-video"> exists.
     Reduced motion: the video does not autoplay and its poster shows. */
  var video = $('.hero-video');
  var vbtn = $('[data-video-toggle]');
  if (video && vbtn) {
    vbtn.disabled = false;
    var setState = function (playing) {
      vbtn.setAttribute('data-state', playing ? 'playing' : 'paused');
      vbtn.setAttribute('aria-label', vbtn.getAttribute(playing ? 'data-label-pause' : 'data-label-play'));
    };
    video.muted = true;
    if (reduceMQ.matches) {
      video.pause();
      setState(false);
    } else {
      var p = video.play();
      if (p && p.then) p.then(function () { setState(true); }, function () { setState(false); });
      else setState(!video.paused);
    }
    vbtn.addEventListener('click', function () {
      if (video.paused) { var q = video.play(); if (q && q.catch) q.catch(function () {}); setState(true); }
      else { video.pause(); setState(false); }
    });
    onMQ(reduceMQ, function () { if (reduceMQ.matches) { video.pause(); setState(false); } });
  }

  /* ------------------------------------------------------------ Cookie consent → GA4 (Consent Mode v2)
     Nothing is requested from Google before "Accept analytics". The choice is stored in localStorage. */
  var GA_ID = 'G-C19FVC0ZMZ'; // HAYKALAH's GA4 measurement ID (Hisham, 2026-10-17)
  var CONSENT_KEY = 'hk-consent';
  var banner = $('[data-consent]');

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', functionality_storage: 'granted', security_storage: 'granted'
  });

  var gaLoaded = false;
  function loadGA() {
    if (gaLoaded) return;
    gaLoaded = true;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID);
  }
  function clearGACookies() {
    var host = window.location.hostname;
    var domains = ['', host, '.' + host, '.' + host.split('.').slice(-2).join('.')];
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (name.indexOf('_ga') === 0) {
        domains.forEach(function (d) {
          document.cookie = name + '=; Max-Age=0; path=/' + (d ? '; domain=' + d : '');
        });
      }
    });
  }
  // The stacking cards stick above the banner while it shows, so they re-measure (on resize) when it appears or goes
  function showBanner() { if (banner) { banner.classList.add('is-visible'); window.dispatchEvent(new Event('resize')); } }
  function hideBanner() { if (banner) { banner.classList.remove('is-visible'); window.dispatchEvent(new Event('resize')); } }

  // Focus not obscured (WCAG 2.2 2.4.11): a focused element must not sit under the sticky header or the cookie banner.
  // When keyboard focus lands under either, scroll just enough to show it with a 16px margin.
  document.addEventListener('focusin', function (e) {
    var el = e.target;
    if (!el || !el.getBoundingClientRect || (banner && banner.contains(el))) return;
    if (el.closest && el.closest('.site-header, .mmenu')) return;
    var r = el.getBoundingClientRect(), hdr = $('.site-header');
    var top = hdr ? hdr.getBoundingClientRect().bottom : 0;
    var bottom = banner && banner.classList.contains('is-visible') ? banner.getBoundingClientRect().top : window.innerHeight;
    if (r.height > bottom - top - 32) return; // taller than the gap: leave it to the browser
    if (r.bottom > bottom - 16) window.scrollBy(0, r.bottom - bottom + 16);
    else if (r.top < top + 16) window.scrollBy(0, r.top - top - 16);
  });

  // [data-consent-status] (privacy.html, "Manage cookie preferences"): shows the current choice from its
  // data-granted / data-denied / data-unset texts, and updates when the choice changes
  function syncStatus() {
    var c = store.get(CONSENT_KEY);
    $$('[data-consent-status]').forEach(function (el) {
      var t = el.getAttribute('data-' + (c === 'granted' || c === 'denied' ? c : 'unset')) || '';
      if (el.textContent !== t) el.textContent = t;
    });
  }
  // A control that reopened the banner gets focus back once a choice is made (the banner's buttons disappear)
  var opener = null;
  function returnFocus() {
    if (opener && document.body.contains(opener)) { try { opener.focus({ preventScroll: true }); } catch (e) { opener.focus(); } }
    opener = null;
  }

  var choice = store.get(CONSENT_KEY);
  if (choice === 'granted') loadGA();
  else if (choice !== 'denied') showBanner();
  syncStatus();

  if (banner) {
    var acc = $('[data-consent-accept]', banner);
    var rej = $('[data-consent-reject]', banner);
    if (acc) acc.addEventListener('click', function () { store.set(CONSENT_KEY, 'granted'); hideBanner(); loadGA(); syncStatus(); returnFocus(); });
    if (rej) rej.addEventListener('click', function () {
      store.set(CONSENT_KEY, 'denied');
      hideBanner();
      if (gaLoaded) gtag('consent', 'update', { analytics_storage: 'denied' });
      clearGACookies();
      syncStatus();
      returnFocus();
    });
  }
  $$('.consent-open').forEach(function (b) {
    b.addEventListener('click', function () {
      opener = b;
      showBanner();
      var first = banner && $('button', banner);
      if (first) first.focus();
    });
  });
  /* ------------------------------------------------------------ Motion v2: "bold and cinematic" (Hisham, 2026-10-23)
     Stacking cards: each top-level <section> of <main> is a card. A card sticks once its bottom reaches the viewport
     (top = min(header, viewport - height)), the next card slides over it, and the one behind shrinks (to 92%), tips back and dims.
     Also: headline word reveals, scroll-scrubbed ledes, hero zoom-out, count-up record figures, magnetic primary
     buttons, card tilt (fine pointers only), slow pattern drift and a reading-progress bar.
     Scroll-linked effects follow the reader's own scroll, so they have no duration. Reduced motion: none of this runs;
     the page keeps normal flow and the shared fades. */
  (function motion() {
    if (reduceMQ.matches) return;
    var main = $('main');
    if (!main) return;
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var vh = window.innerHeight, headerH = 0, ticking = false;
    var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };

    function splitWords(root, cls) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [], n;
      while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push(n);
      nodes.forEach(function (t) {
        var frag = document.createDocumentFragment();
        t.nodeValue.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var w = document.createElement('span');
          w.className = cls;
          if (cls === 'w') { var inner = document.createElement('span'); inner.textContent = part; w.appendChild(inner); }
          else w.textContent = part;
          frag.appendChild(w);
        });
        t.parentNode.replaceChild(frag, t);
      });
    }

    /* Stacking cards */
    // every top-level block of <main> is a card (sections, and the plain blocks of the term and legal pages): a block
    // left out would scroll underneath the stuck cards
    var cards = Array.prototype.filter.call(main.children, function (el) { return !/^(SCRIPT|TEMPLATE|STYLE)$/.test(el.tagName) && !el.hidden; });
    var stacking = cards.length > 1 && !!(window.CSS && CSS.supports('position', 'sticky') && CSS.supports('overflow', 'clip'));
    if (stacking) {
      doc.classList.add('stacking');
      cards.forEach(function (c, i) {
        c.classList.add('stack-card');
        c.style.zIndex = String(i + 1); // later cards always paint over earlier ones, whatever a section's own z-index
        if (i === 0) c.classList.add('stack-first');
        var shade = document.createElement('div');
        shade.className = 'stack-shade';
        shade.setAttribute('aria-hidden', 'true');
        c.appendChild(shade);
        c._shade = shade;
      });
    }

    /* Hero zoom-out: the first card's media grows and its copy lifts and fades as the reader leaves it */
    var hero = $('main > .hero, main > .phero');
    var heroMedia = hero && $('.hero-media, .phero-media', hero);
    var heroBody = hero && $('.hero-body, .phero-body', hero);

    /* Pattern drift */
    var drifts = $$('.band-art, .pband-art');

    /* Reading progress */
    var bar = document.createElement('div');
    bar.className = 'read-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    /* Scroll-scrubbed ledes: words brighten from 28% as the paragraph crosses the lower half of the viewport */
    var scrubs = [];
    $$('main .lede').forEach(function (p) {
      if (hero && hero.contains(p)) return; // the hero lede is on screen at load
      if (p.textContent.length > 420) return;
      splitWords(p, 'sw');
      p.classList.add('scrub');
      scrubs.push({ el: p, words: $$('.sw', p) });
    });

    function measure() {
      vh = window.innerHeight;
      var hdr = $('.site-header');
      headerH = hdr ? hdr.offsetHeight : 0;
      var cb = $('.consent.is-visible');
      var viewBottom = cb ? Math.min(vh, Math.round(cb.getBoundingClientRect().top)) : vh;
      if (stacking) cards.forEach(function (c, i) {
        // stick when the card's bottom reaches the bottom of the visible area: the viewport, or the cookie banner while shown
        var top = Math.min(i === 0 ? 0 : headerH, viewBottom - c.offsetHeight);
        c.style.top = top + 'px';
        c.style.transformOrigin = '50% ' + Math.round((i === 0 ? 0 : headerH) - top) + 'px'; // shrink towards the card's visible top edge, so older cards never peek above it
      });
      paint();
    }

    function paint() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset;
      var max = doc.scrollHeight - vh;
      bar.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max) : 0).toFixed(4) + ')';
      if (stacking) for (var i = 0; i < cards.length - 1; i++) {
        var c = cards[i], nt = cards[i + 1].getBoundingClientRect().top;
        var p = clamp((vh - nt) / Math.max(1, vh - headerH));
        if (p === c._p) continue;
        c._p = p;
        // the covered card falls back: shrinks to 92% and tips away from the reader by up to 5 degrees
        c.style.transform = p ? 'perspective(1400px) rotateX(' + (p * 5).toFixed(2) + 'deg) scale(' + (1 - p * 0.08).toFixed(4) + ')' : '';
        c._shade.style.opacity = (p * 0.6).toFixed(3);
      }
      if (heroMedia && y < vh * 1.5) {
        var q = clamp(y / (hero.offsetHeight || vh));
        heroMedia.style.transform = 'scale(' + (1 + q * 0.28).toFixed(4) + ')';
        if (heroBody) { heroBody.style.transform = 'translate3d(0,' + (-q * 90).toFixed(1) + 'px,0)'; heroBody.style.opacity = (1 - q * 0.85).toFixed(3); }
      }
      drifts.forEach(function (d) {
        var r = d.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var t = (r.top + r.height / 2 - vh / 2) / vh; // -1 … 1 around the viewport centre
        d.style.transform = 'translate3d(0,' + (t * -48).toFixed(1) + 'px,0) rotate(' + (t * 4).toFixed(2) + 'deg)';
      });
      scrubs.forEach(function (s) {
        var r = s.el.getBoundingClientRect();
        if (r.top > vh || r.bottom < 0) return;
        var k = clamp((vh * 0.92 - r.top) / (vh * 0.55)) * s.words.length;
        s.words.forEach(function (w, n) { var o = clamp(k - n); if (w._o !== o) { w._o = o; w.style.opacity = (0.28 + o * 0.72).toFixed(3); } });
      });
    }
    function onScroll() { if (!ticking) { ticking = true; window.requestAnimationFrame(paint); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { window.requestAnimationFrame(measure); }, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(function () { window.requestAnimationFrame(measure); }).observe(main);
    window.addEventListener('load', measure);
    measure();

    /* In-page links: a stuck card reports its stuck position, so the browser's own jump can land under a later card.
       Jump to the target's position in the normal flow instead (the cards' summed heights), then move focus there. */
    function flowTop(el) {
      var card = el.closest && el.closest('.stack-card'), y = 0, n = el;
      if (!card) return el.getBoundingClientRect().top + window.scrollY;
      while (n && n !== card) { y += n.offsetTop; n = n.offsetParent; }
      if (n !== card) y = 0;
      // normal-flow top of the card: main's top plus each earlier card with its margins (the first card's top margin
      // collapses into main's, so main's box already includes it)
      var top = main.getBoundingClientRect().top + window.scrollY, cs;
      for (var i = 0; i < cards.length; i++) {
        cs = window.getComputedStyle(cards[i]);
        if (i) top += parseFloat(cs.marginTop) || 0;
        if (cards[i] === card) break;
        top += cards[i].offsetHeight + (parseFloat(cs.marginBottom) || 0);
      }
      return top + y;
    }
    function jump(id, push) {
      var t = id && document.getElementById(id);
      if (!t || !main.contains(t)) return false;
      var isCard = t.classList.contains('stack-card');
      var y = flowTop(t) - (isCard ? headerH : headerH + 16), card = t.closest('.stack-card');
      // never scroll past the point where the target's card sticks: beyond it the next card starts to cover the target
      if (card) y = Math.min(y, flowTop(card) - (parseFloat(card.style.top) || 0));
      window.scrollTo(0, Math.max(0, y));
      if (push && window.history.pushState) window.history.pushState(null, '', '#' + id);
      if (!t.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
      return true;
    }
    if (stacking) {
      document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href^="#"]');
        if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (jump(decodeURIComponent(a.getAttribute('href').slice(1)), true)) e.preventDefault();
      });
      window.addEventListener('load', function () { if (location.hash) jump(decodeURIComponent(location.hash.slice(1)), false); });
      // Keyboard focus: the browser's own scroll-into-view can leave a focused element under a later card (the same stuck-
      // position problem). If the focused element is not on top where it sits, scroll it into the clear like a jump link.
      document.addEventListener('focusin', function (e) {
        var el = e.target, card = el && el.closest && el.closest('.stack-card');
        if (!card || !el.getBoundingClientRect) return;
        var r = el.getBoundingClientRect();
        var hit = document.elementFromPoint(Math.min(window.innerWidth - 2, Math.max(1, r.left + r.width / 2)), Math.min(window.innerHeight - 2, Math.max(1, r.top + Math.min(r.height, 40) / 2)));
        var hc = hit && hit.closest && hit.closest('.stack-card');
        if (r.bottom > headerH && r.top < window.innerHeight && (hc === card || (hc && card.contains(hc)))) return;
        var y = Math.min(flowTop(el) - headerH - 16, flowTop(card) - (parseFloat(card.style.top) || 0));
        window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
      });
    }

    /* Bolder (Hisham, 2026-10-23): statements in the colour bands assemble from scattered words as the reader scrolls;
       the Design → Implement → Operate → Monitor steps light up one by one with a line drawing under them; photos
       settle from a 22% zoom as they cross the viewport. All scrubbed by the reader's scroll. */
    var assembles = [];
    $$('main .band h2, main .closing h2, main .closing-band h2').forEach(function (h) {
      if (h.classList.contains('visually-hidden') || h.textContent.length > 160) return;
      splitWords(h, 'aw');
      h.classList.add('assemble');
      var words = $$('.aw', h);
      words.forEach(function (w, n) {
        var a = (n * 137.5) % 360 * Math.PI / 180; // golden-angle scatter: varied but stable from load to load
        w._dx = Math.cos(a) * (50 + (n % 3) * 22);
        w._dy = Math.sin(a) * (34 + (n % 2) * 18);
        w._rot = ((n % 5) - 2) * 6;
      });
      assembles.push({ el: h, words: words });
    });
    var methods = $$('main .method').map(function (m) { m.classList.add('method-scene'); return { el: m, steps: $$('li:not(.arr)', m) }; });
    var zooms = $$('main .photo img, main .closing-photo img, main .photo-band img, main .office img');
    zooms.forEach(function (z) { z.classList.add('scroll-zoom'); });

    function paintBolder() {
      assembles.forEach(function (s) {
        var r = s.el.getBoundingClientRect();
        if (r.top > vh || r.bottom < 0) return;
        var k = clamp((vh * 0.98 - r.top) / (vh * 0.55)), len = s.words.length;
        s.words.forEach(function (w, n) {
          var lk = clamp(k * 1.5 - (n / Math.max(1, len)) * 0.5), e = 1 - Math.pow(1 - lk, 3), inv = 1 - e;
          if (w._k === e) return;
          w._k = e;
          w.style.transform = inv ? 'translate3d(' + (w._dx * inv).toFixed(1) + 'px,' + (w._dy * inv).toFixed(1) + 'px,0) rotate(' + (w._rot * inv).toFixed(1) + 'deg)' : '';
          w.style.opacity = (0.08 + e * 0.92).toFixed(3);
        });
      });
      methods.forEach(function (m) {
        var r = m.el.getBoundingClientRect();
        if (r.top > vh || r.bottom < 0) return;
        var k = clamp((vh * 0.9 - r.top) / (vh * 0.45));
        m.el.style.setProperty('--mp', k.toFixed(3));
        m.steps.forEach(function (li, n) { li.classList.toggle('lit', k >= (n + 0.5) / m.steps.length); });
      });
      zooms.forEach(function (z) {
        var r = z.getBoundingClientRect();
        if (r.top > vh || r.bottom < 0) return;
        var t = clamp((vh - r.top) / (vh + r.height)); // 0 entering at the bottom … 1 leaving at the top
        z.style.transform = 'scale(' + (1.22 - Math.min(t * 1.6, 1) * 0.22).toFixed(4) + ')';
      });
    }
    window.addEventListener('scroll', function () { window.requestAnimationFrame(paintBolder); }, { passive: true });
    window.addEventListener('resize', function () { window.requestAnimationFrame(paintBolder); }, { passive: true });
    paintBolder();

    /* Headline word reveal: words rise out of a mask, 40 ms apart (cap 600 ms), when the heading enters */
    var heads = $$('main h1, main h2').filter(function (h) { return !h.classList.contains('visually-hidden') && !h.classList.contains('assemble') && h.textContent.length < 160; });
    if (heads.length && 'IntersectionObserver' in window) {
      heads.forEach(function (h) {
        splitWords(h, 'w');
        $$('.w > span', h).forEach(function (s, i) { s.style.transitionDelay = Math.min(i * 40, 600) + 'ms'; });
        h.classList.add('wsplit');
      });
      var hio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('words-in'); hio.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px' });
      window.requestAnimationFrame(function () { heads.forEach(function (h) { hio.observe(h); }); });
    }

    /* Count-up record figures: the real figure stays in the page for screen readers; only a hidden-from-AT copy counts */
    var figs = $$('.record .fig');
    if (figs.length && 'IntersectionObserver' in window) {
      figs.forEach(function (f) {
        var walker = document.createTreeWalker(f, NodeFilter.SHOW_TEXT, null), t;
        while ((t = walker.nextNode())) if (/\d/.test(t.nodeValue)) break;
        if (!t) return;
        var m = t.nodeValue.match(/^(\D*)([\d.,]+)(.*)$/);
        if (!m) return;
        var target = parseFloat(m[2].replace(/,/g, '')), dec = (m[2].split('.')[1] || '').length;
        var real = document.createElement('span'); real.className = 'visually-hidden'; real.textContent = t.nodeValue;
        var shown = document.createElement('span'); shown.setAttribute('aria-hidden', 'true'); shown.textContent = m[1] + (0).toFixed(dec) + m[3];
        t.parentNode.replaceChild(shown, t); shown.parentNode.insertBefore(real, shown);
        f._count = { el: shown, pre: m[1], post: m[3], to: target, dec: dec };
      });
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting || !e.target._count) return;
          cio.unobserve(e.target);
          var c = e.target._count, start = null, DUR = 1600;
          window.requestAnimationFrame(function step(ts) {
            if (start === null) start = ts;
            var k = Math.min(1, (ts - start) / DUR), ease = 1 - Math.pow(2, -10 * k);
            c.el.textContent = c.pre + (k === 1 ? c.to : c.to * ease).toFixed(c.dec) + c.post;
            if (k < 1) window.requestAnimationFrame(step);
          });
        });
      }, { threshold: 0.6 });
      figs.forEach(function (f) { if (f._count) cio.observe(f); });
    }

    if (!finePointer) return;

    /* Magnetic buttons: drift up to 8 px towards the pointer, settle back in 300 ms */
    $$('main .btn-primary, main .btn-secondary').forEach(function (b) {
      b.classList.add('magnetic');
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        var dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        b.style.transform = 'translate3d(' + (dx * 8).toFixed(1) + 'px,' + (dy * 5).toFixed(1) + 'px,0)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });

    /* Card tilt: up to 4 degrees towards the pointer, with a soft light following it */
    $$('.rcard, .gcard, .icard, .feat-tile').forEach(function (c) {
      c.classList.add('tilt');
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.style.transform = 'perspective(900px) rotateX(' + ((0.5 - y) * 6).toFixed(2) + 'deg) rotateY(' + ((x - 0.5) * 8).toFixed(2) + 'deg)';
        c.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
      c.addEventListener('pointerleave', function () { c.style.transform = ''; });
    });
  })();
})();
