export type TelegramWebAppUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
  start_param?: string;
};

export type ValidatedTelegramInitData = {
  user: TelegramWebAppUser;
  startParam: string | null;
};

const encoder = new TextEncoder();

function hexToBytes(hex: string): ArrayBuffer {
  const buffer = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return buffer;
}

/**
 * Validates Telegram Mini App initData using Telegram's bot-token HMAC scheme.
 * The optional clock arguments make freshness checks deterministic in tests.
 */
export async function validateInitData(
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds = 300,
  allowedFutureSkewSeconds = 30,
): Promise<ValidatedTelegramInitData | null> {
  if (!initData || initData.length > 16_384 || !botToken) return null;

  const params = new URLSearchParams(initData);
  const values = [...params.entries()];
  const seen = new Set<string>();
  for (const [key] of values) {
    if (seen.has(key)) return null;
    seen.add(key);
  }

  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return null;

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const derivationKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const secretKey = await crypto.subtle.sign('HMAC', derivationKey, encoder.encode(botToken));
  const validationKey = await crypto.subtle.importKey(
    'raw',
    secretKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const isValid = await crypto.subtle.verify(
    'HMAC',
    validationKey,
    hexToBytes(hash),
    encoder.encode(dataCheckString),
  );
  if (!isValid) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isSafeInteger(authDate) || authDate <= 0) return null;
  if (nowSeconds - authDate > maxAgeSeconds || authDate - nowSeconds > allowedFutureSkewSeconds) return null;

  const rawUser = params.get('user');
  if (!rawUser) return null;
  let user: TelegramWebAppUser;
  try {
    user = JSON.parse(rawUser) as TelegramWebAppUser;
  } catch {
    return null;
  }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) return null;

  return { user, startParam: params.get('start_param') };
}
