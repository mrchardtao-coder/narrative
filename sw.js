/* ========================================
   Service Worker — 缓存策略：网络优先，缓存回退
   版本号每次更新递增即可强制刷新
   ======================================== */

const CACHE_NAME = 'narrative-v3';

// 安装：跳过等待，立即接管
self.addEventListener('install', () => {
  self.skipWaiting();
});

// 激活：清理所有旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// 请求：网络优先，失败时回退缓存
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/v1/chat/completions') || event.request.url.includes('/models')) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
