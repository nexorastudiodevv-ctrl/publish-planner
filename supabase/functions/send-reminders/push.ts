import webpush from 'npm:web-push@3.6.7';

export type PushSendResult =
  | { ok: true }
  | { ok: false; status: number; expired: boolean; temporary: boolean };

export function configurePush(vapidPublicKey: string, vapidPrivateKey: string, subject: string): void {
  webpush.setVapidDetails(subject, vapidPublicKey, vapidPrivateKey);
}

export async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
): Promise<PushSendResult> {
  try {
    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      payload,
      { TTL: 3600, urgency: 'high', topic: 'publish-planner-reminder' },
    );
    return { ok: true };
  } catch (error) {
    const status = error instanceof Error && 'statusCode' in error
      ? Number((error as Error & { statusCode?: number }).statusCode ?? 0)
      : 0;
    return {
      ok: false,
      status,
      expired: status === 404 || status === 410,
      temporary: status === 429 || status === 0 || status >= 500,
    };
  }
}
