import React from 'react';
import {
  AlertCircle, CheckCircle2, Clock, FileCheck2, History, Lock, Save, ShieldAlert,
} from 'lucide-react';
import { pickText } from '../../../i18n/homepages';
import { formatAttendanceDateLabel, formatAttendanceTimestamp } from '../../../lib/attendance/dateUtils';
import {
  ATTENDANCE_MARKS,
  countAttendanceMarks,
  getEffectiveAttendanceEntry,
  MAX_ATTENDANCE_TEXT_LENGTH,
  type RegisterActionAvailability,
} from '../../../lib/attendance/logic';
import type {
  AttendanceEntryDraft,
  AttendanceMark,
  AttendanceRegisterData,
  AttendanceSaveReceipt,
  Language,
} from '../../../types';
import {
  getAttendanceMarkActiveButtonClass,
  getAttendanceMarkBadgeClass,
  getAttendanceMarkLabel,
  getRegisterStatusLabel,
} from './attendanceLabels';
import type { ConflictBannerState, SaveFeedbackState } from './useRegisterDraftAndSave';

export interface RegisterRosterTableProps {
  visibleRegister: AttendanceRegisterData;
  language: Language;
  t: (key: any) => string;
  conflictBanner: ConflictBannerState | null;
  saveFeedback: SaveFeedbackState | null;
  activeClassArchived: boolean;
  markCounts: ReturnType<typeof countAttendanceMarks>;
  actionAvailability: RegisterActionAvailability;
  effectiveCanEditFields: boolean;
  effectiveCanSaveDraft: boolean;
  effectiveCanSubmitOrCorrect: boolean;
  draftByStudentId: Record<string, AttendanceEntryDraft>;
  reasonText: string;
  setReasonText: (val: string) => void;
  isSaving: boolean;
  confirmedSavePendingRefresh: AttendanceSaveReceipt | null;
  setShowAuditPanel: React.Dispatch<React.SetStateAction<boolean>>;
  handleMarkAllRemainingPresent: () => void;
  updatePupilMark: (studentId: string, nextMark: AttendanceMark | null) => void;
  updatePupilComment: (studentId: string, nextComment: string) => void;
  handleSaveOrSubmit: (submit: boolean) => Promise<void>;
}

export const RegisterRosterTable: React.FC<RegisterRosterTableProps> = (props) => {
  const {
    visibleRegister, language, t, conflictBanner, saveFeedback, activeClassArchived,
    markCounts, actionAvailability, effectiveCanEditFields, effectiveCanSaveDraft,
    effectiveCanSubmitOrCorrect, draftByStudentId, reasonText, setReasonText,
    isSaving, confirmedSavePendingRefresh, setShowAuditPanel,
    handleMarkAllRemainingPresent, updatePupilMark, updatePupilComment, handleSaveOrSubmit,
  } = props;

  const isActionLocked = !effectiveCanEditFields || isSaving || Boolean(confirmedSavePendingRefresh);

  return (
    <>
      {conflictBanner && (
        <div
          role="alert"
          data-testid="attendance-conflict-banner"
          className="rounded-3xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-1.5 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-center gap-2 font-extrabold">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              {conflictBanner.kind === 'roster_conflict'
                ? pickText({ ar: 'تغيرت قائمة التلاميذ على الخادم. تم تحديث القائمة والاحتفاظ بتعديلاتك للتلاميذ المتبقين للمراجعة قبل الحفظ.', fr: 'La liste des élèves a changé sur le serveur. Vos saisies conservées sont prêtes à être vérifiées avant enregistrement.', en: 'The eligible class roster changed on the server. Your edits for remaining pupils are preserved for explicit review before saving.' }, language)
                : pickText({ ar: 'تم تحديث السجل في جلسة أخرى. تم تحميل أحدث نسخة من الخادم مع الاحتفاظ بتعديلاتك للمراجعة قبل الحفظ.', fr: 'Ce registre a été modifié ailleurs. La dernière version serveur a été chargée avec vos saisies conservées pour vérification.', en: 'The register was updated elsewhere. Latest server state loaded with your draft changes preserved for review before saving.' }, language)}
            </span>
          </div>
          {conflictBanner.addedNames.length > 0 && (
            <p className="text-[11px]">
              {pickText({ ar: 'تلاميذ جدد غير مسجلين:', fr: 'Nouveaux élèves non enregistrés :', en: 'Newly added unmarked pupils:' }, language)}{' '}
              {conflictBanner.addedNames.join(', ')}
            </p>
          )}
          {conflictBanner.droppedCount > 0 && (
            <p className="text-[11px]">
              {pickText({ ar: `تم استبعاد ${conflictBanner.droppedCount} تلميذ(اً) لم يعودوا مؤهلين لهذا التاريخ.`, fr: `${conflictBanner.droppedCount} élève(s) retiré(s) car non éligibles à cette date.`, en: `${conflictBanner.droppedCount} pupil(s) removed from eligible roster for this date.` }, language)}
            </p>
          )}
        </div>
      )}

      {saveFeedback && (
        <div
          role={saveFeedback.type === 'error' ? 'alert' : 'status'}
          data-testid="attendance-save-feedback"
          className={`rounded-2xl border px-4 py-3 text-xs font-bold flex items-center gap-2 ${
            saveFeedback.type === 'success'
              ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
              : saveFeedback.type === 'warning'
              ? 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'
              : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
          }`}
        >
          {saveFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{saveFeedback.text}</span>
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-testid="attendance-register-status-badge"
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-extrabold ${
                  visibleRegister.status === 'SUBMITTED'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>{getRegisterStatusLabel(visibleRegister.status, visibleRegister.version, language)}</span>
              </span>
              <span className="text-xs font-bold font-mono tabular-nums text-slate-600 dark:text-zinc-300">
                {formatAttendanceDateLabel(visibleRegister.schoolDate, language)}
              </span>
              {visibleRegister.submittedAt && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400">
                  <Clock className="w-3 h-3" />
                  {formatAttendanceTimestamp(visibleRegister.submittedAt, language)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              {pickText({ ar: 'تشمل الحصة اليومية جميع المواد في هذا القسم دون تقسيم السجل حسب المادة.', fr: 'Ce registre quotidien de classe s’applique à l’ensemble des matières enseignées dans cette classe.', en: 'This daily class register covers all subjects taught in this class; switching subjects does not split the register.' }, language)}
            </p>
          </div>

          {visibleRegister.registerId && (
            <button
              type="button"
              data-testid="attendance-toggle-audit-btn"
              onClick={() => setShowAuditPanel((prev) => !prev)}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900"
            >
              <History className="w-4 h-4" />
              <span>{pickText({ ar: 'سجل التعديلات', fr: 'Historique d’audit', en: 'Audit History' }, language)}</span>
            </button>
          )}
        </div>

        {actionAvailability.isTeacherCutoffClosed && (
          <div
            data-testid="attendance-teacher-cutoff-banner"
            className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3.5 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200"
          >
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold">
                {pickText({ ar: 'هذا السجل المعتمد للقراءة فقط', fr: 'Ce registre soumis est en lecture seule', en: 'This submitted register is read-only' }, language)}
              </p>
              <p className="text-[11px] mt-0.5">
                {pickText({ ar: 'انتهت مهلة التعديل للمربي عند منتصف الليل بتوقيت تونس. لإجراء تصحيح تاريخي، يرجى التواصل مع إدارة المدرسة.', fr: 'Le délai de correction enseignant (minuit heure de Tunis) est écoulé. Contactez l’administration pour toute correction.', en: 'The Teacher correction cutoff (midnight Africa/Tunis) has passed. Contact the School Office or Owner for historical corrections.' }, language)}
              </p>
            </div>
          </div>
        )}

        {activeClassArchived && (
          <div
            data-testid="attendance-archived-class-banner"
            className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 p-3.5 text-xs font-semibold text-slate-600 dark:text-zinc-300"
          >
            {actionAvailability.isNewRegister
              ? pickText({ ar: 'هذا القسم مؤرشف ولا يمكن إنشاء سجل حضور جديد له.', fr: 'Cette classe est archivée ; aucun nouveau registre ne peut être créé.', en: 'This class is archived; new registers cannot be created for it.' }, language)
              : pickText({ ar: 'هذا القسم مؤرشف. يمكن للإدارة تصحيح السجلات المحفوظة مسبقاً فقط.', fr: 'Classe archivée. La direction peut uniquement corriger les registres déjà existants.', en: 'Archived class. Office / Owner may still correct pre-existing saved registers with an audit reason.' }, language)}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold font-mono tabular-nums">
            <span className="rounded-lg border border-slate-200 dark:border-zinc-700 px-2.5 py-1 text-slate-700 dark:text-zinc-200">
              {pickText({ ar: 'الإجمالي', fr: 'Total', en: 'Total' }, language)}: {markCounts.total}
            </span>
            <span className={`rounded-lg border px-2.5 py-1 ${getAttendanceMarkBadgeClass(null)}`}>
              {getAttendanceMarkLabel(null, language)}: {markCounts.notRecorded}
            </span>
            <span className={`rounded-lg border px-2.5 py-1 ${getAttendanceMarkBadgeClass('PRESENT')}`}>
              {getAttendanceMarkLabel('PRESENT', language)}: {markCounts.present}
            </span>
            <span className={`rounded-lg border px-2.5 py-1 ${getAttendanceMarkBadgeClass('ABSENT')}`}>
              {getAttendanceMarkLabel('ABSENT', language)}: {markCounts.absent}
            </span>
            <span className={`rounded-lg border px-2.5 py-1 ${getAttendanceMarkBadgeClass('LATE')}`}>
              {getAttendanceMarkLabel('LATE', language)}: {markCounts.late}
            </span>
            <span className={`rounded-lg border px-2.5 py-1 ${getAttendanceMarkBadgeClass('EXCUSED')}`}>
              {getAttendanceMarkLabel('EXCUSED', language)}: {markCounts.excused}
            </span>
          </div>

          {effectiveCanEditFields && visibleRegister.entries.length > 0 && (
            <button
              type="button"
              data-testid="attendance-mark-all-present-btn"
              disabled={markCounts.notRecorded === 0 || isSaving || Boolean(confirmedSavePendingRefresh)}
              onClick={handleMarkAllRemainingPresent}
              className="min-h-[42px] rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-3.5 py-2 text-xs font-extrabold text-emerald-800 dark:text-emerald-200 disabled:opacity-45"
            >
              {pickText({ ar: 'تعيين الباقين كـ «حاضر»', fr: 'Marquer les restants « Présent »', en: 'Mark all remaining Present' }, language)}
            </button>
          )}
        </div>

        {visibleRegister.entries.length === 0 ? (
          <div
            data-testid="attendance-empty-roster"
            className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40 p-6 text-center text-xs font-semibold text-slate-600 dark:text-zinc-300"
          >
            {pickText({ ar: 'لا يوجد تلاميذ مؤهلون في هذا القسم لهذا التاريخ.', fr: 'Aucun élève éligible inscrit dans cette classe à cette date.', en: 'No eligible pupils enrolled in this class on this school date.' }, language)}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
            {visibleRegister.entries.map((entry) => {
              const effective = getEffectiveAttendanceEntry(entry, draftByStudentId);
              const rowDirty = effective.mark !== entry.mark || effective.internalComment !== entry.internalComment;
              return (
                <div
                  key={entry.studentId}
                  data-testid={`attendance-row-${entry.studentId}`}
                  className={`p-4 space-y-3 transition-colors ${rowDirty ? 'bg-blue-50/40 dark:bg-blue-950/15' : 'bg-white dark:bg-[#111111]'}`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="min-w-0 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white">{entry.fullName}</span>
                      {entry.studentCode && (
                        <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-zinc-400">{entry.studentCode}</span>
                      )}
                      <span
                        data-testid={`attendance-row-badge-${entry.studentId}`}
                        className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-extrabold ${getAttendanceMarkBadgeClass(effective.mark)}`}
                      >
                        {getAttendanceMarkLabel(effective.mark, language)}
                      </span>
                    </div>

                    <div role="group" aria-label={`${entry.fullName} attendance mark`} className="flex flex-wrap gap-1.5">
                      {visibleRegister.status === 'DRAFT' && (
                        <button
                          type="button"
                          disabled={isActionLocked}
                          onClick={() => updatePupilMark(entry.studentId, null)}
                          aria-pressed={effective.mark === null}
                          className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-extrabold transition-colors disabled:opacity-50 ${
                            effective.mark === null
                              ? getAttendanceMarkActiveButtonClass(null)
                              : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {getAttendanceMarkLabel(null, language)}
                        </button>
                      )}
                      {ATTENDANCE_MARKS.map((markOpt) => {
                        const selected = effective.mark === markOpt;
                        return (
                          <button
                            key={markOpt}
                            type="button"
                            data-testid={`mark-btn-${entry.studentId}-${markOpt}`}
                            disabled={isActionLocked}
                            onClick={() => updatePupilMark(entry.studentId, markOpt)}
                            aria-pressed={selected}
                            className={`min-h-[44px] rounded-xl border px-3.5 py-2 text-xs font-extrabold transition-colors disabled:opacity-50 ${
                              selected
                                ? getAttendanceMarkActiveButtonClass(markOpt)
                                : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800'
                            }`}
                          >
                            {getAttendanceMarkLabel(markOpt, language)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 shrink-0">
                      {pickText({ ar: 'ملاحظة داخلية للفريق فقط (لا تظهر للعائلات):', fr: 'Note interne équipe (jamais visible aux familles) :', en: 'Staff-only internal note (never shown to families):' }, language)}
                    </label>
                    <input
                      type="text"
                      maxLength={MAX_ATTENDANCE_TEXT_LENGTH}
                      disabled={isActionLocked}
                      value={effective.internalComment}
                      onChange={(e) => updatePupilComment(entry.studentId, e.target.value)}
                      placeholder={pickText({ ar: 'ملاحظة اختيارية للطاقم التربوي والإداري...', fr: 'Observation interne optionnelle...', en: 'Optional internal staff note...' }, language)}
                      className="flex-1 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3 py-2 text-xs text-slate-900 dark:text-white disabled:opacity-60"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {actionAvailability.requiresCorrectionReason && actionAvailability.canEditFields && (
          <div className="space-y-1.5 pt-2">
            <label className="block text-xs font-extrabold text-slate-800 dark:text-zinc-200">
              {pickText({ ar: 'سبب التصحيح (إلزامي لتعديل سجل معتمد):', fr: 'Motif de correction (obligatoire pour un registre soumis) :', en: 'Correction reason (required for editing a submitted register):' }, language)}
            </label>
            <textarea
              rows={2}
              maxLength={MAX_ATTENDANCE_TEXT_LENGTH}
              data-testid="attendance-correction-reason-input"
              value={reasonText}
              disabled={isActionLocked}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder={pickText({ ar: 'مثال: وصول متأخر مؤكد من الاستقبال...', fr: 'Ex. : arrivée tardive confirmée à l’accueil...', en: 'e.g. Late arrival confirmed at front desk...' }, language)}
              className="w-full rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white"
            />
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
              <span>
                {reasonText.trim().length === 0
                  ? pickText({ ar: 'يرجى كتابة سبب واضح للتدقيق.', fr: 'Un motif clair est requis pour l’audit.', en: 'Clear audit reason required.' }, language)
                  : ''}
              </span>
              <span>{reasonText.length} / {MAX_ATTENDANCE_TEXT_LENGTH}</span>
            </div>
          </div>
        )}

        {actionAvailability.canEditFields && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
              {actionAvailability.hasUnmarkedEligiblePupils
                ? pickText({ ar: `بقي ${markCounts.notRecorded} تلميذ(اً) بحالة «غير مسجل» — يمكنك حفظ المسودة والعودة لاحقاً، أما الاعتماد فيتطلب تحديد جميع التلاميذ.`, fr: `${markCounts.notRecorded} élève(s) « Non enregistré » : le brouillon peut être sauvegardé, mais la soumission exige que tous soient marqués.`, en: `${markCounts.notRecorded} pupil(s) are Not Recorded — you may save a draft, while Submit requires every eligible pupil marked.` }, language)
                : !actionAvailability.isSubmitted && !actionAvailability.isRosterEmpty
                ? pickText({ ar: 'جميع التلاميذ المؤهلين مسجلون وجاهزون للاعتماد.', fr: 'Tous les élèves éligibles sont marqués et prêts pour la soumission.', en: 'All eligible pupils are marked and ready to submit.' }, language)
                : ''}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!actionAvailability.isSubmitted && (
                <button
                  type="button"
                  data-testid="attendance-save-draft-btn"
                  disabled={isSaving || Boolean(confirmedSavePendingRefresh) || !effectiveCanSaveDraft}
                  onClick={() => void handleSaveOrSubmit(false)}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-2xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 px-4 py-2.5 text-xs font-extrabold text-slate-800 dark:text-zinc-100 disabled:opacity-45"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? t('loading') : pickText({ ar: 'حفظ كمسودة', fr: 'Enregistrer brouillon', en: 'Save Draft' }, language)}</span>
                </button>
              )}

              <button
                type="button"
                data-testid="attendance-submit-btn"
                disabled={isSaving || Boolean(confirmedSavePendingRefresh) || !effectiveCanSubmitOrCorrect}
                onClick={() => void handleSaveOrSubmit(true)}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-2xl bg-[#1E3A6D] hover:bg-[#162C54] px-5 py-2.5 text-xs font-extrabold text-white disabled:opacity-45"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSaving
                    ? t('loading')
                    : actionAvailability.isSubmitted
                    ? pickText({ ar: 'حفظ التصحيح المعتمد', fr: 'Enregistrer la correction', en: 'Save Correction' }, language)
                    : pickText({ ar: 'اعتماد السجل وإرساله', fr: 'Soumettre le registre', en: 'Submit Register' }, language)}
                </span>
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
};
