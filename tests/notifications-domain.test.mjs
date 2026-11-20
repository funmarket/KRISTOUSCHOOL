import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.__KRISTOU_SUPABASE_URL__ = 'https://example.supabase.co';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = 'test-publishable-key';

const {
  listMyNotifications,
  markNotificationReadOnServer,
  markAllNotificationsReadOnServer,
} = await import('../src/lib/domains/notifications.ts');

function listClient(rows, error = null) {
  return {
    from(table) {
      assert.equal(table, 'user_notifications');
      return {
        select(columns) {
          assert.equal(
            columns,
            'id, category, title, body, target_tab, target_ref_id, is_read, created_at',
          );
          return {
            order(field, options) {
              assert.equal(field, 'created_at');
              assert.deepEqual(options, { ascending: false });
              return {
                async limit(value) {
                  assert.equal(value, 40);
                  return { data: rows, error };
                },
              };
            },
          };
        },
      };
    },
  };
}

test('listMyNotifications fails closed on malformed required notification fields', async () => {
  for (const row of [
    {
      category: 'MESSAGE',
      title: 'Missing id',
      body: 'Body',
      is_read: false,
      created_at: '2026-11-20T10:00:00Z',
    },
    {
      id: 'notif-1',
      category: 'MESSAGE',
      title: 'Missing created_at',
      body: 'Body',
      is_read: false,
    },
    {
      id: 'notif-2',
      category: 'MESSAGE',
      title: 'Malformed read flag',
      body: 'Body',
      is_read: 'false',
      created_at: '2026-11-20T10:00:00Z',
    },
  ]) {
    const result = await listMyNotifications(listClient([row]));
    assert.equal(result.ok, false);
    assert.equal(result.status, 'ERROR');
  }
});

test('listMyNotifications preserves a valid server row without fabricating nullable fields', async () => {
  const result = await listMyNotifications(listClient([
    {
      id: 'notif-1',
      category: 'MESSAGE',
      title: 'Message received',
      body: 'Hello',
      target_tab: null,
      target_ref_id: null,
      is_read: false,
      created_at: '2026-11-20T10:15:30Z',
    },
  ]));

  assert.equal(result.ok, true);
  assert.equal(result.data?.[0].id, 'notif-1');
  assert.equal(result.data?.[0].read, false);
  assert.equal(result.data?.[0].targetTab, null);
  assert.equal(result.data?.[0].targetRefId, null);
  assert.equal(result.data?.[0].time, '2026-11-20 10:15');
});

test('markNotificationReadOnServer rejects blank notification id without calling RPC', async () => {
  let calls = 0;
  const client = {
    rpc: async () => {
      calls += 1;
      return { data: true, error: null };
    },
  };

  const result = await markNotificationReadOnServer('   ', client);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'ERROR');
  assert.equal(result.errorCode, 'invalid_notification_id');
  assert.equal(calls, 0);
});

test('markNotificationReadOnServer rejects malformed non-boolean RPC success responses', async () => {
  for (const data of [{}, 1, 'false']) {
    const client = { rpc: async () => ({ data, error: null }) };
    const result = await markNotificationReadOnServer('notif-1', client);
    assert.equal(result.ok, false);
    assert.equal(result.status, 'ERROR');
  }
});

test('markNotificationReadOnServer preserves valid true and false boolean RPC responses', async () => {
  for (const data of [true, false]) {
    const client = {
      rpc: async (name, args) => {
        assert.equal(name, 'mark_user_notification_read');
        assert.deepEqual(args, { p_notification_id: 'notif-1' });
        return { data, error: null };
      },
    };
    const result = await markNotificationReadOnServer(' notif-1 ', client);
    assert.equal(result.ok, true);
    assert.equal(result.data, data);
  }
});

test('markAllNotificationsReadOnServer rejects malformed counts instead of coercing them', async () => {
  for (const data of ['3', null, -1, 1.5, {}, Number.NaN]) {
    const client = { rpc: async () => ({ data, error: null }) };
    const result = await markAllNotificationsReadOnServer(client);
    assert.equal(result.ok, false);
    assert.equal(result.status, 'ERROR');
  }
});

test('markAllNotificationsReadOnServer accepts only non-negative integer counts', async () => {
  for (const data of [0, 3]) {
    const client = {
      rpc: async (name) => {
        assert.equal(name, 'mark_all_user_notifications_read');
        return { data, error: null };
      },
    };
    const result = await markAllNotificationsReadOnServer(client);
    assert.equal(result.ok, true);
    assert.equal(result.data, data);
  }
});
