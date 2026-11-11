const TELEGRAM_MINI_APP_URL = 'https://t.me/kristouschool_bot/dreambig';

export function createTelegramLinkUrl(linkCode: string): string {
  const url = new URL(TELEGRAM_MINI_APP_URL);
  url.searchParams.set('startapp', linkCode);
  return url.toString();
}

type TelegramWebAppBridge = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebAppBridge };
  }
}

/** Returns raw initData; the server must verify Telegram's signature before using it. */
export function getTelegramWebAppInitData(): string | null {
  const initData = window.Telegram?.WebApp?.initData;
  return initData || null;
}

/** Returns initData only when the Mini App was opened with an explicit linking challenge. */
export function getTelegramLinkInitData(): string | null {
  const initData = getTelegramWebAppInitData();
  if (!initData) return null;
  const startParam = new URLSearchParams(initData).get('start_param');
  return startParam ? initData : null;
}

export function initializeTelegramWebApp(): void {
  const webApp = window.Telegram?.WebApp;
  webApp?.ready?.();
  webApp?.expand?.();
}
