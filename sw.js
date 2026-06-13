var CACHE_NAME = 'mdd-v4';
var ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/ui.js',
    './js/db.js',
    './js/storage.js',
    './js/profiles.js',
    './js/diary.js',
    './js/analyses.js',
    './js/reminders.js',
    './js/transfer.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (key) {
                    return key !== CACHE_NAME;
                }).map(function (key) {
                    return caches.delete(key);
                })
            );
        })
    );
});

self.addEventListener('fetch', function (event) {
    event.respondWith(
        caches.match(event.request).then(function (cached) {
            return cached || fetch(event.request);
        })
    );
});
