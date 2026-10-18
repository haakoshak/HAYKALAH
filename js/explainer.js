/* HAYKALAH structure explainers (explainers/*.html; the diagram is drawn by tools/build-pages.mjs from each step's
   "nodes" and "flow" lines in content/<lang>/explainer-*.md).
   Step-through: "Previous step", "Next step" and the step list move one step at a time.
   - The current step's flows draw themselves (stroke-dashoffset, ease-out, 300ms each, 120ms apart), then their labels
     fade in on the line; its parties are outlined. Earlier flows stay visible but quieter: dashed, with their step number.
     Later flows are hidden and later parties dashed and faint, so the states never rest on colour alone.
   - The step's number, title, text and flows sit in a polite live region (the panel above the diagram), so each step is
     announced. On phones and small tablets the panel's flow rows are the diagram (the full SVG would be too small to read).
   - The panel's title, text and flow rows fade in (200ms) when the visitor changes step, so the words never hard-cut.
   - Reduced motion: nothing draws; the step's flows, labels and words fade in.
   - Arriving with #step-<n> opens that step. The diagram's first step draws when the diagram first comes into view.
   - Labels are measured once the fonts are ready: each background is sized to its text, and a label whose pair moves both
     ways in the same step sits on its own side of the lines.
   Without JS every flow shows with its step number, and every step is listed in words. */
(function () {
  'use strict';

  var root = document.querySelector('[data-xp]');
  if (!root) return;
  function all(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  var svg = root.querySelector('[data-xp-svg]');
  var list = root.querySelector('.xp-steps');
  var total = parseInt(root.getAttribute('data-total'), 10) || 1;
  var tpl = root.getAttribute('data-count') || '{n} / {total}';
  var countEl = root.querySelector('[data-xp-count]'), titleEl = root.querySelector('[data-xp-title]');
  var textEl = root.querySelector('[data-xp-text]'), rowsEl = root.querySelector('[data-xp-rows]');
  var prev = root.querySelector('[data-xp-prev]'), next = root.querySelector('[data-xp-next]');
  if (!svg || !list || !prev || !next) return;
  var flows = all('.fl', svg), labels = all('.fl-lab', svg), nodes = all('.nd', svg), items = all('.xp-step', list);
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wide = window.matchMedia('(min-width: 1024px)');
  var cur = 0;

  root.classList.add('is-stepping');

  // the list's headings become buttons that open their step
  items.forEach(function (li, i) {
    var h = li.querySelector('.xp-sh');
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'xp-jump';
    while (h.firstChild) b.appendChild(h.firstChild);
    h.appendChild(b);
    b.addEventListener('click', function () { go(i + 1, true); });
    li.xpButton = b;
  });

  /* Labels: size each background to its text, and place a two-way pair's labels on either side of their lines */
  function place() {
    labels.forEach(function (g) {
      var t = g.querySelector('text'), r = g.querySelector('rect'), bb;
      try { bb = t.getBBox(); } catch (e) { return; }
      if (!bb || !bb.width) return;
      var w = bb.width + 18, h = bb.height + 10;
      r.setAttribute('x', (-w / 2).toFixed(1));
      r.setAttribute('y', (bb.y - 5).toFixed(1));
      r.setAttribute('width', w.toFixed(1));
      r.setAttribute('height', h.toFixed(1));
      var side = parseFloat(g.getAttribute('data-side')) || 0;
      var mx = parseFloat(g.getAttribute('data-mx')), my = parseFloat(g.getAttribute('data-my'));
      var nx = parseFloat(g.getAttribute('data-nx')), ny = parseFloat(g.getAttribute('data-ny'));
      var ext = Math.abs(nx) * w / 2 + Math.abs(ny) * h / 2 + 6;
      g.setAttribute('transform', 'translate(' + (mx + nx * side * ext).toFixed(1) + ' ' + (my + ny * side * ext).toFixed(1) + ')');
    });
  }

  function fillCount(n) {
    countEl.textContent = '';
    tpl.split(/(\{n\}|\{total\})/).forEach(function (part) {
      if (!part) return;
      if (part === '{n}' || part === '{total}') { var b = document.createElement('bdi'); b.textContent = part === '{n}' ? n : total; countEl.appendChild(b); }
      else countEl.appendChild(document.createTextNode(part));
    });
  }
  function copy(target, from) { target.textContent = ''; if (from) Array.prototype.forEach.call(from.childNodes, function (n) { target.appendChild(n.cloneNode(true)); }); }

  // mode: 'static' (shown at once), 'hold' (undrawn, waiting to come into view) or 'draw' (draws now)
  function setFlows(n, mode) {
    var draw = mode !== 'static', k = 0;
    // an earlier flow on the very line the current step uses again (same parties, same direction) gives way to it
    var nowKeys = {};
    flows.forEach(function (g) { if (parseInt(g.getAttribute('data-step'), 10) === n) nowKeys[g.getAttribute('data-key')] = 1; });
    flows.forEach(function (g) {
      var s = parseInt(g.getAttribute('data-step'), 10);
      var st = s === n ? 'now' : s > n ? 'future' : nowKeys[g.getAttribute('data-key')] ? 'future' : 'past';
      if (st === 'now') g.style.setProperty('--d', (k++ * 120) + 'ms');
      g.setAttribute('data-state', st === 'now' && draw ? 'drawing' : st);
    });
    k = 0;
    labels.forEach(function (g) {
      var s = parseInt(g.getAttribute('data-step'), 10);
      if (s === n) g.style.setProperty('--d', (k++ * 120) + 'ms');
      g.setAttribute('data-state', s === n ? (draw ? 'wait' : 'now') : 'off');
    });
    if (mode === 'draw') {
      void svg.getBoundingClientRect(); // commit the undrawn state, then let the lines draw
      window.requestAnimationFrame(function () {
        flows.forEach(function (g) { if (g.getAttribute('data-state') === 'drawing') g.setAttribute('data-state', 'now'); });
        labels.forEach(function (g) { if (g.getAttribute('data-state') === 'wait') g.setAttribute('data-state', 'now'); });
      });
    }
  }

  function go(n, user) {
    n = Math.max(1, Math.min(total, n));
    if (n === cur && user) return;
    cur = n;
    root.setAttribute('data-current', n);
    nodes.forEach(function (g) {
      var s = (g.getAttribute('data-steps') || '').split(' ').map(Number);
      g.setAttribute('data-state', s.indexOf(n) >= 0 ? 'now' : s[0] < n ? 'past' : 'future');
    });
    // draw when the visitor moves, never with reduced motion
    setFlows(n, user && !reduce.matches ? 'draw' : 'static');
    items.forEach(function (li, i) {
      var on = i + 1 === n;
      li.classList.toggle('is-current', on);
      if (on) li.xpButton.setAttribute('aria-current', 'step'); else li.xpButton.removeAttribute('aria-current');
    });
    var li = items[n - 1];
    fillCount(n);
    copy(titleEl, li.querySelector('.xp-st'));
    copy(textEl, li.querySelector('.xp-sx'));
    copy(rowsEl, li.querySelector('.xp-rows'));
    // the new step's words fade in where the old ones stood (200 ms, opacity only, so also with reduced motion at 150 ms)
    if (user) {
      [titleEl, textEl, rowsEl].forEach(function (el) { if (el) el.classList.remove('is-in'); });
      void root.offsetWidth;
      [titleEl, textEl, rowsEl].forEach(function (el) { if (el) el.classList.add('is-in'); });
    }
    prev.setAttribute('aria-disabled', n === 1 ? 'true' : 'false');
    next.setAttribute('aria-disabled', n === total ? 'true' : 'false');
  }

  prev.addEventListener('click', function () { if (cur > 1) go(cur - 1, true); });
  next.addEventListener('click', function () { if (cur < total) go(cur + 1, true); });

  var m = window.location.hash.match(/^#step-(\d+)$/);
  go(m ? parseInt(m[1], 10) : 1, false);

  // The first step draws when the diagram first comes into view (no motion with reduced motion)
  if ('IntersectionObserver' in window && !reduce.matches && !m && wide.matches) {
    var first = cur;
    setFlows(first, 'hold');
    var io = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect();
      if (cur === first) setFlows(cur, 'draw');
    }, { threshold: 0.35 });
    io.observe(svg);
  }

  // measure the labels once the fonts are in, and again whenever the diagram is shown at a new size
  function measure() { if (wide.matches) place(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure); else measure();
  measure();
  if (wide.addEventListener) wide.addEventListener('change', measure); else if (wide.addListener) wide.addListener(measure);
})();
