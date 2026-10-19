/* נתב (hash), טעינת הנתונים והרשמת service worker */
'use strict';
var APP = {
  data: null,
  // תוויות הממשק לכל פעילות (מזהי הפעילויות מגיעים מ-site_data.json → progress.activities)
  meta: {
    learn: { ic: '📖', t: 'לוֹמְדִים אֶת הַסּוּגְיָא' },
    text: { ic: '🔍', t: 'גְּמָרָא אִינְטֶרַקְטִיבִית' },
    flashcards: { ic: '🃏', t: 'כַּרְטִיסִיּוֹת מִלִּים' },
    fill_in: { ic: '✏️', t: 'דַּף הָעֲבוֹדָה' },
    multiple_choice: { ic: '❓', t: 'שְׁאֵלוֹת אֲמֶרִיקָאִיּוֹת' },
    matching: { ic: '🔗', t: 'מִשְׂחַק הַתְאָמָה' },
    true_false: { ic: '✅', t: 'נָכוֹן / לֹא נָכוֹן' },
    order: { ic: '🔢', t: 'סַדֵּר אֶת הַסּוּגְיָא' },
    self_check: { ic: '💬', t: 'הַסְבֵּר בְּמִלִּים שֶׁלְּךָ' },
    video: { ic: '🎬', t: 'הַסִּרְטוֹן' },
    answers: { ic: '🖨️', t: 'מַפְתֵּחַ תְּשׁוּבוֹת' },
    progress: { ic: '⭐', t: 'הַהִתְקַדְּמוּת שֶׁלִּי' }
  },
  pages: PAGES,
  activities: function () { return APP.data.progress.activities; },
  route: function () {
    var r = (location.hash || '#/').replace(/^#\/?/, '').split('?')[0].split('/')[0];
    return r || 'home';
  },
  go: function (id) { location.hash = id === 'home' ? '#/' : '#/' + id; },
  next: function (id) {
    var acts = APP.activities(), i = acts.indexOf(id);
    var p = U.state.activities;
    for (var k = 1; k <= acts.length; k++) {
      var cand = acts[(i + k) % acts.length];
      if (!(p[cand] && p[cand].done)) return cand;
    }
    return 'progress';
  },
  // כפתורי סיום פעילות
  finishBar: function (id) {
    var n = APP.next(id), m = APP.meta[n] || { ic: '⭐', t: 'הַהִתְקַדְּמוּת שֶׁלִּי' };
    return U.h('div', { class: 'btnrow' },
      U.h('a', { class: 'btn green', href: '#/' + n }, 'הַבָּא: ' + m.ic + ' ' + m.t + ' ←'),
      U.h('a', { class: 'btn sec', href: '#/' }, '🏠 לַבַּיִת'));
  },
  render: function () {
    U.stop();
    var id = APP.route(), page = APP.pages[id];
    if (!page) { id = 'home'; page = APP.pages.home; }
    var main = document.getElementById('app');
    main.innerHTML = '';
    var m = APP.meta[id];
    document.getElementById('pageTitle').textContent = m ? m.ic + ' ' + m.t : APP.data.meta.title_plain;
    document.title = (m ? m.t.replace(/[\u0591-\u05C7]/g, '') + ' · ' : '') + APP.data.meta.title_plain;
    try { page(main, APP.data); } catch (e) { console.error(e); main.appendChild(U.h('div', { class: 'card' }, 'מַשֶּׁהוּ הִשְׁתַּבֵּשׁ. נַסֵּה לִטְעוֹן שׁוּב.')); }
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  },
  start: function () {
    var sb = document.getElementById('soundToggle');
    var syncSound = function () {
      sb.textContent = U.state.sound ? '🔔' : '🔕';
      sb.setAttribute('aria-pressed', U.state.sound ? 'true' : 'false');
      sb.setAttribute('aria-label', U.state.sound ? 'צלילי משוב: פועל' : 'צלילי משוב: כבוי');
    };
    sb.addEventListener('click', function () { U.state.sound = !U.state.sound; U.save(); syncSound(); U.toast(U.state.sound ? '🔔 צְלִילִים פּוֹעֲלִים' : '🔕 צְלִילִים כְּבוּיִים'); });
    syncSound();
    fetch('data/site_data.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { APP.data = d; window.addEventListener('hashchange', APP.render); APP.render(); })
      .catch(function (e) {
        console.error(e);
        document.getElementById('app').innerHTML = '<div class="card">לֹא הִצְלַחְתִּי לִטְעוֹן אֶת הַתֹּכֶן. בְּדֹק אֶת הַחִבּוּר לָאִינְטֶרְנֶט וְנַסֵּה שׁוּב.</div>';
      });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
    }
  }
};
APP.start();
