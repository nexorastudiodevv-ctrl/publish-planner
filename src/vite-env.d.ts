/// <reference types="vite/client" />
declare module 'virtual:pwa-register' {
  export function registerSW(options?: {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
  }): void;
}

interface ImportMetaEnv {
  readonly VITE_TELEGRAM_BOT_USERNAME?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
