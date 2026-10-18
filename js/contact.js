/* HAYKALAH request form (contact.html only; written by tools/build-pages.mjs from content/<lang>/contact.md).
   Progressive enhancement: without JS the browser's own validation applies (required, type=email) and the form posts
   to Netlify as usual (form "request", action thank-you.html). With JS:
   - Pre-fill from the URL, for the Structure Finder and deep links:
       ?who=<client_group> (or ?i=)  family-office · founder-investor · sovereign-government · bank-institution ·
                                     international-company, or a client page slug (family-offices, banks-institutions, …)
       ?need=<need>                  land-to-income · governance-succession · raise-capital · build-venture · digitize ·
                                     under-used-asset · bank-financing · ppp · market-entry (the nine Structure Finder
                                     needs, all real options since 2026-10-12; the Finder passes these values), or the
                                     practice a need routes to (real-estate-structuring, turning-expenses-into-revenue, …),
                                     which preselects the FIRST need routed to that practice
       ?goal=<feature-slug>          ticks goal_<slug>; repeat it or comma-separate for several
     The page-slug aliases come from the form's data-alias-who / data-alias-need. Any pre-fill sets source=finder.
     Example: contact.html?i=family-offices&need=real-estate-structuring
   - Inline validation on submit: each problem field gets its message (aria-describedby + aria-invalid), and an error
     summary above the form takes focus and links to each field. Fields re-check as they are corrected. */
(function () {
  'use strict';

  var form = document.querySelector('form[data-request]');
  if (!form) return;
  var els = form.elements;

  /* ------------------------------------------------------------ Pre-fill */
  function json(a) { try { return JSON.parse(form.getAttribute(a) || '{}'); } catch (e) { return {}; } }
  var whoAlias = json('data-alias-who'), needAlias = json('data-alias-need');
  var params;
  try { params = new URLSearchParams(window.location.search); } catch (e) { params = null; }
  if (params) {
    var prefilled = false;
    var who = params.get('who') || params.get('i');
    if (who && els.client_group) {
      var wv = whoAlias[who] || who;
      Array.prototype.forEach.call(els.client_group, function (r) { if (r.value === wv) { r.checked = true; prefilled = true; } });
    }
    var need = params.get('need');
    if (need && els.need) {
      // a form value wins over an alias, so the Finder's exact need is always the one preselected
      var has = function (v) { return Array.prototype.some.call(els.need.options, function (o) { return o.value === v; }); };
      var nv = has(need) ? need : needAlias[need];
      if (nv && has(nv)) { els.need.value = nv; prefilled = true; }
    }
    params.getAll('goal').join(',').split(',').forEach(function (g) {
      g = g.trim();
      var box = g && /^[a-z-]+$/.test(g) ? els['goal_' + g] : null;
      if (box && box.type === 'checkbox') { box.checked = true; prefilled = true; }
    });
    if (prefilled && els.source) els.source.value = 'finder';
  }

  /* ------------------------------------------------------------ Validation */
  form.noValidate = true;
  var summary = document.getElementById('rf-summary');
  var listEl = summary ? summary.querySelector('.ferr-list') : null;
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE = /^\+?[0-9][0-9\s()\-]{6,}$/; // digits, starting with the country code; spaces and hyphens allowed
  var names = Array.prototype.map.call(form.querySelectorAll('.ferr'), function (b) { return b.id.replace(/^rf-err-/, ''); });
  var submitted = false;

  function controls(n) {
    var c = els[n];
    if (!c) return [];
    return c.tagName ? [c] : Array.prototype.slice.call(c); // RadioNodeList → array
  }
  function problem(n) {
    var cs = controls(n), first = cs[0];
    if (!first) return null;
    var val;
    if (first.type === 'radio') val = cs.some(function (c) { return c.checked; }) ? 'x' : '';
    else if (first.type === 'checkbox') val = first.checked ? 'x' : '';
    else val = String(first.value || '').trim();
    if (first.required && !val) return 'required';
    if (val && first.type === 'email' && !EMAIL.test(val)) return 'format';
    if (val && first.type === 'tel' && !PHONE.test(val)) return 'format';
    return null;
  }
  function show(n, kind) {
    var box = document.getElementById('rf-err-' + n);
    if (!box) return;
    box.hidden = !kind;
    Array.prototype.forEach.call(box.querySelectorAll('[data-msg]'), function (s) { s.hidden = s.getAttribute('data-msg') !== kind; });
    controls(n).forEach(function (c) {
      if (kind) c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid');
      var ids = (c.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (x) { return x && x !== box.id; });
      if (kind) ids.push(box.id);
      if (ids.length) c.setAttribute('aria-describedby', ids.join(' ')); else c.removeAttribute('aria-describedby');
    });
  }
  function check(n) { var k = problem(n); show(n, k); return k; }

  function fillSummary(bad) {
    if (!summary || !listEl) return;
    listEl.textContent = '';
    bad.forEach(function (n) {
      var box = document.getElementById('rf-err-' + n);
      var msg = box && box.querySelector('[data-msg]:not([hidden])');
      var target = controls(n)[0];
      if (!msg || !target) return;
      var li = document.createElement('li'), a = document.createElement('a');
      a.href = '#' + (target.id || '');
      Array.prototype.forEach.call(msg.childNodes, function (node) { a.appendChild(node.cloneNode(true)); }); // keeps <bdi>
      a.addEventListener('click', function (e) {
        e.preventDefault();
        target.focus();
      });
      li.appendChild(a);
      listEl.appendChild(li);
    });
    summary.hidden = !bad.length;
  }

  form.addEventListener('submit', function (e) {
    submitted = true;
    var bad = names.filter(function (n) { return check(n); });
    if (!bad.length) { if (summary) summary.hidden = true; return; } // valid: the browser posts to Netlify
    e.preventDefault();
    fillSummary(bad);
    if (summary) summary.focus();
  });

  function recheck(e) {
    var n = e.target && e.target.name;
    if (!submitted || !n || names.indexOf(n) < 0) return;
    check(n);
    if (summary && !summary.hidden) fillSummary(names.filter(function (x) { return problem(x); }));
  }
  form.addEventListener('input', recheck);
  form.addEventListener('change', recheck);
})();
