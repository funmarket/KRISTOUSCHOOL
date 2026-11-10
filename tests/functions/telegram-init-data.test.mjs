import assert from 'node:assert/strict';
import test from 'node:test';
import { validateInitData } from '../../supabase/functions/_shared/telegram-init-data.ts';

const TEST_ONLY_BOT_TOKEN = 'TEST_ONLY_FAKE_TELEGRAM_BOT_TOKEN';
const NOW_SECONDS = 1794352800;
const VALID_INIT_DATA = 'auth_date=1794352800&query_id=synthetic-test&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Test%22%2C%22username%22%3A%22test_user%22%7D&hash=377ccb43c6af7648c1a776d821c950e6494f155489bb0877345267b72e0a194d';
const STALE_INIT_DATA = 'auth_date=1794350000&query_id=synthetic-test&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Test%22%2C%22username%22%3A%22test_user%22%7D&hash=842a146c25f86abb833428cc726ca6bb63b0b4c6b3a49262ee0d403dd76cffb2';

test('accepts a valid synthetic Telegram WebApp initData signature', async () => {
  const user = await validateInitData(VALID_INIT_DATA, TEST_ONLY_BOT_TOKEN, NOW_SECONDS);
  assert.deepEqual(user, {
    id: 123456789,
    first_name: 'Test',
    username: 'test_user',
  });
});

test('rejects initData whose signed user payload was modified', async () => {
  const tampered = VALID_INIT_DATA.replace('%22first_name%22%3A%22Test%22', '%22first_name%22%3A%22Mallory%22');
  assert.notEqual(tampered, VALID_INIT_DATA);
  assert.equal(await validateInitData(tampered, TEST_ONLY_BOT_TOKEN, NOW_SECONDS), null);
});

test('rejects initData without a hash', async () => {
  const withoutHash = VALID_INIT_DATA.slice(0, VALID_INIT_DATA.lastIndexOf('&hash='));
  assert.equal(await validateInitData(withoutHash, TEST_ONLY_BOT_TOKEN, NOW_SECONDS), null);
});

test('rejects a correctly signed initData payload older than the five-minute window', async () => {
  assert.equal(await validateInitData(STALE_INIT_DATA, TEST_ONLY_BOT_TOKEN, NOW_SECONDS), null);
});
