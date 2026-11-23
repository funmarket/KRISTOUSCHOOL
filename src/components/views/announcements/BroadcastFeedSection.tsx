import React from 'react';
import { pickText } from '../../../i18n/homepages';
import type { Language, SchoolBroadcastItem } from '../../../types';
import { EmptyFeatureState } from '../../homepages/shared/EmptyFeatureState';
import { AlertCircle, Lock } from 'lucide-react';

interface BroadcastFeedSectionProps {
  language: Language;
  broadcasts: SchoolBroadcastItem[];
  broadcastsStatus: string;
  broadcastsError: string | null;
  isHydratingSchoolData: boolean;
  onRefresh: () => void;
  t: (key: 'loading' | 'noItems' | 'urgent') => string;
}

export const BroadcastFeedSection: React.FC<BroadcastFeedSectionProps> = ({
  language,
  broadcasts,
  broadcastsStatus,
  broadcastsError,
  isHydratingSchoolData,
  onRefresh,
  t,
}) => {
  const formatScopeBadge = (ann: SchoolBroadcastItem) => {
    if (ann.audienceScope === 'SELECTED_LEVELS') {
      const levels = ann.targetLevelCodes.join(', ');
      return pickText(
        {
          ar: `مستويات محددة: ${levels}`,
          fr: `Niveaux ciblés : ${levels}`,
          en: `Selected Levels: ${levels}`,
        },
        language,
      );
    }
    if (ann.audienceScope === 'SELECTED_CLASSES') {
      return pickText(
        {
          ar: `أقسام محددة (${ann.targetClassIds.length})`,
          fr: `Classes ciblées (${ann.targetClassIds.length})`,
          en: `Selected Classes (${ann.targetClassIds.length})`,
        },
        language,
      );
    }
    if (ann.audienceScope === 'ALL_CLASSES') {
      return pickText({ ar: 'جميع الأقسام', fr: 'Toutes les classes', en: 'All Classes' }, language);
    }
    if (ann.audienceScope === 'PUBLIC_SITE' || ann.isPublic) {
      return pickText({ ar: 'الموقع العام', fr: 'Site public', en: 'Public Site' }, language);
    }
    return pickText({ ar: 'كل المدرسة', fr: 'Toute l’école', en: 'All School' }, language);
  };

  return (
    <>
      {broadcastsStatus === 'UNAUTHORIZED' && (
        <div
          data-testid="broadcasts-unauthorized-state"
          role="alert"
          className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              {broadcastsError ||
                pickText(
                  {
                    ar: 'غير مصرح بعرض الإعلانات المدرسية.',
                    fr: 'Accès non autorisé aux annonces scolaires.',
                    en: 'Not authorized to view school broadcasts.',
                  },
                  language,
                )}
            </span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
          </button>
        </div>
      )}

      {broadcastsStatus === 'ERROR' && (
        <div
          data-testid="broadcasts-error-state"
          role="alert"
          className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-xs text-red-800 dark:text-red-300"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {broadcastsError ||
                pickText(
                  {
                    ar: 'تعذر تحميل الإعلانات المدرسية من الخادم.',
                    fr: 'Impossible de charger les annonces scolaires.',
                    en: 'Failed to load school broadcasts from server.',
                  },
                  language,
                )}
            </span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
          </button>
        </div>
      )}

      {broadcastsStatus !== 'UNAUTHORIZED' && (
        <>
          {isHydratingSchoolData && broadcasts.length === 0 ? (
            <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center text-xs font-bold text-gray-500">
              {t('loading')}
            </div>
          ) : broadcastsStatus === 'BLOCKED_BACKEND' && broadcasts.length === 0 ? (
            <EmptyFeatureState
              state="BLOCKED_BACKEND"
              title={pickText(
                {
                  ar: 'الإعلانات المدرسية بانتظار التفعيل في الخادم',
                  fr: 'Annonces générales en attente du contrat serveur',
                  en: 'School Broadcasts Pending Backend Deployment',
                },
                language,
              )}
              description={pickText(
                {
                  ar: 'جدول school_broadcasts غير منشور بعد في قاعدة بيانات Supabase.',
                  fr: 'La table public.school_broadcasts n’est pas encore déployée sur Supabase.',
                  en: 'public.school_broadcasts is awaiting deployment on Supabase.',
                },
                language,
              )}
            />
          ) : broadcasts.length === 0 && broadcastsStatus === 'READY' ? (
            <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center text-xs text-gray-500">
              {t('noItems')}
            </div>
          ) : broadcasts.length > 0 ? (
            <div className="space-y-4">
              {broadcasts.map((ann) => (
                <div
                  key={ann.id}
                  className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {ann.priority === 'URGENT' && (
                        <span className="px-2 py-0.5 rounded-lg bg-red-100 text-red-700 text-[10px] font-extrabold uppercase">
                          {t('urgent')}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-bold">
                        {formatScopeBadge(ann)}
                      </span>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                        {ann.authorName}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(ann.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">{ann.title}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{ann.body}</p>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </>
  );
};
