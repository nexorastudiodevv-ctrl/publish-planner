import { createClient } from 'npm:@supabase/supabase-js@2';

type ActionBody = { action?: unknown; itemId?: unknown };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(),
  });
}

function corsHeaders(): Record<string, string> {
  const allowedOrigin = Deno.env.get('APP_ORIGIN')?.trim();
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': allowedOrigin || '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
  };
}

Deno.serve(async (request: Request): Promise<Response> => {
  const allowedOrigin = Deno.env.get('APP_ORIGIN')?.trim();
  const requestOrigin = request.headers.get('origin');
  if (allowedOrigin && requestOrigin && requestOrigin !== allowedOrigin) {
    return json({ error: 'origin_not_allowed' }, 403);
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!url || !anonKey || !serviceRoleKey || !token) {
    return json({ error: 'configuration_missing' }, 500);
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: 'unauthorized' }, 401);

  let body: ActionBody;
  try {
    body = await request.json() as ActionBody;
  } catch {
    return json({ error: 'invalid_payload' }, 400);
  }
  if (
    (body.action !== 'done' && body.action !== 'snooze15') ||
    typeof body.itemId !== 'string'
  ) {
    return json({ error: 'invalid_payload' }, 400);
  }

  const service = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await service.rpc('perform_telegram_item_action', {
    p_item_id: body.itemId,
    p_user_id: authData.user.id,
    p_action: body.action,
  });
  if (error) return json({ error: 'action_failed' }, 500);
  if (!data || data.length === 0) return json({ error: 'item_not_found_or_not_owned' }, 404);
  return json({ ok: true, action: body.action });
});
