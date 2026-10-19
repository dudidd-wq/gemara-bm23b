/* Service worker: עבודה בלי אינטרנט. כשמשנים קבצים – להעלות את VERSION. */
'use strict';
var VERSION = 'bm23b-v8';
// קריינות חלק ב (7MB) – לא בהתקנה, נשמרת במטמון נפרד בפעם הראשונה שמשמיעים קטע
var AUDIO_B = 'bm23b-audio-b-v4';
var FILES = [
 "./",
 "index.html",
 "manifest.webmanifest",
 "css/style.css",
 "js/util.js",
 "js/pages.js",
 "js/games.js",
 "js/partb.js",
 "js/app.js",
 "data/site_data.json",
 "data/part_b.json",
 "data/part_b_audio.json",
 "fonts/Rubik-Hebrew.woff2",
 "fonts/FrankRuhlLibre-Hebrew.woff2",
 "icons/icon.svg",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/video-poster.jpg",
 "docs/answer_key.pdf",
 "audio/05ef36b073b15a.mp3",
 "audio/0f6745de2490ba.mp3",
 "audio/1b2a0d71d10d07.mp3",
 "audio/253cc8358cdcd8.mp3",
 "audio/38071228c638c3.mp3",
 "audio/43a0fbafb3e804.mp3",
 "audio/581b3d971c50ff.mp3",
 "audio/5a1498209e2d5d.mp3",
 "audio/5a476cf8f7ecce.mp3",
 "audio/5fee0183f0f87d.mp3",
 "audio/710224f886d242.mp3",
 "audio/741aded3ff50d6.mp3",
 "audio/76edec2aab2662.mp3",
 "audio/8abe8331e21132.mp3",
 "audio/8f367532ed85c6.mp3",
 "audio/9b0d53a10af65b.mp3",
 "audio/abffd08f06e011.mp3",
 "audio/af6147a26ab476.mp3",
 "audio/b2b12a4a9380ab.mp3",
 "audio/be64e598da5f6e.mp3",
 "audio/c43aced3596465.mp3",
 "audio/c8ae59a3e26d99.mp3",
 "audio/d62b333be9eede.mp3",
 "audio/da0e532053baeb.mp3",
 "audio/ea3826e5746411.mp3",
 "audio/f2db814a446434.mp3"
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION && k !== AUDIO_B; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// בקשות Range (שמע) – מחזירים 206 מתוך הקובץ השמור, כדי שקפיצה לזמן בקטע תעבוד גם בלי רשת
function rangeResponse(req, res) {
  var m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (!m) return res;
  return res.arrayBuffer().then(function (buf) {
    var size = buf.byteLength, start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], size - 1) : size - 1;
    if (!m[1] && m[2]) { start = Math.max(0, size - +m[2]); end = size - 1; }
    return new Response(buf.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
  });
}
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // הסרטון (40MB) לא נשמר במטמון – תמיד מהרשת, כולל בקשות Range
  if (/\/video\//.test(new URL(req.url).pathname)) return;
  var isData = /\/data\/(site_data|part_b|part_b_audio)\.json$/.test(new URL(req.url).pathname);
  if (isData) { // רשת קודם (תוכן מעודכן), ואם אין – מהמטמון
    e.respondWith(fetch(req).then(function (r) { var cp = r.clone(); caches.open(VERSION).then(function (c) { c.put(req, cp); }); return r; })
      .catch(function () { return caches.match(req, { ignoreSearch: true }); }));
    return;
  }
  if (/\/audio\/b\//.test(new URL(req.url).pathname)) { // לפי דרישה: מורידים את כל הקובץ פעם אחת ושומרים
    e.respondWith(caches.open(AUDIO_B).then(function (c) {
      return c.match(req.url, { ignoreSearch: true }).then(function (hit) {
        if (hit) return req.headers.has('range') ? rangeResponse(req, hit) : hit;
        return fetch(req.url).then(function (r) {
          if (!r.ok) return r;
          return c.put(req.url, r.clone()).then(function () { return req.headers.has('range') ? rangeResponse(req, r) : r; });
        }).catch(function () { return fetch(req); });
      });
    }));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then(function (hit) {
    if (hit) return req.headers.has('range') ? rangeResponse(req, hit) : hit;
    return fetch(req);
  }));
});
