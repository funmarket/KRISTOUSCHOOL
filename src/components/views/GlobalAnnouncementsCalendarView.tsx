import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { pickText } from '../../i18n/homepages';
import {
  canAccessAppTab,
  canManageBroadcastsUi,
  getCalendarPermissionsUi,
  resolveTeacherAssignedClasses,
} from '../homepages/homepageAccess';
import { EmptyFeatureState } from '../homepages/shared/EmptyFeatureState';
import { SchoolCalendarPanel } from './Shared/SchoolCalendarPanel';
import { ParentNotesPanel } from './Shared/ParentNotesPanel';
import { publishSchoolBroadcast } from '../../lib/schoolContent';
import { CANONICAL_SCHOOL_LEVELS } from '../../lib/schoolOperations';
import { SchoolBroadcastItem } from '../../types';
import { Megaphone, Calendar as CalendarIcon, Send, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

export interface GlobalAnnouncementsCalendarViewProps {
  initialSubTab?: 'broadcasts' | 'calendar';
}

export const GlobalAnnouncementsCalendarView: React.FC<GlobalAnnouncementsCalendarViewProps> = ({
  initialSubTab = 'broadcasts',
}) => {
  const {
    currentUser,
    language,
    broadcasts,
    broadcastsStatus,
    broadcastsError,
    calendarEvents,
    calendarStatus,
    calendarError,
    isHydratingSchoolData,
    classRosters,
    classesList,
    refreshSchoolData,
    t,
  } = useApp();

  const [subTab, setSubTab] = useState<'broadcasts' | 'calendar'>(initialSubTab);

  React.useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [audienceScope, setAudienceScope] = useState<SchoolBroadcastItem['audienceScope']>('ALL_SCHOOL');
  const [selectedLevelCodes, setSelectedLevelCodes] = useState<string[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const availableClasses = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; level?: string }>();
    for (const c of classRosters) {
      byId.set(c.id, { id: c.id, name: c.name, level: c.level });
    }
    for (const c of classesList) {
      if (!byId.has(c.id)) {
        byId.set(c.id, { id: c.id, name: c.name, level: c.level });
      }
    }
    return Array.from(byId.values());
  }, [classRosters, classesList]);

  const teacherAssignedClasses = useMemo(
    () =>
      currentUser?.role === 'TEACHER'
        ? resolveTeacherAssignedClasses(currentUser, availableClasses)
        : [],
    [currentUser, availableClasses],
  );

  if (!canAccessAppTab(currentUser, 'announcements')) {
    return (
      <EmptyFeatureState
        state="UNAUTHORIZED"
        title={t('unauthorized')}
        description={t('loginRequired')}
      />
    );
  }

  const canBroadcast = canManageBroadcastsUi(currentUser);
  const calendarPerms = getCalendarPermissionsUi(currentUser, {
    classId: null,
    assignedClassIds: teacherAssignedClasses.map((c) => c.id),
  });

  const handleScopeChange = (nextScope: SchoolBroadcastItem['audienceScope']) => {
    setAudienceScope(nextScope);
    if (nextScope === 'PUBLIC_SITE') {
      setIsPublic(true);
    } else {
      setIsPublic(false);
    }
  };

  const handlePublicToggle = (checked: boolean) => {
    setIsPublic(checked);
    if (checked) {
      setAudienceScope('PUBLIC_SITE');
    } else if (audienceScope === 'PUBLIC_SITE') {
      setAudienceScope('ALL_SCHOOL');
    }
  };

  const toggleLevel = (code: string) => {
    setSelectedLevelCodes((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code],
    );
  };

  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((item) => item !== classId) : [...prev, classId],
    );
  };

  const handlePublishBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const effectiveScope = isPublic ? 'PUBLIC_SITE' : audienceScope;
    setSubmitting(true);
    const res = await publishSchoolBroadcast({
      title,
      body,
      priority,
      audienceScope: effectiveScope,
      isPublic: effectiveScope === 'PUBLIC_SITE',
      targetLevelCodes: effectiveScope === 'SELECTED_LEVELS' ? selectedLevelCodes : [],
      targetClassIds: effectiveScope === 'SELECTED_CLASSES' ? selectedClassIds : [],
    });
    setSubmitting(false);
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.errorMessage || t('error') });
      return;
    }
    setTitle('');
    setBody('');
    setSelectedLevelCodes([]);
    setSelectedClassIds([]);
    setFeedback({
      type: 'success',
      text: pickText(
        {
          ar: 'تم نشر الإعلان المدرسي بنجاح.',
          fr: 'Annonce scolaire publiée.',
          en: 'School broadcast published.',
        },
        language,
      ),
    });
    await refreshSchoolData();
  };

  const formatLevelLabel = (code: string) => {
    const match = CANONICAL_SCHOOL_LEVELS.find((l) => l.code === code);
    if (!match) return code;
    return language === 'ar' ? match.labelAr : language === 'fr' ? match.labelFr : match.labelEn;
  };

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
    <div className="space-y-6 pb-12" data-testid="global-announcements-calendar-view">
      {/* Header */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
            {t('announcements')} & {t('calendar')}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {pickText(
              {
                ar: 'الإعلانات المدرسية الرسمية والتقويم العام للمؤسسة.',
                fr: 'Communications officielles et calendrier général de l’école.',
                en: 'Official school-wide announcements and school campus calendar.',
              },
              language,
            )}
          </p>
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => setSubTab('broadcasts')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === 'broadcasts'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>{t('announcements')}</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('calendar')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === 'calendar'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>{t('calendar')}</span>
          </button>
        </div>
      </div>

      {subTab === 'broadcasts' && (
        <div className="space-y-5">
          {canBroadcast && broadcastsStatus !== 'UNAUTHORIZED' && (
            <form
              onSubmit={handlePublishBroadcast}
              className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4"
            >
              <h2 className="font-bold text-sm text-gray-900 dark:text-white">
                {pickText(
                  { ar: 'نشر إعلان مدرسي عام', fr: 'Publier une annonce générale', en: 'Publish School Broadcast' },
                  language,
                )}
              </h2>
              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    feedback.type === 'error'
                      ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  }`}
                >
                  {feedback.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  <span>{feedback.text}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={pickText({ ar: 'عنوان الإعلان', fr: 'Titre', en: 'Title' }, language)}
                  className="sm:col-span-2 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                />
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'NORMAL' | 'URGENT')}
                  className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="URGENT">{t('urgent')}</option>
                </select>
              </div>
              <textarea
                required
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={pickText(
                  { ar: 'نص الإعلان...', fr: 'Contenu de l’annonce...', en: 'Announcement message...' },
                  language,
                )}
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <select
                    value={audienceScope}
                    onChange={(e) =>
                      handleScopeChange(e.target.value as SchoolBroadcastItem['audienceScope'])
                    }
                    className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                    data-testid="broadcast-audience-scope"
                  >
                    <option value="ALL_SCHOOL">
                      {pickText({ ar: 'كل المدرسة (ALL_SCHOOL)', fr: 'Toute l’école (ALL_SCHOOL)', en: 'All School (ALL_SCHOOL)' }, language)}
                    </option>
                    <option value="ALL_CLASSES">
                      {pickText({ ar: 'جميع الأقسام (ALL_CLASSES)', fr: 'Toutes les classes (ALL_CLASSES)', en: 'All Classes (ALL_CLASSES)' }, language)}
                    </option>
                    <option value="SELECTED_LEVELS">
                      {pickText({ ar: 'مستويات محددة (SELECTED_LEVELS)', fr: 'Niveaux ciblés (SELECTED_LEVELS)', en: 'Selected Levels (SELECTED_LEVELS)' }, language)}
                    </option>
                    <option value="SELECTED_CLASSES">
                      {pickText({ ar: 'أقسام محددة (SELECTED_CLASSES)', fr: 'Classes ciblées (SELECTED_CLASSES)', en: 'Selected Classes (SELECTED_CLASSES)' }, language)}
                    </option>
                    <option value="PUBLIC_SITE">
                      {pickText({ ar: 'الموقع العام (PUBLIC_SITE)', fr: 'Site public (PUBLIC_SITE)', en: 'Public Site (PUBLIC_SITE)' }, language)}
                    </option>
                  </select>
                  <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => handlePublicToggle(e.target.checked)}
                    />
                    <span>
                      {pickText(
                        { ar: 'عرض على الموقع العام', fr: 'Afficher sur le site public', en: 'Show on Public Site' },
                        language,
                      )}
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? t('loading') : t('publish')}</span>
                </button>
              </div>

              {audienceScope === 'SELECTED_LEVELS' && (
                <div
                  className="p-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 space-y-2"
                  data-testid="broadcast-level-selector"
                >
                  <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                    {pickText(
                      {
                        ar: 'اختر المستويات المستهدفة:',
                        fr: 'Sélectionnez les niveaux ciblés :',
                        en: 'Select target school levels:',
                      },
                      language,
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CANONICAL_SCHOOL_LEVELS.map((lvl) => {
                      const active = selectedLevelCodes.includes(lvl.code);
                      return (
                        <label
                          key={lvl.code}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                            active
                              ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                              : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleLevel(lvl.code)}
                          />
                          <span>{formatLevelLabel(lvl.code)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {audienceScope === 'SELECTED_CLASSES' && (
                <div
                  className="p-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 space-y-2"
                  data-testid="broadcast-class-selector"
                >
                  <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                    {pickText(
                      {
                        ar: 'اختر الأقسام المستهدفة:',
                        fr: 'Sélectionnez les classes ciblées :',
                        en: 'Select target classes:',
                      },
                      language,
                    )}
                  </p>
                  {availableClasses.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      {pickText(
                        {
                          ar: 'لا توجد أقسام متاحة حالياً.',
                          fr: 'Aucune classe active disponible.',
                          en: 'No active classes loaded.',
                        },
                        language,
                      )}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableClasses.map((cls) => {
                        const active = selectedClassIds.includes(cls.id);
                        return (
                          <label
                            key={cls.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                              active
                                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={() => toggleClass(cls.id)}
                            />
                            <span>
                              {cls.name} ({cls.level})
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </form>
          )}

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
                onClick={() => void refreshSchoolData()}
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
                onClick={() => void refreshSchoolData()}
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
        </div>
      )}

      {subTab === 'calendar' && (
        <div className="space-y-8">
          <SchoolCalendarPanel
            events={calendarEvents}
            backendStatus={calendarStatus}
            classId={null}
            canManage={calendarPerms.canManageCalendar}
            canManageCalendar={calendarPerms.canManageCalendar}
            canCreate={calendarPerms.canCreate}
            canCancel={calendarPerms.canCancel}
            canRespond={calendarPerms.canRespond}
            assignedClasses={teacherAssignedClasses}
            allClasses={availableClasses}
            isLoading={isHydratingSchoolData}
            errorMessage={calendarError}
            onRefresh={refreshSchoolData}
          />

          {currentUser &&
            currentUser.accountStatus === 'APPROVED' &&
            canAccessAppTab(currentUser, 'notes') && (
              <ParentNotesPanel embeddedUnderCalendar />
            )}
        </div>
      )}
    </div>
  );
};
