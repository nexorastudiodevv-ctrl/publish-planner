import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type {
  Database,
  TelegramCallbackQuery,
  TelegramInlineKeyboard,
  TelegramMessage,
  TelegramUpdate,
} from '../_shared/types.ts';
import {
  consumeLinkAttempt,
  getProfileByChatId,
  getRecentScheduledItems,
  getScheduledForDay,
  getUpcomingItems,
  linkTelegramCode,
  performTelegramItemAction,
  type TelegramItemAction,
  unlinkProfileByChatId,
} from './db.ts';
import {
  formatItem,
  formatScheduledAt,
  getTodayUtcRange,
  helpMessage,
  safeTimezone,
  startInstructions,
} from './format.ts';
import { answerCallbackQuery, editMessageText, sendMessage } from './telegram.ts';

type ServiceClient = SupabaseClient<Database>;

type CommandContext = {
  client: ServiceClient;
  botToken: string;
  message: TelegramMessage;
};

const commandPattern = /^\/([a-zA-Z0-9_]+)(?:@[a-zA-Z0-9_]+)?(?:\s+([\s\S]*))?$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function reply(context: CommandContext, text: string): Promise<void> {
  await sendMessage(context.botToken, context.message.chat.id, text);
}

async function sendItemList(
  context: CommandContext,
  heading: string,
  items: string[],
): Promise<void> {
  let chunk = heading;
  for (const item of items) {
    if (chunk.length + item.length + 2 > 3500 && chunk !== heading) {
      await reply(context, chunk);
      chunk = 'تكملة المواعيد:\n\n';
    }
    chunk += `\n\n${item}`;
  }
  await reply(context, chunk);
}

async function handleStart(context: CommandContext, payload: string): Promise<void> {
  const chatId = context.message.chat.id;
  if (context.message.chat.type !== 'private') {
    await reply(context, 'لأمان حسابك، ابدأ الربط في محادثة خاصة مع البوت.');
    return;
  }

  const linkedProfile = await getProfileByChatId(context.client, chatId);
  if (linkedProfile && !payload) {
    await reply(context, 'مرحبًا بعودتك! حسابك مربوط بمنظّم النشر. أرسل /help لعرض الأوامر.');
    return;
  }

  if (!linkedProfile && !payload) {
    await reply(context, startInstructions());
    return;
  }

  const withinLimit = await consumeLinkAttempt(context.client, chatId);
  if (!withinLimit) {
    await reply(context, 'وصلت إلى حد محاولات الربط. انتظر دقيقة ثم حاول مجددًا.');
    return;
  }

  const code = payload.trim();
  if (!/^[a-zA-Z0-9_-]{8}$/.test(code)) {
    await reply(context, 'كود الربط يجب أن يتكون من 8 خانات. أنشئ كودًا جديدًا من صفحة الإعدادات.');
    return;
  }

  const result = await linkTelegramCode(context.client, code.toLowerCase(), chatId);
  switch (result) {
    case 'linked':
      await reply(
        context,
        'أهلًا بك! تم ربط حسابك بنجاح 🎉\nأرسل /today لمواعيد اليوم أو /help لعرض الأوامر.',
      );
      return;
    case 'invalid':
      await reply(context, 'كود الربط غير صحيح. راجعه أو أنشئ كودًا جديدًا من صفحة الإعدادات.');
      return;
    case 'expired':
      await reply(context, 'انتهت صلاحية كود الربط. أنشئ كودًا جديدًا من صفحة الإعدادات.');
      return;
    case 'used':
      await reply(context, 'تم استخدام هذا الكود من قبل. أنشئ كودًا جديدًا من صفحة الإعدادات.');
      return;
    case 'chat_already_linked':
      await reply(context, 'هذه المحادثة مرتبطة بالفعل بحساب آخر. أرسل /unlink قبل ربط حساب مختلف.');
      return;
    case 'profile_unavailable':
      await reply(context, 'تعذر إكمال الربط. سجّل الدخول إلى الموقع وأنشئ كودًا جديدًا.');
      return;
  }
}

async function requireLinkedProfile(context: CommandContext) {
  if (context.message.chat.type !== 'private') {
    await reply(context, 'استخدم أوامر منظّم النشر في محادثة خاصة مع البوت.');
    return null;
  }

  const profile = await getProfileByChatId(context.client, context.message.chat.id);
  if (!profile) {
    await reply(context, `${startInstructions()}\n\nأرسل /help لعرض الأوامر.`);
    return null;
  }
  return profile;
}

async function handleToday(context: CommandContext): Promise<void> {
  const profile = await requireLinkedProfile(context);
  if (!profile) return;

  const timezone = safeTimezone(profile.timezone);
  const range = getTodayUtcRange(timezone);
  const items = await getScheduledForDay(context.client, profile.id, range.start, range.end);
  if (items.length === 0) {
    await reply(context, 'لا توجد مواعيد مجدولة لليوم. يومك هادئ 🌿');
    return;
  }

  const lines = items.map((item) => formatItem(item, timezone));
  await sendItemList(context, 'مواعيدك اليوم:', lines);
}

async function handleUpcoming(context: CommandContext): Promise<void> {
  const profile = await requireLinkedProfile(context);
  if (!profile) return;

  const items = await getUpcomingItems(context.client, profile.id, new Date().toISOString());
  if (items.length === 0) {
    await reply(context, 'لا توجد مواعيد قادمة حاليًا.');
    return;
  }

  const lines = items.map((item, index) => formatItem(item, safeTimezone(profile.timezone), index));
  await reply(context, `أقرب مواعيدك القادمة:\n\n${lines.join('\n\n')}`);
}

async function handleDoneList(context: CommandContext): Promise<void> {
  const profile = await requireLinkedProfile(context);
  if (!profile) return;

  const items = await getRecentScheduledItems(context.client, profile.id);
  if (items.length === 0) {
    await reply(context, 'لا توجد مواعيد مجدولة لتحديثها.');
    return;
  }

  const inlineKeyboard: TelegramInlineKeyboard = {
    inline_keyboard: items.map((item) => [
      { text: `تم النشر ✅ · ${item.title.slice(0, 45)}`, callback_data: `done:${item.id}` },
    ]),
  };
  const text = items
    .map((item, index) => formatItem(item, safeTimezone(profile.timezone), index))
    .join('\n\n');

  await sendMessage(
    context.botToken,
    context.message.chat.id,
    `اختر الموعد الذي نُشر:\n\n${text}`,
    inlineKeyboard,
  );
}

async function handleUnlink(context: CommandContext): Promise<void> {
  if (context.message.chat.type !== 'private') {
    await reply(context, 'يمكنك فك الربط من المحادثة الخاصة مع البوت فقط.');
    return;
  }

  const wasLinked = await unlinkProfileByChatId(context.client, context.message.chat.id);
  await reply(
    context,
    wasLinked
      ? 'تم فك ربط تيليجرام عن حسابك. يمكنك ربطه مجددًا من صفحة الإعدادات.'
      : 'لا يوجد حساب مرتبط بهذه المحادثة حاليًا.',
  );
}

export async function handleMessage(
  client: ServiceClient,
  botToken: string,
  message: TelegramMessage,
): Promise<void> {
  if (!message.text) return;

  const context: CommandContext = { client, botToken, message };
  const match = commandPattern.exec(message.text.trim());
  if (!match) {
    await reply(context, 'لم أفهم رسالتك. أرسل /help لمعرفة الأوامر المتاحة.');
    return;
  }

  const command = match[1].toLowerCase();
  const payload = (match[2] ?? '').trim();

  switch (command) {
    case 'start':
      await handleStart(context, payload);
      return;
    case 'help': {
      const profile = message.chat.type === 'private'
        ? await getProfileByChatId(client, message.chat.id)
        : null;
      await reply(context, helpMessage(profile !== null));
      return;
    }
    case 'today':
      await handleToday(context);
      return;
    case 'upcoming':
      await handleUpcoming(context);
      return;
    case 'done':
      await handleDoneList(context);
      return;
    case 'unlink':
      await handleUnlink(context);
      return;
    default:
      await reply(context, 'الأمر غير معروف. أرسل /help لعرض الأوامر المتاحة.');
  }
}

export async function handleCallbackQuery(
  client: ServiceClient,
  botToken: string,
  callback: TelegramCallbackQuery,
): Promise<void> {
  const message = callback.message;
  const match = /^(done|snooze15|cancel):([0-9a-f-]{36})$/i.exec(callback.data ?? '');
  if (!message || !match || !uuidPattern.test(match[2])) {
    await answerCallbackQuery(botToken, callback.id, 'تعذر تحديد الموعد.');
    return;
  }

  if (message.chat.type !== 'private') {
    await answerCallbackQuery(botToken, callback.id, 'استخدم الزر في المحادثة الخاصة مع البوت.');
    return;
  }

  let action: TelegramItemAction;
  switch (match[1].toLowerCase()) {
    case 'done':
      action = 'done';
      break;
    case 'snooze15':
      action = 'snooze15';
      break;
    case 'cancel':
      action = 'cancel';
      break;
    default:
      await answerCallbackQuery(botToken, callback.id, 'هذا الإجراء غير متاح.');
      return;
  }

  const profile = await getProfileByChatId(client, message.chat.id);
  if (!profile) {
    await answerCallbackQuery(botToken, callback.id, 'هذه المحادثة غير مرتبطة بحساب.');
    return;
  }

  const result = await performTelegramItemAction(client, profile.id, match[2], action);
  if (!result) {
    await answerCallbackQuery(botToken, callback.id, 'الموعد لم يعد مجدولًا أو لا يخص الحساب المرتبط.');
    return;
  }

  const title = result.item_title.slice(0, 180);
  const updatedText = result.action === 'done'
    ? `✅ تم تسجيل «${title}» كمنشور.`
    : result.action === 'snooze15'
      ? `⏳ تم تأجيل «${title}» 15 دقيقة.\nالموعد الجديد: ${formatScheduledAt(result.scheduled_at, safeTimezone(profile.timezone))}`
      : `❌ تم إلغاء «${title}».`;

  await answerCallbackQuery(
    botToken,
    callback.id,
    result.action === 'done'
      ? 'تم النشر ✅'
      : result.action === 'snooze15'
        ? 'تم التأجيل 15 دقيقة ⏳'
        : 'تم الإلغاء ❌',
  );
  try {
    await editMessageText(
      botToken,
      message.chat.id,
      message.message_id,
      updatedText,
      { inline_keyboard: [] },
    );
  } catch {
    console.error('[telegram-webhook] callback_message_update_failed');
  }
}

export async function handleTelegramUpdate(
  client: ServiceClient,
  botToken: string,
  update: TelegramUpdate,
): Promise<void> {
  if (update.message) {
    await handleMessage(client, botToken, update.message);
    return;
  }
  if (update.callback_query) {
    await handleCallbackQuery(client, botToken, update.callback_query);
  }
}
