var CACHE_NAME = 'mdd-v20';
var ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './css/diary.css',
    './css/about.css',
    './css/graphs.css',
    './css/period.css',
    // Библиотеки графиков и PDF — кэшируются, чтобы работать без интернета
    './vendor/chart.umd.js',
    './vendor/html2canvas.min.js',
    './vendor/jspdf.umd.min.js',
    './js/app.js',
    './js/storage.js',
    './js/profiles.js',
    './js/doctor.js',
    './js/diary.js',
    './js/graphs.js',
    './js/period.js',
    './js/more.js',
    './js/ui.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
    self.skipWaiting();
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
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (event) {
    if (event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }
    event.respondWith(
        fetch(event.request).then(function (response) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
                cache.put(event.request, clone);
            });
            return response;
        }).catch(function () {
            return caches.match(event.request);
        })
    );
});
