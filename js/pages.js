/* עמודים: בית, לימוד צעד-צעד, גמרא אינטראקטיבית, כרטיסיות, סרטון, מפתח תשובות, התקדמות */
'use strict';
var PAGES = {};
(function () {
  var h = U.h;
  var NQ = /[\u05B0-\u05C7]/;
  function seg(d, id) { var s = d.audio.segments[id]; return s ? { file: s.file, start: 0, end: null } : null; }
  function stars(id) { var a = U.state.activities[id]; return a ? a.stars : 0; }
  // רק מעלה כוכבים (לא סופר ניסיון חדש בכל הקשה)
  function bump(id, st) { if (st > stars(id)) { U.record(id, st); return true; } return false; }
  PAGES._helpers = { seg: seg, bump: bump, NQ: NQ };

  // ================= בית =================
  PAGES.home = function (root, d) {
    var n2 = d.video.narration.filter(function (x) { return x.id === 'h2' || x.id === 'h3'; });
    var acts = d.progress.activities;
    var total = acts.reduce(function (s, id) { return s + stars(id); }, 0);
    var nextId = APP.next('video');
    root.appendChild(h('section', { class: 'card hero' },
      h('div', { class: 'fishes', 'aria-hidden': 'true' }, '🐟🐠🐟'),
      h('h2', null, d.meta.title),
      h('p', { class: 'muted' }, d.meta.masechet + ' · ' + d.meta.perek)));
    root.appendChild(h('section', { class: 'card mish' },
      h('div', { class: 'row sp' }, h('h2', { class: 'h3' }, 'הַסִּפּוּר שֶׁל מְנַחֵם'),
        U.playBtn(n2.map(function (x) { return { file: x.audio_file, start: 0, end: null }; }), 'הַשְׁמָעַת הַסִּפּוּר')),
      n2.map(function (x) { return h('p', { class: 'story' }, x.text); })));
    root.appendChild(h('a', { class: 'btn big yellow', href: '#/' + (total ? nextId : 'learn') }, total ? 'מַמְשִׁיכִים ←' : 'בּוֹא נַתְחִיל! ←'));
    root.appendChild(h('h2', { class: 'h3', style: 'margin-top:18px' }, 'מַפַּת הַהִתְקַדְּמוּת · ' + total + ' / ' + acts.length * d.progress.stars_per_activity + ' ⭐'));
    var g = h('nav', { class: 'grid', 'aria-label': 'פעילויות' });
    acts.concat(['answers', 'progress']).forEach(function (id) {
      var m = APP.meta[id], a = U.state.activities[id];
      g.appendChild(h('a', { class: 'tile' + (a && a.done ? ' done' : ''), href: '#/' + id },
        h('span', { class: 'ic', 'aria-hidden': 'true' }, m.ic), h('span', null, m.t),
        acts.indexOf(id) >= 0 ? U.starsEl(a ? a.stars : 0) : null));
    });
    root.appendChild(g);
  };

  // ================= לומדים צעד אחר צעד =================
  var LEARN_ROLES = [null, ['קושיא 1'], ['תירוץ 1'], ['קושיא 2'], ['תירוץ 2'], ['בעיה'], ['ראיה'], ['מסקנה']];
  var LEARN_SEG = ['m1', 'g1', 'g2', 'g3', 'g4', 'r1', 'r2', 'r3'];
  var LEARN_MC = ['mc1', 'mc2', 'mc3', 'mc4', 'mc5', 'mc6', 'mc9', 'mc10'];
  var LEARN_IC = ['🐟🐟🐟', '🪢❓', '🎣🪢', '🔢❓', '🎣🔢', '❓', '⚖️🥈', '⚖️📏🔢✔️'];
  var LEARN_RASHI = [[], [], [], [], [0], [], [1, 2], []];
  var TYPE_TAG = { 'משנה': 'yellow', 'קושיא': 'red', 'תירוץ': 'green', 'בעיה': 'purple', 'ראיה': 'blue', 'מסקנה': 'orange' };
  PAGES.learn = function (root, d) {
    var flow = d.texts.flow, idx = 0, firstTry = {}, answered = {};
    var box = h('div');
    root.appendChild(box);
    function dots() {
      var s = h('div', { class: 'steps', role: 'img', 'aria-label': 'שלב ' + (idx + 1) + ' מתוך ' + (flow.length + 1) });
      for (var i = 0; i <= flow.length; i++) s.appendChild(h('i', { class: i === idx ? 'cur' : (i < idx ? 'ok' : '') }));
      return s;
    }
    function lineBlock(l) {
      return h('div', { class: 'gline' },
        h('div', { class: 'row' }, h('span', { class: 'ar' }, l.niqqud), l.audio ? U.playBtn(l.audio, 'הַשְׁמָעַת הַשּׁוּרָה') : null),
        h('div', { class: 'pshat' }, l.explanation));
    }
    function question(step, onOk) {
      var q = d.quiz.multiple_choice.filter(function (x) { return x.id === LEARN_MC[step]; })[0];
      if (!q) { onOk(); return null; }
      var fb = h('div', { class: 'feedback', 'aria-live': 'polite' }), hint = h('div');
      var wrong = 0, opts = h('div', { class: 'opts' });
      var order = U.shuffle(q.options.map(function (o, i) { return i; }));
      if (answered[step]) { onOk(); }
      order.forEach(function (i) {
        var b = h('button', { class: 'opt' + (answered[step] && i === q.correct ? ' ok' : ''), type: 'button' }, q.options[i]);
        b.addEventListener('click', function () {
          if (answered[step]) return;
          if (i === q.correct) {
            answered[step] = true; if (firstTry[step] == null) firstTry[step] = wrong === 0;
            b.classList.add('ok'); U.good(fb); hint.innerHTML = ''; hint.appendChild(h('div', { class: 'pshat' }, q.explanation)); onOk();
          } else {
            wrong++; b.classList.add('no'); b.disabled = true; U.soft(fb);
            if (wrong === 2) {
              var rest = Array.prototype.filter.call(opts.children, function (x, k) { return order[k] !== q.correct && !x.disabled; });
              if (rest[0]) rest[0].classList.add('hide');
              hint.appendChild(h('div', { class: 'hint' }, '💡 רֶמֶז: קְרָא שׁוּב אֶת הַפְּשָׁט שֶׁלְּמַעְלָה.'));
            }
          }
        });
        opts.appendChild(b);
      });
      return h('div', { class: 'card q' }, h('h2', { class: 'h3' }, '❓ ' + q.question), opts, fb, hint);
    }
    function nav(canNext) {
      var prev = h('button', { class: 'btn sec', type: 'button', disabled: idx === 0 }, '→ הַקּוֹדֵם');
      prev.addEventListener('click', function () { idx--; draw(); });
      var last = idx === flow.length;
      var nx = h('button', { class: 'btn green', type: 'button', disabled: !canNext, id: 'learnNext' }, last ? 'סִיַּמְתִּי! ⭐' : 'הַבָּא ←');
      nx.addEventListener('click', function () {
        if (last) { finish(); return; }
        idx++; draw();
      });
      return { el: h('div', { class: 'btnrow' }, prev, nx), next: nx };
    }
    function finish() {
      var n = 0, ok = 0; for (var k in firstTry) { n++; if (firstTry[k]) ok++; }
      var st = U.starsFromRatio(n ? ok / n : 1);
      U.record('learn', st); U.confetti(18);
      box.innerHTML = '';
      box.appendChild(h('div', { class: 'card done-banner' }, h('div', { class: 'bigstars' }, U.starsEl(st)),
        h('h2', null, U.praise()), h('p', null, 'לָמַדְתָּ אֶת כׇּל הַסּוּגְיָא, צַעַד אַחַר צַעַד!'), APP.finishBar('learn')));
    }
    function draw() {
      U.stop(); box.innerHTML = ''; box.appendChild(dots());
      if (idx === 0) {
        var s1 = d.video.narration.filter(function (x) { return x.id === 's1'; })[0];
        box.appendChild(h('div', { class: 'card mish' },
          h('div', { class: 'row sp' }, h('span', { class: 'tag' }, 'כְּלָל חָשׁוּב'), U.playBtn(seg(d, 's1'), 'הַשְׁמָעַת הַכְּלָל')),
          h('p', { class: 'nq' }, s1.text),
          h('div', { class: 'rule' },
            h('div', { class: 'lane' }, '✔️ יֵשׁ סִימָן', ' ← ', '📢 מַכְרִיזִים', ' ← ', '↩️ מַחֲזִירִים'),
            h('div', { class: 'lane' }, '✖️ אֵין סִימָן', ' ← ', '🏳️ הַבְּעָלִים מִתְיָאֵשׁ', ' ← ', '🏠 שֶׁל הַמּוֹצֵא')),
          h('details', null, h('summary', null, '📚 מוּשָׂגִים חֲשׁוּבִים'),
            d.texts.concepts.map(function (c) { return h('p', null, h('b', { class: 'nq' }, c.term + ': '), c.kid); }))));
        box.appendChild(nav(true).el);
        return;
      }
      var step = idx - 1, f = flow[step];
      var card = h('div', { class: 'card' });
      card.appendChild(h('div', { class: 'row sp' },
        h('span', { class: 'tag ' + (TYPE_TAG[f.type] || '') }, f.step + '. ' + f.type),
        U.playBtn(seg(d, LEARN_SEG[step]), 'הַשְׁמָעַת הַהֶסְבֵּר')));
      card.appendChild(h('div', { class: 'icon-big', 'aria-hidden': 'true' }, LEARN_IC[step]));
      if (step === 0) {
        var m = d.texts.mishna;
        card.appendChild(h('div', { class: 'card mish' }, h('div', { class: 'muted' }, 'בַּמִּשְׁנָה:'),
          h('div', { class: 'row' }, h('span', { class: 'ar' }, m.focus_niqqud), U.playBtn(m.audio, 'הַשְׁמָעַת הַמִּשְׁנָה')),
          h('div', { class: 'pshat' }, m.focus_explanation),
          h('details', null, h('summary', null, '📜 כׇּל הַמִּשְׁנָה'), h('p', { class: 'nq' }, m.full_niqqud)),
          h('details', null, h('summary', null, 'רַשִׁ"י וְשְׁטֵיינְזַלְץ'), h('p', null, h('b', null, 'רש"י: '), m.rashi), h('p', null, h('b', null, 'שטיינזלץ: '), m.steinsaltz))));
        card.appendChild(h('div', { class: 'muted' }, 'בַּגְּמָרָא:'));
        card.appendChild(lineBlock(d.texts.gemara_lines[0]));
      } else {
        d.texts.gemara_lines.filter(function (l) { return LEARN_ROLES[step].indexOf(l.role) >= 0; }).forEach(function (l) { card.appendChild(lineBlock(l)); });
      }
      LEARN_RASHI[step].forEach(function (ri) {
        var r = d.texts.rashi[ri];
        card.appendChild(h('details', null, h('summary', null, 'רַשִׁ"י: ' + r.dibur), h('p', null, r.text), h('p', { class: 'tr' }, r.kid)));
      });
      box.appendChild(card);
      var n = nav(!!answered[step]);
      var qc = question(step, function () { n.next.disabled = false; });
      if (qc) box.appendChild(qc);
      box.appendChild(n.el);
    }
    draw();
  };

  // ================= גמרא אינטראקטיבית =================
  function glossFor(d, tok) {
    var s = U.strip(tok);
    var hit = null;
    d.glossary.forEach(function (g) {
      var a = U.strip(g.aramaic);
      if (!hit && (s === a || s === 'ו' + a || (a.indexOf(' ') > 0 && a.split(' ')[0] === s))) hit = g;
    });
    return hit;
  }
  PAGES.text = function (root, d) {
    var lines = d.texts.gemara_lines, opened = {}, seen = {}, tappable = 0;
    var wrap = h('div', { class: 'card' });
    var cb = h('input', { type: 'checkbox', id: 'trSwitch', checked: true });
    cb.addEventListener('change', function () { wrap.classList.toggle('notr', !cb.checked); });
    var info = h('p', { class: 'muted', 'aria-live': 'polite' });
    root.appendChild(h('div', { class: 'card mish' },
      h('p', null, '👆 הַקֵּשׁ עַל מִלָּה כְּדֵי לִרְאוֹת מָה הִיא אוֹמֶרֶת. כַּפְתּוֹר ', h('b', null, 'פְּשָׁט'), ' מַסְבִּיר אֶת כׇּל הַשּׁוּרָה.'),
      h('label', { class: 'switch', for: 'trSwitch' }, cb, 'לְהַצִּיג תַּרְגּוּם מִתַּחַת לַמִּלִּים'),
      h('details', null, h('summary', null, 'ℹ️ הֶעָרַת נֻסָּח'), h('p', { class: 'small' }, d.texts.gemara_text_note)), info));
    var pop = null;
    function closePop() { if (pop) { pop.remove(); pop = null; } }
    function showPop(tok, line) {
      closePop();
      var g = glossFor(d, tok.t);
      var clips = g && g.audio ? g.audio : line.audio;
      pop = h('div', { class: 'pop', role: 'dialog', 'aria-label': 'תרגום מילה' },
        h('div', { class: 'row sp' }, h('span', { class: 'ar' }, tok.t.replace(/[.,:!?–]+$/, '')),
          h('button', { class: 'play', type: 'button', 'aria-label': 'סְגִירָה', onclick: closePop }, '✖')),
        h('p', { class: 'nq tr', style: 'font-size:24px' }, '= ' + tok.g),
        g && g.tip ? h('p', { class: 'small' }, '💡 ' + g.tip) : null,
        h('div', { class: 'row' }, clips ? U.playBtn(clips, g && g.audio ? 'הַשְׁמָעַת הַמִּלָּה' : 'הַשְׁמָעַת הַשּׁוּרָה') : null,
          clips ? h('span', { class: 'muted' }, g && g.audio ? 'שְׁמַע אֶת הַמִּלָּה' : 'שְׁמַע אֶת הַשּׁוּרָה') : null,
          g && g.meaning_audio ? U.playBtn(g.meaning_audio, 'הַשְׁמָעַת הַפֵּרוּשׁ') : null));
      document.body.appendChild(pop);
    }
    function upd() {
      var o = Object.keys(opened).length, s = Object.keys(seen).length;
      info.textContent = 'פָּתַחְתָּ ' + o + ' מִתּוֹךְ ' + lines.length + ' פְּשָׁטִים · הִקַּשְׁתָּ עַל ' + s + ' מִתּוֹךְ ' + tappable + ' מִלִּים';
      var r = (o + s) / (lines.length + tappable);
      if (r >= 0.4) bump('text', U.starsFromRatio(r));
    }
    lines.forEach(function (l, li) {
      var words = h('div', { class: 'words' });
      l.tokens.forEach(function (tok, ti) {
        if (tok.g) {
          tappable++;
          var b = h('button', { class: 'w', type: 'button' }, tok.t, h('small', null, tok.g));
          b.addEventListener('click', function (e) { e.stopPropagation(); seen[li + ':' + ti] = 1; b.classList.add('seen'); showPop(tok, l); upd(); });
          words.appendChild(b);
        } else words.appendChild(h('span', { class: 'w' }, tok.t, h('small', null, '\u00a0')));
      });
      var ps = h('div', { class: 'pshat', hidden: true }, h('span', { class: 'tag' + ' ' + (TYPE_TAG[l.role.split(' ')[0]] || '') }, l.role), ' ', l.explanation);
      var pb = h('button', { class: 'btn sec sm', type: 'button', 'aria-expanded': 'false' }, '💬 פְּשָׁט');
      pb.addEventListener('click', function () { ps.hidden = !ps.hidden; pb.setAttribute('aria-expanded', String(!ps.hidden)); opened[li] = 1; upd(); });
      wrap.appendChild(h('div', { class: 'gline' }, h('div', { class: 'row' }, h('span', { class: 'num' }, l.n + '.'), words),
        h('div', { class: 'row' }, pb, l.audio ? U.playBtn(l.audio, 'הַשְׁמָעַת שׁוּרָה ' + l.n) : null), ps));
    });
    root.appendChild(wrap);
    root.appendChild(APP.finishBar('text'));
    document.addEventListener('click', function onDoc(e) {
      if (!document.body.contains(wrap)) { document.removeEventListener('click', onDoc); closePop(); return; }
      if (pop && !pop.contains(e.target)) closePop();
    });
    window.addEventListener('hashchange', closePop, { once: true });
    upd();
  };

  // ================= כרטיסיות (חזרה מרווחת פשוטה) =================
  PAGES.flashcards = function (root, d) {
    var fs = U.state.flash;
    var box = h('div');
    function pick(onlyWs) {
      var deck = d.glossary.filter(function (g) { return !onlyWs || g.on_worksheet; });
      // קודם מה שעוד לא יודעים (קופסה נמוכה), בתוך כל קופסה – מעורבב
      deck = U.shuffle(deck).sort(function (a, b) { return ((fs[a.aramaic] || {}).box || 0) - ((fs[b.aramaic] || {}).box || 0); });
      run(deck);
    }
    function chooser() {
      box.innerHTML = '';
      var known = d.glossary.filter(function (g) { return (fs[g.aramaic] || {}).box >= 2; }).length;
      box.appendChild(h('div', { class: 'card center' },
        h('div', { class: 'icon-big', 'aria-hidden': 'true' }, '🃏'),
        h('p', null, 'רוֹאִים מִלָּה בַּאֲרָמִית, חוֹשְׁבִים מָה הַפֵּרוּשׁ, וּמַקִּישִׁים כְּדֵי לַהֲפֹךְ. מִלָּה שֶׁעוֹד לֹא יָדַעְתָּ – תַּחְזֹר שׁוּב.'),
        h('p', { class: 'muted' }, 'מִלִּים שֶׁכְּבָר יוֹדְעִים טוֹב: ' + known + ' / ' + d.glossary.length),
        h('div', { class: 'btnrow' },
          h('button', { class: 'btn yellow', type: 'button', onclick: function () { pick(true); } }, '⭐ 10 הַמִּלִּים מֵהַדַּף'),
          h('button', { class: 'btn', type: 'button', onclick: function () { pick(false); } }, 'כׇּל ' + d.glossary.length + ' הַמִּלִּים'))));
    }
    function run(deck) {
      var queue = deck.slice(), first = {}, total = deck.length;
      function show() {
        U.stop(); box.innerHTML = '';
        if (!queue.length) return done();
        var g = queue[0];
        var fl = h('div', { class: 'flash' });
        var front = h('div', { class: 'face', role: 'button', tabindex: '0', 'aria-label': 'הפוך כרטיס' },
          g.on_worksheet ? h('span', { class: 'star', title: 'מהדף', 'aria-label': 'מילה מהדף' }, '⭐') : null,
          h('div', { class: 'ar big' }, g.niqqud),
          g.audio ? U.playBtn(g.audio, 'הַשְׁמָעַת הַמִּלָּה') : null,
          h('div', { class: 'muted' }, '👆 הַקֵּשׁ לַהֲפֹךְ'));
        var back = h('div', { class: 'face back', role: 'button', tabindex: '0', 'aria-label': 'הפוך כרטיס' },
          h('div', { class: 'ar' }, g.niqqud),
          h('div', { class: 'nq tr', style: 'font-size:26px;font-weight:700' }, '= ' + g.meaning),
          g.worksheet_answer ? h('div', { class: 'small' }, 'בַּתַּרְמִילוֹן: ', h('b', null, g.worksheet_answer)) : null,
          g.tip ? h('div', { class: 'tip' }, '💡 ' + g.tip) : null,
          g.meaning_audio ? U.playBtn(g.meaning_audio, 'הַשְׁמָעַת הַפֵּרוּשׁ') : null);
        var flip = function (e) { if (e.target.closest('.play')) return; fl.classList.toggle('flip'); act.hidden = false; };
        front.addEventListener('click', flip); back.addEventListener('click', flip);
        [front, back].forEach(function (f) { f.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(e); } }); });
        fl.appendChild(h('div', { class: 'flash-in' }, front, back));
        var yes = h('button', { class: 'btn green', type: 'button' }, '✔️ יָדַעְתִּי');
        var no = h('button', { class: 'btn orange', type: 'button' }, '🔁 עוֹד לֹא');
        var act = h('div', { class: 'btnrow', hidden: true }, yes, no);
        yes.addEventListener('click', function () {
          if (first[g.aramaic] == null) first[g.aramaic] = true;
          var r = fs[g.aramaic] || { box: 0 }; r.box = Math.min(3, (r.box || 0) + 1); r.at = Date.now(); fs[g.aramaic] = r; U.save();
          queue.shift(); U.beep(true); show();
        });
        no.addEventListener('click', function () {
          first[g.aramaic] = false;
          fs[g.aramaic] = { box: 0, at: Date.now() }; U.save();
          queue.shift(); queue.splice(Math.min(3, queue.length), 0, g); show();
        });
        box.appendChild(h('p', { class: 'center muted' }, 'נִשְׁאֲרוּ ' + queue.length + ' כַּרְטִיסִים'));
        box.appendChild(fl); box.appendChild(act);
      }
      function done() {
        var ok = Object.keys(first).filter(function (k) { return first[k]; }).length;
        var st = U.starsFromRatio(ok / total);
        U.record('flashcards', st); U.confetti(16);
        box.appendChild(h('div', { class: 'card done-banner' }, h('div', { class: 'bigstars' }, U.starsEl(st)),
          h('h2', null, U.praise()), h('p', null, 'יָדַעְתָּ ' + ok + ' מִתּוֹךְ ' + total + ' כְּבָר בַּפַּעַם הָרִאשׁוֹנָה.'),
          h('div', { class: 'btnrow' }, h('button', { class: 'btn sec', type: 'button', onclick: chooser }, '🔁 עוֹד סִבּוּב')), APP.finishBar('flashcards')));
      }
      show();
    }
    root.appendChild(box); chooser();
  };

  // ================= סרטון =================
  PAGES.video = function (root, d) {
    var v = d.video;
    var vid = h('video', { controls: true, playsinline: true, 'webkit-playsinline': true, preload: 'metadata', poster: 'icons/video-poster.jpg',
      'aria-label': 'הסרטון: מחרוזות של דגים', src: v.local_file });
    vid.addEventListener('error', function () { U.toast('הַסִּרְטוֹן לֹא נִטְעַן – נַסּוּ אֶת הַקִּישּׁוּר לְדְרַייב'); });
    var list = h('ol', { class: 'chapters' });
    function mark() {
      var t = vid.currentTime, cur = -1;
      v.chapters.forEach(function (c, i) { if (t >= c.start - 0.01) cur = i; });
      Array.prototype.forEach.call(list.querySelectorAll('button'), function (x, i) { x.classList.toggle('cur', i === cur); x.setAttribute('aria-current', i === cur ? 'true' : 'false'); });
    }
    vid.addEventListener('timeupdate', mark);
    vid.addEventListener('ended', function () { U.record('video', 3); U.confetti(14); });
    function jump(c) {
      var go = function () {
        try { vid.currentTime = c.start; } catch (e) {}
        var p = vid.play(); if (p && p.catch) p.catch(function () {});
        mark();
      };
      if (vid.readyState >= 1) go(); else { vid.addEventListener('loadedmetadata', function f() { vid.removeEventListener('loadedmetadata', f); go(); }); vid.load(); }
      vid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    root.appendChild(h('div', { class: 'card' },
      h('div', { class: 'vwrap', id: 'vwrap' }, vid),
      h('p', { class: 'muted small' }, 'אוֹרֶךְ: ' + v.duration_label),
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn green sm', type: 'button', onclick: function () { U.record('video', 3); U.confetti(12); U.toast('⭐⭐⭐ ' + U.praise()); } }, '✔️ צָפִיתִי בַּסִּרְטוֹן'))));
    v.chapters.forEach(function (c, i) {
      var b = h('button', { type: 'button', 'data-start': c.start },
        h('span', { class: 't' }, c.start_label.replace(/\.\d$/, '')), h('span', null, c.title));
      b.addEventListener('click', function () { jump(c); });
      list.appendChild(h('li', null, b));
    });
    root.appendChild(h('div', { class: 'card' }, h('h2', { class: 'h3' }, '📑 פְּרָקִים'),
      h('p', { class: 'muted small' }, 'לְחִיצָה עַל פֶּרֶק קוֹפֶצֶת לַזְּמַן הַזֶּה בַּסִּרְטוֹן.'), list,
      h('p', { class: 'small' }, h('a', { href: v.drive_url, target: '_blank', rel: 'noopener' }, '↗️ הַסִּרְטוֹן בְּגוּגְל דְּרַייב (גִּבּוּי)'))));
    root.appendChild(APP.finishBar('video'));
  };

  // ================= מפתח תשובות (להדפסה) =================
  PAGES.answers = function (root, d) {
    var ws = d.worksheet;
    function fill(text, blanks) {
      var parts = text.split(/_{3,}/), out = [];
      parts.forEach(function (p, i) {
        out.push(p);
        if (i < parts.length - 1) out.push(h('span', { class: 'a' }, ansText(blanks[i])));
      });
      if (parts.length === 1 && blanks && blanks.length) out.push(' ', h('span', { class: 'a' }, blanks.map(ansText).join(' / ')));
      return out;
    }
    function ansText(b) { if (!b) return ''; return b.uncertain ? b.answer + ' (אוֹ: ' + b.alternatives[0] + ')' : b.answer; }
    var ak = h('div', { class: 'ak' });
    ak.appendChild(h('div', { class: 'row sp' }, h('span', { class: 'small' }, ws.header.right), h('span', { class: 'small' }, 'מַפְתֵּחַ תְּשׁוּבוֹת')));
    ak.appendChild(h('h2', { class: 'center' }, ws.header.title));
    ak.appendChild(h('p', { class: 'nq' }, d.texts.gemara_lines.map(function (l) { return l.niqqud; }).join(' ')));
    ws.questions.forEach(function (q) {
      if (q.type === 'group') {
        ak.appendChild(h('div', { class: 'ws-q' }, h('span', { class: 'qn' }, q.id + '. '), q.text,
          q.parts.map(function (p) { return h('div', { class: 'ws-part' }, p.label + ' ', fill(p.text, p.blanks)); })));
      } else if (q.type === 'matching_bank') {
        var t = h('table');
        for (var i = 0; i < q.layout.right_column.length; i++) {
          var r = q.layout.right_column[i], l = q.layout.left_column[i];
          var ar = q.items.filter(function (x) { return x.word === r; })[0], al = q.items.filter(function (x) { return x.word === l; })[0];
          t.appendChild(h('tr', null, h('td', null, r), h('td', { class: 'a' }, ar.answer), h('td', null, l), h('td', { class: 'a' }, al.answer)));
        }
        ak.appendChild(h('div', { class: 'ws-q' }, h('span', { class: 'qn' }, q.id + '. '), q.text, t));
      } else {
        ak.appendChild(h('div', { class: 'ws-q' }, h('span', { class: 'qn' }, q.id + '. '), fill(q.text, q.blanks)));
      }
    });
    ak.appendChild(h('p', { class: 'small' }, h('b', null, ws.word_bank_title + ': '), ws.word_bank.join(', ')));
    ak.appendChild(h('p', { class: 'small muted' }, '* ' + d.uncertainties[0]));
    root.appendChild(h('div', { class: 'card no-print' },
      h('p', null, 'כָּאן אֶפְשָׁר לִבְדֹּק אֶת הַדַּף אַחֲרֵי שֶׁעוֹנִים לְבַד. 🖨️ אֶפְשָׁר גַּם לְהַדְפִּיס (עַמּוּד A4 אֶחָד).'),
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn', type: 'button', onclick: function () { window.print(); } }, '🖨️ הַדְפָּסָה'),
        h('a', { class: 'btn sec', href: d.answer_key.local_pdf, target: '_blank', rel: 'noopener' }, '📄 PDF'),
        h('a', { class: 'btn sec', href: d.answer_key.drive_pdf_url, target: '_blank', rel: 'noopener' }, '↗️ PDF בְּדְרַייב'))));
    root.appendChild(h('div', { class: 'card ws' }, ak));
  };

  // ================= ההתקדמות שלי =================
  PAGES.progress = function (root, d) {
    var acts = d.progress.activities, max = d.progress.stars_per_activity;
    var total = 0, done = 0;
    var list = h('div', { class: 'card' });
    acts.forEach(function (id) {
      var a = U.state.activities[id], m = APP.meta[id];
      if (a && a.done) done++;
      total += a ? a.stars : 0;
      list.appendChild(h('a', { class: 'prow', href: '#/' + id },
        h('span', null, m.ic + ' ' + m.t), a && a.done ? U.starsEl(a.stars, max) : h('span', { class: 'muted small' }, 'עוֹד לֹא')));
    });
    if (done === acts.length) {
      root.appendChild(h('div', { class: 'card done-banner' }, h('div', { class: 'bigstars', 'aria-hidden': 'true' }, '⭐⭐⭐'),
        h('h2', null, 'כׇּל הַכָּבוֹד! בְּהַצְלָחָה רַבָּה בַּמִּבְחָן!'), h('p', null, 'סִיַּמְתָּ אֶת כׇּל הַפְּעִילֻיּוֹת 🐟')));
      U.confetti(26);
    }
    root.appendChild(h('div', { class: 'card center' }, h('div', { class: 'bigstars' }, total + ' ⭐'),
      h('p', null, 'מִתּוֹךְ ' + acts.length * max + ' כּוֹכָבִים · סִיַּמְתָּ ' + done + ' מִתּוֹךְ ' + acts.length + ' פְּעִילֻיּוֹת')));
    root.appendChild(list);
    var known = d.glossary.filter(function (g) { return (U.state.flash[g.aramaic] || {}).box >= 2; }).length;
    root.appendChild(h('p', { class: 'muted center' }, '🃏 מִלִּים שֶׁיּוֹדְעִים טוֹב: ' + known + ' / ' + d.glossary.length));
    var rb = h('button', { class: 'btn sec', type: 'button', id: 'resetBtn' }, '🗑️ לְהַתְחִיל מֵחָדָשׁ (מְחִיקַת הַהִתְקַדְּמוּת)');
    rb.addEventListener('click', function () {
      if (window.confirm('למחוק את כל הכוכבים וההתקדמות ולהתחיל מחדש?')) { U.reset(); U.toast('הַהִתְקַדְּמוּת נִמְחֲקָה'); APP.render(); }
    });
    root.appendChild(h('div', { class: 'btnrow' }, rb));
  };
})();
