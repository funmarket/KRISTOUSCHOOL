import React from 'react';
import { AlertCircle, Lock, Users } from 'lucide-react';
import { pickText } from '../../../i18n/homepages';
import { RegisterAuditTrailPanel } from './RegisterAuditTrailPanel';
import { RegisterHeaderControls } from './RegisterHeaderControls';
import { RegisterRosterTable } from './RegisterRosterTable';
import { useStaffAttendanceRegister } from './useStaffAttendanceRegister';

export interface StaffAttendanceRegisterPanelProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export const StaffAttendanceRegisterPanel: React.FC<StaffAttendanceRegisterPanelProps> = ({
  onDirtyChange,
}) => {
  const reg = useStaffAttendanceRegister({ onDirtyChange });
  const {
    currentUser,
    language,
    t,
    isTeacher,
    isOffice,
    actorScopeKey,
    classesBackendStatus,
    classesError,
    isHydratingSchoolData,
    refreshSchoolData,
    teacherAssignedClasses,
    officeState,
    officeSyncedData,
    setOfficeReloadSeq,
    visibleRegister,
    showAuditPanel,
  } = reg;

  if (!isTeacher && !isOffice) {
    return (
      <div
        data-testid="staff-attendance-unauthorized"
        className="rounded-3xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-6 flex items-center gap-3 text-xs font-bold text-amber-800 dark:text-amber-300"
      >
        <Lock className="w-4 h-4 shrink-0" />
        <span>{t('unauthorized')}</span>
      </div>
    );
  }

  if (isTeacher && isHydratingSchoolData) {
    return (
      <div
        data-testid="teacher-attendance-context-loading"
        className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-8 text-center text-xs font-bold text-slate-500"
      >
        {t('loading')}
      </div>
    );
  }

  if (isTeacher && classesBackendStatus === 'UNAUTHORIZED') {
    return (
      <div
        data-testid="teacher-attendance-context-unauthorized"
        role="alert"
        className="rounded-3xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-6 flex items-center gap-3 text-xs font-bold text-amber-800 dark:text-amber-300"
      >
        <Lock className="w-4 h-4 shrink-0" />
        <span>{classesError || t('unauthorized')}</span>
      </div>
    );
  }

  if (isTeacher && classesBackendStatus === 'ERROR') {
    return (
      <div
        data-testid="teacher-attendance-context-error"
        role="alert"
        className="rounded-3xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-5 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-red-700 dark:text-red-300"
      >
        <span className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{classesError || t('error')}</span>
        </span>
        <button
          type="button"
          onClick={() => void refreshSchoolData()}
          className="rounded-xl bg-red-700 hover:bg-red-800 px-3 py-1.5 text-white text-xs font-bold"
        >
          {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
        </button>
      </div>
    );
  }

  if (isTeacher && teacherAssignedClasses.length === 0) {
    return (
      <div
        data-testid="teacher-attendance-no-classes"
        className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-6 space-y-2 text-xs"
      >
        <div className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-white">
          <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>
            {pickText(
              {
                ar: 'لا توجد أقسام مسندة لحسابك حالياً',
                fr: 'Aucune classe assignée à votre compte',
                en: 'No assigned classes linked to your account yet',
              },
              language,
            )}
          </span>
        </div>
        <p className="text-slate-500 dark:text-zinc-400">
          {pickText(
            {
              ar: 'ستظهر أقسامك هنا فور إسنادها من قبل إدارة المدرسة لتتمكن من تسجيل الحضور والغياب.',
              fr: 'Vos classes assignées apparaîtront ici dès leur affectation par la direction.',
              en: 'Your assigned classes will appear here once school administration assigns them to you.',
            },
            language,
          )}
        </p>
      </div>
    );
  }

  if (isOffice && (officeState.actorScopeKey !== actorScopeKey || officeState.status === 'LOADING')) {
    return (
      <div
        data-testid="office-attendance-loading"
        className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-8 text-center text-xs font-bold text-slate-500"
      >
        {t('loading')}
      </div>
    );
  }

  if (isOffice && officeState.status !== 'READY') {
    return (
      <div
        data-testid="office-attendance-error"
        role="alert"
        className="rounded-3xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-5 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-red-700 dark:text-red-300"
      >
        <span className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{officeState.errorMessage || t('error')}</span>
        </span>
        <button
          type="button"
          onClick={() => setOfficeReloadSeq((n) => n + 1)}
          className="rounded-xl bg-red-700 hover:bg-red-800 px-3 py-1.5 text-white text-xs font-bold"
        >
          {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
        </button>
      </div>
    );
  }

  if (
    isOffice &&
    officeSyncedData &&
    (officeSyncedData.classes.length === 0 || officeSyncedData.teachers.length === 0)
  ) {
    return (
      <div
        data-testid="office-attendance-empty-setup"
        className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-6 space-y-2 text-xs"
      >
        <div className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-white">
          <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>
            {pickText(
              {
                ar: 'لا توجد أقسام أو مربون مفعّلون في المدرسة بعد',
                fr: 'Aucune classe ou aucun enseignant configuré pour le moment',
                en: 'No school classes or teachers set up yet',
              },
              language,
            )}
          </span>
        </div>
        <p className="text-slate-500 dark:text-zinc-400">
          {pickText(
            {
              ar: 'قم بإنشاء قسم وتعيين مربي في إدارة الأقسام أولاً لفتح سجلات الحضور اليومية.',
              fr: 'Créez d’abord une classe et affectez un enseignant dans la gestion des classes.',
              en: 'Create a class and assign a teacher in Classes management first to oversee daily registers.',
            },
            language,
          )}
        </p>
      </div>
    );
  }

  return (
    <div
      className="space-y-5"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      data-testid={isOffice ? 'office-attendance-workspace' : 'teacher-attendance-workspace'}
    >
      <RegisterHeaderControls
        currentUser={currentUser}
        language={language}
        t={t}
        isTeacher={isTeacher}
        isOffice={isOffice}
        activeClassId={reg.activeClassId}
        activeTeacherUserIdParam={reg.activeTeacherUserIdParam}
        schoolDate={reg.schoolDate}
        teacherAssignedClasses={teacherAssignedClasses}
        officeSyncedData={officeSyncedData}
        officeTeachersForActiveClass={reg.officeTeachersForActiveClass}
        syncedOfficeRegistersPage={reg.syncedOfficeRegistersPage}
        officeHistoryTeacherFilter={reg.officeHistoryTeacherFilter}
        setOfficeHistoryTeacherFilter={reg.setOfficeHistoryTeacherFilter}
        officeHistoryFromDate={reg.officeHistoryFromDate}
        setOfficeHistoryFromDate={reg.setOfficeHistoryFromDate}
        officeHistoryToDate={reg.officeHistoryToDate}
        setOfficeHistoryToDate={reg.setOfficeHistoryToDate}
        officeHistoryOffset={reg.officeHistoryOffset}
        setOfficeHistoryOffset={reg.setOfficeHistoryOffset}
        setOfficeHistoryReloadSeq={reg.setOfficeHistoryReloadSeq}
        registerState={reg.registerState}
        isRegisterScopeSynced={reg.isRegisterScopeSynced}
        isRetryingConflictRefresh={reg.isRetryingConflictRefresh}
        pendingSwitch={reg.pendingSwitch}
        setPendingSwitch={reg.setPendingSwitch}
        applyContextSwitch={reg.applyContextSwitch}
        requestContextSwitch={reg.requestContextSwitch}
        confirmedSavePendingRefresh={reg.confirmedSavePendingRefresh}
        activeRecoveryForScope={reg.activeRecoveryForScope}
        loadRegister={reg.loadRegister}
        discardConflictDraftAndReload={reg.discardConflictDraftAndReload}
      />

      {visibleRegister && (
        <div className="space-y-4">
          <RegisterRosterTable
            visibleRegister={visibleRegister}
            language={language}
            t={t}
            conflictBanner={reg.conflictBanner}
            saveFeedback={reg.saveFeedback}
            activeClassArchived={reg.activeClassArchived}
            markCounts={reg.markCounts}
            actionAvailability={reg.actionAvailability}
            effectiveCanEditFields={reg.effectiveCanEditFields}
            effectiveCanSaveDraft={reg.effectiveCanSaveDraft}
            effectiveCanSubmitOrCorrect={reg.effectiveCanSubmitOrCorrect}
            draftByStudentId={reg.draftByStudentId}
            reasonText={reg.reasonText}
            setReasonText={reg.setReasonText}
            isSaving={reg.isSaving}
            confirmedSavePendingRefresh={reg.confirmedSavePendingRefresh}
            setShowAuditPanel={reg.setShowAuditPanel}
            handleMarkAllRemainingPresent={reg.handleMarkAllRemainingPresent}
            updatePupilMark={reg.updatePupilMark}
            updatePupilComment={reg.updatePupilComment}
            handleSaveOrSubmit={reg.handleSaveOrSubmit}
          />

          {showAuditPanel && visibleRegister.registerId && (
            <RegisterAuditTrailPanel
              visibleRegister={visibleRegister}
              currentUser={currentUser}
              officeSyncedData={officeSyncedData}
              language={language}
              t={t}
              auditState={reg.auditState}
              isAuditScopeSynced={reg.isAuditScopeSynced}
              loadAuditHistory={reg.loadAuditHistory}
            />
          )}
        </div>
      )}
    </div>
  );
};
