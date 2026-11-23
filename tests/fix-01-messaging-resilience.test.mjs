import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.__KRISTOU_SUPABASE_URL__ = 'https://example.supabase.co';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = 'test-publishable-key';

const { listMessageThreads } = await import('../src/lib/domains/messaging.ts');

function mockClient(threads, participants, messages, recipients) {
  return {
    from(table) {
      if (table === 'message_threads') {
        return {
          select() {
            return {
              order() {
                return Promise.resolve({ data: threads, error: null });
              },
            };
          },
        };
      }
      if (table === 'thread_participants') {
        return {
          select() {
            return {
              in(_col, _vals) {
                return Promise.resolve({ data: participants, error: null });
              },
            };
          },
        };
      }
      if (table === 'thread_messages') {
        return {
          select() {
            return {
              in() {
                return {
                  order() {
                    return Promise.resolve({ data: messages, error: null });
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    rpc(method) {
      if (method === 'list_approved_message_recipients') {
        return Promise.resolve({ data: recipients, error: null });
      }
      throw new Error(`Unexpected RPC: ${method}`);
    },
  };
}

test('FIX-01: listMessageThreads isolates unresolvable participant / missing recipient and loads remaining inbox successfully', async () => {
  const threads = [
    { id: 'thread-1', subject: 'Valid Thread', created_by_user_id: 'user-a', last_message_preview: 'Hello', updated_at: '2026-11-22T10:00:00Z' },
    { id: 'thread-2', subject: 'Unresolvable Participant Thread', created_by_user_id: 'user-a', last_message_preview: 'Orphan', updated_at: '2026-11-22T09:00:00Z' },
  ];
  const participants = [
    { thread_id: 'thread-1', user_id: 'user-a', unread: false },
    { thread_id: 'thread-1', user_id: 'user-b', unread: false },
    { thread_id: 'thread-2', user_id: 'user-a', unread: false },
    { thread_id: 'thread-2', user_id: 'non-existent-user-c', unread: false }, // Missing from approved recipients
  ];
  const messages = [];
  const recipients = [
    { id: 'user-b', fullName: 'Teacher Bob', role: 'TEACHER', schoolYear: '2026' },
  ];

  const client = mockClient(threads, participants, messages, recipients);
  const result = await listMessageThreads('user-a', client);

  assert.equal(result.ok, true, 'Inbox load must succeed even with unresolvable participant');
  assert.equal(result.status, 'READY');
  assert.equal(result.data.length, 2, 'Both threads must be returned');

  // Thread 1 should resolve fully
  assert.equal(result.data[0].id, 'thread-1');
  assert.equal(result.data[0].recipientName, 'Teacher Bob');

  // Thread 2 should degrade gracefully with fallback display metadata
  assert.equal(result.data[1].id, 'thread-2');
  assert.equal(result.data[1].recipientId, 'non-existent-user-c');
  assert.equal(result.data[1].recipientName, 'Member');
  assert.equal(result.data[1].recipientRole, 'SCHOOL_STAFF');
});
