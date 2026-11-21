export type ContentType = 'video' | 'reel' | 'post' | 'story';
export type Platform =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'x'
  | 'linkedin'
  | 'snapchat'
  | 'telegram'
  | 'other';
export type ContentStatus = 'scheduled' | 'published' | 'cancelled';

export type ContentItem = {
  id: string;
  user_id: string;
  title: string;
  content_type: ContentType;
  platform: Platform;
  scheduled_at: string;
  remind_before_minutes: number;
  note: string | null;
  status: ContentStatus;
  reminder_sent_at: string | null;
  pre_reminder_sent_at: string | null;
  final_reminder_sent_at: string | null;
  reminder_attempts: number;
  last_reminder_error: string | null;
  reminder_missed_at: string | null;
  reminder_claim_type: 'pre' | 'final' | null;
  reminder_claim_token: string | null;
  reminder_claim_until: string | null;
  reminder_claim_chat_id: number | null;
  reminder_last_attempt_at: string | null;
  reminder_next_attempt_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  telegram_chat_id: number | null;
  timezone: string;
  push_enabled: boolean;
  telegram_enabled: boolean;
  created_at: string;
};

export type TelegramLinkCode = {
  code: string;
  user_id: string;
  expires_at: string;
  used_at: string | null;
};

export type TelegramLinkAttempt = {
  chat_id: number;
  window_started_at: string;
  attempts: number;
};

export type PushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_success_at: string | null;
  failure_count: number;
};

export type ReminderDeliveryLog = {
  id: string;
  item_id: string | null;
  user_id: string | null;
  reminder_kind: 'pre' | 'final';
  channel: 'telegram' | 'push' | 'none';
  status: 'sent' | 'failed' | 'skipped';
  error: string | null;
  created_at: string;
};

export type ReminderClaim = Pick<
  ContentItem,
  | 'id'
  | 'user_id'
  | 'title'
  | 'content_type'
  | 'platform'
  | 'scheduled_at'
  | 'remind_before_minutes'
  | 'note'
> & {
  reminder_kind: 'pre' | 'final';
  claim_token: string;
  telegram_chat_id: number;
  timezone: string;
};

export type TelegramItemAction = {
  item_title: string;
  scheduled_at: string;
  action: 'done' | 'snooze15' | 'cancel';
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, 'id'>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      content_items: {
        Row: ContentItem;
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          content_type: ContentType;
          platform: Platform;
          scheduled_at: string;
          remind_before_minutes?: number;
          note?: string | null;
          status?: ContentStatus;
          reminder_sent_at?: string | null;
          pre_reminder_sent_at?: string | null;
          final_reminder_sent_at?: string | null;
          reminder_attempts?: number;
          last_reminder_error?: string | null;
          reminder_missed_at?: string | null;
          reminder_claim_type?: 'pre' | 'final' | null;
          reminder_claim_token?: string | null;
          reminder_claim_until?: string | null;
          reminder_claim_chat_id?: number | null;
          reminder_last_attempt_at?: string | null;
          reminder_next_attempt_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ContentItem>;
        Relationships: [];
      };
      telegram_link_codes: {
        Row: TelegramLinkCode;
        Insert: Partial<TelegramLinkCode> & Pick<TelegramLinkCode, 'user_id'>;
        Update: Partial<TelegramLinkCode>;
        Relationships: [];
      };
      telegram_link_attempts: {
        Row: TelegramLinkAttempt;
        Insert: TelegramLinkAttempt;
        Update: Partial<TelegramLinkAttempt>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: PushSubscription;
        Insert: Partial<PushSubscription> & Pick<PushSubscription, 'user_id' | 'endpoint' | 'p256dh' | 'auth'>;
        Update: Partial<PushSubscription>;
        Relationships: [];
      };
      reminder_send_rate_limit: {
        Row: { singleton: boolean; next_slot_at: string };
        Insert: { singleton?: boolean; next_slot_at?: string };
        Update: { singleton?: boolean; next_slot_at?: string };
        Relationships: [];
      },
      reminder_delivery_log: {
        Row: ReminderDeliveryLog;
        Insert: Partial<ReminderDeliveryLog> & Pick<ReminderDeliveryLog, 'reminder_kind' | 'channel' | 'status'>;
        Update: Partial<ReminderDeliveryLog>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_telegram_link_attempt: {
        Args: { p_chat_id: number };
        Returns: boolean;
      };
      claim_due_reminders: {
        Args: { batch_size: number };
        Returns: ReminderClaim[];
      };
      mark_missed_reminders: {
        Args: Record<string, never>;
        Returns: number;
      };
      finish_reminder_attempt: {
        Args: {
          p_item_id: string;
          p_claim_token: string;
          p_success: boolean;
          p_error?: string | null;
          p_stop_retries?: boolean;
          p_retry_after_seconds?: number | null;
        };
        Returns: boolean;
      };
      reserve_reminder_send_slot: {
        Args: Record<string, never>;
        Returns: string;
      };
      link_telegram_code: {
        Args: { p_code: string; p_chat_id: number };
        Returns: string;
      };
      perform_telegram_item_action: {
        Args: { p_item_id: string; p_user_id: string; p_action: string };
        Returns: TelegramItemAction[];
      };
    };
    Enums: {
      content_type: ContentType;
      platform: Platform;
      content_status: ContentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type TelegramChat = {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel' | string;
};

export type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export type TelegramInlineKeyboardButton = {
  text: string;
  callback_data?: string;
};

export type TelegramInlineKeyboardMarkup = {
  inline_keyboard: TelegramInlineKeyboardButton[][];
};

export type TelegramMessage = {
  message_id: number;
  date: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  reply_markup?: TelegramInlineKeyboardMarkup;
};

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export type TelegramInlineKeyboard = TelegramInlineKeyboardMarkup;
