import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.__KRISTOU_SUPABASE_URL__ = 'https://example.supabase.co';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = 'test-publishable-key';

const { fetchPublicContent } = await import('../src/lib/domains/publicContent.ts');

function publicContentClient(data, error = null) {
  let publishedFilterCalls = 0;
  return {
    from(table) {
      assert.equal(table, 'school_public_content');
      return {
        select(columns) {
          assert.equal(
            columns,
            'slug, title_ar, title_fr, title_en, body_ar, body_fr, body_en, is_published, updated_at',
          );
          return {
            async eq(column, value) {
              assert.equal(column, 'is_published');
              assert.equal(value, true);
              publishedFilterCalls += 1;
              return { data, error };
            },
          };
        },
      };
    },
    getPublishedFilterCalls() {
      return publishedFilterCalls;
    },
  };
}

function validRow(overrides = {}) {
  return {
    slug: 'hero',
    title_ar: 'مدرسة كريستو',
    title_fr: 'École Kristou',
    title_en: 'Kristou School',
    body_ar: 'وصف',
    body_fr: 'Description',
    body_en: 'Description',
    is_published: true,
    updated_at: '2026-11-20T12:00:00Z',
    ...overrides,
  };
}

test('fetchPublicContent excludes rows unless is_published is explicitly true', async () => {
  for (const isPublished of [false, null, undefined]) {
    const client = publicContentClient([validRow({ slug: 'hidden', is_published: isPublished })]);
    const result = await fetchPublicContent(client);

    assert.equal(result.ok, true);
    assert.deepEqual(result.data, {});
    assert.equal(client.getPublishedFilterCalls(), 1);
  }
});

test('fetchPublicContent skips blank slugs and preserves a valid published row', async () => {
  const result = await fetchPublicContent(publicContentClient([
    validRow({ slug: '   ' }),
    validRow({ slug: 'hero' }),
  ]));

  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.data ?? {}), ['hero']);
  assert.equal(result.data?.hero?.isPublished, true);
  assert.equal(result.data?.hero?.updatedAt, '2026-11-20T12:00:00Z');
});

test('fetchPublicContent fails closed on malformed required server fields', async () => {
  for (const row of [
    validRow({ title_en: undefined }),
    validRow({ body_fr: null }),
    validRow({ updated_at: undefined }),
  ]) {
    const result = await fetchPublicContent(publicContentClient([row]));
    assert.equal(result.ok, false);
    assert.equal(result.status, 'ERROR');
  }
});

test('fetchPublicContent fails closed on non-array successful payloads', async () => {
  const result = await fetchPublicContent(publicContentClient({ slug: 'hero' }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'ERROR');
});

test('fetchPublicContent surfaces query errors instead of fabricating READY content', async () => {
  const result = await fetchPublicContent(
    publicContentClient(null, { code: '42501', message: 'permission denied' }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'UNAUTHORIZED');
});
