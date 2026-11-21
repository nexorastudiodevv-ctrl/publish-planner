import type { ReminderClaim } from '../_shared/types.ts';
import { createServiceClient, type ServiceClient } from '../_shared/supabase.ts';
import { reminderKeyboard, reminderMessage } from './messages.ts';
import {
  DeferredTelegramRateLimit,
  RetryableReminderError,
  sendReminderMessage,
} from './telegram.ts';
import { TelegramApiError } from '../telegram-webhook/telegram.ts';
import { configurePush, sendWebPush } from './push.ts';
import { logReminderDelivery } from './log.ts';

type SendReport = {
  sent: number;
  failed: number;
  skipped: number;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function matchesSecret(received: string | null, expected: string): boolean {
  if (!received || received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function safeErrorCode(error: unknown): string {
  if (error instanceof DeferredTelegramRateLimit) return 'telegram_rate_limited';
  if (error instanceof RetryableReminderError) return 'telegram_send_slot_unavailable';
  if (error instanceof TelegramApiError) return `telegram_http_${error.status}`;
  if (error instanceof Error && error.name === 'TypeError') return 'telegram_network_error';
  return 'reminder_delivery_failed';
}

async function finishClaim(
  client: ServiceClient,
  claim: ReminderClaim,
  options: {
    success: boolean;
    error?: string;
    stopRetries?: boolean;
    retryAfterSeconds?: number;
  },
): Promise<boolean> {
  const { data, error } = await client.rpc('finish_reminder_attempt', {
    p_item_id: claim.id,
    p_claim_token: claim.claim_token,
    p_success: options.success,
    p_error: options.error ?? null,
    p_stop_retries: options.stopRetries ?? false,
    p_retry_after_seconds: options.retryAfterSeconds ?? null,
  });

  if (error) throw new Error('reminder_claim_finish_failed');
  return data === true;
}

async function reserveSendSlot(client: ServiceClient): Promise<void> {
  const { data: sendAt, error } = await client.rpc('reserve_reminder_send_slot', {});
  if (error || !sendAt) throw new Error('telegram_send_slot_unavailable');
  const delay = new Date(sendAt).getTime() - Date.now();
  if (delay > 0) await sleep(delay);
}

async function processClaim(
  client: ServiceClient,
  botToken: string,
  claim: ReminderClaim,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
): Promise<'sent' | 'failed' | 'skipped'> {
  const { data: item, error: itemError } = await client
    .from('content_items')
    .select('id, status, scheduled_at')
    .eq('id', claim.id)
    .eq('reminder_claim_token', claim.claim_token)
    .maybeSingle();

  if (itemError) throw new Error('reminder_claim_validation_failed');
  if (!item) return 'skipped';

  if (item.status !== 'scheduled') {
    await finishClaim(client, claim, {
      success: false,
      error: 'content_not_scheduled',
      stopRetries: true,
    });
    return 'skipped';
  }

  const scheduledAt = new Date(item.scheduled_at).getTime();
  const now = Date.now();
  if (
    claim.reminder_kind === 'pre' && scheduledAt <= now
  ) {
    await finishClaim(client, claim, {
      success: false,
      error: 'pre_reminder_window_elapsed',
      stopRetries: true,
    });
    return 'skipped';
  }
  if (claim.reminder_kind === 'final' && scheduledAt <= now - 6 * 60 * 60 * 1000) {
    const { error: missedError } = await client.rpc('mark_missed_reminders', {});
    if (missedError) throw new Error('mark_missed_reminders_failed');
    return 'skipped';
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('telegram_chat_id, timezone, push_enabled, telegram_enabled')
    .eq('id', claim.user_id)
    .maybeSingle();

  if (profileError) throw new Error('reminder_profile_lookup_failed');
  if (!profile) {
    await finishClaim(client, claim, { success: false, error: 'profile_unavailable', stopRetries: true });
    return 'skipped';
  }

  const currentClaim = { ...claim, timezone: profile.timezone };
  let telegramSucceeded = false;
  let pushSucceeded = false;
  let deliveryError: string | null = null;
  let retryAfterSeconds: number | undefined;

  if (profile.telegram_enabled && profile.telegram_chat_id && profile.telegram_chat_id === claim.telegram_chat_id) {
    try {
      await sendReminderMessage(
        botToken,
        profile.telegram_chat_id,
        reminderMessage(currentClaim),
        reminderKeyboard(claim.id),
        () => reserveSendSlot(client),
      );
      telegramSucceeded = true;
    } catch (error) {
      deliveryError = safeErrorCode(error);
      if (error instanceof DeferredTelegramRateLimit) retryAfterSeconds = error.retryAfterSeconds;
      if (error instanceof TelegramApiError && error.status === 403) {
        deliveryError = 'telegram_forbidden';
        await client
          .from('profiles')
          .update({ telegram_chat_id: null })
          .eq('id', claim.user_id)
          .eq('telegram_chat_id', profile.telegram_chat_id);
      }
    }
  } else if (profile.telegram_enabled && !profile.push_enabled) {
    deliveryError = 'telegram_not_linked';
  }

  if (profile.push_enabled) {
    let subscriptionsError: unknown = null;
    let subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string; failure_count: number }> | null = null;
    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      deliveryError ??= 'push_vapid_not_configured';
    } else {
      configurePush(vapidPublicKey, vapidPrivateKey, vapidSubject);
      const result = await client
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, failure_count')
      .eq('user_id', claim.user_id);
      subscriptionsError = result.error;
      subscriptions = result.data;
    }
    if (subscriptionsError) {
      console.error('[send-reminders] push_subscriptions_lookup_failed');
      deliveryError ??= 'push_lookup_failed';
    } else {
      if ((subscriptions?.length ?? 0) === 0) {
        deliveryError ??= 'push_subscription_missing';
      }
      const payload = JSON.stringify({
        title: 'منظّم النشر',
        body: reminderMessage(currentClaim),
        tag: `reminder-${claim.id}-${claim.reminder_kind}`,
        data: { itemId: claim.id, url: '/?item=' + claim.id },
      });
      for (const subscription of subscriptions ?? []) {
        const result = await sendWebPush(
          subscription.endpoint,
          subscription.p256dh,
          subscription.auth,
          payload,
        );
        if (result.ok) {
          pushSucceeded = true;
          await client
            .from('push_subscriptions')
            .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
            .eq('id', subscription.id);
          continue;
        }
        deliveryError ??= result.expired ? 'push_subscription_expired' : 'push_temporary_failure';
        if (result.expired) {
          await client.from('push_subscriptions').delete().eq('id', subscription.id);
        } else {
          const nextFailureCount = (subscription.failure_count ?? 0) + 1;
          if (nextFailureCount >= 5) {
            await client.from('push_subscriptions').delete().eq('id', subscription.id);
          } else {
            await client
              .from('push_subscriptions')
              .update({ failure_count: nextFailureCount })
              .eq('id', subscription.id);
          }
        }
      }
    }
  }

  if (!profile.push_enabled && !profile.telegram_enabled) {
    deliveryError = 'delivery_channels_disabled';
  }

  if (telegramSucceeded || pushSucceeded) {
    try {
      await finishClaim(client, claim, { success: true });
      await logReminderDelivery(client, {
        itemId: claim.id,
        userId: claim.user_id,
        reminderKind: claim.reminder_kind,
        channel: telegramSucceeded ? 'telegram' : 'push',
        status: 'sent',
      });
    } catch {
      console.error('[send-reminders] sent_state_update_failed');
    }
    return 'sent';
  }

  const stopRetries = deliveryError === 'telegram_forbidden' ||
    deliveryError === 'telegram_not_linked' ||
    deliveryError === 'push_subscription_expired' ||
    deliveryError === 'push_subscription_missing' ||
    deliveryError === 'delivery_channels_disabled';
  try {
    await finishClaim(client, claim, {
      success: false,
      error: deliveryError ?? 'no_delivery_channel',
      stopRetries,
      retryAfterSeconds,
    });
    await logReminderDelivery(client, {
      itemId: claim.id,
      userId: claim.user_id,
      reminderKind: claim.reminder_kind,
      channel: 'none',
      status: 'failed',
      error: deliveryError,
    });
  } catch {
    console.error('[send-reminders] failed_attempt_record_failed');
  }
  return 'failed';
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

Deno.serve(async (request: Request): Promise<Response> => {
  const expectedSecret = Deno.env.get('CRON_SECRET') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const authorizedByServiceRole = Boolean(serviceRoleKey && bearer === serviceRoleKey);
  if (
    !authorizedByServiceRole &&
    (!expectedSecret || !matchesSecret(request.headers.get('x-cron-secret'), expectedSecret))
  ) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? '';
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!supabaseUrl || !serviceRoleKey || !botToken) {
    console.error('[send-reminders] configuration_missing');
    return jsonResponse({ sent: 0, failed: 0, skipped: 0, error: 'configuration_missing' }, 500);
  }

  const report: SendReport = { sent: 0, failed: 0, skipped: 0 };

  try {
    const client = createServiceClient(supabaseUrl, serviceRoleKey);
    const { data: missedCount, error: missedError } = await client.rpc('mark_missed_reminders', {});
    if (missedError) throw new Error('mark_missed_reminders_failed');
    report.skipped += missedCount ?? 0;

    const { data: claims, error: claimError } = await client.rpc('claim_due_reminders', {
      batch_size: 100,
    });
    if (claimError) throw new Error('claim_due_reminders_failed');

    const claimed = claims ?? [];
    for (let offset = 0; offset < claimed.length; offset += 20) {
      const outcomes = await Promise.all(claimed.slice(offset, offset + 20).map(async (claim) => {
        try {
          return await processClaim(
            client,
            botToken,
            claim,
            vapidPublicKey,
            vapidPrivateKey,
            vapidSubject,
          );
        } catch (error) {
          console.error(
            '[send-reminders] claim_processing_failed',
            error instanceof Error ? error.name : 'unknown_error',
          );
          try {
            const finalized = await finishClaim(client, claim, {
              success: false,
              error: safeErrorCode(error),
            });
            return finalized ? 'failed' : 'skipped';
          } catch {
            console.error('[send-reminders] claim_release_failed');
            return 'failed';
          }
        }
      }));

      for (const outcome of outcomes) report[outcome] += 1;
    }

    return jsonResponse(report);
  } catch (error) {
    console.error(
      '[send-reminders] batch_failed',
      error instanceof Error ? error.name : 'unknown_error',
    );
    return jsonResponse({ ...report, error: 'batch_failed' }, 500);
  }
});
