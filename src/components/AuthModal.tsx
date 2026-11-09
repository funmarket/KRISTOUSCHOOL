import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Send, Lock, User as UserIcon } from 'lucide-react';

export const AuthModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { login, connectTelegram, t } = useApp();
  const [username, setUsername] = useState('parent_karim');
  const [password, setPassword] = useState('••••••••');
  const [error, setError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      setError('Veuillez entrer un nom d’utilisateur');
      return;
    }
    const success = login(username, password);
    if (success) {
      onClose();
    } else {
      setError('Identifiants incorrects');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#111111] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <img
            src="/public/assets/kristou-logo.png"
            alt="KRISTOU SCHOOL"
            className="w-14 h-14 rounded-2xl object-contain bg-white dark:bg-gray-800 p-1 mx-auto mb-3 shadow-md border border-gray-200 dark:border-gray-700"
          />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('login')}</h2>
          <p className="text-xs text-gray-500 mt-1">École Primaire Privée Kristou School</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 text-red-600 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              {t('username')}
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: parent_karim"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              {t('password')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-lg shadow-blue-500/25 transition-all"
          >
            {t('login')}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-xs text-gray-500 mb-3">Accès rapide Telegram Mini App</p>
          <button
            onClick={() => {
              connectTelegram();
              onClose();
            }}
            className="w-full py-2.5 bg-[#229ED9] hover:bg-[#1e8bc3] text-white font-semibold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-md transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Connexion via Telegram initData</span>
          </button>
        </div>
      </div>
    </div>
  );
};
