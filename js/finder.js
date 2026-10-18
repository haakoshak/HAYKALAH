/* HAYKALAH Structure Finder (finder.html only; copy and data written by tools/build-pages.mjs from content/<lang>/finder.md
   into <script type="application/json" id="fd-data">).
   Deterministic: every result is one of the 45 (who × need) pairs written and approved in advance. No AI, no storage,
   no request of any kind.
   - Q1 "I am a…" and Q2 "I need to…" are required radios; Q3, the goals, is optional and never changes the result: it is
     only passed on to the request form.
   - Arriving with ?who= (or ?i=) and ?need= set to valid values (the homepage teaser), the result shows at once.
     Unknown values are ignored.
   - The result, in this order: heading; who and need in one sentence; the "adjacent" line when the pair is adjacent; the
     guidance sentence; practice cards; structures as glossary chips; case cards and the figures notice; how we would create
     value; the visitor's goals (a goal that is also one of the pair's features is marked); the hand-off
     contact.html?i=<who>&need=<need>&goal=<goals> (the request form has all nine needs, so it preselects exactly this
     need); "Start over".
   - Accessible: fieldsets with legends, inline errors tied to each question, the result announced in a polite live region
     and focus moved to its heading. Without JS the questions stay hidden and a static list links each need to its practice.
   Motion: the result fades in (200ms), and "Start over" fades the questions back in; nothing moves. */
(function () {
  'use strict';

  var root = document.querySelector('[data-finder]');
  var HK = window.HK;
  if (!root || !HK) return;
  var D = HK.data('fd-data');
  var form = root.querySelector('[data-fd-form]');
  var out = root.querySelector('[data-fd-result]');
  var live = root.querySelector('[data-fd-live]');
  if (!D || !form || !out) return;
  var el = HK.el, put = HK.put;

  function find(list, v) { for (var i = 0; i < list.length; i++) if (list[i].v === v) return list[i]; return null; }
  function inputs(name) { return Array.prototype.slice.call(form.querySelectorAll('input[name="' + name + '"]')); }
  function chosen(name) { return inputs(name).filter(function (i) { return i.checked; }).map(function (i) { return i.value; }); }
  function text(v) { return document.createTextNode(v); }

  function setError(key, on) {
    var box = document.getElementById('fd-err-' + key);
    if (box) box.hidden = !on;
    inputs(key).forEach(function (i) { if (on) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); });
  }

  function block(label, body, extra) {
    var b = el('div', { 'class': 'fd-block' + (extra ? ' ' + extra : '') }, [el('h3', { 'class': 'fd-bh', text: label })]);
    (Array.isArray(body) ? body : [body]).forEach(function (n) { if (n) b.appendChild(n); });
    return b;
  }

  function practiceCard(slug) {
    var p = D.practices[slug];
    if (!p) return null;
    return el('li', null, [el('a', { 'class': 'fd-pcard', href: p.url }, [
      el('span', { 'class': 'fd-pn', text: p.n }),
      el('span', { 'class': 'fd-pt', text: p.name }),
      p.line ? el('span', { 'class': 'fd-pl', text: p.line }) : null,
      el('span', { 'class': 'fd-plink' }, [el('span', { text: D.labels['practice-link'] }), HK.arrow(16, 12)]),
    ])]);
  }

  function caseCard(id) {
    var c = D.cases[id];
    if (!c) return null;
    return el('li', null, [el('a', { 'class': 'rcard', href: c.url }, [
      el('span', { 'class': 'rc-top' }, [el('span', { 'class': 'rc-y', text: c.y }), el('span', { 'class': 'wc-ev wc-ev-' + c.ev, text: c.evl })]),
      el('span', { 'class': 'rc-t', text: c.t }),
      el('span', { 'class': 'rc-role', text: c.role }),
      el('span', { 'class': 'rc-st', text: c.st }),
      el('span', { 'class': 'rc-go' }, [el('span', { text: D.see }), HK.arrow(16, 12)]),
    ])]);
  }

  function handoff(who, need, goals) {
    return D.contact + '?i=' + encodeURIComponent(who) + '&need=' + encodeURIComponent(need) + (goals.length ? '&goal=' + goals.map(encodeURIComponent).join(',') : '');
  }

  function render(who, need, goals, fromLoad) {
    var W = find(D.who, who), N = find(D.need, need), R = D.map[who + '|' + need];
    if (!W || !N || !R) return false;
    var L = D.labels;
    out.textContent = '';

    var head = el('h2', { 'class': 'fd-rh headline', id: 'fd-rh', tabindex: '-1', text: L.heading });
    var you = el('p', { 'class': 'fd-you' });
    put(you, D.sentence.who); you.appendChild(text(' ')); put(you, W.l); you.appendChild(text(' '));
    put(you, D.sentence.need); you.appendChild(text(' ')); put(you, N.l); you.appendChild(text('.'));
    var parts = [head, you];
    if (R.fit === 'adjacent') parts.push(el('p', { 'class': 'fd-adj', text: L.adjacent }));
    parts.push(el('p', { 'class': 'fd-guide', text: R.g }));

    parts.push(block(L.practices, el('ul', { 'class': 'fd-pcards' }, R.p.map(practiceCard))));
    parts.push(block(L.structures, el('ul', { 'class': 'chips' }, R.s.map(function (s) {
      var t = D.terms[s];
      return t ? el('li', null, [el('a', { 'class': 'chip', href: t.url }, [el('span', { text: t.name })])]) : null; // one span: a chip is inline-flex
    }))));
    parts.push(block(L.cases, [
      el('ul', { 'class': 'rcards fd-cases' }, R.c.map(caseCard)),
      el('p', { 'class': 'caption fd-figs', text: D.figures }),
    ]));
    parts.push(block(L.features, el('ul', { 'class': 'fd-feats' }, R.f.map(function (f) {
      var x = D.features[f];
      return x ? el('li', null, [el('a', { 'class': 'fd-feat', href: x.url, text: x.name })]) : null;
    }))));
    if (goals.length) {
      parts.push(block(L.goals, el('ul', { 'class': 'fd-goals' }, goals.map(function (g) {
        var G = find(D.goal, g);
        if (!G) return null;
        var match = R.f.indexOf(g) >= 0;
        return el('li', { 'class': match ? 'is-match' : null }, [
          el('span', { 'class': 'fd-gn', text: G.l }),
          match ? el('span', { 'class': 'fd-match', text: D.match }) : null,
        ]);
      }))));
    }
    parts.push(el('div', { 'class': 'fd-cta' }, [
      el('a', { 'class': 'btn btn-primary', href: handoff(who, need, goals), text: L.cta }),
      el('p', { 'class': 'fhint', text: L['cta-note'] }),
    ]));
    var restart = el('button', { 'class': 'wclear fd-restart', type: 'button', text: L.restart });
    restart.addEventListener('click', startOver);
    parts.push(el('p', { 'class': 'fd-again' }, [restart]));

    parts.forEach(function (n) { out.appendChild(n); });
    form.hidden = true;
    out.hidden = false;
    out.classList.remove('is-in');
    void out.offsetWidth; // restart the fade
    out.classList.add('is-in');
    try { head.focus({ preventScroll: true }); } catch (e) { head.focus(); }
    head.scrollIntoView({ block: 'start', behavior: HK.reduce && HK.reduce.matches ? 'auto' : 'smooth' });
    // announce once the region has settled: the heading and where to start
    if (live) {
      live.textContent = '';
      window.setTimeout(function () {
        var first = D.practices[R.p[0]];
        live.textContent = HK.text(L.heading) + ': ' + (first ? HK.text(first.name) : '') + '. ' + HK.text(R.g);
      }, fromLoad ? 400 : 150);
    }
    return true;
  }

  function startOver() {
    form.reset();
    ['who', 'need'].forEach(function (k) { setError(k, false); });
    out.hidden = true;
    out.textContent = '';
    form.hidden = false;
    form.classList.remove('is-in');
    void form.offsetWidth; // the questions fade back in, as the result did
    form.classList.add('is-in');
    var first = inputs('who')[0];
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } root.scrollIntoView({ block: 'start', behavior: HK.reduce && HK.reduce.matches ? 'auto' : 'smooth' }); }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var who = chosen('who')[0], need = chosen('need')[0];
    setError('who', !who);
    setError('need', !need);
    if (!who || !need) {
      var bad = inputs(!who ? 'who' : 'need')[0];
      if (bad) bad.focus();
      return;
    }
    render(who, need, chosen('goal'), false);
  });
  form.addEventListener('change', function (e) {
    var n = e.target && e.target.name;
    if ((n === 'who' || n === 'need') && chosen(n).length) setError(n, false);
  });

  // The homepage teaser arrives with ?who=…&need=… (or ?i=…): show the result straight away
  try {
    var p = new URLSearchParams(window.location.search);
    var who = p.get('who') || p.get('i'), need = p.get('need');
    if (who && find(D.who, who)) inputs('who').forEach(function (i) { i.checked = i.value === who; });
    if (need && find(D.need, need)) inputs('need').forEach(function (i) { i.checked = i.value === need; });
    var goals = p.getAll('goal').join(',').split(',').filter(function (g) { return find(D.goal, g.trim()); });
    inputs('goal').forEach(function (i) { i.checked = goals.indexOf(i.value) >= 0; });
    if (who && need && find(D.who, who) && find(D.need, need)) render(who, need, chosen('goal'), true);
  } catch (e) { /* old browser: start with the questions */ }
})();
