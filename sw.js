// キャッシュ（保存）する名前とファイル
const CACHE_NAME = 'my-game-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './game.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// インストール時にファイルをキャッシュ（保存）する
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

// オフラインの時は保存したファイルを使ってゲームを起動する
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // キャッシュがあればそれを返し、無ければ通常通り通信して取得
        return response || fetch(event.request);
      })
  );
});