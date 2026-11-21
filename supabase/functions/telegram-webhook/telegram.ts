import type { TelegramInlineKeyboard, TelegramMessage } from '../_shared/types.ts';

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  error_code?: number;
  parameters?: { retry_after?: number };
};

type SentMessage = Pick<TelegramMessage, 'message_id' | 'chat'>;

export class TelegramApiError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(`telegram_api_${status}`);
    this.name = 'TelegramApiError';
  }
}

async function callTelegramApi<T>(
  botToken: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });

  let result: TelegramApiResponse<T>;
  try {
    result = await response.json() as TelegramApiResponse<T>;
  } catch {
    throw new TelegramApiError(response.status);
  }

  if (!response.ok || !result.ok) {
    throw new TelegramApiError(
      result.error_code ?? response.status,
      result.parameters?.retry_after,
    );
  }
  if (result.result === undefined) {
    throw new TelegramApiError(response.status);
  }
  return result.result;
}

export function sendMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: TelegramInlineKeyboard,
): Promise<SentMessage> {
  return callTelegramApi<SentMessage>(botToken, 'sendMessage', {
    chat_id: chatId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  await callTelegramApi<boolean>(botToken, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

export async function editMessageReplyMarkup(
  botToken: string,
  chatId: number,
  messageId: number,
  replyMarkup: TelegramInlineKeyboard,
): Promise<void> {
  await callTelegramApi<TelegramMessage>(botToken, 'editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  });
}

export async function editMessageText(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: TelegramInlineKeyboard,
): Promise<void> {
  await callTelegramApi<TelegramMessage>(botToken, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}
