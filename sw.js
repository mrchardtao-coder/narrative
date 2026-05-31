/* ========================================
   Service Worker — PWA 离线缓存
   ======================================== */

const CACHE_NAME = 'narrative-v1';
const ASSETS = [
  '/',
  'index.html',
  'css/style.css',
  'js/config.js',
  'js/storage.js',
  'js/prompt.js',
  'js/api.js',
  'js/app.js',
  'manifest.json',
];

// 安装：预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {
        // 部分失败不影响安装
      });
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// 请求：缓存优先，网络回退
self.addEventListener('fetch', (event) => {
  // API 请求不缓存
  if (event.request.url.includes('/v1/chat/completions')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // 缓存成功的 GET 请求
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    }).catch(() => {
      // 离线时返回缓存，或什么都不返回
      return caches.match(event.request);
    })
  );
});
