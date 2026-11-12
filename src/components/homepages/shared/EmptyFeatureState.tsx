import React from 'react';
import { CardAvailabilityState } from '../../../types';
import { useApp } from '../../../context/AppContext';

export interface EmptyFeatureStateProps {
  title: string;
  description: string;
  state?: CardAvailabilityState;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
}

export const EmptyFeatureState: React.FC<EmptyFeatureStateProps> = ({
  title,
  description,
  state = 'COMING_SOON',
  actionLabel,
  onAction,
  onClose,
}) => {
  const { theme, language } = useApp();

  const badgeLabels: Record<CardAvailabilityState, { ar: string; fr: string; en: string }> = {
    AVAILABLE: { ar: 'متاح', fr: 'Disponible', en: 'Available' },
    AVAILABLE_READ_ONLY: { ar: 'قراءة فقط', fr: 'Lecture seule', en: 'Read-only' },
    COMING_SOON: { ar: 'قريباً', fr: 'Bientôt disponible', en: 'Coming soon' },
    UNAUTHORIZED: { ar: 'غير مصرح', fr: 'Accès restreint', en: 'Restricted' },
    BLOCKED_BACKEND: {
      ar: 'بانتظار ربط الخادم (Supabase)',
      fr: 'En attente du contrat serveur Supabase',
      en: 'Awaiting verified backend contract',
    },
  };

  const closeLabels = {
    ar: 'إغلاق',
    fr: 'Fermer',
    en: 'Dismiss',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mt-4 rounded-2xl border p-4 sm:p-5 transition-all ${
        theme === 'pitch-black'
          ? 'bg-[#0C0C0C] border-zinc-800 text-zinc-100'
          : 'bg-slate-50 border-slate-200 text-slate-800'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
              {badgeLabels[state][language]}
            </span>
            <h3 className="text-base font-extrabold">{title}</h3>
          </div>
          <p
            className={`text-sm leading-relaxed ${
              theme === 'pitch-black' ? 'text-zinc-400' : 'text-slate-600'
            }`}
          >
            {description}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="rounded-xl bg-[#0D8AE8] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#0B76C7]"
            >
              {actionLabel}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                theme === 'pitch-black'
                  ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-900'
                  : 'border-slate-300 text-slate-700 hover:bg-white'
              }`}
            >
              {closeLabels[language]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
