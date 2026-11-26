import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Lock,
  RefreshCw,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { pickText } from '../../../i18n/homepages';
import type { OfficeAttendanceContextResult } from '../../../lib/attendance/api';
import type {
  AttendanceSaveReceipt,
  Language,
  OfficeAttendanceTeacherOption,
  User,
} from '../../../types';
import { RegisterHistorySelector } from './RegisterHistorySelector';
import type {
  PendingContextSwitch,
  ScopedOfficeRegistersState,
} from './useOfficeAttendanceDiscovery';
import type {
  PendingConflictRecovery,
  ScopedRegisterState,
} from './useRegisterDraftAndSave';

export interface RegisterHeaderControlsProps {
  currentUser: User | null;
  language: Language;
  t: (key: any) => string;
  isTeacher: boolean;
  isOffice: boolean;
  activeClassId: string;
  activeTeacherUserIdParam: string;
  schoolDate: string;
  teacherAssignedClasses: Array<{ id: string; name: string; academicYear?: string }>;
  officeSyncedData: OfficeAttendanceContextResult | null;
  officeTeachersForActiveClass: OfficeAttendanceTeacherOption[];
  syncedOfficeRegistersPage: ScopedOfficeRegistersState | null;
  officeHistoryTeacherFilter: string;
  setOfficeHistoryTeacherFilter: (val: string) => void;
  officeHistoryFromDate: string;
  setOfficeHistoryFromDate: (val: string) => void;
  officeHistoryToDate: string;
  setOfficeHistoryToDate: (val: string) => void;
  officeHistoryOffset: number;
  setOfficeHistoryOffset: React.Dispatch<React.SetStateAction<number>>;
  setOfficeHistoryReloadSeq: React.Dispatch<React.SetStateAction<number>>;
  registerState: ScopedRegisterState;
  isRegisterScopeSynced: boolean;
  isRetryingConflictRefresh: boolean;
  pendingSwitch: PendingContextSwitch | null;
  setPendingSwitch: (val: PendingContextSwitch | null) => void;
  applyContextSwitch: (nextSwitch: PendingContextSwitch) => void;
  requestContextSwitch: (nextSwitch: PendingContextSwitch) => void;
  confirmedSavePendingRefresh: AttendanceSaveReceipt | null;
  activeRecoveryForScope: PendingConflictRecovery | null;
  loadRegister: () => Promise<unknown>;
  discardConflictDraftAndReload: () => void;
}

export const RegisterHeaderControls: React.FC<RegisterHeaderControlsProps> = ({
  currentUser,
  language,
  t,
  isTeacher,
  isOffice,
  activeClassId,
  activeTeacherUserIdParam,
  schoolDate,
  teacherAssignedClasses,
  officeSyncedData,
  officeTeachersForActiveClass,
  syncedOfficeRegistersPage,
  officeHistoryTeacherFilter,
  setOfficeHistoryTeacherFilter,
  officeHistoryFromDate,
  setOfficeHistoryFromDate,
  officeHistoryToDate,
  setOfficeHistoryToDate,
  officeHistoryOffset,
  setOfficeHistoryOffset,
  setOfficeHistoryReloadSeq,
  registerState,
  isRegisterScopeSynced,
  isRetryingConflictRefresh,
  pendingSwitch,
  setPendingSwitch,
  applyContextSwitch,
  requestContextSwitch,
  confirmedSavePendingRefresh,
  activeRecoveryForScope,
  loadRegister,
  discardConflictDraftAndReload,
}) => {
  return (
    <>
      <section className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              {t('classLabel')}
            </label>
            {isTeacher ? (
              <select
                aria-label={t('classLabel')}
                data-testid="attendance-teacher-class-select"
                value={activeClassId}
                onChange={(e) => requestContextSwitch({ kind: 'class', classId: e.target.value })}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
              >
                {teacherAssignedClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.academicYear})
                  </option>
                ))}
              </select>
            ) : (
              <select
                aria-label={t('classLabel')}
                data-testid="attendance-office-class-select"
                value={activeClassId}
                onChange={(e) => requestContextSwitch({ kind: 'class', classId: e.target.value })}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
              >
                {(officeSyncedData?.classes ?? []).map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.academicYear})
                    {cls.isArchived
                      ? ` — [${pickText({ ar: 'مؤرشف', fr: 'Archivée', en: 'Archived', es: 'Archivada', de: 'Archiviert', pt: 'Arquivada' }, language)}]`
                      : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {isOffice ? (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                {pickText({ ar: 'المربي المسؤول', fr: 'Enseignant responsable', en: 'Responsible Teacher', es: 'Docente responsable', de: 'Verantwortliche Lehrkraft', pt: 'Professor responsável' }, language)}
              </label>
              <select
                aria-label={pickText({ ar: 'المربي المسؤول', fr: 'Enseignant responsable', en: 'Responsible Teacher', es: 'Docente responsable', de: 'Verantwortliche Lehrkraft', pt: 'Professor responsável' }, language)}
                data-testid="attendance-office-teacher-select"
                value={activeTeacherUserIdParam}
                onChange={(e) => requestContextSwitch({ kind: 'teacher', teacherUserId: e.target.value })}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
              >
                {officeTeachersForActiveClass.map((tOpt) => {
                  const tags: string[] = [];
                  if (tOpt.hasActiveAssignmentInClass[activeClassId]) {
                    tags.push(pickText({ ar: 'مكلف حالياً', fr: 'Assigné', en: 'Assigned', es: 'Asignado', de: 'Zugewiesen', pt: 'Atribuído' }, language));
                  }
                  if (tOpt.hasSavedRegisterInClass[activeClassId]) {
                    tags.push(pickText({ ar: 'له سجل محفوظ', fr: 'Registres existants', en: 'Has Registers', es: 'Con registros', de: 'Mit Registern', pt: 'Com registos' }, language));
                  }
                  if (tOpt.accountStatus && tOpt.accountStatus !== 'APPROVED') tags.push(tOpt.accountStatus);
                  return (
                    <option key={tOpt.userId} value={tOpt.userId}>
                      {tOpt.fullName}
                      {tags.length > 0 ? ` (${tags.join(' • ')})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                {pickText({ ar: 'المربي المسؤول', fr: 'Enseignant responsable', en: 'Responsible Teacher', es: 'Docente responsable', de: 'Verantwortliche Lehrkraft', pt: 'Professor responsável' }, language)}
              </span>
              <div className="min-h-[44px] rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/50 px-3 py-2 flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-zinc-200">
                <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="truncate">{currentUser?.fullName}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              {pickText({ ar: 'تاريخ اليوم الدراسي (تونس)', fr: 'Date scolaire (Africa/Tunis)', en: 'School Date (Africa/Tunis)', es: 'Fecha escolar (Africa/Tunis)', de: 'Schuldatum (Africa/Tunis)', pt: 'Data escolar (Africa/Tunis)' }, language)}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="School Date"
                data-testid="attendance-school-date-input"
                value={schoolDate}
                onChange={(e) => {
                  if (e.target.value) requestContextSwitch({ kind: 'date', schoolDate: e.target.value });
                }}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3 py-2 text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-white"
              />
              <button
                type="button"
                data-testid="attendance-refresh-btn"
                onClick={() => void loadRegister()}
                disabled={(registerState.status === 'LOADING' && isRegisterScopeSynced) || isRetryingConflictRefresh}
                className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                title={pickText({ ar: 'إعادة قراءة من الخادم', fr: 'Recharger depuis le serveur', en: 'Reload from server', es: 'Recargar desde el servidor', de: 'Vom Server neu laden', pt: 'Recarregar do servidor' }, language)}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {isOffice && activeClassId && (
          <RegisterHistorySelector
            language={language}
            t={t}
            activeClassId={activeClassId}
            activeTeacherUserIdParam={activeTeacherUserIdParam}
            schoolDate={schoolDate}
            officeSyncedData={officeSyncedData}
            officeTeachersForActiveClass={officeTeachersForActiveClass}
            syncedOfficeRegistersPage={syncedOfficeRegistersPage}
            officeHistoryTeacherFilter={officeHistoryTeacherFilter}
            setOfficeHistoryTeacherFilter={setOfficeHistoryTeacherFilter}
            officeHistoryFromDate={officeHistoryFromDate}
            setOfficeHistoryFromDate={setOfficeHistoryFromDate}
            officeHistoryToDate={officeHistoryToDate}
            setOfficeHistoryToDate={setOfficeHistoryToDate}
            officeHistoryOffset={officeHistoryOffset}
            setOfficeHistoryOffset={setOfficeHistoryOffset}
            setOfficeHistoryReloadSeq={setOfficeHistoryReloadSeq}
            requestContextSwitch={requestContextSwitch}
          />
        )}
      </section>

      {pendingSwitch && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="attendance-dirty-switch-dialog"
          className="rounded-3xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-5 space-y-3"
        >
          <div className="flex items-start gap-2.5 text-xs font-bold text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-extrabold">
                {pickText({ ar: 'لديك تعديلات غير محفوظة في سجل الحضور الحالي.', fr: 'Vous avez des modifications non enregistrées dans ce registre.', en: 'You have unsaved changes in the current attendance register.', es: 'Tiene cambios sin guardar en el registro de asistencia actual.', de: 'Sie haben ungespeicherte Änderungen im aktuellen Klassenbuch.', pt: 'Tem alterações não guardadas no registo de assiduidade atual.' }, language)}
              </p>
              <p className="font-normal text-amber-800 dark:text-amber-300">
                {pickText({ ar: 'تبديل القسم أو التاريخ أو المربي سيؤدي إلى تجاهل التعديلات غير المحفوظة.', fr: 'Changer de classe, de date ou d’enseignant ignorera vos modifications non enregistrées.', en: 'Switching class, date, or responsible teacher will discard unsaved edits.', es: 'Cambiar de clase, fecha o docente responsable descartará los cambios sin guardar.', de: 'Das Wechseln von Klasse, Datum oder Lehrkraft verwirft ungespeicherte Änderungen.', pt: 'Mudar de turma, data ou professor responsável descartará as alterações não guardadas.' }, language)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="attendance-discard-switch-btn"
              onClick={() => applyContextSwitch(pendingSwitch)}
              className="min-h-[40px] rounded-xl bg-amber-700 hover:bg-amber-800 px-4 py-2 text-xs font-bold text-white"
            >
              {pickText({ ar: 'تجاهل التعديلات والمتابعة', fr: 'Ignorer et continuer', en: 'Discard & Switch', es: 'Descartar y cambiar', de: 'Verwerfen & wechseln', pt: 'Descartar e mudar' }, language)}
            </button>
            <button
              type="button"
              onClick={() => setPendingSwitch(null)}
              className="min-h-[40px] rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 px-4 py-2 text-xs font-bold text-amber-900 dark:text-amber-200"
            >
              {pickText({ ar: 'البقاء والمتابعة', fr: 'Rester ici', en: 'Keep Editing', es: 'Seguir editando', de: 'Weiter bearbeiten', pt: 'Continuar a editar' }, language)}
            </button>
          </div>
        </div>
      )}

      {confirmedSavePendingRefresh && (
        <div
          role="alert"
          data-testid="attendance-save-refresh-failed-banner"
          className="rounded-3xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200"
        >
          <p className="font-extrabold">
            {pickText({ ar: `تم تأكيد الحفظ (النسخة ${confirmedSavePendingRefresh.version})، بانتظار تحديث القراءة.`, fr: `Sauvegarde confirmée (v${confirmedSavePendingRefresh.version}), lecture actualisée requise.`, en: `Save confirmed on server (v${confirmedSavePendingRefresh.version}), waiting for fresh readback.`, es: `Guardado confirmado en el servidor (v${confirmedSavePendingRefresh.version}), esperando lectura actualizada.`, de: `Speichern auf Server bestätigt (v${confirmedSavePendingRefresh.version}), warte auf Aktualisierung.`, pt: `Gravação confirmada no servidor (v${confirmedSavePendingRefresh.version}), a aguardar atualização.` }, language)}
          </p>
          <button
            type="button"
            data-testid="attendance-reload-readback-btn"
            onClick={() => void loadRegister()}
            className="min-h-[40px] rounded-xl bg-amber-700 hover:bg-amber-800 px-4 py-2 text-xs font-bold text-white inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{pickText({ ar: 'تحديث القراءة', fr: 'Actualiser la lecture', en: 'Refresh Readback', es: 'Actualizar lectura', de: 'Anzeige aktualisieren', pt: 'Atualizar leitura' }, language)}</span>
          </button>
        </div>
      )}

      {(!isRegisterScopeSynced || registerState.status === 'LOADING') && (
        <div
          data-testid="attendance-register-loading"
          className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-8 text-center text-xs font-bold text-slate-500"
        >
          {t('loading')}
        </div>
      )}

      {isRegisterScopeSynced && registerState.status === 'UNAUTHORIZED' && (
        <div
          data-testid="attendance-register-unauthorized"
          role="alert"
          className="rounded-3xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-5 flex items-center gap-3 text-xs font-bold text-amber-800 dark:text-amber-300"
        >
          <Lock className="w-4 h-4 shrink-0" />
          <span>{registerState.errorMessage || t('unauthorized')}</span>
        </div>
      )}

      {isRegisterScopeSynced && registerState.status === 'BLOCKED_BACKEND' && (
        <div
          data-testid="attendance-register-blocked"
          className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-6 text-xs font-semibold text-slate-600 dark:text-zinc-300"
        >
          {registerState.errorMessage}
        </div>
      )}

      {isRegisterScopeSynced && registerState.status === 'ERROR' && (
        <div
          data-testid="attendance-register-error"
          role="alert"
          className="rounded-3xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-5 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-red-700 dark:text-red-300"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{registerState.errorMessage || t('error')}</span>
          </span>
          <button
            type="button"
            onClick={() => void loadRegister()}
            className="rounded-xl bg-red-700 hover:bg-red-800 px-3 py-1.5 text-white text-xs font-bold"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
          </button>
        </div>
      )}

      {activeRecoveryForScope && (
        <div
          role="alert"
          data-testid="attendance-conflict-refresh-failed-banner"
          className="rounded-3xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2 font-extrabold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                {activeRecoveryForScope.conflictKind === 'roster_conflict'
                  ? pickText({ ar: 'تغيرت قائمة القسم أثناء الحفظ، وتعذر تحديث أحدث نسخة من الخادم بعد.', fr: 'La liste de la classe a changé pendant l’enregistrement et l’actualisation serveur a échoué.', en: 'The class roster changed during save, and refreshing the latest register failed.', es: 'La lista de la clase cambió al guardar y falló la actualización del registro.', de: 'Die Klassenliste hat sich beim Speichern geändert und das Neuladen ist fehlgeschlagen.', pt: 'A lista da turma mudou ao guardar e falhou a atualização do registo.' }, language)
                  : pickText({ ar: 'تم تحديث السجل في جلسة أخرى، وتعذر قراءة النسخة الأحدث من الخادم بعد.', fr: 'Ce registre a été modifié ailleurs et l’actualisation serveur a échoué.', en: 'This register changed elsewhere, and refreshing the latest server state failed.', es: 'Este registro cambió en otro lugar y falló la actualización del servidor.', de: 'Dieses Klassenbuch wurde anderweitig geändert und das Neuladen ist fehlgeschlagen.', pt: 'Este registo foi alterado noutro local e falhou a atualização do servidor.' }, language)}
              </span>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              {activeRecoveryForScope.refreshErrorMessage ||
                pickText({ ar: 'تم الاحتفاظ بتعديلاتك غير المحفوظة وبقائمة السجل السابقة بشكل آمن. أعد القراءة للمصالحة قبل الحفظ.', fr: 'Vos saisies non enregistrées sont conservées en toute sécurité. Relancez la lecture pour réconcilier avant d’enregistrer.', en: 'Your unsaved draft entries are safely preserved. Retry loading the server register to reconcile before saving.', es: 'Sus entradas en borrador están a salvo. Reintente cargar el registro del servidor antes de guardar.', de: 'Ihre ungespeicherten Entwürfe bleiben sicher erhalten. Laden Sie das Register vor dem Speichern erneut.', pt: 'As suas alterações em rascunho estão guardadas. Tente recarregar o registo do servidor antes de guardar.' }, language)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="attendance-conflict-retry-btn"
              disabled={isRetryingConflictRefresh}
              onClick={() => void loadRegister()}
              className="min-h-[40px] rounded-xl bg-amber-700 hover:bg-amber-800 px-4 py-2 text-xs font-bold text-white inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>
                {isRetryingConflictRefresh
                  ? t('loading')
                  : pickText({ ar: 'إعادة قراءة السجل', fr: 'Réessayer l’actualisation', en: 'Retry Refresh', es: 'Reintentar actualización', de: 'Erneut laden', pt: 'Tentar atualizar' }, language)}
              </span>
            </button>
            <button
              type="button"
              data-testid="attendance-conflict-discard-btn"
              disabled={isRetryingConflictRefresh}
              onClick={discardConflictDraftAndReload}
              className="min-h-[40px] rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs font-bold text-amber-900 dark:text-amber-200 disabled:opacity-50"
            >
              {pickText({ ar: 'تجاهل المسودة وإعادة التحميل', fr: 'Abandonner et recharger', en: 'Discard Draft & Reload', es: 'Descartar borrador y recargar', de: 'Entwurf verwerfen & neu laden', pt: 'Descartar rascunho e recarregar' }, language)}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
