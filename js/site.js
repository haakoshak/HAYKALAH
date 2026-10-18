/* HAYKALAH site script. One deferred file, progressive enhancement only: every page works without it.
   Handles: inline form validation (form[data-validate]), header state, Expertise mega panel, mobile menu, language switch memory, reveal on scroll,
   background parallax, hero video pause/play (WCAG 2.2.2) and the cookie consent that gates GA4.
   Also: window.HK (the shared EN/AR text normalisation and DOM helpers used by the Knowledge Center search and the
   Phase 5a tools) and the homepage Ask HAYKALAH box, which sends its question in the URL fragment.
   Motion follows DIRECTION.md: ease-out, ≤300ms, 12–16px rise, 60ms stagger, parallax on background imagery only. */
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
  function showBanner() { if (banner) banner.classList.add('is-visible'); }
  function hideBanner() { if (banner) banner.classList.remove('is-visible'); }

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
})();
