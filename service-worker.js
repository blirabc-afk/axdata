// AX 모바일 Service Worker
// 오프라인 캐싱 - 인터넷 없이도 mobile.html 실행 가능

const CACHE_NAME = 'ax-mobile-v1';
const CACHE_FILES = [
  '/mobile.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// 1. 설치 시: 핵심 파일들을 캐시에 저장
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(CACHE_FILES);
      })
      .then(() => self.skipWaiting())
  );
});

// 2. 활성화 시: 이전 버전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. 요청 시: 캐시 우선, 없으면 네트워크
self.addEventListener('fetch', (event) => {
  // GET 요청만 처리
  if (event.request.method !== 'GET') return;

  // 업로드 API(GCP Cloud Run)는 캐싱 안 함 - 항상 네트워크
  const url = new URL(event.request.url);
  if (url.hostname.includes('run.app') || url.hostname.includes('googleapis')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        // 정상 응답만 캐싱
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // 오프라인 + 캐시 없음 → mobile.html 폴백
        if (event.request.mode === 'navigate') {
          return caches.match('/mobile.html');
        }
      });
    })
  );
});
