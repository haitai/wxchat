/* wxchat service worker v2.0.1 */
const CACHE_NAME = 'wxchat-static-v2.1.1';
const PRECACHE = [
  '/',
  '/index.html',
  '/login.html',
  '/manifest.json',
  '/css/variables.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/messages.css',
  '/css/input.css',
  '/css/modals.css',
  '/css/mobile.css',
  '/css/auth-page.css',
  '/js/config.js',
  '/js/components/emojiPanel.js',
  '/js/core/emojiData.js',
  '/js/core/eventBus.js',
  '/js/utils.js',
  '/js/auth.js',
  '/js/api.js',
  '/js/ui.js',
  '/js/ui/messageRenderer.js',
  '/js/ui/markdownHandler.js',
  '/js/ui/imageLoader.js',
  '/js/fileUpload.js',
  '/js/realtime.js',
  '/js/messageHandler.js',
  '/js/pwa.js',
  '/js/components/functionMenu.js',
  '/js/components/functionButton.js',
  '/js/ai/aiAPI.js',
  '/js/ai/aiUI.js',
  '/js/ai/aiHandler.js',
  '/js/imageGen/imageGenAPI.js',
  '/js/imageGen/imageGenUI.js',
  '/js/imageGen/imageGenHandler.js',
  '/js/search/searchAPI.js',
  '/js/search/searchUI.js',
  '/js/search/searchHandler.js',
  '/js/app.js',
  '/icons/icon.svg'
];

// Cloudflare 静态资源默认 html_handling=auto-trailing-slash：
// /login.html -> 307 /login，/index.html -> 307 /
// 跟随该重定向得到的响应 redirected=true，直接回给导航请求
// （导航请求的 redirect mode 是 manual）会报：
// "a redirected response was used for a request whose redirect mode is not 'follow'"
// 因此入库/回包前必须去掉 redirected 标记（参考 Workbox cleanResponse）
async function cleanResponse(res) {
  if (!res || !res.redirected) return res;
  const body = await res.arrayBuffer();
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // 逐个预缓存：跟随重定向拿到内容后清洗再入库，保证缓存里没有 redirected 响应
      Promise.all(PRECACHE.map(async (url) => {
        const res = await fetch(url, { redirect: 'follow' });
        if (!res.ok) throw new Error(`precache ${url} -> ${res.status}`);
        await cache.put(url, await cleanResponse(res));
      }))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // API 网络优先，不缓存
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req).catch(() => new Response(JSON.stringify({
      success: false,
      error: '离线不可用'
    }), { headers: { 'Content-Type': 'application/json' }, status: 503 })));
    return;
  }

  // 静态资源：缓存优先，回落网络
  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req).then(async (cached) => {
        // 兜底：万一缓存里混入 redirected 响应，先清洗再回包，避免导航网络错误
        const served = cached && cached.redirected ? await cleanResponse(cached) : cached;
        const fetched = fetch(req).then((res) => {
          // 不缓存跟随重定向得到的响应，防止缓存被污染
          if (res && res.status === 200 && res.type === 'basic' && !res.redirected) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        }).catch(() => served);
        return served || fetched;
      })
    );
  }
});
