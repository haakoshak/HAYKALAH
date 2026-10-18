/* HAYKALAH asset readiness check (readiness-check.html only; copy written by tools/build-pages.mjs from
   content/<lang>/readiness-check.md into <script type="application/json" id="rc-data">).
   Five questions, one per step of the engine (Audit, Optimize, Structure, Operate, Monetize), three answers each
   (ready, partly ready, not yet). Scoring is by order, never by points: each answer sets its step's level, and the
   profile is the first step in engine order that is not ready (all five ready: "all-ready"). No number, score,
   percentage, value or valuation is computed or shown.
   - The result: heading; the profile's heading and summary; the five steps as a strip (square markers on a hairline,
     each with its level written out, so colour is never the only cue; the profile's step marked "Start here"); the
     disclaimer; an optional "I am" select (preset from ?who= or ?i=); the hand-off
     contact.html?i=<who>&need=turning-expenses-into-revenue&goal=monetization; the explainer and practice links;
     "Start again".
   - Privacy: the answers stay in the page. They never go into the URL, storage, analytics or the request.
   - Accessible: fieldsets with legends, an error inside each unanswered question, focus on the first one; the result is
     announced in a polite live region and focus moves to its heading. Without JS the questions show with a note. */
(function () {
  'use strict';

  var root = document.querySelector('[data-readiness]');
  var HK = window.HK;
  if (!root || !HK) return;
  var D = HK.data('rc-data');
  var form = root.querySelector('[data-rc-form]');
  var out = root.querySelector('[data-rc-result]');
  var live = root.querySelector('[data-rc-live]');
  var incomplete = root.querySelector('[data-rc-incomplete]');
  if (!D || !form || !out) return;
  var el = HK.el;

  var who = '';
  try { var p = new URLSearchParams(window.location.search); who = p.get('who') || p.get('i') || ''; } catch (e) { who = ''; }
  if (!D.who.some(function (o) { return o.v === who; })) who = '';

  function inputs(name) { return Array.prototype.slice.call(form.querySelectorAll('input[name="' + name + '"]')); }
  function answer(name) { var c = inputs(name).filter(function (i) { return i.checked; })[0]; return c ? c.value : ''; }
  function setError(key, on) {
    var box = document.getElementById('rc-err-' + key);
    if (box) box.hidden = !on;
    inputs(key).forEach(function (i) { if (on) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); });
    var set = document.getElementById('rc-q-' + key);
    if (set) {
      var ids = (set.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (x) { return x && x !== 'rc-err-' + key; });
      if (on) ids.push('rc-err-' + key);
      set.setAttribute('aria-describedby', ids.join(' '));
    }
  }

  function href() {
    // the answers and the profile are never passed; only who (optional), the practice and the Monetization goal
    return D.contact.href + '?' + (who ? 'i=' + encodeURIComponent(who) + '&' : '') + 'need=' + D.contact.need + '&goal=' + D.contact.goal;
  }

  function render(levels) {
    var L = D.labels;
    var key = null;
    for (var i = 0; i < D.steps.length; i++) if (levels[D.steps[i].k] !== 'ready') { key = 'start-' + D.steps[i].k; break; }
    var profile = D.profiles[key || 'all-ready'];
    out.textContent = '';
    var head = el('h2', { 'class': 'rc-rh headline', id: 'rc-rh', tabindex: '-1', text: L.heading });
    var strip = el('ol', { 'class': 'rc-strip' }, D.steps.map(function (s) {
      var lv = levels[s.k], here = key === 'start-' + s.k;
      return el('li', { 'class': 'rc-cell' + (here ? ' is-here' : ''), 'data-level': lv }, [
        el('span', { 'class': 'rc-mark', 'aria-hidden': 'true' }),
        el('p', { 'class': 'rc-cn' }, [el('span', { 'class': 'rc-cw', text: s.word }), document.createTextNode(' · '), el('span', { text: s.name })]),
        el('p', { 'class': 'rc-lv', text: D.levels[lv] }),
        here ? el('p', { 'class': 'rc-here' }, [el('span', { 'class': 'xbadge', text: D.here })]) : null,
        el('p', { 'class': 'rc-res', text: s.res[lv] }),
      ]);
    }));
    var select = el('select', { 'class': 'ctl', id: 'rc-who' }, [el('option', { value: '', text: D.select })].concat(D.who.map(function (o) {
      return el('option', { value: o.v, selected: o.v === who, text: o.l });
    })));
    var cta = el('a', { 'class': 'btn btn-primary', id: 'rc-cta', href: href(), text: L.cta });
    select.addEventListener('change', function () { who = select.value; cta.setAttribute('href', href()); });
    var restart = el('button', { 'class': 'wclear', type: 'button', text: L.restart });
    restart.addEventListener('click', function () {
      form.reset();
      D.steps.forEach(function (s) { setError(s.k, false); });
      if (incomplete) incomplete.hidden = true;
      out.hidden = true;
      out.textContent = '';
      form.hidden = false;
      form.classList.remove('is-in');
      void form.offsetWidth; // the questions fade back in (200ms), as the result did
      form.classList.add('is-in');
      var first = inputs(D.steps[0].k)[0];
      if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } root.scrollIntoView({ block: 'start', behavior: HK.reduce && HK.reduce.matches ? 'auto' : 'smooth' }); }
    });
    [
      head,
      el('div', { 'class': 'rc-profile' }, [el('h3', { 'class': 'rc-ph', text: profile.h }), el('p', { text: profile.s })]),
      el('h3', { 'class': 'rc-sh', text: L.steps }),
      strip,
      el('p', { 'class': 'rc-disc', text: L.disclaimer }),
      el('div', { 'class': 'field rc-who' }, [el('label', { 'for': 'rc-who', text: L.who }), select]),
      el('div', { 'class': 'fd-cta rc-cta' }, [cta, el('p', { 'class': 'fhint', text: L['cta-note'] })]),
      el('p', { 'class': 'rc-links' }, D.links.map(function (l) { return el('a', { 'class': 'tlink', href: l.href }, [el('span', { text: l.l }), HK.arrow(16, 12)]); })),
      el('p', { 'class': 'fd-again' }, [restart]),
    ].forEach(function (n) { out.appendChild(n); });
    form.hidden = true;
    out.hidden = false;
    out.classList.remove('is-in');
    void out.offsetWidth;
    out.classList.add('is-in');
    try { head.focus({ preventScroll: true }); } catch (e) { head.focus(); }
    head.scrollIntoView({ block: 'start', behavior: HK.reduce && HK.reduce.matches ? 'auto' : 'smooth' });
    if (live) {
      live.textContent = '';
      window.setTimeout(function () { live.textContent = HK.text(L.heading) + ': ' + HK.text(profile.h); }, 150);
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var levels = {}, missing = [];
    D.steps.forEach(function (s) { var a = answer(s.k); levels[s.k] = a; setError(s.k, !a); if (!a) missing.push(s.k); });
    if (incomplete) incomplete.hidden = !missing.length;
    if (missing.length) { var f = inputs(missing[0])[0]; if (f) f.focus(); return; }
    render(levels);
  });
  form.addEventListener('change', function (e) {
    var n = e.target && e.target.name;
    if (n && answer(n)) setError(n, false);
    if (incomplete && !incomplete.hidden && D.steps.every(function (s) { return answer(s.k); })) incomplete.hidden = true;
  });
})();
