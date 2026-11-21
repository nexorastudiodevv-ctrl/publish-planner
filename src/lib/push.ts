export type PushSetupStatus =
  | 'unsupported'
  | 'ios-install-required'
  | 'permission-denied'
  | 'disabled'
  | 'enabled'
  | 'loading';

const databaseName = 'publish-planner-push';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

export function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

export async function openPushDatabase(): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('auth')) {
        request.result.createObjectStore('auth');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storePushAuth(
  accessToken: string | null,
  supabaseUrl: string,
  anonKey: string,
  vapidPublicKey: string,
  userId?: string,
): Promise<void> {
  const database = await openPushDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('auth', 'readwrite');
    const store = transaction.objectStore('auth');
    if (accessToken) store.put(accessToken, 'access_token');
    else store.delete('access_token');
    store.put(supabaseUrl, 'supabase_url');
    store.put(anonKey, 'anon_key');
    store.put(vapidPublicKey, 'vapid_public_key');
    if (userId) store.put(userId, 'user_id');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}
