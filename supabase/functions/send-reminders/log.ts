import type { ServiceClient } from '../../_shared/supabase.ts';

export async function logReminderDelivery(
  client: ServiceClient,
  input: {
    itemId: string;
    userId: string;
    reminderKind: 'pre' | 'final';
    channel: 'telegram' | 'push' | 'none';
    status: 'sent' | 'failed' | 'skipped';
    error?: string | null;
  },
): Promise<void> {
  const { error } = await client.from('reminder_delivery_log').insert({
    item_id: input.itemId,
    user_id: input.userId,
    reminder_kind: input.reminderKind,
    channel: input.channel,
    status: input.status,
    error: input.error ?? null,
  });
  if (error) console.error('[send-reminders] delivery_log_failed');
}
