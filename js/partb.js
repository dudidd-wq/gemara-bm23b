/* חלק ב: המשך הגמרא (כ"ג ע"ב – כ"ד ע"א). נתונים: data/part_b.json. לא משנה את חלק א. */
'use strict';
(function () {
  var h = U.h;
  var TABS = [
    { id: 'learn', ic: '📖', t: 'לוֹמְדִים' },
    { id: 'quiz', ic: '❓', t: 'שְׁאֵלוֹת' },
    { id: 'match', ic: '🔗', t: 'הַתְאָמָה' },
    { id: 'order', ic: '🔢', t: 'סֵדֶר' },
    { id: 'self', ic: '💬', t: 'הַסְבֵּר' }
  ];
  var TAG = { 'משנה': 'yellow', 'ברייתא': 'yellow', 'קושיא': 'red', 'שאלה': 'red', 'תירוץ': 'green', 'תשובה': 'green', 'בעיה': 'purple',
    'ראיה': 'blue', 'דיוק': 'blue', 'דחייה': 'orange', 'מסקנה': 'orange', 'הסבר': 'green', 'מעשה': 'purple' };
  var NQ = /[\u0591-\u05C7]/;
  // הקובץ נטען לפני app.js, לכן הכותרות נקבעות כאן ולא ב-APP.meta
  function setTitle(ic, t) { document.getElementById('pageTitle').textContent = ic + ' ' + t; document.title = t.replace(NQ_G, '') + ' · חלק ב'; }
  var NQ_G = /[\u0591-\u05C7]/g;

  var B = null, loading = null;
  function load() {
    if (B) return Promise.resolve(B);
    if (!loading) loading = Promise.all([
      fetch('data/part_b.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch('data/part_b_audio.json').then(function (r) { return r.ok ? r.json() : { clips: {} }; }).catch(function () { return { clips: {} }; })
    ]).then(function (x) { B = x[0]; B.audio = (x[1] && x[1].clips) || {}; return B; }).catch(function (e) { loading = null; throw e; });
    return loading;
  }
  function withData(root, fn) {
    if (B) return fn(B);
    var l = h('div', { class: 'card center muted' }, 'טוֹעֵן…'); root.appendChild(l);
    load().then(function (d) { if (!document.body.contains(l)) return; l.remove(); try { fn(d); } catch (e) { console.error(e); root.appendChild(h('div', { class: 'card' }, 'מַשֶּׁהוּ הִשְׁתַּבֵּשׁ. נַסֵּה לִטְעוֹן שׁוּב.')); } })
      .catch(function () { l.textContent = 'לֹא הִצְלַחְתִּי לִטְעוֹן אֶת חֵלֶק ב. בְּדֹק אֶת הַחִבּוּר לָאִינְטֶרְנֶט וְנַסֵּה שׁוּב.'; });
  }
  function params() { return (location.hash || '').replace(/^#\/?/, '').split('?')[0].split('/').slice(1); }
  function aid(uid, tab) { return 'b:' + uid + ':' + tab; }
  function st(id) { var a = U.state.activities[id]; return a ? a.stars : 0; }
  function unitStars(uid) { return TABS.reduce(function (s, t) { return s + st(aid(uid, t.id)); }, 0); }
  function unitDone(uid) { return TABS.every(function (t) { var a = U.state.activities[aid(uid, t.id)]; return a && a.done; }); }
  function totals(d) {
    var got = 0, max = d.units.length * TABS.length * 3, done = 0;
    d.units.forEach(function (u) { got += unitStars(u.id); if (unitDone(u.id)) done++; });
    return { got: got, max: max, done: done };
  }
  function nextStep(d, uid, tab) {
    var ti = TABS.findIndex(function (t) { return t.id === tab; });
    var ui = d.units.findIndex(function (u) { return u.id === uid; });
    for (var k = ti + 1; k < TABS.length; k++) if (!(U.state.activities[aid(uid, TABS[k].id)] || {}).done) return { href: '#/b/' + uid + '/' + TABS[k].id, t: TABS[k].ic + ' ' + TABS[k].t };
    if (ui < d.units.length - 1) { var nu = d.units[ui + 1]; return { href: '#/b/' + nu.id, t: nu.ic + ' ' + nu.title }; }
    return { href: '#/b', t: '📜 כׇּל הַיְּחִידוֹת' };
  }
  function doneCard(d, uid, tab, stars, msg, again) {
    U.confetti(18);
    var n = nextStep(d, uid, tab);
    return h('div', { class: 'card done-banner' }, h('div', { class: 'bigstars' }, U.starsEl(stars)),
      h('h2', null, U.praise()), msg ? h('p', null, msg) : null,
      again ? h('div', { class: 'btnrow' }, h('button', { class: 'btn sec', type: 'button', onclick: again }, '🔁 עוֹד פַּעַם')) : null,
      h('div', { class: 'btnrow' }, h('a', { class: 'btn green', href: n.href }, 'הַבָּא: ' + n.t + ' ←'), h('a', { class: 'btn sec', href: '#/b' }, '📜 לִרְשִׁימַת הַיְּחִידוֹת')));
  }
  function clip(d, cid) { var c = d.audio && d.audio[cid]; return c ? { file: c.file, start: 0, end: null } : null; }
  function tag(type) { return h('span', { class: 'tag ' + (TAG[type] || '') }, type); }

  // ================= רשימת היחידות =================
  function unitList(root, d) {
    var t = totals(d);
    root.appendChild(h('section', { class: 'card hero' }, h('div', { class: 'fishes', 'aria-hidden': 'true' }, '📜'),
      h('h2', null, d.title), h('p', { class: 'muted' }, d.subtitle),
      h('p', { class: 'small' }, 'הַגְּמָרָא מְמַשִּׁיכָה אַחֲרֵי "מִדָּה וּמִנְיָן נָמֵי הָוֵי סִימָן". לוֹמְדִים יְחִידָה אַחַר יְחִידָה – וְאוֹסְפִים כּוֹכָבִים!')));
    root.appendChild(h('h2', { class: 'h3' }, 'הַיְּחִידוֹת · ' + t.got + ' / ' + t.max + ' ⭐'));
    var list = h('nav', { class: 'card', 'aria-label': 'יחידות חלק ב' });
    d.units.forEach(function (u, i) {
      list.appendChild(h('a', { class: 'prow' + (unitDone(u.id) ? ' done' : ''), href: '#/b/' + u.id, id: 'unit-' + u.id },
        h('span', null, h('span', { 'aria-hidden': 'true' }, u.ic + ' '), (i + 1) + '. ' + u.title, h('br'), h('span', { class: 'small muted' }, 'דַּף ' + u.daf)),
        h('span', { class: 'small' }, U.starsEl(Math.round(unitStars(u.id) / TABS.length)))));
    });
    root.appendChild(list);
    root.appendChild(h('div', { class: 'btnrow' }, h('a', { class: 'btn', href: '#/b-words' }, '🃏 מִלִּים שֶׁל חֵלֶק ב'), h('a', { class: 'btn sec', href: '#/progress' }, '⭐ הַהִתְקַדְּמוּת שֶׁלִּי')));
    root.appendChild(h('details', { class: 'card' }, h('summary', null, 'ℹ️ מֵאַיִן הַטֶּקְסְט?'),
      h('p', { class: 'small' }, 'טֶקְסְט הַגְּמָרָא הַמְּנֻקָּד: ' + d.source.gemara_hebrew + ' (ספריא). הַהֶסְבֵּרִים לְפִי שְׁטַיְינְזָלְץ וְרַשִׁ"י. הַסּוּגְיָא מַמְשִׁיכָה בְּדַף כ"ד ע"ב.')));
  }

  // ================= עמוד יחידה =================
  function unitPage(root, d, uid, tab) {
    var u = d.units.filter(function (x) { return x.id === uid; })[0];
    if (!u) { location.hash = '#/b'; return; }
    tab = TABS.some(function (t) { return t.id === tab; }) ? tab : 'learn';
    var idx = d.units.indexOf(u);
    setTitle(u.ic, u.title);
    root.appendChild(h('p', { class: 'center muted small' }, 'יְחִידָה ' + (idx + 1) + ' מִתּוֹךְ ' + d.units.length + ' · דַּף ' + u.daf));
    var tabs = h('nav', { class: 'tabs', 'aria-label': 'חלקי היחידה' });
    TABS.forEach(function (t) {
      var a = U.state.activities[aid(uid, t.id)];
      tabs.appendChild(h('a', { class: 'btn sm ' + (t.id === tab ? 'cur' : 'sec'), href: '#/b/' + uid + '/' + t.id, 'aria-current': t.id === tab ? 'page' : null, id: 'tab-' + t.id },
        (a && a.done ? '✔️ ' : '') + t.ic + ' ' + t.t));
    });
    root.appendChild(tabs);
    var box = h('div'); root.appendChild(box);
    ({ learn: learnTab, quiz: quizTab, match: matchTab, order: orderTab, self: selfTab })[tab](box, d, u);
  }

  function learnTab(root, d, u) {
    var seen = {}, opened = {}, tappable = 0, recorded = false;
    var ci = clip(d, u.id + '_intro');
    var seq = [], seqLine = [];
    if (ci) { seq.push(ci); seqLine.push(-1); }
    u.lines.forEach(function (l, li) { [clip(d, u.id + '_g' + l.n), clip(d, u.id + '_e' + l.n)].forEach(function (c) { if (c) { seq.push(c); seqLine.push(li); } }); });
    var allBtn = null;
    if (seq.length) {
      allBtn = h('button', { class: 'btn green', type: 'button', id: 'playUnit', 'aria-pressed': 'false' }, '▶️ לְהַשְׁמִיעַ אֶת כׇּל הַיְּחִידָה');
      var follow = 0;
      allBtn.addEventListener('click', function () {
        U.play(seq, allBtn);
        clearInterval(follow);
        var last = -2;
        follow = setInterval(function () {
          var a = U._audio(), on = allBtn.classList.contains('on') && document.body.contains(allBtn);
          var li = -2;
          if (on && a && a.src) { var k = seq.map(function (c) { return new URL(c.file, document.baseURI).href; }).indexOf(a.src); if (k >= 0) li = seqLine[k]; }
          if (li !== last) {
            Array.prototype.forEach.call(wrap.querySelectorAll('.gline.playing'), function (x) { x.classList.remove('playing'); });
            if (li >= 0) { var g = wrap.children[li]; g.classList.add('playing'); g.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            last = li;
          }
          if (!on) { clearInterval(follow); allBtn.textContent = '▶️ לְהַשְׁמִיעַ אֶת כׇּל הַיְּחִידָה'; }
          else allBtn.textContent = '⏹️ לַעֲצֹר';
        }, 250);
      });
    }
    root.appendChild(h('div', { class: 'card mish' }, h('div', { class: 'row sp' }, h('p', null, u.intro), ci ? U.playBtn(ci, 'הַשְׁמָעַת הַפְּתִיחָה') : null),
      allBtn ? h('div', { class: 'btnrow' }, allBtn) : null,
      h('p', { class: 'small muted' }, '👆 הַקֵּשׁ עַל מִלָּה מְסֻמֶּנֶת כְּדֵי לִרְאוֹת אֶת הַתַּרְגּוּם. כַּפְתּוֹר ', h('b', null, 'פְּשָׁט'), ' מַסְבִּיר אֶת הַשּׁוּרָה.')));
    var wrap = h('div', { class: 'card notr', id: 'bLines' });
    var cb = h('input', { type: 'checkbox', id: 'bTr' });
    cb.addEventListener('change', function () { wrap.classList.toggle('notr', !cb.checked); });
    root.appendChild(h('label', { class: 'switch', for: 'bTr' }, cb, 'לְהַצִּיג תַּרְגּוּם מִתַּחַת לַמִּלִּים'));
    var info = h('p', { class: 'muted small', 'aria-live': 'polite' });
    u.lines.forEach(function (l, li) {
      var words = h('div', { class: 'words' }), say = h('div', { class: 'hint', hidden: true, 'aria-live': 'polite' });
      l.tokens.forEach(function (tok, ti) {
        if (tok.g) {
          tappable++;
          var b = h('button', { class: 'w', type: 'button' }, tok.t, h('small', null, tok.g));
          b.addEventListener('click', function () {
            seen[li + ':' + ti] = 1; b.classList.add('seen');
            say.hidden = false; say.innerHTML = '';
            say.appendChild(h('span', { class: 'nq' }, tok.t.replace(/[.,:;!?–]+$/, '')));
            say.appendChild(h('b', { class: 'tr' }, ' = ' + tok.g)); upd();
          });
          words.appendChild(b);
        } else words.appendChild(h('span', { class: 'w' }, tok.t, h('small', null, '\u00a0')));
      });
      var ps = h('div', { class: 'pshat', hidden: true }, tag(l.role), ' ', l.explanation);
      var pb = h('button', { class: 'btn sec sm pb', type: 'button', 'aria-expanded': 'false' }, '💬 פְּשָׁט');
      pb.addEventListener('click', function () { ps.hidden = !ps.hidden; pb.setAttribute('aria-expanded', String(!ps.hidden)); opened[li] = 1; upd(); });
      var cg = clip(d, u.id + '_g' + l.n), ce = clip(d, u.id + '_e' + l.n);
      if (ce) ps.appendChild(h('div', { class: 'row' }, U.playBtn(ce, 'הַשְׁמָעַת הַהֶסְבֵּר לְשׁוּרָה ' + l.n), h('span', { class: 'small muted' }, 'שְׁמַע אֶת הַהֶסְבֵּר')));
      wrap.appendChild(h('div', { class: 'gline' }, h('div', { class: 'row' }, h('span', { class: 'num' }, l.n + '.'), words), say,
        h('div', { class: 'row' }, pb, cg ? U.playBtn(cg, 'הַשְׁמָעַת שׁוּרָה ' + l.n) : null), ps));
    });
    root.appendChild(wrap); root.appendChild(info);
    // מהלך הסוגיא
    var fl = h('ol', { class: 'flowlist' });
    u.flow.forEach(function (f) { fl.appendChild(h('li', null, tag(f.type), ' ', f.text)); });
    root.appendChild(h('div', { class: 'card' }, h('h2', { class: 'h3' }, '➡️ מַהֲלַךְ הַסּוּגְיָא'), fl));
    if (u.rashi.length) {
      var rs = h('div', { class: 'card' }, h('h2', { class: 'h3' }, '📘 רַשִׁ"י עוֹזֵר לָנוּ'));
      u.rashi.forEach(function (r) {
        rs.appendChild(h('div', { class: 'gline' }, h('div', { class: 'nq' }, h('b', null, r.dibur + ' – '), r.text), h('div', { class: 'pshat' }, r.kid)));
      });
      root.appendChild(rs);
    }
    var fin = h('button', { class: 'btn big green', type: 'button', id: 'learnDone' }, 'לָמַדְתִּי אֶת הַיְּחִידָה! ⭐');
    var out = h('div');
    fin.addEventListener('click', function () {
      var r = (Object.keys(opened).length + Object.keys(seen).length) / (u.lines.length + tappable);
      var s = r >= 0.5 ? 3 : r >= 0.2 ? 2 : 1;
      U.record(aid(u.id, 'learn'), s); fin.hidden = true;
      out.appendChild(doneCard(d, u.id, 'learn', s, s < 3 ? 'רוֹצֶה עוֹד כּוֹכָב? פְּתַח עוֹד פְּשָׁטִים וְהַקֵּשׁ עַל עוֹד מִלִּים, וְלַחַץ שׁוּב.' : 'עָבַרְתָּ עַל כׇּל הַיְּחִידָה!'));
      setTimeout(function () { fin.hidden = false; }, 50);
      out.scrollIntoView({ behavior: 'smooth' });
    });
    function upd() {
      info.textContent = 'פָּתַחְתָּ ' + Object.keys(opened).length + ' מִתּוֹךְ ' + u.lines.length + ' פְּשָׁטִים · הִקַּשְׁתָּ עַל ' + Object.keys(seen).length + ' מִתּוֹךְ ' + tappable + ' מִלִּים';
    }
    root.appendChild(h('div', { class: 'btnrow' }, fin)); root.appendChild(out); upd();
  }

  function quizTab(root, d, u) {
    var qs = u.quiz.multiple_choice.map(function (q) { return { k: 'mc', q: q }; }).concat(u.quiz.true_false.map(function (q) { return { k: 'tf', q: q }; }));
    var i = 0, firstOk = 0, box = h('div'); root.appendChild(box);
    function show() {
      box.innerHTML = '';
      if (i >= qs.length) {
        var s = U.starsFromRatio(firstOk / qs.length);
        U.record(aid(u.id, 'quiz'), s, { score: firstOk + '/' + qs.length });
        box.appendChild(doneCard(d, u.id, 'quiz', s, 'עָנִיתָ נָכוֹן ' + firstOk + ' מִתּוֹךְ ' + qs.length + ' בַּפַּעַם הָרִאשׁוֹנָה.', function () { i = 0; firstOk = 0; show(); }));
        return;
      }
      var it = qs[i], q = it.q, wrong = 0, done = false;
      var fb = h('div', { class: 'feedback', 'aria-live': 'polite' }), extra = h('div'), opts = h('div', { class: 'opts' });
      var nx = h('button', { class: 'btn green', type: 'button', hidden: true, id: 'bqNext' }, i === qs.length - 1 ? 'לַתּוֹצָאָה ⭐' : 'הַבָּא ←');
      nx.addEventListener('click', function () { i++; show(); });
      function right(b, txt) { done = true; if (!wrong) firstOk++; b.classList.add('ok'); U.good(fb); extra.innerHTML = ''; if (txt) extra.appendChild(h('div', { class: 'pshat' }, txt)); nx.hidden = false; nx.focus(); }
      function bad(b) { wrong++; b.classList.add('no'); b.disabled = true; U.soft(fb); }
      var title;
      if (it.k === 'mc') {
        title = q.question;
        U.shuffle(q.options.map(function (o, k) { return k; })).forEach(function (k) {
          var b = h('button', { class: 'opt', type: 'button', 'data-correct': k === q.correct ? '1' : '0' }, q.options[k]);
          b.addEventListener('click', function () {
            if (done) return;
            if (k === q.correct) right(b, '📖 ' + q.explanation);
            else {
              bad(b);
              if (wrong === 2) {
                var rest = Array.prototype.filter.call(opts.children, function (x) { return x.dataset.correct === '0' && !x.disabled; });
                if (rest[0]) rest[0].classList.add('hide');
                extra.appendChild(h('div', { class: 'hint' }, '💡 רֶמֶז: נִשְׁאֲרוּ רַק שְׁתֵּי אֶפְשָׁרֻיּוֹת!'));
              }
            }
          });
          opts.appendChild(b);
        });
      } else {
        title = '✔️ / ✖️  ' + q.statement;
        [true, false].forEach(function (v) {
          var b = h('button', { class: 'opt center', type: 'button', 'data-correct': v === q.answer ? '1' : '0' }, v ? '✔️ נָכוֹן' : '✖️ לֹא נָכוֹן');
          b.addEventListener('click', function () { if (done) return; if (v === q.answer) right(b, (q.answer ? '✔️ נָכוֹן. ' : '✖️ לֹא נָכוֹן. ') + (q.explanation || '')); else bad(b); });
          opts.appendChild(b);
        });
      }
      box.appendChild(h('p', { class: 'center muted' }, 'שְׁאֵלָה ' + (i + 1) + ' מִתּוֹךְ ' + qs.length + ' · ⭐ ' + firstOk));
      box.appendChild(h('div', { class: 'card q' }, h('h2', { class: 'h3' }, title), opts, fb, extra, h('div', { class: 'btnrow' }, nx)));
    }
    show();
  }

  function matchTab(root, d, u) {
    var s = u.quiz.matching, box = h('div'); root.appendChild(box);
    function play() {
      box.innerHTML = '';
      var mistakes = 0, matched = 0, selR = null, selL = null;
      var colR = h('div', { class: 'col' }), colL = h('div', { class: 'col' }), fb = h('div', { class: 'feedback', 'aria-live': 'polite' }), out = h('div');
      function mk(text, side, idx) {
        var b = h('button', { class: 'mi' + (NQ.test(text) ? ' nqc' : ''), type: 'button', 'data-i': idx, 'data-side': side }, text);
        b.addEventListener('click', function () {
          if (b.classList.contains('ok')) return;
          if (side === 'r') { if (selR) selR.classList.remove('sel'); selR = selR === b ? null : b; } else { if (selL) selL.classList.remove('sel'); selL = selL === b ? null : b; }
          b.classList.toggle('sel', side === 'r' ? selR === b : selL === b);
          if (selR && selL) {
            if (selR.dataset.i === selL.dataset.i) {
              [selR, selL].forEach(function (x) { x.classList.add('ok'); x.classList.remove('sel'); x.disabled = true; });
              matched++; U.beep(true); fb.textContent = U.praise(); fb.className = 'feedback ok';
              if (matched === s.pairs.length) {
                var stars = mistakes === 0 ? 3 : mistakes <= Math.ceil(s.pairs.length / 3) ? 2 : 1;
                U.record(aid(u.id, 'match'), stars);
                out.appendChild(doneCard(d, u.id, 'match', stars, 'הִתְאַמְתָּ אֶת כׇּל ' + s.pairs.length + ' הַזּוּגוֹת!', play));
              }
            } else {
              mistakes++; [selR, selL].forEach(function (x) { x.classList.remove('sel'); x.classList.add('shake'); setTimeout(function () { x.classList.remove('shake'); }, 400); });
              U.soft(fb);
            }
            selR = selL = null;
          }
        });
        return b;
      }
      U.shuffle(s.pairs.map(function (p, k) { return k; })).forEach(function (k) { colR.appendChild(mk(s.pairs[k].left, 'r', k)); });
      U.shuffle(s.pairs.map(function (p, k) { return k; })).forEach(function (k) { colL.appendChild(mk(s.pairs[k].right, 'l', k)); });
      box.appendChild(h('div', { class: 'card q' }, h('h2', { class: 'h3' }, '🔗 ' + s.title), h('p', { class: 'small muted' }, 'הַקֵּשׁ עַל מִלָּה מִיָּמִין וְעַל הַפֵּרוּשׁ שֶׁלָּהּ מִשְּׂמֹאל.'),
        h('div', { class: 'match' }, colR, colL), fb));
      box.appendChild(out);
    }
    play();
  }

  function orderTab(root, d, u) {
    var o = u.quiz.order_the_steps, correct = o.correct_order, checks = 0;
    var ul = h('ol', { class: 'order', 'aria-label': 'שלבי הסוגיא' });
    var idxs = correct.map(function (x, k) { return k; }), sh;
    do { sh = U.shuffle(idxs); } while (sh.every(function (v, k) { return v === k; }));
    function clearMarks() { Array.prototype.forEach.call(ul.children, function (x) { x.classList.remove('ok', 'almost'); }); }
    function li(k) {
      var up = h('button', { type: 'button', 'aria-label': 'להזיז למעלה' }, '▲'), dn = h('button', { type: 'button', 'aria-label': 'להזיז למטה' }, '▼');
      var handle = h('span', { class: 'handle', 'aria-hidden': 'true' }, '☰');
      var el = h('li', { 'data-k': k }, handle, h('span', { class: 'txt' }, correct[k]), h('span', { class: 'mv' }, up, dn));
      up.addEventListener('click', function () { var p = el.previousElementSibling; if (p) ul.insertBefore(el, p); clearMarks(); });
      dn.addEventListener('click', function () { var n = el.nextElementSibling; if (n) ul.insertBefore(n, el); clearMarks(); });
      var pid = null;
      handle.addEventListener('pointerdown', function (e) { pid = e.pointerId; try { handle.setPointerCapture(pid); } catch (x) {} el.classList.add('drag'); clearMarks(); e.preventDefault(); });
      handle.addEventListener('pointermove', function (e) {
        if (pid !== e.pointerId) return;
        var y = e.clientY, sibs = Array.prototype.filter.call(ul.children, function (x) { return x !== el; }), before = null;
        for (var q = 0; q < sibs.length; q++) { var r = sibs[q].getBoundingClientRect(); if (y < r.top + r.height / 2) { before = sibs[q]; break; } }
        if (before) { if (el.nextElementSibling !== before) ul.insertBefore(el, before); } else if (ul.lastElementChild !== el) ul.appendChild(el);
        if (y < 70) window.scrollBy(0, -12); else if (y > window.innerHeight - 70) window.scrollBy(0, 12);
      });
      var end = function (e) { if (pid !== e.pointerId) return; pid = null; el.classList.remove('drag'); };
      handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
      return el;
    }
    sh.forEach(function (k) { ul.appendChild(li(k)); });
    var fb = h('div', { class: 'feedback', 'aria-live': 'polite' }), hint = h('div'), out = h('div');
    var chk = h('button', { class: 'btn', type: 'button', id: 'bOrderCheck' }, 'בְּדֹק אֶת הַסֵּדֶר ✓');
    chk.addEventListener('click', function () {
      checks++; var right = 0;
      Array.prototype.forEach.call(ul.children, function (x, pos) { var ok = +x.dataset.k === pos; x.classList.toggle('ok', ok); x.classList.toggle('almost', !ok); if (ok) right++; });
      if (right === correct.length) {
        U.good(fb); chk.disabled = true;
        var s = checks === 1 ? 3 : checks === 2 ? 2 : 1;
        U.record(aid(u.id, 'order'), s); out.appendChild(doneCard(d, u.id, 'order', s, 'סִדַּרְתָּ אֶת כׇּל הַסּוּגְיָא!'));
      } else {
        U.soft(fb); fb.textContent += ' (' + right + '/' + correct.length + ' בַּמָּקוֹם)';
        if (checks >= 2 && !hint.firstChild) hint.appendChild(h('div', { class: 'hint' }, '💡 רֶמֶז: הַשָּׁלָב הָרִאשׁוֹן הוּא: ' + correct[0]));
      }
    });
    root.appendChild(h('div', { class: 'card q' }, h('h2', { class: 'h3' }, o.instruction), h('p', { class: 'small muted' }, '☰ גְּרֹר מֵהַיָּדִית, אוֹ הַשְׁתַּמֵּשׁ בַּחִצִּים ▲▼.'), ul,
      h('div', { class: 'btnrow' }, chk), fb, hint));
    root.appendChild(out);
  }

  function selfTab(root, d, u) {
    var q = u.quiz.self_check[0], out = h('div');
    var ta = h('textarea', { 'aria-label': 'התשובה שלי', placeholder: 'כְּתֹב כָּאן – אוֹ אֱמֹר בְּקוֹל 💬' });
    var area = h('div'), go = h('button', { class: 'btn', type: 'button', id: 'bSelfGo' }, 'סִיַּמְתִּי – בּוֹא נִבְדֹּק ✓');
    go.addEventListener('click', function () {
      go.remove();
      area.appendChild(h('p', { class: 'small' }, 'סַמֵּן ✓ עַל כׇּל נְקֻדָּה שֶׁאָמַרְתָּ אוֹ כָּתַבְתָּ:'));
      var boxes = q.key_points.map(function (kp, k) {
        var cb = h('input', { type: 'checkbox', id: 'bkp' + k });
        cb.addEventListener('change', function () { if (cb.checked) U.beep(true); if (out.firstChild) rec(); });
        area.appendChild(h('label', { class: 'kp', for: 'bkp' + k }, cb, kp));
        return cb;
      });
      function rec() { var got = boxes.filter(function (x) { return x.checked; }).length; var s = U.starsFromRatio(got / boxes.length); U.record(aid(u.id, 'self'), s); return { s: s, got: got }; }
      var sm = h('button', { class: 'btn sec sm', type: 'button', id: 'bSelfModel' }, '👀 הַרְאֵה תְּשׁוּבָה לְדֻגְמָה');
      sm.addEventListener('click', function () {
        sm.remove(); area.appendChild(h('div', { class: 'model' }, '✍️ ' + q.model_answer));
        var r = rec();
        out.appendChild(doneCard(d, u.id, 'self', r.s, 'אָמַרְתָּ ' + r.got + ' מִתּוֹךְ ' + boxes.length + ' נְקֻדּוֹת. כׇּל הַכָּבוֹד שֶׁהִסְבַּרְתָּ בְּעַצְמְךָ!'));
      });
      area.appendChild(h('div', { class: 'btnrow' }, sm));
    });
    root.appendChild(h('div', { class: 'card q' }, h('h2', { class: 'h3' }, q.prompt), ta, h('div', { class: 'btnrow' }, go), area));
    root.appendChild(out);
  }

  // ================= כרטיסיות מילים לחלק ב =================
  function words(root, d) {
    var deck = U.shuffle(d.glossary), i = 0, knew = 0;
    U.state.flashB = U.state.flashB || {};
    var box = h('div'); root.appendChild(box);
    root.appendChild(h('p', { class: 'small muted center' }, 'הַנִּקּוּד שֶׁל הַמִּלִּים לָקוּחַ מִטֶּקְסְט הַגְּמָרָא.'));
    function show() {
      box.innerHTML = '';
      if (i >= deck.length) {
        var s = U.starsFromRatio(knew / deck.length);
        U.record('b:words', s, { score: knew + '/' + deck.length });
        U.confetti(18);
        box.appendChild(h('div', { class: 'card done-banner' }, h('div', { class: 'bigstars' }, U.starsEl(s)), h('h2', null, U.praise()),
          h('p', null, 'יָדַעְתָּ ' + knew + ' מִתּוֹךְ ' + deck.length + ' מִלִּים.'),
          h('div', { class: 'btnrow' }, h('button', { class: 'btn sec', type: 'button', onclick: function () { deck = U.shuffle(d.glossary); i = 0; knew = 0; show(); } }, '🔁 עוֹד פַּעַם'),
            h('a', { class: 'btn green', href: '#/b' }, '📜 לִרְשִׁימַת הַיְּחִידוֹת'))));
        return;
      }
      var g = deck[i], back = h('div', { hidden: true },
        h('p', { class: 'nq tr', style: 'font-size:26px' }, '= ' + g.meaning), g.tip ? h('p', { class: 'small' }, '💡 ' + g.tip) : null,
        h('div', { class: 'btnrow' },
          h('button', { class: 'btn green', type: 'button', id: 'bwKnew', onclick: function () { knew++; U.state.flashB[g.aramaic] = 2; U.save(); U.beep(true); i++; show(); } }, '✔️ יָדַעְתִּי'),
          h('button', { class: 'btn sec', type: 'button', id: 'bwNot', onclick: function () { U.state.flashB[g.aramaic] = 1; U.save(); i++; show(); } }, '🔁 עוֹד לֹא')));
      var flip = h('button', { class: 'btn', type: 'button', id: 'bwFlip' }, '🔄 הַפֹךְ');
      flip.addEventListener('click', function () { back.hidden = false; flip.remove(); });
      box.appendChild(h('p', { class: 'center muted' }, (i + 1) + ' / ' + deck.length + ' · ⭐ ' + knew));
      box.appendChild(h('div', { class: 'card center' }, h('div', { class: 'ar big' }, g.niqqud), h('p', { class: 'small muted' }, 'מִתּוֹךְ יְחִידָה ' + g.unit.slice(1) + ', שׁוּרָה ' + g.line),
        h('div', { class: 'btnrow' }, flip), back));
    }
    show();
  }

  PAGES.b = function (root) {
    var p = params();
    setTitle('📜', 'חֵלֶק ב: הֶמְשֵׁךְ הַגְּמָרָא');
    withData(root, function (d) { if (p[0]) unitPage(root, d, p[0], p[1]); else unitList(root, d); });
  };
  PAGES['b-words'] = function (root) { setTitle('🃏', 'מִלִּים – חֵלֶק ב'); withData(root, function (d) { words(root, d); }); };

  // ================= בית: חלק א + חלק ב =================
  var homeA = PAGES.home;
  PAGES.home = function (root, d) {
    root.appendChild(h('h2', { class: 'parthead', id: 'partA' }, '🐟 חֵלֶק א: מַחֲרוֹזוֹת שֶׁל דָּגִים (לַמִּבְחָן)'));
    homeA(root, d);
    var sec = h('section', { class: 'card partb', id: 'partB', 'aria-labelledby': 'partBh' },
      h('h2', { id: 'partBh', class: 'parthead' }, '📜 חֵלֶק ב: הֶמְשֵׁךְ הַגְּמָרָא (דַּף כ"ד ע"א)'),
      h('p', { class: 'muted small' }, 'סוֹף דַּף כ"ג ע"ב וְכׇל דַּף כ"ד ע"א – 10 יְחִידוֹת קְצָרוֹת.'));
    var slot = h('div'); sec.appendChild(slot);
    sec.appendChild(h('div', { class: 'btnrow' }, h('a', { class: 'btn big', href: '#/b', id: 'goPartB' }, 'לְחֵלֶק ב ←')));
    root.appendChild(sec);
    load().then(function (bd) {
      var t = totals(bd);
      slot.appendChild(h('p', null, '⭐ ' + t.got + ' / ' + t.max + ' · סִיַּמְתָּ ' + t.done + ' מִתּוֹךְ ' + bd.units.length + ' יְחִידוֹת'));
    }).catch(function () {});
  };

  // ================= התקדמות: הוספת חלק ב =================
  var progA = PAGES.progress;
  PAGES.progress = function (root, d) {
    progA(root, d);
    var sec = h('section', { class: 'card', id: 'progB' }, h('h2', { class: 'h3' }, '📜 חֵלֶק ב: הֶמְשֵׁךְ הַגְּמָרָא'));
    var reset = root.querySelector('#resetBtn'); var anchor = reset ? reset.parentNode : null;
    root.insertBefore(h('h2', { class: 'parthead' }, '🐟 חֵלֶק א: מַחֲרוֹזוֹת שֶׁל דָּגִים'), root.firstChild);
    if (anchor) root.insertBefore(sec, anchor); else root.appendChild(sec);
    load().then(function (bd) {
      var t = totals(bd);
      sec.appendChild(h('p', { class: 'center' }, h('b', null, t.got + ' ⭐'), ' מִתּוֹךְ ' + t.max + ' · סִיַּמְתָּ ' + t.done + ' מִתּוֹךְ ' + bd.units.length + ' יְחִידוֹת'));
      bd.units.forEach(function (u) {
        var row = h('a', { class: 'prow', href: '#/b/' + u.id },
          h('span', null, u.ic + ' ' + u.title),
          h('span', { class: 'small' }, TABS.filter(function (tb) { var a = U.state.activities[aid(u.id, tb.id)]; return a && a.done; }).length + '/' + TABS.length + ' ✔️ ', U.starsEl(Math.round(unitStars(u.id) / TABS.length))));
        sec.appendChild(row);
      });
      var w = U.state.activities['b:words'];
      sec.appendChild(h('a', { class: 'prow', href: '#/b-words' }, h('span', null, '🃏 מִלִּים – חֵלֶק ב'), w && w.done ? U.starsEl(w.stars) : h('span', { class: 'muted small' }, 'עוֹד לֹא')));
    }).catch(function () { sec.appendChild(h('p', { class: 'muted' }, 'לֹא הִצְלַחְתִּי לִטְעוֹן אֶת חֵלֶק ב.')); });
  };
})();
