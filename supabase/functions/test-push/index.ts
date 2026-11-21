import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(),
  });
}

function corsHeaders(): Record<string, string> {
  // يُستبدل بعد نشر الدومين بمصدر الواجهة الإنتاجي عبر APP_ORIGIN.
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
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT');
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!url || !anonKey || !serviceRoleKey || !publicKey || !privateKey || !subject || !token) {
    return json({ error: 'configuration_missing' }, 500);
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: 'unauthorized' }, 401);

  const service = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: subscriptions, error } = await service
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, failure_count')
    .eq('user_id', authData.user.id);
  if (error) return json({ error: 'subscriptions_lookup_failed' }, 500);

  webpush.setVapidDetails(subject, publicKey, privateKey);
  let sent = 0;
  for (const subscription of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify({
          title: 'منظّم النشر',
          body: 'هذا تنبيه تجريبي — تنبيهات التطبيق تعمل بنجاح ✅',
          tag: 'publish-planner-test',
          data: { url: '/' },
        }),
        { TTL: 3600, urgency: 'high' },
      );
      sent += 1;
      await service
        .from('push_subscriptions')
        .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
        .eq('id', subscription.id);
    } catch (error) {
      const statusCode = error instanceof Error && 'statusCode' in error
        ? Number((error as Error & { statusCode?: number }).statusCode ?? 0)
        : 0;
      if (statusCode === 404 || statusCode === 410) {
        await service.from('push_subscriptions').delete().eq('id', subscription.id);
      } else if (statusCode === 429 || statusCode === 0 || statusCode >= 500) {
        const failureCount = (subscription as { failure_count?: number }).failure_count ?? 0;
        if (failureCount + 1 >= 5) {
          await service.from('push_subscriptions').delete().eq('id', subscription.id);
        } else {
          await service
            .from('push_subscriptions')
            .update({ failure_count: failureCount + 1 })
            .eq('id', subscription.id);
        }
      }
    }
  }
  return json({ sent });
});
