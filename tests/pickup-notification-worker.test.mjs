import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const source = fileURLToPath(new URL('../supabase/functions/pickup-notification-worker/index.ts', import.meta.url));
const bundled = await build({
  entryPoints: [source],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  plugins: [
    {
      name: 'stub-supabase-js',
      setup(builder) {
        builder.onResolve({ filter: /^https:\/\/esm\.sh\/@supabase\/supabase-js/ }, () => ({
          path: 'supabase-stub',
          namespace: 'mock',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
          contents: 'export function createClient(){ throw new Error("unexpected live supabase client"); }',
          loader: 'js',
        }));
      },
    },
  ],
});

const encoded = Buffer.from(bundled.outputFiles[0].contents).toString('base64');
const { handlePickupNotificationWorker, formatPickupNotificationMessage } = await import(
  `data:text/javascript;base64,${encoded}`
);

const SERVICE_KEY = 'test-service-role-key-g7';

function makeWorkerRequest(body, headers = {}, method = 'POST') {
  return new Request('https://edge.invalid/pickup-notification-worker', {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(method === 'POST' && body !== undefined
      ? { body: typeof body === 'string' ? body : JSON.stringify(body) }
      : {}),
  });
}

test('pickup-notification-worker rejects non-POST, unconfigured env, invalid secret, and invalid limits', async () => {
  const getRes = await handlePickupNotificationWorker(makeWorkerRequest(undefined, {}, 'GET'), {
    serviceRoleKey: SERVICE_KEY,
  });
  assert.equal(getRes.status, 405);

  const unconfigured = await handlePickupNotificationWorker(makeWorkerRequest({ limit: 10 }), {});
  assert.equal(unconfigured.status, 503);
  assert.deepEqual(await unconfigured.json(), { error: 'worker_unconfigured' });

  const missingHeader = await handlePickupNotificationWorker(
    makeWorkerRequest({ limit: 10 }, {}),
    { serviceRoleKey: SERVICE_KEY },
  );
  assert.equal(missingHeader.status, 401);
  assert.deepEqual(await missingHeader.json(), { error: 'unauthorized' });

  const badAuth = await handlePickupNotificationWorker(
    makeWorkerRequest({ limit: 10 }, { authorization: 'Bearer wrong-secret' }),
    { serviceRoleKey: SERVICE_KEY },
  );
  assert.equal(badAuth.status, 401);
  assert.deepEqual(await badAuth.json(), { error: 'unauthorized' });

  for (const invalidLimit of [0, -1, 101, '25', 1.5]) {
    const res = await handlePickupNotificationWorker(
      makeWorkerRequest({ limit: invalidLimit }, { authorization: `Bearer ${SERVICE_KEY}` }),
      { serviceRoleKey: SERVICE_KEY, claimBatch: async () => [], acknowledgeDelivery: async () => ({}) },
    );
    assert.equal(res.status, 400, `Limit ${String(invalidLimit)} must return 400`);
  }

  const oversize = await handlePickupNotificationWorker(
    makeWorkerRequest('x'.repeat(5000), { authorization: `Bearer ${SERVICE_KEY}` }),
    { serviceRoleKey: SERVICE_KEY, claimBatch: async () => [], acknowledgeDelivery: async () => ({}) },
  );
  assert.equal(oversize.status, 413);
});

test('formatPickupNotificationMessage renders localized non-empty messages across all 6 languages', () => {
  const events = [
    { eventType: 'pickup.arrival_announced', decision: null },
    { eventType: 'pickup.child_released', decision: null },
    { eventType: 'pickup.early_departure_requested', decision: null },
    { eventType: 'pickup.early_departure_reviewed', decision: 'APPROVED' },
    { eventType: 'pickup.early_departure_reviewed', decision: 'REJECTED' },
    { eventType: 'pickup.early_departure_completed', decision: null },
  ];

  for (const lang of ['ar', 'fr', 'en', 'es', 'de', 'pt']) {
    for (const ev of events) {
      const msg = formatPickupNotificationMessage(
        {
          id: 'outbox-1',
          eventType: ev.eventType,
          sourceId: 'src-1',
          attemptCount: 1,
          createdAt: '2026-11-27T10:00:00Z',
          studentLabel: 'Youssef Ben Ali',
          classLabel: 'CE1-A',
          decision: ev.decision,
          recipients: [],
        },
        lang,
      );
      assert.ok(msg.includes('Youssef Ben Ali (CE1-A)'), `Expected student+class in ${lang}/${ev.eventType}`);
      assert.ok(msg.startsWith('KRISTOU SCHOOL'), `Expected school prefix in ${lang}/${ev.eventType}`);
    }
  }
});

test('pickup-notification-worker dispatches Telegram messages, handles empty recipients, and acks failures cleanly', async () => {
  const ackCalls = [];
  const fetchCalls = [];

  const res = await handlePickupNotificationWorker(
    makeWorkerRequest({ limit: 10 }, { authorization: `Bearer ${SERVICE_KEY}` }),
    {
      serviceRoleKey: SERVICE_KEY,
      botToken: 'bot-token-123',
      claimBatch: async (limit) => {
        assert.equal(limit, 10);
        return [
          {
            id: 'item-delivered',
            eventType: 'pickup.arrival_announced',
            sourceId: 'cycle-1',
            attemptCount: 1,
            createdAt: '2026-11-27T10:00:00Z',
            studentLabel: 'Youssef',
            classLabel: 'CE1-A',
            recipients: [
              { userId: 'u-1', role: 'MANAGER', language: 'fr', telegramUserId: 111001 },
              { userId: 'u-2', role: 'APP_ADMIN', language: 'ar', telegramUserId: 111002 },
            ],
          },
          {
            id: 'item-no-recipients',
            eventType: 'pickup.child_released',
            sourceId: 'cycle-2',
            attemptCount: 1,
            createdAt: '2026-11-27T10:01:00Z',
            studentLabel: 'Salma',
            classLabel: 'CE2-B',
            recipients: [],
          },
          {
            id: 'item-http-fail',
            eventType: 'pickup.early_departure_requested',
            sourceId: 'ed-1',
            attemptCount: 2,
            createdAt: '2026-11-27T10:02:00Z',
            studentLabel: 'Adam',
            classLabel: 'CM1',
            recipients: [
              { userId: 'u-3', role: 'APP_ADMIN', language: 'es', telegramUserId: 111003 },
            ],
          },
        ];
      },
      fetcher: async (url, init) => {
        const body = JSON.parse(String(init?.body || '{}'));
        fetchCalls.push({ url: String(url), body });
        if (body.chat_id === 111003) {
          return new Response('rate limited', { status: 429 });
        }
        return new Response(JSON.stringify({ ok: true, result: { message_id: body.chat_id + 9000 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
      acknowledgeDelivery: async (input) => {
        ackCalls.push(input);
        return { ok: true };
      },
    },
  );

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, claimed: 3, sent: 2, retriedOrFailed: 1 });
  assert.equal(fetchCalls.length, 3);
  assert.match(fetchCalls[0].body.text, /Arrivée signalée/);
  assert.match(fetchCalls[1].body.text, /وصول الولي/);
  assert.match(fetchCalls[2].body.text, /Nueva solicitud de salida anticipada/);

  assert.deepEqual(ackCalls, [
    { outboxId: 'item-delivered', succeeded: true, providerMessageId: '120001,120002' },
    { outboxId: 'item-no-recipients', succeeded: true, providerMessageId: 'no-telegram-recipients' },
    { outboxId: 'item-http-fail', succeeded: false, error: 'telegram_http_429' },
  ]);

  // Missing botToken with non-empty recipients queues retryable failure
  const noTokenAcks = [];
  const noTokenRes = await handlePickupNotificationWorker(
    makeWorkerRequest({}, { authorization: `Bearer ${SERVICE_KEY}` }),
    {
      serviceRoleKey: SERVICE_KEY,
      botToken: '',
      claimBatch: async () => [
        {
          id: 'item-missing-token',
          eventType: 'pickup.child_released',
          sourceId: 'cycle-3',
          attemptCount: 1,
          createdAt: '2026-11-27T10:03:00Z',
          studentLabel: 'Lina',
          classLabel: 'CP',
          recipients: [{ userId: 'u-4', role: 'PARENT', language: 'de', telegramUserId: 111004 }],
        },
      ],
      acknowledgeDelivery: async (input) => {
        noTokenAcks.push(input);
      },
    },
  );
  assert.equal(noTokenRes.status, 200);
  assert.deepEqual(noTokenAcks, [
    { outboxId: 'item-missing-token', succeeded: false, error: 'telegram_bot_token_unconfigured' },
  ]);
});
