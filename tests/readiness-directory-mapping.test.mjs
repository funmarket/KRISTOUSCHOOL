import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.__KRISTOU_SUPABASE_URL__ = '';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = '';

const { listPublicDirectory } = await import('../src/lib/schoolContent.ts');

function directoryClient(rows, error = null) {
  return {
    from(table) {
      assert.equal(table, 'directory_entries');
      return {
        select(columns) {
          assert.ok(columns.includes('languages') && columns.includes('is_published'));
          return {
            async order(field, options) {
              assert.equal(field, 'sort_order');
              assert.deepEqual(options, { ascending: true });
              return { data: rows, error };
            },
          };
        },
      };
    },
  };
}

test('actual directory adapter preserves both Teacher and Administration languages/publication', async () => {
  const rows = [
    {
      id: 'teach-1', entry_type: 'TEACHER', display_name: 'Teacher One',
      title: 'Teacher', photo_url: '/assets/kristou-logo.png', bio: 'Approved biography',
      tags: ['CP'], languages: ['AR', 'FR'], is_published: true,
    },
    {
      id: 'admin-1', entry_type: 'ADMIN', display_name: 'Admin One',
      title: 'Director', photo_url: null, bio: 'Public information',
      tags: ['Coordination'], languages: ['FR', 'EN'], is_published: false,
      private_contact: 'MUST_NOT_LEAK',
    },
  ];
  const result = await listPublicDirectory(directoryClient(rows));
  assert.equal(result.ok, true);
  assert.deepEqual(result.data?.teachers[0].languages, ['AR', 'FR']);
  assert.deepEqual(result.data?.admins[0].languages, ['FR', 'EN']);
  assert.equal(result.data?.admins[0].isPublished, false);
  assert.deepEqual(result.data?.admins[0].responsibilities, ['Coordination']);
  assert.equal(result.data?.admins[0].photoUrl, '/assets/kristou-logo.png');
  assert.equal(JSON.stringify(result.data).includes('MUST_NOT_LEAK'), false, 'private columns never enter the public projection');
});

test('missing optional directory arrays remain empty, with no language or bio fabricated', async () => {
  const result = await listPublicDirectory(directoryClient([
    { id: 'admin-empty', entry_type: 'ADMIN', display_name: 'Admin Two', title: 'Office', is_published: true },
    { id: 'teach-empty', entry_type: 'TEACHER', display_name: 'Teacher Two', title: 'Teacher', is_published: true },
  ]));
  assert.equal(result.ok, true);
  assert.deepEqual(result.data?.admins[0].languages, []);
  assert.deepEqual(result.data?.teachers[0].languages, []);
  assert.equal(result.data?.admins[0].bio, '');
  assert.deepEqual(result.data?.admins[0].responsibilities, []);
});

test('Directory read errors are not silently converted to an empty successful list', async () => {
  const networkClient = { from() { throw new Error('Failed to fetch'); } };
  const result = await listPublicDirectory(networkClient);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'ERROR');
  assert.equal(result.data, undefined);
});
