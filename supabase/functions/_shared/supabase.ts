import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { Database } from './types.ts';

export type ServiceClient = SupabaseClient<Database>;

export function createServiceClient(url: string, serviceRoleKey: string): ServiceClient {
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
