import React from 'react';
import { Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { pickText } from '../../../i18n/homepages';
import type { useClassCommunityView } from './useClassCommunityView';

export interface ClassAnnouncementsTabProps {
  vm: ReturnType<typeof useClassCommunityView>;
}

export const ClassAnnouncementsTab: React.FC<ClassAnnouncementsTabProps> = ({ vm }) => {
  const {
    language,
    t,
    canModerate,
    activeClass,
    showAnnouncementForm,
    setShowAnnouncementForm,
    annTitle,
    setAnnTitle,
    annBody,
    setAnnBody,
    annPriority,
    setAnnPriority,
    handleCreateAnnouncement,
    submittingAction,
    communityStatus,
    scopedAnnouncements,
  } = vm;

  return (
    <div className="space-y-4">
      {canModerate && activeClass && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowAnnouncementForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {pickText(
                  { ar: 'إعلان للقسم', fr: 'Publier annonce classe', en: 'New Class Announcement' },
                  language,
                )}
              </span>
            </button>
          </div>
          {showAnnouncementForm && (
            <form
              onSubmit={(e) => void handleCreateAnnouncement(e)}
              className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-blue-200 dark:border-blue-900 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder={pickText({ ar: 'عنوان الإعلان', fr: 'Titre', en: 'Announcement title' }, language)}
                  className="sm:col-span-2 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                />
                <select
                  value={annPriority}
                  onChange={(e) => setAnnPriority(e.target.value as 'NORMAL' | 'URGENT')}
                  className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>
              <textarea
                required
                rows={3}
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder={pickText({ ar: 'نص الإعلان...', fr: 'Contenu...', en: 'Message...' }, language)}
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementForm(false)}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  {submittingAction ? t('loading') : t('publish')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {communityStatus === 'BLOCKED_BACKEND' && (
        <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-4 py-2.5 rounded-2xl">
          {pickText(
            {
              ar: 'إعلانات القسم المباشرة بانتظار نشر جداول المجتمع في Supabase.',
              fr: 'Les annonces de classe attendent le déploiement du schéma communautaire Supabase.',
              en: 'Live class announcements are awaiting Supabase community schema deployment.',
            },
            language,
          )}
        </p>
      )}

      {scopedAnnouncements.map((ann) => (
        <div
          key={ann.id}
          className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {ann.authorName} ({ann.authorRole})
            </span>
            <span className="text-xs text-gray-400">{new Date(ann.createdAt).toLocaleDateString()}</span>
          </div>
          <h3 className="font-bold text-base text-gray-900 dark:text-white">{ann.title}</h3>
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{ann.body}</p>
        </div>
      ))}
    </div>
  );
};

export interface ClassHomeworkTabProps {
  vm: ReturnType<typeof useClassCommunityView>;
}

export const ClassHomeworkTab: React.FC<ClassHomeworkTabProps> = ({ vm }) => {
  const {
    language,
    t,
    canModerate,
    activeClass,
    showHomeworkForm,
    setShowHomeworkForm,
    hwTitle,
    setHwTitle,
    hwDesc,
    setHwDesc,
    hwDueDate,
    setHwDueDate,
    handleCreateHomework,
    submittingAction,
    communityStatus,
    scopedHomework,
  } = vm;

  return (
    <div className="space-y-4">
      {canModerate && activeClass && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowHomeworkForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {pickText({ ar: 'إضافة واجب', fr: 'Ajouter un devoir', en: 'Add Homework' }, language)}
              </span>
            </button>
          </div>
          {showHomeworkForm && (
            <form
              onSubmit={(e) => void handleCreateHomework(e)}
              className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-blue-200 dark:border-blue-900 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={hwTitle}
                  onChange={(e) => setHwTitle(e.target.value)}
                  placeholder={pickText({ ar: 'عنوان الواجب', fr: 'Titre du devoir', en: 'Homework title' }, language)}
                  className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                />
                <input
                  type="date"
                  required
                  value={hwDueDate}
                  onChange={(e) => setHwDueDate(e.target.value)}
                  className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                />
              </div>
              <textarea
                rows={2}
                value={hwDesc}
                onChange={(e) => setHwDesc(e.target.value)}
                placeholder={pickText({ ar: 'التعليمات...', fr: 'Consignes...', en: 'Instructions...' }, language)}
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowHomeworkForm(false)}
                  className="px-4 py-2 rounded-xl border text-xs font-semibold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  {submittingAction ? t('loading') : t('save')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {communityStatus === 'BLOCKED_BACKEND' && scopedHomework.length === 0 ? (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-6 rounded-3xl text-center text-xs text-amber-900 dark:text-amber-200 space-y-2">
          <p className="font-bold">
            {pickText(
              { ar: 'الواجبات المنزلية بانتظار التفعيل في الخادم', fr: 'Devoirs en attente du contrat serveur', en: 'Homework Persistence Pending Backend' },
              language,
            )}
          </p>
          <p className="text-[11px]">
            {pickText(
              {
                ar: 'الجدول class_homework_items غير منشور بعد في Supabase.',
                fr: 'La table class_homework_items n’est pas encore déployée sur Supabase.',
                en: 'public.class_homework_items is awaiting deployment on Supabase.',
              },
              language,
            )}
          </p>
        </div>
      ) : scopedHomework.length === 0 ? (
        <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center text-xs text-gray-500">
          {pickText({ ar: 'لا توجد واجبات منشورة حالياً.', fr: 'Aucun devoir publié pour cette classe.', en: 'No homework posted yet.' }, language)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scopedHomework.map((hw) => (
            <div
              key={hw.id}
              className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-xl">
                  {hw.dueDate}
                </span>
                <span className="text-xs text-gray-400">{hw.teacherName}</span>
              </div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">{hw.title}</h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{hw.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
