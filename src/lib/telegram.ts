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

/** Returns raw initData for a link attempt; the server verifies both signature and start_param. */
export function getTelegramLinkInitData(): string | null {
  const initData = window.Telegram?.WebApp?.initData;
  if (!initData) return null;
  const startParam = new URLSearchParams(initData).get('start_param');
  return startParam ? initData : null;
}

export function initializeTelegramWebApp(): void {
  const webApp = window.Telegram?.WebApp;
  webApp?.ready?.();
  webApp?.expand?.();
}
