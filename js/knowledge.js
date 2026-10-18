/* HAYKALAH Knowledge Center hub (knowledge.html only; written by tools/build-pages.mjs).
   Progressive enhancement: without JS every term shows, in its group, and the search panel stays hidden.
   - Search: every word typed must appear in the term's name (English or Arabic), its other names or its definition.
     Matching ignores case, Latin accents, Arabic diacritics and tatweel, alef / yaa / taa marbuta variants,
     apostrophes and hyphens, so "istisna", "Istisna'a" and «استصناع» all find Istisna'a.
   - Group filter (a select): one group or all; each option shows how many terms it would leave for the current search.
   - Groups with no matching term are hidden; a polite live region reports "Showing n of N terms"; an empty state
     offers to clear. The query string mirrors the state (?q=…&group=…), so a search can be shared.
   Motion: none; results change in place (DIRECTION.md). */
(function () {
  'use strict';

  var root = document.querySelector('[data-know]');
  if (!root) return;
  var panel = root.querySelector('[data-kfilters]');
  var q = panel && panel.querySelector('[data-q]');
  var sel = panel && panel.querySelector('[data-g]');
  if (!panel || !q || !sel) return;
  function all(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }

  var countEl = panel.querySelector('[data-count]');
  var empty = root.querySelector('[data-empty]');
  var clears = all('[data-clear]', root);
  var barClear = panel.querySelector('[data-clear]');
  var sections = all('[data-kgroup]', root);
  var rtl = document.documentElement.getAttribute('dir') === 'rtl';

  // the shared EN/AR normalisation lives in js/site.js (window.HK.norm), which loads first; Ask HAYKALAH uses it too
  var norm = (window.HK && window.HK.norm) || function (s) { return String(s || '').toLowerCase().trim(); };

  var items = all('.kcard', root).map(function (el) {
    var text = all('.kc-t, .kc-alt, .kc-def', el).map(function (n) { return n.textContent; }).join(' ');
    return { el: el, group: el.getAttribute('data-group'), hay: ' ' + norm(text + ' ' + (el.getAttribute('data-also') || '') + ' ' + el.id.replace(/^k-/, '')) };
  });

  panel.hidden = false;

  function words() { var v = norm(q.value); return v ? v.split(' ') : []; }
  function hit(it, ws, g) {
    if (g && it.group !== g) return false;
    for (var i = 0; i < ws.length; i++) if (it.hay.indexOf(ws[i]) < 0) return false;
    return true;
  }
  // option text cannot hold <bdi>: Arabic digits get Unicode isolates instead
  function iso(n) { return rtl ? '⁦' + n + '⁩' : String(n); }

  function setCount(shown) {
    var tpl = countEl.getAttribute('data-tpl') || '{n} / {total}';
    var frag = document.createDocumentFragment(), text = '';
    tpl.split(/(\{n\}|\{total\})/).forEach(function (part) {
      if (!part) return;
      if (part === '{n}' || part === '{total}') {
        var b = document.createElement('bdi');
        b.textContent = part === '{n}' ? shown : items.length;
        frag.appendChild(b);
        text += b.textContent;
      } else {
        frag.appendChild(document.createTextNode(part));
        text += part;
      }
    });
    if (countEl.textContent !== text) { countEl.textContent = ''; countEl.appendChild(frag); } // unchanged text is not re-announced
  }

  function syncURL(ws, g) {
    if (!window.history || !window.history.replaceState) return;
    var p = [];
    if (q.value.trim()) p.push('q=' + encodeURIComponent(q.value.trim()));
    if (g) p.push('group=' + encodeURIComponent(g));
    var url = window.location.pathname + (p.length ? '?' + p.join('&') : '') + window.location.hash;
    try { window.history.replaceState(null, '', url); } catch (e) { /* file:// or sandboxed: ignore */ }
  }

  var announce = 0;
  function render(fromUser) {
    var ws = words(), g = sel.value, shown = 0;
    items.forEach(function (it) {
      var ok = hit(it, ws, g);
      if (it.el.hidden === ok) it.el.hidden = !ok;
      if (ok) shown++;
    });
    sections.forEach(function (s) { s.hidden = !s.querySelector('.kcard:not([hidden])'); });
    if (empty) empty.hidden = shown > 0;
    Array.prototype.forEach.call(sel.options, function (o) {
      var n = items.filter(function (it) { return hit(it, ws, o.value); }).length;
      o.textContent = (o.getAttribute('data-label') || o.textContent) + ' (' + iso(n) + ')';
    });
    if (barClear) barClear.hidden = !(ws.length || g);
    root.classList.toggle('is-filtering', !!(ws.length || g)); // the A–Z jump list (to the unfiltered index) steps aside
    // the visible list changes at once; the count (a live region) settles before it is announced
    window.clearTimeout(announce);
    if (fromUser) announce = window.setTimeout(function () { setCount(shown); }, 350);
    else setCount(shown);
    if (fromUser) syncURL(ws, g);
  }

  function reset() { q.value = ''; sel.value = ''; }

  q.addEventListener('input', function () { render(true); });
  q.addEventListener('search', function () { render(true); }); // the search field's own clear control
  q.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && q.value) { e.preventDefault(); q.value = ''; render(true); }
  });
  sel.addEventListener('change', function () { render(true); });
  clears.forEach(function (b) {
    b.addEventListener('click', function () {
      reset();
      render(true);
      q.focus(); // the empty state (and its button) is gone: keep focus in the panel
    });
  });

  // state from the query string (?q=…&group=…)
  try {
    var p = new URLSearchParams(window.location.search);
    if (p.get('q')) q.value = p.get('q');
    var g = p.get('group');
    if (g && Array.prototype.some.call(sel.options, function (o) { return o.value === g; })) sel.value = g;
  } catch (e) { /* old browser: start unfiltered */ }
  render(false);
})();
