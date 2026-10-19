/* כלי עזר: DOM, בדיקת תשובות, שמע, התקדמות ומשוב. JS רגיל, בלי בנייה. */
'use strict';
var U = (function () {
  // ---------- DOM ----------
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.setAttribute('style', v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // ---------- בדיקת תשובות (סעיף 7.4 במסמך) ----------
  function strip(s) {
    return String(s || '').normalize('NFC').replace(/[\u0591-\u05C7]/g, '')
      .replace(/["'׳״.,!?:;()\-–־]/g, '').replace(/\s+/g, ' ').trim()
      .replace(/יי/g, 'י').replace(/וו/g, 'ו');
  }
  var NEG = /(^| )(לא|אין|אינו|אינם|אינה)( |$)/;
  // מחזיר true אם הקלט תואם לתשובה או לאחת החלופות.
  // גם "מכיל" מתקבל (למשל "מנין ומשקל" ← משקל), חוץ ממקרה של שלילה ("לא טוב").
  function isOk(input, blank) {
    var x = strip(input); if (!x) return false;
    var all = [blank.answer].concat(blank.alternatives || []).map(strip).filter(Boolean);
    if (all.indexOf(x) >= 0) return true;
    var padded = ' ' + x + ' ';
    return all.some(function (a) {
      if (a.length < 2) return false;
      if (padded.indexOf(' ' + a + ' ') < 0 && padded.indexOf(' ו' + a + ' ') < 0) return false;
      return !(NEG.test(x) && !NEG.test(a));
    });
  }
  // ---------- שמע ----------
  var audioEl = null, stopAt = null, raf = 0, curBtn = null, queue = [];
  function ensureAudio() {
    if (!audioEl) {
      audioEl = new Audio(); audioEl.preload = 'auto';
      audioEl.addEventListener('ended', onEnd);
      audioEl.addEventListener('error', function () { toast('🔇 לא הצלחתי להשמיע'); onEnd(); });
    }
    return audioEl;
  }
  function tick() {
    if (stopAt != null && audioEl.currentTime >= stopAt) { audioEl.pause(); onEnd(); return; }
    raf = requestAnimationFrame(tick);
  }
  function onEnd() {
    cancelAnimationFrame(raf); stopAt = null;
    if (queue.length) { var n = queue.shift(); startClip(n); return; }
    if (curBtn) { curBtn.classList.remove('on'); curBtn.setAttribute('aria-pressed', 'false'); }
    curBtn = null;
  }
  function startClip(c) {
    var a = ensureAudio();
    var url = new URL(c.file, document.baseURI).href;
    var go = function () {
      try { a.currentTime = Math.max(0, (c.start || 0) - 0.05); } catch (e) {}
      stopAt = (c.end != null) ? c.end + 0.05 : null;
      var p = a.play();
      if (p && p.catch) p.catch(function () { onEnd(); });
      cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    };
    if (a.src !== url) {
      a.src = url;
      a.addEventListener('loadedmetadata', function f() { a.removeEventListener('loadedmetadata', f); go(); });
      a.load();
    } else if (a.readyState >= 1) go();
    else a.addEventListener('loadedmetadata', function f() { a.removeEventListener('loadedmetadata', f); go(); });
  }
  // clips: {file,start,end} או מערך של כאלה (מתנגנים ברצף). מתנגן רק אחרי לחיצה.
  function play(clips, btn) {
    var list = Array.isArray(clips) ? clips.slice() : [clips];
    list = list.filter(function (c) { return c && c.file; });
    var wasSame = curBtn && curBtn === btn;
    stop();
    if (wasSame || !list.length) return;
    curBtn = btn || null;
    if (btn) { btn.classList.add('on'); btn.setAttribute('aria-pressed', 'true'); }
    queue = list.slice(1);
    startClip(list[0]);
  }
  function stop() {
    queue = [];
    if (audioEl) { audioEl.pause(); }
    cancelAnimationFrame(raf); stopAt = null;
    if (curBtn) { curBtn.classList.remove('on'); curBtn.setAttribute('aria-pressed', 'false'); }
    curBtn = null;
  }
  function playBtn(clips, label) {
    var b = h('button', { class: 'play', type: 'button', 'aria-label': label || 'הַשְׁמָעָה', 'aria-pressed': 'false', text: '🔊' });
    b.addEventListener('click', function (e) { e.stopPropagation(); play(clips, b); });
    return b;
  }
  // ---------- התקדמות ----------
  var KEY = 'bm23b_progress_v1';
  function load() {
    try { var p = JSON.parse(localStorage.getItem(KEY) || '{}'); if (p && typeof p === 'object') return norm(p); } catch (e) {}
    return norm({});
  }
  function norm(p) { p.activities = p.activities || {}; p.flash = p.flash || {}; if (p.sound == null) p.sound = true; return p; }
  var state = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  // שומר את התוצאה הטובה ביותר; stars 0–3
  function record(id, stars, extra) {
    var a = state.activities[id] || { stars: 0, done: false, tries: 0 };
    a.tries = (a.tries || 0) + 1;
    a.done = true;
    a.stars = Math.max(a.stars || 0, Math.max(1, Math.min(3, stars | 0)));
    a.last = Math.max(1, Math.min(3, stars | 0));
    if (extra) for (var k in extra) a[k] = extra[k];
    a.at = Date.now();
    state.activities[id] = a; save();
    return a;
  }
  function reset() { var s = state.sound; state = norm({ sound: s }); save(); }
  function starsFromRatio(r) { return r >= 0.9 ? 3 : r >= 0.6 ? 2 : 1; }
  function starsEl(n, max) {
    max = max || 3; var s = h('span', { class: 'stars', 'aria-label': n + ' כּוֹכָבִים מִתּוֹךְ ' + max, role: 'img' });
    for (var i = 0; i < max; i++) s.appendChild(h('span', { class: i < n ? '' : 'off', 'aria-hidden': 'true', text: i < n ? '★' : '☆' }));
    return s;
  }
  // ---------- משוב ----------
  var actx = null;
  function beep(good) {
    if (!state.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var t = actx.currentTime, notes = good ? [660, 880] : [440, 392];
      notes.forEach(function (f, i) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.11); g.gain.exponentialRampToValueAtTime(good ? 0.18 : 0.08, t + i * 0.11 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.11 + 0.22);
        o.connect(g); g.connect(actx.destination); o.start(t + i * 0.11); o.stop(t + i * 0.11 + 0.25);
      });
    } catch (e) {}
  }
  var PRAISE = ['יָפֶה מְאוֹד!', 'כׇּל הַכָּבוֹד!', 'מְצֻיָּן!', 'נָכוֹן! ⭐', 'אַלּוּף!', 'יוֹפִי!'];
  var ALMOST = ['כִּמְעַט! נַסֵּה שׁוּב 🐟', 'עוֹד נִסָּיוֹן קָטָן!', 'כִּמְעַט! חֲשֹׁב שׁוּב 🐠'];
  function praise() { return PRAISE[Math.floor(Math.random() * PRAISE.length)]; }
  function almost() { return ALMOST[Math.floor(Math.random() * ALMOST.length)]; }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function confetti(n) {
    if (reduce) return;
    var fx = document.getElementById('fx'); if (!fx) return;
    var bits = ['⭐', '🐟', '✨', '🐠', '⭐'];
    for (var i = 0; i < (n || 16); i++) {
      var b = h('span', { class: 'bit', text: bits[i % bits.length] });
      b.style.left = (Math.random() * 96) + 'vw';
      b.style.animationDelay = (Math.random() * 0.5) + 's';
      b.style.fontSize = (18 + Math.random() * 16) + 'px';
      fx.appendChild(b);
      setTimeout(function (x) { x.remove(); }.bind(null, b), 2400);
    }
  }
  function starPop() {
    if (reduce) return;
    var s = h('div', { class: 'pop-star', 'aria-hidden': 'true', text: '⭐' });
    document.body.appendChild(s); setTimeout(function () { s.remove(); }, 1000);
  }
  var toastT = 0;
  function toast(msg) {
    var t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }
  function good(el) { beep(true); starPop(); if (el) { el.textContent = praise(); el.className = 'feedback ok'; } }
  function soft(el) { beep(false); if (el) { el.textContent = almost(); el.className = 'feedback almost'; } }

  return {
    h: h, add: add, shuffle: shuffle, strip: strip, isOk: isOk,
    play: play, stop: stop, playBtn: playBtn, _audio: function () { return audioEl; },
    get state() { return state; }, save: save, record: record, reset: reset, starsFromRatio: starsFromRatio, starsEl: starsEl,
    beep: beep, confetti: confetti, starPop: starPop, toast: toast, good: good, soft: soft, praise: praise, almost: almost
  };
})();
