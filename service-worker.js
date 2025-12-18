const CACHE_NAME = 'rhymic-cache-v2';
const urlsToCache = [
    '/',
    '/manifest.json',
    '/style.css',
    '/script.js',
    '/icon.png',
    '/assets/2.mp3',
    '/assets/2.jpg',
    '/assets/3.mp3',
    '/assets/3.jpg',
    '/assets/4.mp3',
    '/assets/4.jpg',
    '/assets/12.mp3',
    '/assets/12.jpg',
    '/assets/17.mp3',
    '/assets/17.jpg',
    '/assets/18.mp3',
    '/assets/18.jpg',
    '/assets/19.mp3',
    '/assets/19.jpg',
    '/assets/20.mp3',
    '/assets/20.jpg',
    '/assets/22.mp3',
    '/assets/22.jpg',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache');
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            
            if (response) {
                return response;
            }

            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            });
        }).catch(() => {
        })
    );
});