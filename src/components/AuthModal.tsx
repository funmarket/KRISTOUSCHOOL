import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Send, Lock, User as UserIcon } from 'lucide-react';

export const AuthModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { login, connectTelegram, t } = useApp();
  const [username, setUsername] = useState('parent_karim');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError(t('requiredUsername'));
      return;
    }
    const success = login(username.trim(), password);
    if (success) onClose();
    else setError(t('invalidCredentials'));
  };

  return (
    <div
      className="fixed inset-0 z-[60] min-h-[100dvh] overflow-y-auto bg-black/60 p-4 backdrop-blur-xs sm:p-6"
      role="presentation"
      dir="ltr"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex min-h-[calc(100dvh-2rem)] items-center justify-center py-[max(0.5rem,env(safe-area-inset-top))] sm:min-h-[calc(100dvh-3rem)]">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-[#111111] sm:p-6"
        >
          <button onClick={onClose} aria-label={t('close')} className="absolute end-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>

          <div className="mb-6 px-8 text-center">
            <img src="/assets/kristou-logo.png" alt={t('school')} className="mx-auto mb-3 h-14 w-14 rounded-2xl border border-gray-200 bg-white object-contain p-1 shadow-md dark:border-gray-700 dark:bg-gray-800" />
            <h2 id="auth-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">{t('login')}</h2>
            <p className="mt-1 text-xs text-gray-500">{t('school')}</p>
          </div>

          {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600 dark:bg-red-950/40">{error}</div>}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t('username')}</label>
              <div className="relative">
                <UserIcon className="absolute start-3 top-3 h-4 w-4 text-gray-400" />
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 ps-10 pe-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-k-brand dark:border-gray-800 dark:bg-gray-900 dark:text-white" placeholder="Ex: parent_karim" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t('password')}</label>
              <div className="relative">
                <Lock className="absolute start-3 top-3 h-4 w-4 text-gray-400" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 ps-10 pe-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-k-brand dark:border-gray-800 dark:bg-gray-900 dark:text-white" placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" className="w-full rounded-xl bg-k-brand py-3 text-sm font-semibold text-white shadow-lg shadow-k-brand/25 transition-all hover:bg-k-brand-strong">{t('login')}</button>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-6 text-center dark:border-gray-800">
            <p className="mb-3 text-xs text-gray-500">{t('telegramInitData')}</p>
            <button onClick={() => { connectTelegram(); onClose(); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] py-2.5 text-xs font-semibold text-white shadow-md transition-all hover:bg-[#1e8bc3]">
              <Send className="h-4 w-4" /><span>{t('telegramAccess')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
