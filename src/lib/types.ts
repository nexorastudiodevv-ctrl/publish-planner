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

type ContentItemRow = {
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

type ProfileRow = {
  id: string;
  telegram_chat_id: number | null;
  timezone: string;
  push_enabled: boolean;
  telegram_enabled: boolean;
  created_at: string;
};

type TelegramLinkCodeRow = {
  code: string;
  user_id: string;
  expires_at: string;
  used_at: string | null;
};

type PushSubscriptionRow = {
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

export interface Database {
  public: {
    Tables: {
      content_items: {
        Row: ContentItemRow;
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
        Update: Partial<ContentItemRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: {
          id: string;
          telegram_chat_id?: number | null;
          timezone?: string;
          push_enabled?: boolean;
          telegram_enabled?: boolean;
          created_at?: string;
        };
        Update: {
          timezone?: string;
          push_enabled?: boolean;
          telegram_enabled?: boolean;
        };
        Relationships: [];
      };
      telegram_link_codes: {
        Row: TelegramLinkCodeRow;
        Insert: {
          code?: string;
          user_id: string;
          expires_at?: string;
          used_at?: string | null;
        };
        Update: Partial<TelegramLinkCodeRow>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          last_success_at?: string | null;
          failure_count?: number;
        };
        Update: Partial<PushSubscriptionRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      content_type: ContentType;
      platform: Platform;
      content_status: ContentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type ContentItem = ContentItemRow;
export type Profile = ProfileRow;
export type TelegramLinkCode = TelegramLinkCodeRow;
export type ContentItemInput = Pick<
  ContentItemRow,
  'title' | 'content_type' | 'platform' | 'scheduled_at' | 'remind_before_minutes' | 'note'
>;
