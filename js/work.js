/* HAYKALAH Signature work explorer (work.html only; written by tools/build-pages.mjs).
   Progressive enhancement: without JS every case shows and the filter panel stays hidden.
   - Five selects (sector, role, city, status, chapter) combine with AND; the "How we create value" toggles
     (button[aria-pressed]) combine with OR among themselves. Each option and toggle shows how many cases it would
     leave, given the other filters, and a polite live region reports "Showing n of N cases".
   - The query string mirrors the filters (?sector=…&feature=a,b), so a sector page can link to its cases.
   - Arriving with #<case-id> (the homepage and sector pages link that way): the filters are cleared, the case is
     scrolled to, focused and highlighted. Same on a later hashchange.
   Motion: none beyond the highlight's 300ms colour fade (DIRECTION.md); results change in place. */
(function () {
  'use strict';

  var root = document.querySelector('[data-work]');
  if (!root) return;
  var panel = root.querySelector('[data-filters]');
  var list = root.querySelector('[data-cases]');
  if (!panel || !list) return;
  function all(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }

  var cases = all('.wcase', list);
  var selects = all('select[data-key]', panel);
  var chips = all('button[data-feature]', panel);
  var countEl = panel.querySelector('[data-count]');
  var empty = root.querySelector('[data-empty]');
  var clears = all('[data-clear]', root);
  var rtl = document.documentElement.getAttribute('dir') === 'rtl';
  var KEYS = selects.map(function (s) { return s.getAttribute('data-key'); });

  panel.hidden = false;

  function tags(el, key) { return (el.getAttribute('data-' + key) || '').split(' '); }

  function state() {
    var st = {};
    selects.forEach(function (s) { if (s.value) st[s.getAttribute('data-key')] = s.value; });
    var f = chips.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })
      .map(function (b) { return b.getAttribute('data-feature'); });
    if (f.length) st.feature = f;
    return st;
  }

  // does a case pass every active filter (optionally ignoring one, to count what that filter's choices would leave)?
  function matches(el, st, skip) {
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i];
      if (k !== skip && st[k] && tags(el, k).indexOf(st[k]) < 0) return false;
    }
    if (skip !== 'feature' && st.feature) {
      var t = tags(el, 'feature');
      if (!st.feature.some(function (f) { return t.indexOf(f) >= 0; })) return false;
    }
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
        b.textContent = part === '{n}' ? shown : cases.length;
        frag.appendChild(b);
        text += b.textContent;
      } else {
        frag.appendChild(document.createTextNode(part));
        text += part;
      }
    });
    if (countEl.textContent !== text) { countEl.textContent = ''; countEl.appendChild(frag); } // unchanged text is not re-announced
  }

  function syncURL(st) {
    if (!window.history || !window.history.replaceState) return;
    var q = [];
    KEYS.forEach(function (k) { if (st[k]) q.push(k + '=' + encodeURIComponent(st[k])); });
    if (st.feature) q.push('feature=' + st.feature.map(encodeURIComponent).join(','));
    var url = window.location.pathname + (q.length ? '?' + q.join('&') : '') + (q.length ? '' : window.location.hash);
    try { window.history.replaceState(null, '', url); } catch (e) { /* file:// or sandboxed: ignore */ }
  }

  function render(fromUser) {
    var st = state(), shown = 0;
    cases.forEach(function (el) {
      var ok = matches(el, st);
      el.hidden = !ok;
      if (ok) { el.classList.toggle('is-even', shown % 2 === 1); shown++; }
    });
    list.classList.toggle('is-filtered', Object.keys(st).length > 0);
    if (empty) empty.hidden = shown > 0;

    selects.forEach(function (s) {
      var key = s.getAttribute('data-key');
      Array.prototype.forEach.call(s.options, function (o) {
        if (!o.value) return;
        var n = cases.filter(function (el) { return matches(el, st, key) && tags(el, key).indexOf(o.value) >= 0; }).length;
        o.textContent = o.getAttribute('data-label') + ' (' + iso(n) + ')';
      });
    });
    chips.forEach(function (b) {
      var f = b.getAttribute('data-feature');
      var n = cases.filter(function (el) { return matches(el, st, 'feature') && tags(el, 'feature').indexOf(f) >= 0; }).length;
      var out = b.querySelector('[data-n]');
      if (out) { var bdi = out.querySelector('bdi'); (bdi || out).textContent = n; }
    });
    setCount(shown);
    if (fromUser) {
      cases.forEach(function (el) { el.classList.remove('is-target'); });
      syncURL(st);
    }
  }

  function reset() {
    selects.forEach(function (s) { s.value = ''; });
    chips.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
  }

  // filters from the query string (?sector=…&role=…&city=…&status=…&year=…&feature=a,b)
  function fromQuery() {
    var p;
    try { p = new URLSearchParams(window.location.search); } catch (e) { return; }
    selects.forEach(function (s) {
      var v = p.get(s.getAttribute('data-key'));
      if (v && Array.prototype.some.call(s.options, function (o) { return o.value === v; })) s.value = v;
    });
    var f = (p.get('feature') || '').split(',');
    chips.forEach(function (b) { if (f.indexOf(b.getAttribute('data-feature')) >= 0) b.setAttribute('aria-pressed', 'true'); });
  }

  // #<case-id>: clear the filters, then scroll to the case, focus it and mark it
  function goToHash() {
    var id = '';
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch (e) { return false; }
    var el = id ? document.getElementById(id) : null;
    if (!el || !el.classList.contains('wcase')) return false;
    reset();
    render(false);
    cases.forEach(function (c) { c.classList.toggle('is-target', c === el); });
    try { window.history.replaceState(null, '', window.location.pathname + '#' + id); } catch (e) { /* ignore */ }
    try { el.scrollIntoView({ block: 'start', behavior: 'instant' }); } catch (e) { el.scrollIntoView(true); }
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    return true;
  }

  selects.forEach(function (s) { s.addEventListener('change', function () { render(true); }); });
  chips.forEach(function (b) {
    b.addEventListener('click', function () {
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      render(true);
    });
  });
  clears.forEach(function (b) {
    b.addEventListener('click', function () {
      var inEmpty = empty && empty.contains(b);
      reset();
      render(true);
      if (inEmpty && selects[0]) selects[0].focus(); // the empty state (and its button) is gone: keep focus in the panel
    });
  });
  window.addEventListener('hashchange', goToHash);

  if (!goToHash()) {
    fromQuery();
    render(false);
  }
})();
