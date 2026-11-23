import React from 'react';
import { BookOpen, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { CommunitySubTab } from '../../types';
import { pickText } from '../../i18n/homepages';
import { canAccessAppTab } from '../homepages/homepageAccess';
import { SchoolCalendarPanel } from './Shared/SchoolCalendarPanel';
import { ParentNotesPanel } from './Shared/ParentNotesPanel';
import { useClassCommunityView } from './class-community/useClassCommunityView';
import { ClassAnnouncementsTab, ClassHomeworkTab } from './class-community/ClassAnnouncementsHomeworkTabs';
import { ClassQuestionsTab } from './class-community/ClassQuestionsTab';
import { ClassDocumentsTab, ClassGalleryTab } from './class-community/ClassDocumentsGalleryTab';

export interface ClassCommunityViewProps {
  initialSubTab?: CommunitySubTab;
}

export const ClassCommunityView: React.FC<ClassCommunityViewProps> = ({
  initialSubTab = 'announcements',
}) => {
  const vm = useClassCommunityView({ initialSubTab });
  const {
    currentUser,
    activeSubTab,
    setActiveSubTab,
    actionFeedback,
    communityStatus,
    communityError,
    activeClass,
    accessibleClasses,
    setSelectedClassId,
    calendarPerms,
    scopedCalendarEvents,
    calendarStatus,
    calendarError,
    teacherAssignedClasses,
    allClassOptions,
    isHydratingSchoolData,
    isLoadingClassCommunity,
    refreshSchoolData,
    language,
    t,
  } = vm;

  return (
    <div className="space-y-6 pb-12" data-testid="class-community-view">
      {/* Header card */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-semibold mb-2">
              <BookOpen className="w-3.5 h-3.5" />
              <span>
                {activeClass ? `${t('classActive')}: ${activeClass.name}` : t('school')}
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
              {t('classCommunity')}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              {activeClass
                ? `${t('teacherLabel')} : ${activeClass.teacherName || '—'} • ${t('schoolYear')} ${activeClass.academicYear}`
                : `${t('school')} • ${t('tunis')}`}
            </p>
          </div>

          {/* Sub-tabs */}
          <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveSubTab('announcements')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeSubTab === 'announcements'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {t('announcements')}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('homework')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeSubTab === 'homework'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {t('homework')}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('calendar')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeSubTab === 'calendar'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {t('calendar')}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('questions')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeSubTab === 'questions'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {t('classQuestions')}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('documents')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeSubTab === 'documents'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {language === 'ar' ? 'الوثائق' : language === 'fr' ? 'Documents' : 'Documents'}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('gallery')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeSubTab === 'gallery'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {language === 'ar' ? 'المعرض' : language === 'fr' ? 'Galerie' : 'Gallery'}
            </button>
          </div>
        </div>

        {accessibleClasses.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <span className="text-[11px] font-bold text-gray-500">
              {pickText({ ar: 'اختيار القسم:', fr: 'Classe :', en: 'Active Class:' }, language)}
            </span>
            {accessibleClasses.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => setSelectedClassId(cls.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors ${
                  activeClass?.id === cls.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300'
                }`}
              >
                {cls.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {actionFeedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
            actionFeedback.type === 'error'
              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
          }`}
        >
          {actionFeedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {communityStatus === 'UNAUTHORIZED' && activeSubTab !== 'calendar' && (
        <div
          data-testid="community-unauthorized-banner"
          role="alert"
          className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              {communityError ||
                pickText(
                  {
                    ar: 'غير مصرح بالوصول إلى بيانات هذا القسم.',
                    fr: 'Accès non autorisé au contenu de cette classe.',
                    en: 'Not authorized to access class community content.',
                  },
                  language,
                )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void refreshSchoolData()}
            className="px-3.5 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
          </button>
        </div>
      )}

      {communityStatus === 'ERROR' && activeSubTab !== 'calendar' && (
        <div
          data-testid="community-error-banner"
          role="alert"
          className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-red-800 dark:text-red-300"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {communityError ||
                pickText(
                  {
                    ar: 'تعذر تحميل محتوى مجتمع القسم من الخادم.',
                    fr: 'Impossible de charger les données de la communauté de classe.',
                    en: 'Failed to load class community data from server.',
                  },
                  language,
                )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void refreshSchoolData()}
            className="px-3.5 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
          </button>
        </div>
      )}

      {activeSubTab === 'announcements' && communityStatus !== 'UNAUTHORIZED' && (
        <ClassAnnouncementsTab vm={vm} />
      )}

      {activeSubTab === 'homework' && communityStatus !== 'UNAUTHORIZED' && (
        <ClassHomeworkTab vm={vm} />
      )}

      {activeSubTab === 'calendar' && (
        <div className="space-y-8">
          <SchoolCalendarPanel
            events={scopedCalendarEvents}
            backendStatus={calendarStatus}
            classId={activeClass?.id ?? null}
            canManage={calendarPerms.canManageCalendar}
            canManageCalendar={calendarPerms.canManageCalendar}
            canCreate={calendarPerms.canCreate}
            canCancel={calendarPerms.canCancel}
            canRespond={calendarPerms.canRespond}
            assignedClasses={teacherAssignedClasses}
            allClasses={allClassOptions}
            isLoading={isHydratingSchoolData || isLoadingClassCommunity}
            errorMessage={calendarError}
            onRefresh={refreshSchoolData}
          />

          {currentUser &&
            currentUser.accountStatus === 'APPROVED' &&
            canAccessAppTab(currentUser, 'notes') && (
              <ParentNotesPanel
                classId={activeClass?.id ?? null}
                classNameLabel={activeClass?.name ?? null}
                embeddedUnderCalendar
              />
            )}
        </div>
      )}

      {activeSubTab === 'questions' && communityStatus !== 'UNAUTHORIZED' && (
        <ClassQuestionsTab vm={vm} />
      )}

      {activeSubTab === 'documents' && communityStatus !== 'UNAUTHORIZED' && (
        <ClassDocumentsTab vm={vm} />
      )}

      {activeSubTab === 'gallery' && communityStatus !== 'UNAUTHORIZED' && (
        <ClassGalleryTab vm={vm} />
      )}
    </div>
  );
};
