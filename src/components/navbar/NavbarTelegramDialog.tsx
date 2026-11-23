import React from 'react';
import { Send } from 'lucide-react';
import type { getTelegramLinkCopy } from '../../i18n/telegram-link';

interface NavbarTelegramDialogProps {
  showTelegramLinkDialog: boolean;
  setShowTelegramLinkDialog: (show: boolean) => void;
  telegramLinkUrl: string | null;
  telegramCopy: ReturnType<typeof getTelegramLinkCopy>;
  telegramLinkNotice: 'success' | 'failed' | null;
  dismissTelegramLinkNotice: () => void;
}

export const NavbarTelegramDialog: React.FC<NavbarTelegramDialogProps> = ({
  showTelegramLinkDialog,
  setShowTelegramLinkDialog,
  telegramLinkUrl,
  telegramCopy,
  telegramLinkNotice,
  dismissTelegramLinkNotice,
}) => {
  return (
    <>
      {showTelegramLinkDialog && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowTelegramLinkDialog(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="telegram-link-title"
            className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-[#111111]"
          >
            <h2 id="telegram-link-title" className="text-base font-bold text-gray-900 dark:text-white">
              {telegramCopy.title}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {telegramLinkUrl ? telegramCopy.instructions : telegramCopy.startFailed}
            </p>
            {telegramLinkUrl && (
              <>
                <a
                  href={telegramLinkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1e8bc3]"
                >
                  <Send className="h-4 w-4" />
                  {telegramCopy.open}
                </a>
                <p className="mt-3 text-xs text-gray-500">{telegramCopy.expires}</p>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowTelegramLinkDialog(false)}
              className="mt-4 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
            >
              {telegramCopy.close}
            </button>
          </div>
        </div>
      )}

      {telegramLinkNotice && (
        <div
          className={`fixed bottom-4 left-1/2 z-[80] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-3 rounded-xl border p-4 shadow-xl ${
            telegramLinkNotice === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
          }`}
          role="status"
        >
          <p className="flex-1 text-sm">
            {telegramLinkNotice === 'success' ? telegramCopy.complete : telegramCopy.failed}
          </p>
          <button
            type="button"
            onClick={dismissTelegramLinkNotice}
            aria-label={telegramCopy.close}
            className="text-sm font-semibold"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
};