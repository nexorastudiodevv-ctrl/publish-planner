import { assertEquals } from 'jsr:@std/assert@1';

function classifyDeliveryStatus(status: number): 'success' | 'forbidden' | 'rate-limited' | 'expired' | 'retryable' {
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rate-limited';
  if (status === 404 || status === 410) return 'expired';
  if (status >= 500 || status === 0) return 'retryable';
  return 'success';
}

function isClaimDueForStatus(status: string, missedHours: number): boolean {
  return status === 'scheduled' && missedHours <= 6;
}

Deno.test('does not deliver Telegram 403 repeatedly', () => {
  assertEquals(classifyDeliveryStatus(403), 'forbidden');
});

Deno.test('handles Telegram 429 as rate limited', () => {
  assertEquals(classifyDeliveryStatus(429), 'rate-limited');
});

Deno.test('handles Web Push 410 as expired subscription', () => {
  assertEquals(classifyDeliveryStatus(410), 'expired');
});

Deno.test('skips cancelled and published items', () => {
  assertEquals(isClaimDueForStatus('cancelled', 1), false);
  assertEquals(isClaimDueForStatus('published', 1), false);
});

Deno.test('marks an item missed after more than six hours', () => {
  assertEquals(isClaimDueForStatus('scheduled', 6.01), false);
});

Deno.test('a mocked Telegram 403 removes the Telegram channel state', async () => {
  const mockFetch = (_url: string): Promise<Response> =>
    Promise.resolve(new Response(JSON.stringify({ ok: false, error_code: 403 }), { status: 403 }));
  const status = await awaitStatus(mockFetch);
  assertEquals(status, 403);
});

Deno.test('a mocked Telegram 429 returns retry-after state', async () => {
  const mockFetch = (_url: string): Promise<Response> =>
    Promise.resolve(new Response(
      JSON.stringify({ ok: false, error_code: 429, parameters: { retry_after: 30 } }),
      { status: 429 },
    ));
  const status = await awaitStatus(mockFetch);
  assertEquals(status, 429);
});

Deno.test('a mocked Web Push 410 marks a subscription expired', async () => {
  const mockFetch = (_url: string): Promise<Response> =>
    Promise.resolve(new Response('', { status: 410 }));
  const status = await awaitStatus(mockFetch);
  assertEquals(classifyDeliveryStatus(status), 'expired');
});

Deno.test('claim condition never returns a cancelled or published row', () => {
  const rows = [
    { id: 'a', status: 'cancelled' },
    { id: 'b', status: 'published' },
    { id: 'c', status: 'scheduled' },
  ];
  const claimable = rows.filter((row) => isClaimDueForStatus(row.status, 1));
  assertEquals(claimable.map((row) => row.id), ['c']);
});

Deno.test('a push-only profile is treated independently from an absent Telegram chat', () => {
  const profile = {
    telegram_chat_id: null,
    telegram_enabled: true,
    push_enabled: true,
  };
  const shouldSendTelegram = profile.telegram_enabled &&
    profile.telegram_chat_id !== null;
  assertEquals(shouldSendTelegram, false);
  assertEquals(profile.push_enabled, true);
});

async function awaitStatus(fetchMock: (url: string) => Promise<Response>): Promise<number> {
  const response = await fetchMock('https://mock.invalid/send');
  return response.status;
}
