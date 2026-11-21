import type { TelegramInlineKeyboard } from '../_shared/types.ts';
import { sendMessage, TelegramApiError } from '../telegram-webhook/telegram.ts';

export class DeferredTelegramRateLimit extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('telegram_rate_limited');
    this.name = 'DeferredTelegramRateLimit';
  }
}

export class RetryableReminderError extends Error {
  constructor() {
    super('reminder_send_slot_unavailable');
    this.name = 'RetryableReminderError';
  }
}

export async function sendReminderMessage(
  botToken: string,
  chatId: number,
  text: string,
  keyboard: TelegramInlineKeyboard,
  beforeSend: () => Promise<void>,
): Promise<void> {
  try {
    await beforeSend();
  } catch {
    throw new RetryableReminderError();
  }

  try {
    await sendMessage(botToken, chatId, text, keyboard);
  } catch (error) {
    if (
      error instanceof TelegramApiError &&
      error.status === 429 &&
      error.retryAfterSeconds !== undefined
    ) {
      throw new DeferredTelegramRateLimit(error.retryAfterSeconds);
    }
    throw error;
  }
}
