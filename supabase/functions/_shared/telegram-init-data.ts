export type TelegramWebAppUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

const encoder = new TextEncoder();

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Validates Telegram WebApp initData using Telegram's bot-token HMAC scheme.
 * The optional clock argument keeps freshness checks deterministic in tests.
 */
export async function validateInitData(
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<TelegramWebAppUser | null> {
  const params = new URLSearchParams(initData);
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
  if (!Number.isFinite(authDate) || nowSeconds - authDate > 300) return null;

  const rawUser = params.get('user');
  if (!rawUser) return null;
  try {
    return JSON.parse(rawUser) as TelegramWebAppUser;
  } catch {
    return null;
  }
}
