/* HAYKALAH Ask HAYKALAH, Beta (ask.html only; copy and settings written by tools/build-pages.mjs from content/<lang>/ask.md
   into <script type="application/json" id="ask-config">).

   PASSAGE MODE (ASK_AI_CONNECTED = false in the builder; config.ai false): the question is matched, in the browser, against
   site/data/ask-index-<lang>.json, one entry per paragraph of HAYKALAH's published pages ({ id, page, section, url, text }),
   with BM25 over the shared EN/AR normalisation (window.HK.norm, js/site.js) plus light English and Arabic stemming.
   The three most relevant passages show as numbered source cards, "[1] Page › Section", with the matched words marked
   (<mark> elements built with textContent; nothing from the data is ever parsed as HTML) and a link to the passage.
   A question written in the other script (Arabic on /en/, Latin letters only on /ar/) is matched against the other
   language's index, and its cards link to those pages.
   - Refusals (content: ## Refusals): personal or confidential details, messages or offers received in HAYKALAH's name, and
     specific investments, returns, prices or recommendations are recognised by EN/AR patterns before anything else; the
     page shows the refusal and "Talk to a person" instead of passages. Personal details are never sent anywhere.
   - No match (content: ## No answer): the message and its links.
   - Privacy: no cookies, no localStorage or sessionStorage, and no network request in passage mode except loading the
     index JSON (on first use). A question arriving as ask.html#q=… (the homepage box) or ?q=… was read, and removed from
     the address bar, by the inline script in <head> (window.HK_ASK_Q). This script never writes the question into the URL.

   AI MODE (config.ai true; the Netlify Function is NOT part of this build): after the refusal check and the retrieval,
   the page POSTs to config.endpoint (/.netlify/functions/ask), same origin, no cookies needed:
     request  { "question": "What is Musataha?", "lang": "en",
                "passages": [ { "n": 1, "id": "en-123", "page": "Musataha", "section": "What it means",
                                "url": "knowledge/musataha.html#tm-what", "text": "…" }, … up to 6 ] }
     response { "answer": "Plain text. Cite passages as [1], [2].",           (required; rendered with textContent)
                "sources": [1, 2],                                            (optional: the passage numbers it cites)
                "refusal": "investment" | "official-channels" | "personal-data" (optional: the function declined)
                "noAnswer": true }                                             (optional: the passages do not cover it)
   The answer shows with its numbered sources. Any network error, a timeout (20 s), a non-2xx status or a malformed body
   falls back to passage mode, with the content's fallback line above the passages. */
(function () {
  'use strict';

  var root = document.querySelector('[data-ask]');
  var HK = window.HK;
  if (!root || !HK || !HK.norm) return;
  var C = HK.data('ask-config');
  var form = root.querySelector('[data-ask-form]');
  var input = form && form.querySelector('input');
  var out = root.querySelector('[data-ask-out]');
  var live = root.querySelector('[data-ask-live]');
  if (!C || !form || !input || !out) return;
  var el = HK.el, put = HK.put, L = C.labels;

  /* ------------------------------------------------------------ Text: tokens, stemming, stop words */
  var AR = /[؀-ۿ]/;
  function stemEn(w) {
    if (/^\d+$/.test(w)) return w;
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (w.length > 3 && /s$/.test(w) && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
    if (w.length > 4 && /ah$/.test(w)) w = w.slice(0, -1); // Ijarah → ijara, Musharakah → musharaka
    return w;
  }
  var AR_PRE = ['وال', 'بال', 'كال', 'فال', 'لل', 'ال'];
  var AR_SUF = ['ها', 'نا', 'كم', 'هم', 'ان', 'ات', 'ون', 'ين', 'يه', 'ه', 'ي'];
  function stemAr(w) {
    if (w.length >= 4 && w.charAt(0) === 'و') w = w.slice(1); // و
    for (var i = 0; i < AR_PRE.length; i++) if (w.indexOf(AR_PRE[i]) === 0 && w.length - AR_PRE[i].length >= 2) { w = w.slice(AR_PRE[i].length); break; }
    for (var j = 0; j < AR_SUF.length; j++) { var s = AR_SUF[j]; if (w.length - s.length >= 2 && w.slice(-s.length) === s) w = w.slice(0, -s.length); }
    return w;
  }
  var STOP = {};
  ('a an the and or of to in on for with by is are was were be been it its this that these those what which who whom how why when where ' +
    'do does did done can could would should will shall may might must i we you he she they my our your their me us him her them from as at ' +
    'about into than then there here not no yes if so also any all some more most such per via tell explain mean meaning please give know').split(' ').forEach(function (w) { STOP[stemEn(HK.norm(w))] = 1; });
  ('في من على إلى عن ما ماذا هل هو هي هم كيف لماذا متى أين ' +
    'التي الذي الذين ذلك هذه هذا أن إن أو و ثم كان كانت يكون مع قد لا لم لن بين كل أي ' +
    'عند لدى حين إذا لدي لديكم اشرح معنى تعريف')
    .split(' ').forEach(function (w) { STOP[stemAr(HK.norm(w))] = 1; STOP[HK.norm(w)] = 1; });

  function tokens(s) {
    var out = [];
    HK.norm(s).replace(/[^\p{L}\p{N}\s]+/gu, ' ').split(/\s+/).forEach(function (w) { // question marks and other punctuation never stick to a word
      if (!w) return;
      var t = AR.test(w) ? stemAr(w) : stemEn(w);
      if (t.length < 2 && !/^\d$/.test(t)) return;
      if (STOP[t]) return;
      out.push(t);
    });
    return out;
  }

  /* ------------------------------------------------------------ The index (loaded once, on first use) */
  var cache = {};
  function loadIndex(lang) {
    if (cache[lang]) return cache[lang];
    var url = lang === C.lang ? C.index : C.other.index;
    cache[lang] = fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('index ' + r.status);
      return r.json();
    }).then(function (j) {
      var docs = [], df = {}, total = 0;
      (j.passages || []).forEach(function (p) {
        var tf = {}, n = 0, bi = {}, prev = null;
        tokens(p.text).forEach(function (t) { tf[t] = (tf[t] || 0) + 1; n++; if (prev) bi[prev + ' ' + t] = 1; prev = t; });
        // the page title and the section heading (often an FAQ question) count three times, and their word pairs count too
        prev = null;
        tokens(p.page + ' ' + (p.section || '')).forEach(function (t) { tf[t] = (tf[t] || 0) + 3; n += 3; if (prev) bi[prev + ' ' + t] = 1; prev = t; });
        Object.keys(tf).forEach(function (t) { df[t] = (df[t] || 0) + 1; });
        total += n;
        docs.push({ p: p, tf: tf, bi: bi, len: n });
      });
      return { docs: docs, df: df, avg: total / Math.max(docs.length, 1), vocab: Object.keys(df), lang: lang };
    });
    cache[lang].catch(function () { delete cache[lang]; }); // a failed load can be retried
    return cache[lang];
  }

  /* BM25 (k1 1.2, b 0.75). A question word missing from the index also matches index words that begin with it, or share
     all but its last letters with it (at 0.7 weight), so "istisna" finds Istisna'a and "founded" finds founder.
     Two question words that stand next to each other in a passage add a bonus. A passage must contain every word of a
     one- or two-word question, and at least 60% of the words of a longer one, to count as an answer. */
  function prefix(a, z) { var i = 0; while (i < a.length && i < z.length && a.charAt(i) === z.charAt(i)) i++; return i; }
  function search(I, qt) {
    var N = I.docs.length, k1 = 1.2, b = 0.75;
    var terms = [];
    var idf = function (t) { return Math.log(1 + (N - I.df[t] + 0.5) / (I.df[t] + 0.5)); };
    qt.forEach(function (t) {
      if (I.df[t]) { terms.push({ t: t, w: 1, q: t }); return; }
      var n = 0;
      if (t.length >= 4) I.vocab.forEach(function (v) {
        if (n >= 8 || v === t) return;
        var p = prefix(t, v);
        if (v.indexOf(t) === 0 || (v.length >= 5 && t.indexOf(v) === 0) || (p >= 5 && p >= Math.min(t.length, v.length) - 2)) { terms.push({ t: v, w: 0.7, q: t }); n++; }
      });
    });
    var uq = qt.filter(function (t, i) { return qt.indexOf(t) === i; });
    var need = uq.length <= 2 ? uq.length : Math.ceil(uq.length * 0.6);
    var pairs = [];
    for (var k = 1; k < qt.length; k++) if (qt[k] !== qt[k - 1]) pairs.push([qt[k - 1], qt[k]]);
    var res = [];
    I.docs.forEach(function (d) {
      var s = 0, hit = {};
      terms.forEach(function (x) {
        var f = d.tf[x.t];
        if (!f) return;
        s += x.w * idf(x.t) * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / I.avg));
        hit[x.q] = 1;
      });
      if (!s) return;
      var got = Object.keys(hit).length;
      if (got < need) return;
      pairs.forEach(function (pr) { if (d.bi[pr[0] + ' ' + pr[1]]) s += (idf(pr[0]) + idf(pr[1])) / 2; });
      var cover = got / Math.max(uq.length, 1);
      res.push({ d: d, s: s * (0.5 + 0.5 * cover), cover: cover, terms: terms.filter(function (x) { return d.tf[x.t]; }).map(function (x) { return x.t; }) });
    });
    res.sort(function (a, z) { return z.s - a.s; });
    // three passages: never the same place twice, at most two from one page
    var pick = [], perPage = {};
    for (var i = 0; i < res.length && pick.length < 6; i++) {
      var r = res[i], page = r.d.p.url.split('#')[0];
      if (r.s < 0.3) continue;
      if (pick.some(function (x) { return x.d.p.url === r.d.p.url; })) continue;
      if ((perPage[page] || 0) >= 2) continue;
      perPage[page] = (perPage[page] || 0) + 1;
      pick.push(r);
    }
    return pick;
  }

  /* ------------------------------------------------------------ Refusals, before anything else */
  function digitsRun(q) { // nine digits or more in one run (spaces, dots, dashes and brackets allowed): a phone, ID or account number
    var m = q.match(/[+\d][\d\s().\-]{7,}\d/g) || [];
    return m.some(function (x) { return (x.match(/\d/g) || []).length >= 9; });
  }
  var REFUSE = [
    ['personal-data', function (q) {
      return /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(q) || digitsRun(q) || /\bSA\d{2}\s?\d{2}/i.test(q) ||
        /\bmy (?:name|phone|mobile|number|email|e-mail|address|iban|account|passport|national id|id number)\b/i.test(q) || /\bmy name is\b/i.test(q) ||
        /(?:اسمي|رقم (?:جوالي|هاتفي|هويتي|حسابي)|جوالي|بريدي|عنواني|هويتي)/.test(q);
      // اسمي، رقم جوالي/هاتفي/هويتي/حسابي، جوالي، بريدي، عنواني، هويتي
    }],
    ['official-channels', function (q) {
      return /\b(?:scam|scams|fraud|fraudulent|phishing|impersonat\w*|whatsapp|telegram)\b/i.test(q) ||
        /\b(?:someone|somebody|a person|a man|a woman|they|he|she|a company) (?:has |have )?(?:called|contacted|messaged|emailed|texted|offered|asked)\b/i.test(q) ||
        /\b(?:received|got|get|getting) (?:a |an )?(?:call|calls|message|messages|email|emails|text|texts|offer|offers|invoice|payment request)\b/i.test(q) ||
        /\b(?:is|was) (?:this|that|it) (?:email|message|offer|call|account|number|person|website|link) (?:real|genuine|legit\w*|from haykalah)\b/i.test(q) ||
        /\b(?:transfer|send|pay|wire|deposit) (?:money|funds|a deposit|a fee|fees|payment)\b/i.test(q) ||
        /(?:احتيال|نصب|مزيف|انتحال|واتساب|تيليجرام|تلقيت|اتصل بي|راسلني|عرض علي|طلب مني|تحويل (?:مبلغ|أموال|اموال))/.test(q);
      // احتيال، نصب، مزيف، انتحال، واتساب، تيليجرام، تلقيت، اتصل بي، راسلني، عرض علي، طلب مني، تحويل مبلغ/أموال
    }],
    ['investment', function (q) {
      return /\bshould (?:i|we) (?:invest|buy|sell|put)\b/i.test(q) ||
        /\b(?:where|what|which) (?:should|can|could|do) (?:i|we) (?:invest|buy)\b/i.test(q) ||
        /\b(?:is|are) (?:it|this|that|they|sukuk|haykalah)\b[^?]{0,40}\b(?:a )?(?:good|safe|smart|profitable|risky) (?:investment|bet|buy)\b/i.test(q) ||
        /\b(?:good|best|safe|safest|profitable|top) investments?\b/i.test(q) ||
        /\b(?:expected|guaranteed|annual|average|target|projected) (?:returns?|yields?|profits?|income)\b/i.test(q) ||
        /\b(?:returns?|yields?|profits?)\b[^.?!]{0,30}\bexpect\w*/i.test(q) || /\bexpect\w*\b[^.?!]{0,30}\b(?:returns?|yields?|profits?)\b/i.test(q) ||
        /\bhow much (?:will|can|could|would|do|does) (?:i|we|it|an investor) (?:earn|make|get|gain|profit|return|pay)\b/i.test(q) ||
        /\b(?:share|stock|unit|sukuk|bond|token) prices?\b|\bprice of (?:a |the )?(?:share|stock|unit|sukuk|bond|token|security)/i.test(q) ||
        /\b(?:recommend|recommendation|recommendations)\b/i.test(q) ||
        /\b(?:buy|sell|purchase) (?:shares|stocks|sukuk|units|bonds|tokens)\b/i.test(q) ||
        /\binvest (?:in|with|through) haykalah\b/i.test(q) || /\broi\b/i.test(q) ||
        /\bwhat (?:returns?|yields?|profits?) (?:will|would|can|could|do|does|should) (?:i|we|an investor) (?:get|make|earn|expect)\b/i.test(q) ||
        // Arabic parity (QA 2026-10-17): should / can I invest or buy, which … to buy, invest in it, the best sukuk, fund or
        // shares, the highest return, the return I will get, buying or selling sukuk, shares or units, investing with HAYKALAH
        /(?:(?:يجب|ينبغي|يمكنني|أستطيع|استطيع|علي|عليّ) (?:أن |ان )?(?:[أا]ستثمر|نستثمر|[أا]شتري|نشتري))|(?:[أا]ستثمر|نستثمر|[أا]شتري|نشتري) (?:فيها|فيه|بها|به|فيهم)|أيّ? (?:\S+ ){0,2}(?:[أا]ستثمر|نستثمر|[أا]شتري|نشتري)|أفضل (?:ال)?(?:صكوك|صك|أسهم|سهم|صناديق|صندوق|استثمارات)|أعلى (?:ال)?(?:عائد|عوائد|ربح|أرباح)|(?:ال)?(?:عوائد|أرباح) (?:ال)?متوقعة|العائد على الاستثمار|العائد الذي (?:س)?(?:[أا]حصل|نحصل|[أا]جني)|(?:س)?(?:[أا]حصل|[أا]ربح) على عائد|(?:[أا]شتري|شراء|بيع|[أا]بيع) (?:ال)?(?:صكوك|أسهم|وحدات|سندات)|(?:ال)?[اأ]ستثمار (?:مع|لدى|عبر) هيكلة|[أا]ستثمر (?:مع|لدى|عبر|في) هيكلة/.test(q) ||
        /(?:هل (?:أستثمر|استثمر|نستثمر|أشتري|اشتري)|أين أستثمر|اين استثمر|ماذا أشتري|العائد المتوقع|عائد مضمون|أرباح مضمونة|كم (?:سأربح|أربح|العائد|الربح|نسبة)|سعر (?:السهم|الصك|الصكوك|الوحدة)|توصية|توصيات|انصحني|أنصحني|بماذا تنصح|أفضل استثمار|استثمار (?:جيد|آمن|مربح)|أستثمر مع هيكلة)/.test(q);
      // هل أستثمر/أشتري، أين أستثمر، ماذا أشتري، العائد المتوقع، عائد مضمون، أرباح مضمونة، كم سأربح/العائد/الربح/نسبة،
      // سعر السهم/الصك/الصكوك/الوحدة، توصية، انصحني، بماذا تنصح، أفضل استثمار، استثمار جيد/آمن/مربح، أستثمر مع هيكلة
    }],
  ];
  function refusal(q) { for (var i = 0; i < REFUSE.length; i++) if (REFUSE[i][1](q)) return REFUSE[i][0]; return null; }

  /* ------------------------------------------------------------ Rendering */
  function link(href, label) { return el('a', { 'class': 'tlink', href: href }, [el('span', { text: label }), HK.arrow(16, 12)]); }
  function youAsked(q) {
    return el('p', { 'class': 'ask-you' }, [el('span', { 'class': 'ask-you-l', text: L.you }), el('span', { 'class': 'ask-you-q', dir: 'auto' }, [document.createTextNode(q)])]);
  }
  function clearBtn() {
    var b = el('button', { 'class': 'wclear ask-clear', type: 'button', text: L.clear });
    b.addEventListener('click', function () { input.value = ''; out.hidden = true; out.textContent = ''; input.focus(); });
    return el('p', { 'class': 'ask-again' }, [b]);
  }
  function announce(s) { if (!live) return; live.textContent = ''; window.setTimeout(function () { live.textContent = s; }, 120); }
  function show(nodes) {
    out.textContent = '';
    nodes.forEach(function (n) { if (n) out.appendChild(n); });
    out.hidden = false;
    out.classList.remove('is-in');
    void out.offsetWidth;
    out.classList.add('is-in');
    var r = out.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight * 0.75) out.scrollIntoView({ block: 'start', behavior: HK.reduce && HK.reduce.matches ? 'auto' : 'smooth' });
  }
  // the excerpt: about 320 characters around the first match, every matched word marked
  function excerpt(text, terms) {
    var set = {};
    terms.forEach(function (t) { set[t] = 1; });
    var re = /[\p{L}\p{N}’']+/gu, m, first = -1;
    while ((m = re.exec(text))) { var t = tokens(m[0])[0]; if (t && set[t]) { first = m.index; break; } }
    var start = 0, end = text.length, MAX = 320;
    if (text.length > MAX) {
      start = Math.max(0, first - 90);
      if (start > 0) { var sp = text.indexOf(' ', start); start = sp > 0 && sp < first ? sp + 1 : start; }
      end = Math.min(text.length, start + MAX);
      if (end < text.length) { var sp2 = text.lastIndexOf(' ', end); if (sp2 > start + 160) end = sp2; }
    }
    var p = el('p', { 'class': 'ask-x' });
    if (start > 0) p.appendChild(document.createTextNode('… '));
    var part = text.slice(start, end), last = 0;
    re.lastIndex = 0;
    while ((m = re.exec(part))) {
      var tk = tokens(m[0])[0];
      if (tk && set[tk]) {
        if (m.index > last) p.appendChild(document.createTextNode(part.slice(last, m.index)));
        p.appendChild(el('mark', null, [document.createTextNode(m[0])]));
        last = m.index + m[0].length;
      }
    }
    p.appendChild(document.createTextNode(part.slice(last)));
    if (end < text.length) p.appendChild(document.createTextNode(' …'));
    return p;
  }
  function cards(hits, prefix) {
    return el('ol', { 'class': 'ask-cards' }, hits.map(function (h, i) {
      var p = h.d.p, href = prefix + p.url;
      var title = p.page + (p.section && p.section !== p.page ? ' › ' + p.section : '');
      return el('li', { 'class': 'ask-card', id: 'ask-src-' + (i + 1) }, [
        el('span', { 'class': 'ask-n', 'aria-hidden': 'true', text: '[' + (i + 1) + ']' }),
        el('div', { 'class': 'ask-cb' }, [
          el('p', { 'class': 'ask-src' }, [el('a', { href: href, dir: 'auto' }, [el('span', { 'class': 'visually-hidden', text: '[' + (i + 1) + '] ' }), document.createTextNode(title)])]),
          excerpt(p.text, h.terms),
        ]),
      ]);
    }));
  }
  function message(kind, m, links) {
    return el('div', { 'class': 'ask-msg ask-msg-' + kind }, [
      el('p', { text: m }),
      el('p', { 'class': 'ask-msg-links' }, links.map(function (l) { return link(l.href, l.l); })),
    ]);
  }

  function showPassages(q, hits, other, fallback) {
    var nodes = [youAsked(q)];
    if (fallback) nodes.push(el('p', { 'class': 'ask-fallback' }, [el('strong', { text: L.unavailable }), document.createTextNode(' '), el('span', { text: L.fallback })]));
    nodes.push(el('h3', { 'class': 'ask-rh', id: 'ask-rh', text: L.heading }));
    if (other) nodes.push(el('p', { 'class': 'caption ask-other', text: L.other }));
    nodes.push(cards(hits, other ? C.other.prefix : ''));
    nodes.push(clearBtn());
    show(nodes);
    announce(HK.text(L.found).replace('{n}', hits.length) + ' ' + hits.map(function (h, i) { return '[' + (i + 1) + '] ' + h.d.p.page; }).join(', '));
  }
  function showRefusal(q, key) {
    var R = C.refusals[key];
    var links = [R.link];
    if (R.link.href !== C.handoff.href) links.push({ href: C.handoff.href, l: C.handoff.l });
    show([youAsked(q), el('h3', { 'class': 'ask-rh', text: L.refused }), message('refusal', R.m, links), clearBtn()]);
    announce(HK.text(R.m));
  }
  function showNoAnswer(q) {
    show([youAsked(q), message('none', C.noAnswer.m, C.noAnswer.links), clearBtn()]);
    announce(HK.text(C.noAnswer.m));
  }
  function showAnswer(q, j, hits, other) {
    var cited = (Array.isArray(j.sources) && j.sources.length ? j.sources : hits.slice(0, 3).map(function (h, i) { return i + 1; }))
      .map(function (n) { return hits[n - 1]; }).filter(Boolean);
    show([
      youAsked(q),
      el('h3', { 'class': 'ask-rh', text: L.answer }),
      el('p', { 'class': 'ask-answer', dir: 'auto' }, [document.createTextNode(String(j.answer))]),
      el('h3', { 'class': 'ask-rh', text: L.sources }),
      cards(cited, other ? C.other.prefix : ''),
      clearBtn(),
    ]);
    announce(String(j.answer).slice(0, 400));
  }

  /* ------------------------------------------------------------ AI mode: the Netlify Function (see the header) */
  function askAI(q, hits, lang) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = window.setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    return fetch(C.endpoint, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, lang: lang, passages: hits.map(function (h, i) { var p = h.d.p; return { n: i + 1, id: p.id, page: p.page, section: p.section, url: p.url, text: p.text }; }) }),
    }).then(function (r) {
      window.clearTimeout(timer);
      if (!r.ok) throw new Error('status ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || (typeof j.answer !== 'string' && !j.refusal && !j.noAnswer)) throw new Error('malformed');
      return j;
    });
  }

  /* ------------------------------------------------------------ Run a question */
  var busy = 0;
  function run(raw) {
    var q = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!q) return;
    var key = refusal(q);
    if (key) { showRefusal(q, key); return; }
    var arQ = (q.match(/[؀-ۿ]/g) || []).length, latQ = (q.match(/[A-Za-z]/g) || []).length;
    var lang = C.lang === 'en' ? (arQ > latQ ? 'ar' : 'en') : (arQ === 0 && latQ > 0 ? 'en' : 'ar');
    var other = lang !== C.lang;
    var qt = tokens(q);
    var ticket = ++busy;
    root.setAttribute('aria-busy', 'true');
    announce(HK.text(L.searching));
    loadIndex(lang).then(function (I) {
      if (ticket !== busy) return;
      var hits = qt.length ? search(I, qt) : [];
      if (!C.ai) {
        root.removeAttribute('aria-busy');
        if (!hits.length) showNoAnswer(q); else showPassages(q, hits.slice(0, 3), other, false);
        return;
      }
      askAI(q, hits, lang).then(function (j) {
        if (ticket !== busy) return;
        root.removeAttribute('aria-busy');
        if (j.refusal && C.refusals[j.refusal]) showRefusal(q, j.refusal);
        else if (j.noAnswer || !hits.length) showNoAnswer(q);
        else showAnswer(q, j, hits, other);
      }).catch(function () {
        if (ticket !== busy) return;
        root.removeAttribute('aria-busy');
        if (!hits.length) showNoAnswer(q); else showPassages(q, hits.slice(0, 3), other, true);
      });
    }).catch(function () {
      if (ticket !== busy) return;
      root.removeAttribute('aria-busy');
      show([youAsked(q), message('error', L.failed, [{ href: C.handoff.href, l: C.handoff.l }]), clearBtn()]);
      announce(HK.text(L.failed));
    });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); run(input.value); });
  input.addEventListener('focus', function () { loadIndex(C.lang).catch(function () {}); }, { once: true });
  Array.prototype.forEach.call(root.querySelectorAll('[data-q]'), function (b) {
    b.addEventListener('click', function () { input.value = b.getAttribute('data-q'); run(input.value); });
  });

  // A question that arrived in the URL (#q=… from the homepage, or an old ?q=…), already removed from the address bar
  if (typeof window.HK_ASK_Q === 'string' && window.HK_ASK_Q.trim()) {
    input.value = window.HK_ASK_Q.trim().slice(0, 300);
    run(input.value);
  }
})();
