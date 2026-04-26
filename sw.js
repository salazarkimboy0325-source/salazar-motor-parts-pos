const CACHE_NAME = 'smp-pos-v1';
const urlsToCache = [
    '/',
    '/login.html',
    '/index.html',
    '/checkout.html',
    '/management.html',
    '/reports.html',
    '/styles.css',
    '/script.js',
    '/auth.js',
    '/auth.css',
    '/checkout.js',
    '/checkout.css',
    '/management.js',
    '/management.css',
    '/reports.js',
    '/reports.css',
'/firebase-config.js',
    '/android-icon-192x192.png',
'/apple-icon-180x180.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

