import type { ContentItem, Profile } from '../_shared/types.ts';
import type { ServiceClient } from '../_shared/supabase.ts';

export { createServiceClient } from '../_shared/supabase.ts';
export type { ServiceClient } from '../_shared/supabase.ts';

function throwDatabaseError(): never {
  throw new Error('database_request_failed');
}

export async function getProfileByChatId(
  client: ServiceClient,
  chatId: number,
): Promise<Pick<Profile, 'id' | 'timezone'> | null> {
  const { data, error } = await client
    .from('profiles')
    .select('id, timezone')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();

  if (error) throwDatabaseError();
  return data;
}

export async function consumeLinkAttempt(client: ServiceClient, chatId: number): Promise<boolean> {
  const { data, error } = await client.rpc('consume_telegram_link_attempt', {
    p_chat_id: chatId,
  });

  if (error) throwDatabaseError();
  return data === true;
}

export type LinkCodeResult =
  | 'linked'
  | 'invalid'
  | 'expired'
  | 'used'
  | 'chat_already_linked'
  | 'profile_unavailable';

export async function linkTelegramCode(
  client: ServiceClient,
  code: string,
  chatId: number,
): Promise<LinkCodeResult> {
  const { data, error } = await client.rpc('link_telegram_code', {
    p_code: code,
    p_chat_id: chatId,
  });

  if (error) throwDatabaseError();
  if (
    data === 'linked' ||
    data === 'invalid' ||
    data === 'expired' ||
    data === 'used' ||
    data === 'chat_already_linked' ||
    data === 'profile_unavailable'
  ) {
    return data;
  }
  throwDatabaseError();
}

export async function getScheduledForDay(
  client: ServiceClient,
  userId: string,
  startIso: string,
  endIso: string,
): Promise<ContentItem[]> {
  const { data, error } = await client
    .from('content_items')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', startIso)
    .lt('scheduled_at', endIso)
    .order('scheduled_at', { ascending: true });

  if (error) throwDatabaseError();
  return data ?? [];
}

export async function getUpcomingItems(
  client: ServiceClient,
  userId: string,
  fromIso: string,
): Promise<ContentItem[]> {
  const { data, error } = await client
    .from('content_items')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', fromIso)
    .order('scheduled_at', { ascending: true })
    .limit(5);

  if (error) throwDatabaseError();
  return data ?? [];
}

export async function getRecentScheduledItems(
  client: ServiceClient,
  userId: string,
): Promise<ContentItem[]> {
  const { data, error } = await client
    .from('content_items')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'scheduled')
    .order('scheduled_at', { ascending: false })
    .limit(5);

  if (error) throwDatabaseError();
  return data ?? [];
}

export type TelegramItemAction = 'done' | 'snooze15' | 'cancel';

export async function performTelegramItemAction(
  client: ServiceClient,
  userId: string,
  itemId: string,
  action: TelegramItemAction,
): Promise<{ item_title: string; scheduled_at: string; action: TelegramItemAction } | null> {
  const { data, error } = await client.rpc('perform_telegram_item_action', {
    p_item_id: itemId,
    p_user_id: userId,
    p_action: action,
  });

  if (error) throwDatabaseError();
  return data?.[0] ?? null;
}

export async function unlinkProfileByChatId(
  client: ServiceClient,
  chatId: number,
): Promise<boolean> {
  const { data, error } = await client
    .from('profiles')
    .update({ telegram_chat_id: null })
    .eq('telegram_chat_id', chatId)
    .select('id')
    .maybeSingle();

  if (error) throwDatabaseError();
  return data !== null;
}
