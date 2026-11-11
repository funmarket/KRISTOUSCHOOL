import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { validateInitData } from '../../supabase/functions/_shared/telegram-init-data.ts';
import { createTelegramLinkUrl } from '../../src/lib/telegram.ts';

const TEST_ONLY_BOT_TOKEN = 'TEST_ONLY_FAKE_TELEGRAM_BOT_TOKEN';
const NOW_SECONDS = 1_794_352_800;

function makeInitData(fields) {
  const dataCheckString = Object.entries(fields)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(TEST_ONLY_BOT_TOKEN).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const params = new URLSearchParams(fields);
  params.set('hash', hash);
  return params.toString();
}

const validFields = {
  auth_date: String(NOW_SECONDS),
  query_id: 'synthetic-test',
  start_param: 'synthetic-one-time-link-code',
  user: JSON.stringify({ id: 123456789, first_name: 'Test', username: 'test_user' }),
};

test('builds the KRISTOU Mini App direct link with the challenge as startapp', () => {
  const url = new URL(createTelegramLinkUrl('one-time code+value'));
  assert.equal(url.origin, 'https://t.me');
  assert.equal(url.pathname, '/kristouschool_bot/dreambig');
  assert.equal(url.searchParams.get('startapp'), 'one-time code+value');
});

test('accepts valid signed Telegram initData and returns its signed start_param', async () => {
  const result = await validateInitData(makeInitData(validFields), TEST_ONLY_BOT_TOKEN, NOW_SECONDS);
  assert.deepEqual(result, {
    user: { id: 123456789, first_name: 'Test', username: 'test_user' },
    startParam: 'synthetic-one-time-link-code',
  });
});

test('accepts a normal Mini App launch without start_param for linked-account lookup', async () => {
  const { start_param: _startParam, ...fields } = validFields;
  const result = await validateInitData(makeInitData(fields), TEST_ONLY_BOT_TOKEN, NOW_SECONDS);
  assert.equal(result?.user.id, 123456789);
  assert.equal(result?.startParam, null);
});

test('rejects a tampered signed user payload', async () => {
  const valid = makeInitData(validFields);
  const tampered = valid.replace('first_name%22%3A%22Test', 'first_name%22%3A%22Mallory');
  assert.notEqual(tampered, valid);
  assert.equal(await validateInitData(tampered, TEST_ONLY_BOT_TOKEN, NOW_SECONDS), null);
});

test('rejects missing or malformed hashes', async () => {
  const valid = makeInitData(validFields);
  assert.equal(await validateInitData(valid.slice(0, valid.lastIndexOf('&hash=')), TEST_ONLY_BOT_TOKEN, NOW_SECONDS), null);
  assert.equal(await validateInitData(`${valid.slice(0, valid.lastIndexOf('hash='))}hash=bad`, TEST_ONLY_BOT_TOKEN, NOW_SECONDS), null);
});

test('rejects stale and future-dated signed initData', async () => {
  assert.equal(await validateInitData(makeInitData({ ...validFields, auth_date: String(NOW_SECONDS - 301) }), TEST_ONLY_BOT_TOKEN, NOW_SECONDS), null);
  assert.equal(await validateInitData(makeInitData({ ...validFields, auth_date: String(NOW_SECONDS + 31) }), TEST_ONLY_BOT_TOKEN, NOW_SECONDS), null);
});

test('rejects duplicate parameters and invalid Telegram user identifiers', async () => {
  const valid = makeInitData(validFields);
  assert.equal(await validateInitData(`${valid}&start_param=attacker`, TEST_ONLY_BOT_TOKEN, NOW_SECONDS), null);
  const invalidUser = makeInitData({ ...validFields, user: JSON.stringify({ id: '123456789' }) });
  assert.equal(await validateInitData(invalidUser, TEST_ONLY_BOT_TOKEN, NOW_SECONDS), null);
});
