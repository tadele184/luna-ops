// Keeps the app working with a weak signal. The page itself is always fetched fresh when online.
var CACHE = "luna-ops-18.7";
var FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "exceljs.min.js", "jszip.min.js"];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener("activate", function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;          // the server (Google) is never cached
  if (e.request.mode === "navigate" || u.pathname.slice(-5) === ".html" || u.pathname.slice(-1) === "/") {
    e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(CACHE).then(function (ca) { ca.put(e.request, c); }); return r; })
      .catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match("index.html"); }); }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function (r) { return r || fetch(e.request); }));
});
