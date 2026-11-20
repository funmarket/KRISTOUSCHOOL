import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.__KRISTOU_SUPABASE_URL__ = 'https://example.supabase.co';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = 'test-publishable-key';

const {
  listFoodMenus,
  saveFoodMenuWeek,
} = await import('../src/lib/domains/foodMenu.ts');

function listClient({ weeks, weekError = null, days = [], dayError = null }) {
  return {
    from(table) {
      if (table === 'food_menu_weeks') {
        return {
          select(columns) {
            assert.equal(columns, 'id, week_range, status, provider_name, created_at');
            return {
              async order(field, options) {
                assert.equal(field, 'created_at');
                assert.deepEqual(options, { ascending: false });
                return { data: weeks, error: weekError };
              },
            };
          },
        };
      }

      if (table === 'food_menu_days') {
        return {
          select(columns) {
            assert.equal(columns, '*');
            return {
              in(field, ids) {
                assert.equal(field, 'menu_week_id');
                assert.deepEqual(ids, ['week-1']);
                return {
                  async order(orderField, options) {
                    assert.equal(orderField, 'day_order');
                    assert.deepEqual(options, { ascending: true });
                    return { data: days, error: dayError };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

test('listFoodMenus propagates food_menu_days query errors instead of returning READY', async () => {
  const result = await listFoodMenus(listClient({
    weeks: [{
      id: 'week-1',
      week_range: '23–27 Nov',
      status: 'PUBLISHED',
      provider_name: 'La Toque Gourmande',
      created_at: '2026-11-20T12:00:00Z',
    }],
    dayError: { code: 'PGRST500', message: 'day query failed' },
  }));

  assert.equal(result.ok, false);
  assert.notEqual(result.status, 'READY');
});

test('listFoodMenus never marks real database rows as demo previews', async () => {
  const result = await listFoodMenus(listClient({
    weeks: [{
      id: 'week-1',
      week_range: '23–27 Nov',
      status: 'PUBLISHED',
      provider_name: 'La Toque Gourmande',
      created_at: '2026-11-20T12:00:00Z',
    }],
    days: [{
      menu_week_id: 'week-1',
      day_order: 1,
      day_label: 'Monday',
      starter: 'Salad',
      main_dish: 'Couscous',
      side_dish: '',
      dessert: 'Fruit',
      notes: null,
    }],
  }));

  assert.equal(result.ok, true);
  assert.equal(result.data?.[0].published, true);
  assert.equal(result.data?.[0].isDemoPreview, false);
});

test('saveFoodMenuWeek fails closed when successful RPC payload has no non-empty id', async () => {
  for (const data of [{}, { id: '' }, { id: '   ' }, null]) {
    const client = {
      rpc: async (name, args) => {
        assert.equal(name, 'save_food_menu_week');
        assert.equal(args.p_week_range, '23–27 Nov');
        assert.equal(args.p_publish, true);
        return { data, error: null };
      },
    };

    const result = await saveFoodMenuWeek(
      ' 23–27 Nov ',
      [{ day: 'Monday', starter: 'Salad', main: 'Couscous', side: '', dessert: 'Fruit' }],
      true,
      client,
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, 'ERROR');
  }
});

test('saveFoodMenuWeek preserves a valid server id', async () => {
  const client = {
    rpc: async () => ({ data: { id: 'week-1' }, error: null }),
  };

  const result = await saveFoodMenuWeek(
    '23–27 Nov',
    [{ day: 'Monday', starter: 'Salad', main: 'Couscous', side: '', dessert: 'Fruit' }],
    false,
    client,
  );

  assert.equal(result.ok, true);
  assert.equal(result.data?.id, 'week-1');
});
