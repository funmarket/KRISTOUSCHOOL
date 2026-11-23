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
import { BroadcastFeedSection } from './announcements/BroadcastFeedSection';
import { BroadcastAudienceSelector } from './announcements/BroadcastAudienceSelector';
import { publishSchoolBroadcast } from '../../lib/schoolContent';
import { CANONICAL_SCHOOL_LEVELS } from '../../lib/schoolOperations';
import { SchoolBroadcastItem } from '../../types';
import { Megaphone, Calendar as CalendarIcon, Send, AlertCircle, CheckCircle2 } from 'lucide-react';

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
    return [...byId.values()];
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
    setIsPublic(nextScope === 'PUBLIC_SITE');
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
                <BroadcastAudienceSelector
                  mode="levels"
                  language={language}
                  levels={CANONICAL_SCHOOL_LEVELS}
                  selectedLevelCodes={selectedLevelCodes}
                  onToggleLevel={toggleLevel}
                  availableClasses={availableClasses}
                  selectedClassIds={selectedClassIds}
                  onToggleClass={toggleClass}
                />
              )}

              {audienceScope === 'SELECTED_CLASSES' && (
                <BroadcastAudienceSelector
                  mode="classes"
                  language={language}
                  levels={CANONICAL_SCHOOL_LEVELS}
                  selectedLevelCodes={selectedLevelCodes}
                  onToggleLevel={toggleLevel}
                  availableClasses={availableClasses}
                  selectedClassIds={selectedClassIds}
                  onToggleClass={toggleClass}
                />
              )}
            </form>
          )}

          <BroadcastFeedSection
            language={language}
            broadcasts={broadcasts}
            broadcastsStatus={broadcastsStatus}
            broadcastsError={broadcastsError}
            isHydratingSchoolData={isHydratingSchoolData}
            onRefresh={() => void refreshSchoolData()}
            t={t}
          />
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
