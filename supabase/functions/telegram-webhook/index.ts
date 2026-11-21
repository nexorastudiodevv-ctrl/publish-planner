import type {
  TelegramChat,
  TelegramInlineKeyboardMarkup,
  TelegramMessage,
  TelegramUpdate,
  TelegramUser,
} from '../_shared/types.ts';
import { createServiceClient, type ServiceClient } from './db.ts';
import { handleTelegramUpdate } from './commands.ts';
import { answerCallbackQuery, sendMessage } from './telegram.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTelegramChat(value: unknown): value is TelegramChat {
  return isRecord(value) &&
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    typeof value.type === 'string';
}

function isTelegramUser(value: unknown): value is TelegramUser {
  return isRecord(value) &&
    typeof value.id === 'number' &&
    Number.isSafeInteger(value.id) &&
    typeof value.is_bot === 'boolean' &&
    typeof value.first_name === 'string';
}

function isInlineKeyboard(value: unknown): value is TelegramInlineKeyboardMarkup {
  if (!isRecord(value) || !Array.isArray(value.inline_keyboard)) return false;
  return value.inline_keyboard.every((row) =>
    Array.isArray(row) && row.every((button) =>
      isRecord(button) &&
      typeof button.text === 'string' &&
      (button.callback_data === undefined || typeof button.callback_data === 'string')
    )
  );
}

function isTelegramMessage(value: unknown): value is TelegramMessage {
  if (!isRecord(value) ||
    typeof value.message_id !== 'number' ||
    !Number.isSafeInteger(value.message_id) ||
    typeof value.date !== 'number' ||
    !Number.isSafeInteger(value.date) ||
    !isTelegramChat(value.chat)) {
    return false;
  }

  if (value.from !== undefined && !isTelegramUser(value.from)) return false;
  if (value.text !== undefined && typeof value.text !== 'string') return false;
  if (value.reply_markup !== undefined && !isInlineKeyboard(value.reply_markup)) return false;
  return true;
}

function isTelegramUpdate(value: unknown): value is TelegramUpdate {
  if (!isRecord(value) ||
    typeof value.update_id !== 'number' ||
    !Number.isSafeInteger(value.update_id)) {
    return false;
  }

  const hasMessage = value.message !== undefined && isTelegramMessage(value.message);
  const callback = value.callback_query;
  const hasCallback = isRecord(callback) &&
    typeof callback.id === 'string' &&
    isTelegramUser(callback.from) &&
    (callback.message === undefined || isTelegramMessage(callback.message)) &&
    (callback.data === undefined || typeof callback.data === 'string');

  return hasMessage || hasCallback;
}

function matchesSecret(received: string | null, expected: string): boolean {
  if (!received || received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function getServiceClient(): ServiceClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) throw new Error('supabase_configuration_missing');
  return createServiceClient(url, serviceRoleKey);
}

async function sendTemporaryFailure(update: TelegramUpdate, botToken: string): Promise<void> {
  if (update.message) {
    await sendMessage(
      botToken,
      update.message.chat.id,
      'حدث خطأ مؤقت. حاول مجددًا بعد قليل.',
    );
    return;
  }
  if (update.callback_query) {
    await answerCallbackQuery(botToken, update.callback_query.id, 'حدث خطأ مؤقت. حاول مجددًا.');
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  const expectedSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';
  if (!expectedSecret || !matchesSecret(
    request.headers.get('X-Telegram-Bot-Api-Secret-Token'),
    expectedSecret,
  )) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let update: TelegramUpdate;
  try {
    const body: unknown = await request.json();
    if (!isTelegramUpdate(body)) {
      console.error('[telegram-webhook] invalid_update');
      return new Response('ok', { status: 200 });
    }
    update = body;
  } catch {
    console.error('[telegram-webhook] invalid_json');
    return new Response('ok', { status: 200 });
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    console.error('[telegram-webhook] configuration_missing');
    return new Response('ok', { status: 200 });
  }

  try {
    const client = getServiceClient();
    await handleTelegramUpdate(client, botToken, update);
  } catch (error) {
    console.error(
      '[telegram-webhook] update_failed',
      error instanceof Error ? error.name : 'unknown_error',
    );
    try {
      await sendTemporaryFailure(update, botToken);
    } catch {
      console.error('[telegram-webhook] failure_reply_failed');
    }
  }

  return new Response('ok', { status: 200 });
});
