/* sw.js — membuat aplikasi tetap bisa dibuka tanpa internet.
   Strategi: ambil versi terbaru dari internet; kalau offline, pakai salinan tersimpan. */
const CACHE = "dagangan-v1";
const FILES = ["login.html", "dashboard.html", "style.css", "login.js", "dashboard.js",
               "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(nama => Promise.all(nama.filter(n => n !== CACHE).map(n => caches.delete(n)))));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => { if (res.ok) { const salinan = res.clone(); caches.open(CACHE).then(c => c.put(req, salinan)); } return res; })
      .catch(() => caches.match(req).then(m => m || caches.match("login.html")))
  );
});
