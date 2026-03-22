/// <reference lib="webworker" />

const CACHE_NAME = 'elmokhber-v1';
const OFFLINE_CACHE = 'elmokhber-offline-v1';

// الملفات الأساسية للتخزين (الأوفلاين)
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
];

// الملفات اللي يتم تخزينها تلقائياً
const CACHE_PATTERNS = [
  // الصفحات الأساسية
  /^\/$/,
  /^\/\?action=/,
  
  // الملفات الثابتة
  /\.(js|css|woff2?|ttf|eot)$/,
  
  // الصور والأيقونات
  /\.(png|jpg|jpeg|gif|svg|ico|webp)$/,
  
  // البيانات
  /\.json$/,
];

// الملفات اللي مفيش تخزين (الأونلاين)
const NO_CACHE_PATTERNS = [
  /\/api\//,           // API requests
  /socket\.io/,        // WebSocket
  /\/online/,          // الغرف الأونلاين
  /\/room/,            // الشات
  /voice/,             // الصوت
  /\/social\//,        // التواصل الاجتماعي
  /\/notifications/,   // الإشعارات
  /XTransformPort/,    // Mini services
  /ably/,              // Ably realtime
  /websocket/,         // WebSocket
];

// تثبيت Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // تخزين صفحة الـ offline
        return caches.open(OFFLINE_CACHE);
      })
      .then(() => {
        console.log('[SW] Service Worker installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// تفعيل Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== OFFLINE_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        return self.clients.claim();
      })
  );
});

// التحقق من نوع الطلب
function shouldCache(url) {
  const urlString = url.toString();
  
  // لا تخزن الأونلاين والـ API
  if (NO_CACHE_PATTERNS.some(pattern => pattern.test(urlString))) {
    return false;
  }
  
  // تخزن الملفات المطابقة
  return CACHE_PATTERNS.some(pattern => pattern.test(urlString));
}

function isOnlineRequest(url) {
  const urlString = url.toString();
  return NO_CACHE_PATTERNS.some(pattern => pattern.test(urlString));
}

// معالجة الطلبات
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // تخطي الطلبات غير GET
  if (request.method !== 'GET') {
    return;
  }
  
  // للطلبات الأونلاين (API, WebSocket, etc.)
  if (isOnlineRequest(request.url)) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // في حالة عدم وجود إنترنت
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'هذه الميزة تحتاج اتصال بالإنترنت',
              offline: true 
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }
  
  // للملفات الثابتة - استراتيجية Cache First
  if (shouldCache(request.url)) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // تحديث الكاش في الخلفية
            fetch(request)
              .then((networkResponse) => {
                if (networkResponse.ok) {
                  caches.open(CACHE_NAME)
                    .then((cache) => cache.put(request, networkResponse));
                }
              })
              .catch(() => {});
            
            return cachedResponse;
          }
          
          // إذا لم يكن في الكاش، جلب من الشبكة
          return fetch(request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => cache.put(request, responseClone));
              }
              return networkResponse;
            })
            .catch(() => {
              // في حالة الفشل، محاولة إرجاع الصفحة الرئيسية
              if (request.mode === 'navigate') {
                return caches.match('/');
              }
              return new Response('Offline', { status: 503 });
            });
        })
    );
    return;
  }
  
  // للصفحات - استراتيجية Network First
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request)
            .then((cachedResponse) => {
              return cachedResponse || caches.match('/');
            });
        })
    );
    return;
  }
  
  // باقي الطلبات - Network First مع Cache Fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok && shouldCache(request.url)) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// استقبال الرسائل من الصفحة
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      cacheNames.forEach((name) => caches.delete(name));
    });
  }
});

// Push Notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  let data = {
    title: 'الخبير',
    body: 'لديك إشعار جديد!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'elmokhber-notification',
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      vibrate: [100, 50, 100],
      data: data.data || {},
      actions: data.actions || [],
    })
  );
});

// التعامل مع النقر على الإشعار
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  
  event.notification.close();
  
  const data = event.notification.data || {};
  let url = '/';
  
  // تحديد الصفحة بناءً على نوع الإشعار
  if (data.type === 'friend_request') {
    url = '/?action=social';
  } else if (data.type === 'room_invite') {
    url = '/?action=online&room=' + (data.roomCode || '');
  } else if (data.type === 'new_message') {
    url = '/?action=social&chat=' + (data.senderId || '');
  } else if (data.screen) {
    url = data.screen;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // البحث عن نافذة مفتوحة
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // فتح نافذة جديدة
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Background Sync للأونلاين
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // سيتم تنفيذها لاحقاً لمزامنة الرسائل
  console.log('[SW] Syncing messages...');
}

console.log('[SW] Service Worker loaded');
