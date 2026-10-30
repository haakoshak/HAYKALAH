/* HAYKALAH site script. One deferred file, progressive enhancement only: every page works without it.
   Handles: inline form validation (form[data-validate]), header state, Expertise mega panel, mobile menu, language switch memory, reveal on scroll,
   background parallax, hero video pause/play (WCAG 2.2.2) and the cookie consent that gates GA4.
   Also: window.HK (the shared EN/AR text normalisation and DOM helpers used by the Knowledge Center search and the
   Phase 5a tools) and the homepage Ask HAYKALAH box, which sends its question in the URL fragment.
   Motion follows DIRECTION.md (ease-out, UI transitions ≤300ms). Motion v3 at the end: see its header. */
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
  // Scroll scenes re-measure (on resize) when the banner appears or goes
  // --consent-h lets the held homepage hero keep its buttons above the banner while it shows
  function showBanner() { if (banner) { banner.classList.add('is-visible'); doc.style.setProperty('--consent-h', banner.offsetHeight + 'px'); window.dispatchEvent(new Event('resize')); } }
  function hideBanner() { if (banner) { banner.classList.remove('is-visible'); doc.style.removeProperty('--consent-h'); window.dispatchEvent(new Event('resize')); } }

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
  /* ------------------------------------------------------------ Colour theme (Hisham, 2026-10-30)
     The inline <head> script already set data-theme (the visitor's saved choice, else their device setting) before
     the first paint. This adds the header switch, which cycles Auto → Light → Dark and remembers the choice; in Auto
     the page follows the device live (for example a PC that turns dark in the evening). */
  (function theme() {
    var ar = doc.lang === 'ar';
    var L = ar
      ? { auto: 'تلقائي (حسب جهازك)', light: 'فاتح', dark: 'داكن', label: 'مظهر الألوان: ' }
      : { auto: 'Auto (follows your device)', light: 'Light', dark: 'Dark', label: 'Colour theme: ' };
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    var ICON = {
      auto: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 2.75a7.25 7.25 0 0 1 0 14.5z" fill="currentColor"/></svg>',
      light: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 1.5v2.2M10 16.3v2.2M1.5 10h2.2M16.3 10h2.2M4 4l1.55 1.55M14.45 14.45 16 16M4 16l1.55-1.55M14.45 5.55 16 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      dark: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M16.5 12.3A7 7 0 0 1 7.7 3.5a7 7 0 1 0 8.8 8.8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'
    };
    var pref = doc.getAttribute('data-theme-pref') || 'auto';
    function resolved() { return pref === 'auto' ? (mq.matches ? 'light' : 'dark') : pref; }
    function apply() {
      var t = resolved();
      doc.setAttribute('data-theme', t);
      doc.setAttribute('data-theme-pref', pref);
      var cs = $('meta[name="color-scheme"]'); if (cs) cs.setAttribute('content', t);
      var tc = $('meta[name="theme-color"]'); if (tc) tc.setAttribute('content', t === 'light' ? '#f5f4fb' : '#1c1840');
      $$('.theme-btn').forEach(function (b) {
        b.innerHTML = ICON[pref];
        b.setAttribute('aria-label', L.label + L[pref]);
        b.title = L.label + L[pref];
      });
    }
    var host = $('.site-header .hd-end');
    if (host) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'icon-btn theme-btn';
      host.insertBefore(btn, host.firstChild);
      btn.addEventListener('click', function () {
        pref = pref === 'auto' ? 'light' : pref === 'light' ? 'dark' : 'auto';
        if (pref === 'auto') { try { window.localStorage.removeItem('hk-theme'); } catch (e) { /* storage blocked */ } }
        else store.set('hk-theme', pref);
        apply();
      });
    }
    onMQ(mq, function () { if (pref === 'auto') apply(); });
    apply();
  })();

  /* ------------------------------------------------------------ Phones: page heroes show their photo behind the title only
     (2026-10-24). The intro paragraph sits below the photo on the plain page, so the image is not buried under text. */
  function heroIntroGap() {
    $$('.phero').forEach(function (h) {
      var intro = $('.phero-intro', h);
      if (!intro) return;
      if (smallMQ.matches) h.style.setProperty('--intro-h', (intro.offsetHeight + 28) + 'px');
      else h.style.removeProperty('--intro-h');
    });
  }
  heroIntroGap();
  window.addEventListener('resize', heroIntroGap, { passive: true });
  window.addEventListener('load', heroIntroGap);
  onMQ(smallMQ, heroIntroGap);

  /* ------------------------------------------------------------ Motion v3 (Hisham, 2026-10-24: "a few big, crafted moments")
     Site-wide: headings rise through a curtain mask; photos open from a frame and settle; record figures tick up once.
     Homepage only: a held hero scene in which a 3D structure (thin beams on a canvas, no library) builds as the reader
     scrolls, the camera flying through it; the six practices as a sideways filmstrip; the method lighting up step by step.
     Every scroll-linked value eases towards its target each frame, so movement glides instead of jumping.
     Reduced motion: none of it runs; the page keeps its normal layout and the shared fades. */
  (function motion3() {
    if (reduceMQ.matches) return;
    var main = $('main');
    if (!main || !('IntersectionObserver' in window)) return;
    var rtl = doc.getAttribute('dir') === 'rtl';
    var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
    var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
    var vh = window.innerHeight, vw = window.innerWidth;

    /* Curtain and frame reveals (once): the class goes on, the transition runs, then the mask is removed altogether */
    var shown = function (el) {
      el.classList.add('is-shown');
      window.setTimeout(function () { el.classList.add('is-done'); }, 1500);
    };
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { shown(e.target); rio.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    $$('main h1, main h2').forEach(function (h) {
      if (h.classList.contains('visually-hidden') || h.closest('.consent, .hero, .phero')) return; // hero headings show at once (Speed Index)
      h.classList.add('curtain');
      rio.observe(h);
    });
    $$('main .photo, main .closing-photo, main .office').forEach(function (p) { p.classList.add('frame'); rio.observe(p); });
    // Safety net: anything already above the bottom 5% of the viewport reveals even if the observer missed it
    // (the last blocks of a page can never cross the observer's -10% line)
    var sweep = function () {
      $$('.curtain:not(.is-shown), .frame:not(.is-shown)').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.95 && r.width) { shown(el); rio.unobserve(el); }
      });
    };
    var swept = false;
    window.addEventListener('scroll', function () { if (!swept) { swept = true; window.requestAnimationFrame(function () { swept = false; sweep(); }); } }, { passive: true });
    window.addEventListener('load', sweep);

    /* Record figures tick up once (1.4 s); the real figure stays in the page for screen readers */
    var figs = $$('.record .fig');
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting || !e.target._count) return;
        cio.unobserve(e.target);
        var c = e.target._count, start = null;
        window.requestAnimationFrame(function step(ts) {
          if (start === null) start = ts;
          var k = Math.min(1, (ts - start) / 1400);
          c.el.textContent = c.pre + (k === 1 ? c.to : c.to * (1 - Math.pow(2, -10 * k))).toFixed(c.dec) + c.post;
          if (k < 1) window.requestAnimationFrame(step);
        });
      });
    }, { threshold: 0.6 });
    figs.forEach(function (f) {
      var walker = document.createTreeWalker(f, NodeFilter.SHOW_TEXT, null), t;
      while ((t = walker.nextNode())) if (/\d/.test(t.nodeValue)) break;
      var m = t && t.nodeValue.match(/^(\D*)([\d.,]+)(.*)$/);
      if (!m) return;
      var real = document.createElement('span'); real.className = 'visually-hidden'; real.textContent = t.nodeValue;
      var show = document.createElement('span'); show.setAttribute('aria-hidden', 'true');
      var dec = (m[2].split('.')[1] || '').length;
      show.textContent = m[1] + (0).toFixed(dec) + m[3];
      t.parentNode.replaceChild(show, t); show.parentNode.insertBefore(real, show);
      f._count = { el: show, pre: m[1], post: m[3], to: parseFloat(m[2].replace(/,/g, '')), dec: dec };
      cio.observe(f);
    });

    var scenes = []; // each: { measure(), target(), apply(value) } with an eased current value

    /* Homepage hero: a held scene. The hero gets 120vh of extra scroll; its content sits in a sticky stage. */
    var hero = $('main > .hero');
    if (hero) {
      var stage = $('.hero-stage', hero); // in the markup since 2026-10-30, so the page never shifts when this runs
      if (!stage) { stage = document.createElement('div'); stage.className = 'hero-stage'; while (hero.firstChild) stage.appendChild(hero.firstChild); hero.appendChild(stage); }
      hero.classList.add('hero-held');
      var media = $('.hero-media', stage), copy = $('.hero-copy', stage), photo = $('.hero-photo', stage);
      var canvas = document.createElement('canvas');
      canvas.className = 'structure';
      canvas.setAttribute('aria-hidden', 'true');
      media.appendChild(canvas);
      var ctx = canvas.getContext('2d');
      // The structure: a 4 x 4 grid of columns, 12 floors, floor beams and alternating cross braces (a tower skeleton)
      var segs = [], N = 4, F = 12, S = 1, FH = 0.62;
      for (var f = 0; f < F; f++) for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
        var x = i - (N - 1) / 2, z = j - (N - 1) / 2, y0 = f * FH, y1 = y0 + FH;
        segs.push({ a: [x, y0, z], b: [x, y1, z], f: f, k: 0 }); // column
        if (i < N - 1) segs.push({ a: [x, y1, z], b: [x + S, y1, z], f: f + 0.5, k: 1 }); // beams
        if (j < N - 1) segs.push({ a: [x, y1, z], b: [x, y1, z + S], f: f + 0.5, k: 1 });
        if ((i === 0 || i === N - 1) && j < N - 1 && (f + j) % 2 === 0) segs.push({ a: [x, y0, z], b: [x, y1, z + S], f: f + 0.7, k: 2 }); // braces
        if ((j === 0 || j === N - 1) && i < N - 1 && (f + i) % 2 === 1) segs.push({ a: [x, y0, z], b: [x + S, y1, z], f: f + 0.7, k: 2 });
      }
      var mx = 0, my = 0, cmx = 0, cmy = 0, t0 = performance.now(), intro = 0, dpr = 1, cw = 0, chh = 0;
      window.addEventListener('pointermove', function (e) { mx = e.clientX / vw - 0.5; my = e.clientY / vh - 0.5; }, { passive: true });
      var heroScene = {
        cur: 0, val: 0,
        measure: function () {
          dpr = Math.min(2, window.devicePixelRatio || 1);
          cw = media.clientWidth; chh = media.clientHeight;
          canvas.width = Math.round(cw * dpr); canvas.height = Math.round(chh * dpr);
        },
        target: function () { return clamp(-hero.getBoundingClientRect().top / Math.max(1, hero.offsetHeight - vh)); },
        apply: function (p) {
          var e = ease(p);
          if (copy) { copy.style.transform = 'translate3d(0,' + (-e * 80).toFixed(1) + 'px,0)'; copy.style.opacity = (1 - clamp((p - 0.45) / 0.4)).toFixed(3); }
          if (photo) photo.style.transform = 'scale(' + (1.04 + e * 0.16).toFixed(4) + ')';
          drawStructure(p);
        },
        // with a mouse the structure breathes with time and the cursor, so it repaints every frame while on screen; on touch
        // screens it only repaints for the first 1.8 s and while scrolling, to keep phones' main thread free
        live: window.matchMedia('(hover: hover) and (pointer: fine)').matches
      };
      function drawStructure(p) {
        var now = performance.now();
        intro = Math.min(1, (now - t0) / 1800);
        cmx += (mx - cmx) * 0.05; cmy += (my - cmy) * 0.05;
        var build = 0.18 + 0.32 * ease(intro) + 0.5 * ease(p); // share of the tower that exists
        var yaw = 0.55 + (now - t0) / 24000 + cmx * 0.5 + ease(p) * 1.1;
        var pitch = -0.16 + cmy * 0.18 - ease(p) * 0.1;
        var dist = 14 - ease(p) * 5.5, cy = F * FH * (0.42 + ease(p) * 0.18);
        var small = cw < 768; // phones: the tower stands higher and quieter, behind the headline
        var cx = cw * (rtl ? (small ? 0.2 : 0.25) - ease(p) * 0.06 : (small ? 0.8 : 0.75) + ease(p) * 0.06), sy = chh * (small ? 0.42 : 0.56), focal = Math.min(cw, chh * 1.5) * 0.95;
        var cY = Math.cos(yaw), sY = Math.sin(yaw), cP = Math.cos(pitch), sP = Math.sin(pitch);
        function proj(v) {
          var x = v[0] * cY - v[2] * sY, z = v[0] * sY + v[2] * cY, y = v[1] - cy;
          var y2 = y * cP - z * sP, z2 = y * sP + z * cP + dist;
          if (z2 < 0.4) return null;
          return [cx + (x * focal) / z2, sy - (y2 * focal) / z2, z2];
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, chh);
        ctx.lineCap = 'square';
        var top = build * F;
        for (var pass = 0; pass < 2; pass++) {
          for (var n = 0; n < segs.length; n++) {
            var s = segs[n];
            if (s.f > top) continue;
            var grow = clamp(top - s.f); // the newest floor draws in
            var A = proj(s.a), B0 = proj(s.b);
            if (!A || !B0) continue;
            var B = [A[0] + (B0[0] - A[0]) * grow, A[1] + (B0[1] - A[1]) * grow];
            var depth = clamp(1.25 - (A[2] - dist + 3) / 8); // nearer beams are brighter
            var alpha = (s.k === 2 ? 0.35 : 1) * (0.14 + depth * 0.5) * (1 - clamp((p - 0.82) / 0.18) * 0.6) * (small ? 0.5 : 1);
            ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]);
            if (pass === 0) { ctx.strokeStyle = 'rgba(150,135,240,' + (alpha * 0.22).toFixed(3) + ')'; ctx.lineWidth = 5; }
            else { ctx.strokeStyle = 'rgba(232,228,255,' + alpha.toFixed(3) + ')'; ctx.lineWidth = s.k === 0 ? 1.4 : 1; }
            ctx.stroke();
          }
        }
      }
      scenes.push(heroScene);
    }

    /* The six practices as a sideways filmstrip (desktop and tablet landscape) */
    var film = $('main .whatwedo .practices-wrap');
    var track = film && $('.practices', film);
    if (film && track && window.matchMedia('(min-width: 1024px)').matches) {
      film.classList.add('film');
      var fstage = document.createElement('div');
      fstage.className = 'film-stage';
      film.insertBefore(fstage, track);
      fstage.appendChild(track);
      // a progress line with a 01 / 06 counter under the strip, then the strip's own footnote
      var foot = document.createElement('div');
      foot.className = 'film-foot';
      foot.setAttribute('aria-hidden', 'true');
      foot.innerHTML = '<span class="film-bar"><i></i></span><span class="film-count" dir="ltr"></span>';
      fstage.appendChild(foot);
      var note = $('.wwd-foot', film);
      if (note) fstage.appendChild(note);
      var bar = $('.film-bar i', foot), count = $('.film-count', foot), total = track.children.length;
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      count.textContent = pad(1) + ' / ' + pad(total);
      var span = 0;
      scenes.push({
        cur: 0, val: 0,
        measure: function () {
          span = Math.max(0, track.scrollWidth - fstage.clientWidth);
          film.style.height = (span + vh) + 'px';
        },
        target: function () { return clamp(-film.getBoundingClientRect().top / Math.max(1, film.offsetHeight - vh)); },
        apply: function (p) {
          track.style.transform = 'translate3d(' + ((rtl ? 1 : -1) * p * span).toFixed(1) + 'px,0,0)';
          bar.style.transform = 'scaleX(' + (0.06 + p * 0.94).toFixed(4) + ')';
          count.textContent = pad(Math.min(total, 1 + Math.floor(p * total * 0.999))) + ' / ' + pad(total);
        }
      });
      // keyboard: a focused card scrolls the page to the point where that card is in view
      track.addEventListener('focusin', function (e) {
        var li = e.target.closest('li');
        if (!li) return;
        var idx = Array.prototype.indexOf.call(track.children, li), n = track.children.length;
        var p = n > 1 ? idx / (n - 1) : 0;
        var top = film.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: top + p * (film.offsetHeight - vh), behavior: 'instant' });
      });
    }

    /* The method lights up step by step, with a line drawing under it */
    $$('main .method').forEach(function (m) {
      var steps = $$('li:not(.arr)', m);
      m.classList.add('method-scene');
      scenes.push({
        cur: 0, val: 0, measure: function () {},
        target: function () { var r = m.getBoundingClientRect(); return clamp((vh * 0.85 - r.top) / (vh * 0.45)); },
        apply: function (k) {
          m.style.setProperty('--mp', k.toFixed(3));
          steps.forEach(function (li, n) { li.classList.toggle('lit', k >= (n + 0.6) / steps.length); });
        }
      });
    });

    /* Photo interludes: the band opens from a narrower frame to full width as it rises, and the photo drifts slowly */
    $$('main .interlude').forEach(function (band) {
      var img = $('img', band);
      scenes.push({
        cur: 0, val: -1, measure: function () {},
        target: function () { var r = band.getBoundingClientRect(); return clamp((vh - r.top) / (vh + r.height)); },
        apply: function (p) {
          var open = ease(clamp(p * 2.2)), inset = (8 * (1 - open)).toFixed(2);
          band.style.clipPath = 'inset(0 ' + inset + '% 0 ' + inset + '%)';
          if (img) img.style.transform = 'translate3d(0,' + ((p - 0.5) * -70).toFixed(1) + 'px,0) scale(' + (1.14 - open * 0.06).toFixed(4) + ')';
        }
      });
    });

    /* One frame loop: values ease 14% of the way to their target each frame; it sleeps when everything has settled */
    var running = false;
    function frame() {
      var busy = false;
      scenes.forEach(function (s) {
        var t = s.target();
        s.cur += (t - s.cur) * 0.14;
        if (Math.abs(t - s.cur) < 0.0004) s.cur = t; else busy = true;
        if (s.live || s.cur !== s.val) { s.apply(s.cur); s.val = s.cur; }
        if ((s.live || performance.now() - t0 < 1900) && hero && hero.getBoundingClientRect().bottom > 0) busy = true;
      });
      if (busy) window.requestAnimationFrame(frame); else running = false;
    }
    function wake() { if (!running) { running = true; window.requestAnimationFrame(frame); } }
    function measureAll() { vh = window.innerHeight; vw = window.innerWidth; scenes.forEach(function (s) { s.measure(); }); wake(); }
    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('resize', function () { window.requestAnimationFrame(measureAll); }, { passive: true });
    window.addEventListener('load', measureAll);
    measureAll();
  })();
})();
