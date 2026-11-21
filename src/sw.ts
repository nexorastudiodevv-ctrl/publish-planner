/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ request, url }) =>
    request.mode === 'navigate' &&
    url.origin === self.location.origin &&
    !url.pathname.startsWith('/functions/v1/'),
  new NetworkFirst({
    cacheName: 'app-shell-navigation',
    networkTimeoutSeconds: 5,
    plugins: [{
      handlerDidError: async () => Response.redirect('/offline', 302),
    }],
  }),
);

registerRoute(
  new NavigationRoute(async () => Response.redirect('/offline', 302), {
    allowlist: [/^\/offline$/],
  }),
);

type PushPayload = {
  title?: string;
  body?: string;
  tag?: string;
  data?: { itemId?: string; url?: string };
};

type SwNotificationAction = { action: string; title: string };
type SwNotificationOptions = NotificationOptions & {
  actions?: SwNotificationAction[];
  renotify?: boolean;
};
type PushSubscriptionChangeEvent = Event & {
  newSubscription: PushSubscription | null;
  waitUntil: (promise: Promise<unknown>) => void;
};

async function openDatabase(): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open('publish-planner-push', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('auth');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStoredValue(key: string): Promise<string | null> {
  const database = await openDatabase();
  return await new Promise((resolve, reject) => {
    const request = database.transaction('auth', 'readonly').objectStore('auth').get(key);
    request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
    request.onerror = () => reject(request.error);
  });
}

async function readAccessToken(): Promise<string | null> {
  const database = await openDatabase();
  return await new Promise((resolve, reject) => {
    const request = database.transaction('auth', 'readonly').objectStore('auth').get('access_token');
    request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
    request.onerror = () => reject(request.error);
  });
}

async function updateSubscription(subscription: PushSubscription): Promise<void> {
  const token = await readAccessToken();
  const supabaseUrl = await readStoredValue('supabase_url');
  const anonKey = await readStoredValue('anon_key');
  const userId = await readStoredValue('user_id');
  if (!token || !supabaseUrl || !anonKey || !userId) return;

  const json = subscription.toJSON();
  await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
    }),
  });
}

self.addEventListener('push', (event: PushEvent) => {
  let payload: PushPayload;
  try {
    payload = event.data?.json() as PushPayload;
  } catch {
    payload = { title: 'منظّم النشر', body: 'لديك تنبيه جديد.' };
  }

  const itemId = payload.data?.itemId;
  const url = payload.data?.url ?? '/';
  const options: SwNotificationOptions = {
    body: payload.body ?? 'لديك تنبيه نشر جديد.',
    lang: 'ar',
    dir: 'rtl',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag ?? (itemId ? `reminder-${itemId}` : 'publish-planner'),
    renotify: true,
    data: { itemId, url },
  };

  if (typeof Notification !== 'undefined' && 'actions' in Notification.prototype) {
    options.actions = [
      { action: 'done', title: 'تم النشر ✅' },
      { action: 'snooze15', title: 'تأجيل 15 دقيقة ⏳' },
    ];
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'منظّم النشر', options),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const data = event.notification.data as { itemId?: string; url?: string } | undefined;
  const itemId = data?.itemId;
  const url = data?.url ?? '/';
  const action = event.action;

  event.waitUntil((async () => {
    if ((action === 'done' || action === 'snooze15') && itemId) {
      const token = await readAccessToken();
      if (!token) {
        await openNotificationUrl(url);
        return;
      }
      const supabaseUrl = await readSupabaseUrl();
      if (!supabaseUrl) {
        await openNotificationUrl(url);
        return;
      }
      await fetch(`${supabaseUrl}/functions/v1/reminder-action`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action, itemId }),
      }).catch(() => undefined);
    }
    await openNotificationUrl(url);
  })());
});

async function readSupabaseUrl(): Promise<string | null> {
  const database = await openDatabase();
  return await new Promise((resolve, reject) => {
    const request = database.transaction('auth', 'readonly').objectStore('auth').get('supabase_url');
    request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
    request.onerror = () => reject(request.error);
  });
}

async function openNotificationUrl(url: string): Promise<void> {
  const targetUrl = new URL(url, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of windows) {
    if ('focus' in client) {
      await client.navigate(targetUrl);
      await client.focus();
      return;
    }
  }
  await self.clients.openWindow(targetUrl);
}

self.addEventListener('pushsubscriptionchange', (rawEvent: Event) => {
  const event = rawEvent as PushSubscriptionChangeEvent;
  event.waitUntil((async () => {
    const registration = await self.registration;
    const vapidKey = await readVapidPublicKey();
    if (!vapidKey) return;
    const current = event.newSubscription ??
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyToUint8Array(vapidKey),
      });
    await updateSubscription(current);
  })());
});

async function readVapidPublicKey(): Promise<string | null> {
  const database = await openDatabase();
  return await new Promise((resolve, reject) => {
    const request = database.transaction('auth', 'readonly').objectStore('auth').get('vapid_public_key');
    request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
    request.onerror = () => reject(request.error);
  });
}

function vapidKeyToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}
