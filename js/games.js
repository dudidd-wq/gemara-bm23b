/* פעילויות: דף העבודה, שאלות אמריקאיות, התאמה, נכון/לא נכון, סדר, הסבר במילים שלך */
'use strict';
(function () {
  var h = U.h, NQ = /[\u05B0-\u05C7]/;
  function doneCard(id, st, msg, again) {
    U.confetti(18);
    return h('div', { class: 'card done-banner' }, h('div', { class: 'bigstars' }, U.starsEl(st)),
      h('h2', null, U.praise()), msg ? h('p', null, msg) : null,
      again ? h('div', { class: 'btnrow' }, h('button', { class: 'btn sec', type: 'button', onclick: again }, '🔁 עוֹד פַּעַם')) : null,
      APP.finishBar(id));
  }
  function firstLetter(b) { var s = U.strip(b.answer); return s.charAt(0); }

  // ================= דף העבודה =================
  PAGES.fill_in = function (root, d) {
    var ws = d.worksheet;
    var items = []; // {kind:'auto'|'free'|'q5', ok:bool, score:0..1}
    var finishBtn = h('button', { class: 'btn big green', type: 'button', disabled: true }, 'סִיַּמְתִּי אֶת הַדַּף! ⭐');
    var status = h('p', { class: 'muted center', 'aria-live': 'polite' });
    function refresh() {
      var left = items.filter(function (x) { return !x.ok; }).length;
      finishBtn.disabled = left > 0;
      status.textContent = left ? 'נִשְׁאֲרוּ ' + left + ' חֲלָקִים לְהַשְׁלִים' : 'הַכֹּל מוּכָן! 🎉';
    }
    // שורת השלמה: טקסט עם ____ ותיבות קלט
    function partRow(label, text, blanks, top) {
      var row = h('div', { class: top ? 'ws-part top' : 'ws-part' }), free = blanks.some(function (b) { return b.free_text; });
      if (label) row.appendChild(h('b', { class: top ? 'qn' : null }, label + ' '));
      var segs = text.split(/_{3,}/), inputs = [];
      segs.forEach(function (s, i) {
        row.appendChild(document.createTextNode(s));
        if (i < segs.length - 1 && !free) {
          var inp = h('input', { class: 'blank', type: 'text', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done', 'aria-label': (label || '') + ' מילה חסרה ' + (i + 1) });
          inputs.push(inp); row.appendChild(inp);
        }
      });
      if (segs.length === 1 && !free) {
        var inp2 = h('input', { class: 'blank free', type: 'text', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'done', 'aria-label': (label || '') + ' תשובה' });
        inputs.push(inp2); row.appendChild(inp2);
      }
      var fb = h('div', { class: 'feedback', 'aria-live': 'polite' }), extra = h('div');
      if (free) {
        // "בלשונך" – בדיקה עצמית
        var it = { kind: 'free', ok: false, score: 0 }; items.push(it);
        var ta = h('textarea', { class: 'blank free', rows: '2', 'aria-label': (label || '') + ' תשובה במילים שלך', placeholder: 'כְּתֹב בִּלְשׁוֹנְךָ…' });
        row.appendChild(ta);
        var show = h('button', { class: 'btn sec sm', type: 'button' }, '👀 הַרְאֵה תְּשׁוּבָה לְדֻגְמָה');
        show.addEventListener('click', function () {
          show.remove();
          extra.appendChild(h('div', { class: 'model' }, '✍️ ' + blanks[0].answer));
          var marks = h('div', { class: 'selfmark', role: 'group', 'aria-label': 'סימון עצמי' });
          [['כָּתַבְתִּי כָּכָה ✔️', 1], ['כִּמְעַט', 0.5], ['לֹא', 0]].forEach(function (m) {
            var b = h('button', { class: 'btn sm ' + (m[1] === 1 ? 'green' : m[1] ? 'yellow' : 'sec'), type: 'button' }, m[0]);
            b.addEventListener('click', function () {
              Array.prototype.forEach.call(marks.children, function (x) { x.classList.remove('sel'); });
              b.classList.add('sel'); it.ok = true; it.score = m[1];
              if (m[1] === 1) U.good(fb); else { fb.textContent = m[1] ? 'יָפֶה! עַכְשָׁיו אַתָּה יוֹדֵעַ אֶת כׇּל הַתְּשׁוּבָה 👍' : 'זֶה בְּסֵדֶר! קְרָא אֶת הַתְּשׁוּבָה פַּעַם נוֹסֶפֶת 🐟'; fb.className = 'feedback almost'; }
              refresh();
            });
            marks.appendChild(b);
          });
          extra.appendChild(marks);
        });
        row.appendChild(h('div', { class: 'btnrow' }, show));
      } else {
        var it2 = { kind: 'auto', ok: false, score: 0, wrong: 0 }; items.push(it2);
        var chk = h('button', { class: 'btn sm', type: 'button' }, 'בְּדֹק ✓');
        var check = function () {
          var allOk = true, empty = false;
          inputs.forEach(function (inp, i) {
            if (!inp.value.trim()) empty = true;
            var ok = U.isOk(inp.value, blanks[i]);
            inp.classList.toggle('ok', ok); inp.classList.toggle('almost', !ok && !!inp.value.trim());
            if (!ok) allOk = false;
          });
          if (empty && !allOk) { fb.textContent = 'כִּתְבוּ תְּשׁוּבָה בְּכׇל הַשּׁוּרוֹת ✏️'; fb.className = 'feedback almost'; return; }
          if (allOk) {
            if (!it2.ok) it2.score = it2.wrong === 0 ? 1 : 0.5;
            it2.ok = true; U.good(fb); chk.disabled = true;
            inputs.forEach(function (x) { x.readOnly = true; });
            extra.innerHTML = '';
            blanks.forEach(function (b) { if (b.uncertain && b.note) extra.appendChild(h('p', { class: 'small muted' }, 'ℹ️ ' + 'הַתְּשׁוּבָה הַמֻּמְלֶצֶת: ' + b.answer + '. ' + b.note)); });
            refresh();
          } else {
            it2.wrong++; U.soft(fb);
            if (it2.wrong >= 2) {
              extra.innerHTML = '';
              inputs.forEach(function (inp, i) {
                if (!U.isOk(inp.value, blanks[i])) extra.appendChild(h('div', { class: 'hint' }, '💡 רֶמֶז: הַמִּלָּה מַתְחִילָה בָּאוֹת "' + firstLetter(blanks[i]) + '"' + (it2.wrong >= 3 ? ' · הַתְּשׁוּבָה: ' + blanks[i].answer : '')));
              });
            }
          }
        };
        chk.addEventListener('click', check);
        inputs.forEach(function (inp) { inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } }); });
        row.appendChild(h('div', { class: 'btnrow' }, chk));
      }
      row.appendChild(fb); row.appendChild(extra);
      return row;
    }
    // שאלה 5 – תרמילון: גרירה או הקשה
    function q5(q) {
      var it = { kind: 'q5', ok: false, score: 0, checks: 0 }; items.push(it);
      var selected = null, slots = {}, chips = {};
      var grid = h('div', { class: 'q5' });
      var n = Math.max(q.layout.right_column.length, q.layout.left_column.length);
      for (var i = 0; i < n; i++) [q.layout.right_column[i], q.layout.left_column[i]].forEach(function (w) {
        if (!w) return;
        var item = q.items.filter(function (x) { return x.word === w; })[0];
        var slot = h('div', { class: 'slot', role: 'button', tabindex: '0', 'data-word': w, 'aria-label': 'מקום לפירוש של ' + w }, '…');
        slot._item = item; slot._chip = null; slots[w] = slot;
        slot.addEventListener('click', function () {
          if (it.ok) return;
          if (selected) place(selected, slot);
          else if (slot._chip) unplace(slot);
        });
        slot.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); slot.click(); } });
        grid.appendChild(h('div', { class: 'slotrow' }, h('b', null, w), slot));
      });
      var bank = h('div', { class: 'bank', 'aria-label': 'תרמילון' }, h('span', { class: 'bank-title' }, ws.word_bank_title + ':'));
      ws.word_bank.forEach(function (wb) {
        var c = h('span', { class: 'chip', role: 'button', tabindex: '0', 'aria-label': 'מילה מהתרמילון: ' + wb }, wb);
        c._w = wb; chips[wb] = c; bindChip(c); bank.appendChild(c);
      });
      function select(c) { if (selected) selected.classList.remove('sel'); selected = (selected === c) ? null : c; if (selected) selected.classList.add('sel'); }
      function place(c, slot) {
        if (slot._chip) unplace(slot);
        // אם הצ'יפ כבר במקום אחר – לפנות אותו
        Object.keys(slots).forEach(function (k) { if (slots[k]._chip === c) unplace(slots[k]); });
        slot._chip = c; slot.textContent = c._w; slot.classList.remove('ok', 'almost');
        c.classList.add('used'); c.classList.remove('sel'); selected = null;
        fbx.textContent = ''; fbx.className = 'feedback';
      }
      function unplace(slot) { var c = slot._chip; if (!c) return; c.classList.remove('used'); slot._chip = null; slot.textContent = '…'; slot.classList.remove('ok', 'almost'); }
      function bindChip(c) {
        var sx = 0, sy = 0, drag = false, ghost = null, over = null, pid = null;
        c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(c); } });
        c.addEventListener('pointerdown', function (e) {
          if (it.ok) return;
          pid = e.pointerId; sx = e.clientX; sy = e.clientY; drag = false;
          try { c.setPointerCapture(pid); } catch (x) {}
        });
        c.addEventListener('pointermove', function (e) {
          if (pid !== e.pointerId) return;
          if (!drag && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) {
            drag = true; ghost = c.cloneNode(true); ghost.classList.add('ghost'); ghost.classList.remove('sel'); document.body.appendChild(ghost);
          }
          if (drag) {
            ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
            if (e.clientY < 80) window.scrollBy(0, -14); else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 14);
            var el = document.elementFromPoint(e.clientX, e.clientY), s = el && el.closest ? el.closest('.slot') : null;
            if (over && over !== s) over.classList.remove('hover');
            over = s; if (s) s.classList.add('hover');
          }
        });
        function end(e, cancel) {
          if (pid !== e.pointerId) return; pid = null;
          if (ghost) { ghost.remove(); ghost = null; }
          if (over) over.classList.remove('hover');
          if (drag) { if (over && !cancel) place(c, over); }
          else if (!cancel) select(c);
          over = null; drag = false;
        }
        c.addEventListener('pointerup', function (e) { end(e, false); });
        c.addEventListener('pointercancel', function (e) { end(e, true); });
      }
      var fbx = h('div', { class: 'feedback', 'aria-live': 'polite' }), hint = h('div');
      var chk = h('button', { class: 'btn sm', type: 'button' }, 'בְּדֹק ✓');
      chk.addEventListener('click', function () {
        var filled = 0, right = 0;
        Object.keys(slots).forEach(function (k) {
          var s = slots[k]; if (!s._chip) return; filled++;
          var ok = U.strip(s._chip._w) === U.strip(s._item.answer);
          s.classList.toggle('ok', ok); s.classList.toggle('almost', !ok); if (ok) right++;
        });
        var total = Object.keys(slots).length;
        if (filled < total) { fbx.textContent = 'שִׂים מִלָּה בְּכׇל הַשּׁוּרוֹת (' + filled + '/' + total + ') 🐟'; fbx.className = 'feedback almost'; return; }
        it.checks++;
        if (it.checks === 1) it.score = right / total;
        if (right === total) {
          it.ok = true; chk.disabled = true; U.good(fbx); hint.innerHTML = ''; refresh();
        } else {
          U.soft(fbx); fbx.textContent += ' (' + right + '/' + total + ' נְכוֹנוֹת)';
          if (it.checks >= 2) {
            hint.innerHTML = '';
            Object.keys(slots).forEach(function (k) {
              var s = slots[k]; if (s.classList.contains('ok')) return;
              var g = d.glossary.filter(function (x) { return U.strip(x.aramaic) === U.strip(k); })[0];
              hint.appendChild(h('div', { class: 'hint' }, '💡 ' + k + ': ' + (g && g.tip ? g.tip : '')));
            });
          }
        }
      });
      return h('div', null, grid, bank, h('p', { class: 'small muted' }, '👆 גְּרֹר מִלָּה מֵהַתַּרְמִילוֹן לַשּׁוּרָה – אוֹ הַקֵּשׁ עַל מִלָּה וְאָז עַל הַשּׁוּרָה.'), h('div', { class: 'btnrow' }, chk), fbx, hint);
    }
    var sheet = h('div', { class: 'ws' });
    sheet.appendChild(h('div', { class: 'ws-head' }, h('div', null, ws.header.right),
      h('div', { class: 'fields', 'aria-hidden': 'true' }, ws.header.fields_left.map(function (f) { return h('div', null, f); }))));
    sheet.appendChild(h('div', { class: 'ws-title' }, ws.header.title));
    ws.questions.forEach(function (q) {
      var qd = h('div', { class: 'ws-q' });
      if (q.type === 'group') {
        qd.appendChild(h('div', null, h('span', { class: 'qn' }, q.id + '. '), h('u', null, q.text)));
        q.parts.forEach(function (p) { qd.appendChild(partRow(p.label, p.text, p.blanks)); });
      } else if (q.type === 'matching_bank') {
        qd.appendChild(h('div', null, h('span', { class: 'qn' }, q.id + '. '), h('b', null, q.text)));
        qd.appendChild(q5(q));
      } else {
        qd.appendChild(partRow(q.id + '.', q.text, q.blanks, true));
      }
      sheet.appendChild(qd);
    });
    sheet.appendChild(h('div', { class: 'ws-foot' }, ws.header.footer));
    root.appendChild(sheet);
    root.appendChild(status); root.appendChild(finishBtn);
    var out = h('div'); root.appendChild(out);
    finishBtn.addEventListener('click', function () {
      var sum = 0, cnt = 0;
      items.forEach(function (x) { var w = x.kind === 'q5' ? 10 : 1; sum += x.score * w; cnt += w; });
      var st = U.starsFromRatio(sum / cnt);
      U.record('fill_in', st, { score: Math.round(100 * sum / cnt) });
      finishBtn.hidden = true; status.hidden = true;
      out.appendChild(doneCard('fill_in', st, 'הַצִּיּוּן שֶׁלְּךָ: ' + Math.round(100 * sum / cnt) + ' 🐟'));
      out.scrollIntoView({ behavior: 'smooth' });
    });
    refresh();
  };

  // ================= שאלות אמריקאיות =================
  PAGES.multiple_choice = function (root, d) {
    var qs = d.quiz.multiple_choice, i = 0, firstOk = 0, box = h('div');
    root.appendChild(box);
    function show() {
      box.innerHTML = '';
      if (i >= qs.length) {
        var st = U.starsFromRatio(firstOk / qs.length);
        U.record('multiple_choice', st, { score: firstOk + '/' + qs.length });
        box.appendChild(doneCard('multiple_choice', st, 'עָנִיתָ נָכוֹן ' + firstOk + ' מִתּוֹךְ ' + qs.length + ' בַּפַּעַם הָרִאשׁוֹנָה.', function () { i = 0; firstOk = 0; show(); }));
        return;
      }
      var q = qs[i], wrong = 0, done = false;
      var fb = h('div', { class: 'feedback', 'aria-live': 'polite' }), extra = h('div'), opts = h('div', { class: 'opts' });
      var order = U.shuffle(q.options.map(function (o, k) { return k; }));
      var nx = h('button', { class: 'btn green', type: 'button', hidden: true, id: 'mcNext' }, i === qs.length - 1 ? 'לַתּוֹצָאָה ⭐' : 'הַשְּׁאֵלָה הַבָּאָה ←');
      nx.addEventListener('click', function () { i++; show(); });
      order.forEach(function (k) {
        var b = h('button', { class: 'opt', type: 'button', 'data-correct': k === q.correct ? '1' : '0' }, q.options[k]);
        b.addEventListener('click', function () {
          if (done) return;
          if (k === q.correct) {
            done = true; if (wrong === 0) firstOk++;
            b.classList.add('ok'); U.good(fb); extra.innerHTML = ''; extra.appendChild(h('div', { class: 'pshat' }, '📖 ' + q.explanation)); nx.hidden = false; nx.focus();
          } else {
            wrong++; b.classList.add('no'); b.disabled = true; U.soft(fb);
            if (wrong === 2) {
              var rest = Array.prototype.filter.call(opts.children, function (x) { return x.dataset.correct === '0' && !x.disabled; });
              if (rest[0]) rest[0].classList.add('hide');
              extra.appendChild(h('div', { class: 'hint' }, '💡 רֶמֶז: נִשְׁאֲרוּ רַק שְׁתֵּי אֶפְשָׁרֻיּוֹת!'));
            }
          }
        });
        opts.appendChild(b);
      });
      box.appendChild(h('p', { class: 'center muted' }, 'שְׁאֵלָה ' + (i + 1) + ' מִתּוֹךְ ' + qs.length + ' · ⭐ ' + firstOk));
      box.appendChild(h('div', { class: 'card q' }, h('h2', { class: 'h3' }, q.question), opts, fb, extra, h('div', { class: 'btnrow' }, nx)));
    }
    show();
  };

  // ================= נכון / לא נכון =================
  PAGES.true_false = function (root, d) {
    var qs = d.quiz.true_false, i = 0, firstOk = 0, box = h('div');
    root.appendChild(box);
    function show() {
      box.innerHTML = '';
      if (i >= qs.length) {
        var st = U.starsFromRatio(firstOk / qs.length);
        U.record('true_false', st, { score: firstOk + '/' + qs.length });
        box.appendChild(doneCard('true_false', st, 'עָנִיתָ נָכוֹן ' + firstOk + ' מִתּוֹךְ ' + qs.length + '.', function () { i = 0; firstOk = 0; show(); }));
        return;
      }
      var q = qs[i], wrong = 0, done = false, fb = h('div', { class: 'feedback', 'aria-live': 'polite' }), extra = h('div');
      var nx = h('button', { class: 'btn green', type: 'button', hidden: true, id: 'tfNext' }, i === qs.length - 1 ? 'לַתּוֹצָאָה ⭐' : 'הַבָּא ←');
      nx.addEventListener('click', function () { i++; show(); });
      function ans(v, b) {
        if (done) return;
        if (v === q.answer) {
          done = true; if (!wrong) firstOk++; b.classList.add('ok'); U.good(fb);
          extra.appendChild(h('div', { class: 'pshat' }, (q.answer ? '✔️ נָכוֹן. ' : '✖️ לֹא נָכוֹן. ') + (q.explanation || ''))); nx.hidden = false; nx.focus();
        } else { wrong++; b.classList.add('no'); b.disabled = true; U.soft(fb); }
      }
      var bt = h('button', { class: 'opt center', type: 'button', 'data-v': 'true' }, '✔️ נָכוֹן');
      var bf = h('button', { class: 'opt center', type: 'button', 'data-v': 'false' }, '✖️ לֹא נָכוֹן');
      bt.addEventListener('click', function () { ans(true, bt); }); bf.addEventListener('click', function () { ans(false, bf); });
      box.appendChild(h('p', { class: 'center muted' }, (i + 1) + ' / ' + qs.length));
      box.appendChild(h('div', { class: 'card q' }, h('h2', { class: 'h3' }, q.statement), h('div', { class: 'opts' }, bt, bf), fb, extra, h('div', { class: 'btnrow' }, nx)));
    }
    show();
  };

  // ================= משחק התאמה =================
  PAGES.matching = function (root, d) {
    var sets = d.quiz.matching;
    U.state.matchSets = U.state.matchSets || {};
    var tabs = h('div', { class: 'tabs', role: 'tablist' }), box = h('div'), cur = 0;
    function drawTabs() {
      tabs.innerHTML = '';
      sets.forEach(function (s, k) {
        var b = h('button', { class: 'btn sm ' + (k === cur ? 'cur' : 'sec'), type: 'button', role: 'tab', 'aria-selected': String(k === cur) },
          (U.state.matchSets[s.id] ? '✔️ ' : '') + s.title);
        b.addEventListener('click', function () { cur = k; drawTabs(); play(); });
        tabs.appendChild(b);
      });
    }
    function play() {
      box.innerHTML = '';
      var s = sets[cur], mistakes = 0, matched = 0, selR = null, selL = null;
      var colR = h('div', { class: 'col' }), colL = h('div', { class: 'col' });
      var fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
      function mk(text, side, idx) {
        var b = h('button', { class: 'mi' + (NQ.test(text) ? ' nqc' : ''), type: 'button', 'data-i': idx, 'data-side': side }, text);
        b.addEventListener('click', function () {
          if (b.classList.contains('ok')) return;
          if (side === 'r') { if (selR) selR.classList.remove('sel'); selR = selR === b ? null : b; } else { if (selL) selL.classList.remove('sel'); selL = selL === b ? null : b; }
          b.classList.toggle('sel', side === 'r' ? selR === b : selL === b);
          if (selR && selL) {
            if (selR.dataset.i === selL.dataset.i) {
              selR.classList.add('ok'); selL.classList.add('ok'); selR.classList.remove('sel'); selL.classList.remove('sel');
              selR.disabled = selL.disabled = true; matched++; U.beep(true); fb.textContent = U.praise(); fb.className = 'feedback ok';
              if (matched === s.pairs.length) setDone();
            } else {
              mistakes++; var a = selR, c = selL; [a, c].forEach(function (x) { x.classList.remove('sel'); x.classList.add('shake'); setTimeout(function () { x.classList.remove('shake'); }, 400); });
              U.soft(fb);
            }
            selR = selL = null;
          }
        });
        return b;
      }
      U.shuffle(s.pairs.map(function (p, k) { return k; })).forEach(function (k) { colR.appendChild(mk(s.pairs[k].left, 'r', k)); });
      U.shuffle(s.pairs.map(function (p, k) { return k; })).forEach(function (k) { colL.appendChild(mk(s.pairs[k].right, 'l', k)); });
      function setDone() {
        var st = mistakes === 0 ? 3 : mistakes <= Math.ceil(s.pairs.length / 3) ? 2 : 1;
        U.state.matchSets[s.id] = Math.max(U.state.matchSets[s.id] || 0, st); U.save();
        var all = sets.every(function (x) { return U.state.matchSets[x.id]; });
        drawTabs();
        if (all) {
          var avg = Math.round(sets.reduce(function (a, x) { return a + U.state.matchSets[x.id]; }, 0) / sets.length);
          U.record('matching', avg);
          box.appendChild(doneCard('matching', avg, 'הִתְאַמְתָּ אֶת כׇּל ' + sets.length + ' הַמִּשְׂחָקִים!', function () { play(); }));
        } else {
          U.starPop();
          var nxt = sets.findIndex(function (x) { return !U.state.matchSets[x.id]; });
          box.appendChild(h('div', { class: 'card okc center' }, h('div', { class: 'bigstars' }, U.starsEl(st)), h('p', null, U.praise()),
            h('button', { class: 'btn green', type: 'button', id: 'matchNext', onclick: function () { cur = nxt; drawTabs(); play(); } }, 'לַמִּשְׂחָק הַבָּא ←')));
        }
      }
      box.appendChild(h('div', { class: 'card q' }, h('h2', { class: 'h3' }, s.title), h('p', { class: 'small muted' }, 'הַקֵּשׁ עַל פְּרִיט מִיָּמִין וְעַל הַפְּרִיט שֶׁמַּתְאִים לוֹ מִשְּׂמֹאל.'),
        h('div', { class: 'match' }, colR, colL), fb));
    }
    root.appendChild(tabs); root.appendChild(box);
    var firstOpen = sets.findIndex(function (x) { return !U.state.matchSets[x.id]; }); cur = firstOpen < 0 ? 0 : firstOpen;
    drawTabs(); play();
  };

  // ================= סדר את הסוגיה =================
  PAGES.order = function (root, d) {
    var o = d.quiz.order_the_steps, correct = o.correct_order, checks = 0;
    var ul = h('ol', { class: 'order', 'aria-label': 'שלבי הסוגיה' });
    var idxs = correct.map(function (x, k) { return k; });
    var sh; do { sh = U.shuffle(idxs); } while (sh.every(function (v, k) { return v === k; }));
    function li(k) {
      var up = h('button', { type: 'button', 'aria-label': 'להזיז למעלה' }, '▲'), dn = h('button', { type: 'button', 'aria-label': 'להזיז למטה' }, '▼');
      var handle = h('span', { class: 'handle', 'aria-hidden': 'true' }, '☰');
      var el = h('li', { 'data-k': k }, handle, h('span', { class: 'txt' }, correct[k]), h('span', { class: 'mv' }, up, dn));
      up.addEventListener('click', function () { var p = el.previousElementSibling; if (p) ul.insertBefore(el, p); clearMarks(); });
      dn.addEventListener('click', function () { var n = el.nextElementSibling; if (n) ul.insertBefore(n, el); clearMarks(); });
      var pid = null;
      // מאזינים במסמך: הזזת ה-li ב-DOM מבטלת pointer capture, ואז הגרירה נעצרה אחרי צעד אחד
      handle.addEventListener('pointerdown', function (e) { pid = e.pointerId; el.classList.add('drag'); clearMarks(); e.preventDefault();
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end); });
      var move = function (e) {
        if (pid !== e.pointerId) return;
        var y = e.clientY, sibs = Array.prototype.filter.call(ul.children, function (x) { return x !== el; });
        var before = null;
        for (var s = 0; s < sibs.length; s++) { var r = sibs[s].getBoundingClientRect(); if (y < r.top + r.height / 2) { before = sibs[s]; break; } }
        if (before) { if (el.nextElementSibling !== before) ul.insertBefore(el, before); } else if (ul.lastElementChild !== el) ul.appendChild(el);
        if (y < 70) window.scrollBy(0, -12); else if (y > window.innerHeight - 70) window.scrollBy(0, 12);
      };
      var end = function (e) { if (pid !== e.pointerId) return; pid = null; el.classList.remove('drag');
        document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end); document.removeEventListener('pointercancel', end); };
      return el;
    }
    function clearMarks() { Array.prototype.forEach.call(ul.children, function (x) { x.classList.remove('ok', 'almost'); }); }
    sh.forEach(function (k) { ul.appendChild(li(k)); });
    var fb = h('div', { class: 'feedback', 'aria-live': 'polite' }), hint = h('div'), out = h('div');
    var chk = h('button', { class: 'btn', type: 'button', id: 'orderCheck' }, 'בְּדֹק אֶת הַסֵּדֶר ✓');
    chk.addEventListener('click', function () {
      checks++; var right = 0;
      Array.prototype.forEach.call(ul.children, function (x, pos) { var ok = +x.dataset.k === pos; x.classList.toggle('ok', ok); x.classList.toggle('almost', !ok); if (ok) right++; });
      if (right === correct.length) {
        U.good(fb); chk.disabled = true;
        var st = checks === 1 ? 3 : checks === 2 ? 2 : 1;
        U.record('order', st); out.appendChild(doneCard('order', st, 'סִדַּרְתָּ אֶת כׇּל הַסּוּגְיָא! 🐟'));
      } else {
        U.soft(fb); fb.textContent += ' (' + right + '/' + correct.length + ' בַּמָּקוֹם)';
        if (checks >= 2 && !hint.firstChild) hint.appendChild(h('div', { class: 'hint' }, '💡 רֶמֶז: מַהֲלַךְ הַסּוּגְיָא: ' + d.texts.flow.map(function (f) { return f.type; }).join(' ← ')));
      }
    });
    root.appendChild(h('div', { class: 'card q' }, h('h2', { class: 'h3' }, o.instruction), h('p', { class: 'small muted' }, '☰ גְּרֹר מֵהַיָּדִית, אוֹ הַשְׁתַּמֵּשׁ בַּחִצִּים ▲▼.'), ul,
      h('div', { class: 'btnrow' }, chk), fb, hint));
    root.appendChild(out);
  };

  // ================= הסבר במילים שלך =================
  PAGES.self_check = function (root, d) {
    var qs = d.quiz.self_check, state = qs.map(function () { return { done: false, got: 0 }; });
    var out = h('div');
    qs.forEach(function (q, qi) {
      var ta = h('textarea', { 'aria-label': 'התשובה שלי', placeholder: 'כְּתֹב כָּאן – אוֹ אֱמֹר בְּקוֹל 💬' });
      var area = h('div');
      var go = h('button', { class: 'btn', type: 'button' }, 'סִיַּמְתִּי – בּוֹא נִבְדֹּק ✓');
      go.addEventListener('click', function () {
        go.remove();
        area.appendChild(h('p', { class: 'small' }, 'סַמֵּן ✓ עַל כׇּל נְקֻדָּה שֶׁאָמַרְתָּ אוֹ כָּתַבְתָּ:'));
        var boxes = q.key_points.map(function (kp, k) {
          var cb = h('input', { type: 'checkbox', id: 'kp' + qi + '_' + k });
          cb.addEventListener('change', function () {
            state[qi].got = boxes.filter(function (x) { return x.checked; }).length; if (cb.checked) U.beep(true);
            if (out.firstChild) { var st2 = U.starsFromRatio(totals().got / totals().all); var a = U.state.activities.self_check; if (!a || st2 > a.stars) U.record('self_check', st2); }
          });
          area.appendChild(h('label', { class: 'kp', for: 'kp' + qi + '_' + k }, cb, kp));
          return cb;
        });
        var sm = h('button', { class: 'btn sec sm', type: 'button' }, '👀 הַרְאֵה תְּשׁוּבָה לְדֻגְמָה');
        sm.addEventListener('click', function () {
          sm.remove(); area.appendChild(h('div', { class: 'model' }, '✍️ ' + q.model_answer));
          state[qi].done = true; check();
        });
        area.appendChild(h('div', { class: 'btnrow' }, sm));
      });
      root.appendChild(h('div', { class: 'card q' }, h('h2', { class: 'h3' }, (qi + 1) + '. ' + q.prompt), ta, h('div', { class: 'btnrow' }, go), area));
    });
    root.appendChild(out);
    function totals() { var got = 0, all = 0; qs.forEach(function (q, k) { got += state[k].got; all += q.key_points.length; }); return { got: got, all: all }; }
    function check() {
      if (!state.every(function (s) { return s.done; }) || out.firstChild) return;
      var t = totals(), got = t.got, all = t.all;
      var st = U.starsFromRatio(got / all);
      U.record('self_check', st);
      out.appendChild(doneCard('self_check', st, 'אָמַרְתָּ ' + got + ' מִתּוֹךְ ' + all + ' נְקֻדּוֹת. כׇּל הַכָּבוֹד שֶׁהִסְבַּרְתָּ בְּעַצְמְךָ!'));
    }
  };
})();
