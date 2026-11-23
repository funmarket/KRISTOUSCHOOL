import React from 'react';
import type { Language, SchoolClassSummary } from '../../../types';
import type { ClassCreationFeedback, resolveClassReadback } from '../../../lib/classes/classCreation';
import { pickText } from '../../../i18n/homepages';
import { CANONICAL_SCHOOL_LEVELS } from '../../../lib/schoolOperations';
import type { GovernanceAccountRecord } from '../../../lib/accountGovernance';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ActiveClassesForm } from './useClassesMutations';

interface ClassManagementFormsProps {
  language: Language; t: (key: any) => string; canManage: boolean; canLoadAccounts: boolean;
  activeForm: ActiveClassesForm; setActiveForm: React.Dispatch<React.SetStateAction<ActiveClassesForm>>;
  opFeedback: { type: 'error' | 'success'; text: string } | null;
  visibleCreation: ClassCreationFeedback | null; classReadback: ReturnType<typeof resolveClassReadback> | null;
  creationPending: boolean; submitting: boolean; initialClasses: SchoolClassSummary[]; yearOptions: string[];
  academicYearCode: string; setAcademicYearCode: (v: string) => void;
  levelCode: string; setLevelCode: (v: string) => void;
  className: string; setClassName: (v: string) => void;
  capacity: number; setCapacity: (v: number) => void;
  roomLabel: string; setRoomLabel: (v: string) => void;
  studentCode: string; setStudentCode: (v: string) => void;
  studentFullName: string; setStudentFullName: (v: string) => void;
  studentBirthDate: string; setStudentBirthDate: (v: string) => void;
  enrollClassId: string; setEnrollClassId: (v: string) => void;
  relationshipLabel: string; setRelationshipLabel: (v: string) => void;
  parentUserId: string; setParentUserId: (v: string) => void;
  linkedProfileId: string; setLinkedProfileId: (v: string) => void;
  teacherUserId: string; setTeacherUserId: (v: string) => void;
  assignClassId: string; setAssignClassId: (v: string) => void;
  isHomeroom: boolean; setIsHomeroom: (v: boolean) => void;
  teacherActive: boolean; setTeacherActive: (v: boolean) => void;
  teacherAccounts: GovernanceAccountRecord[]; parentAccounts: GovernanceAccountRecord[];
  studentAccounts: GovernanceAccountRecord[]; accountsError: string | null;
  onRefresh?: () => Promise<boolean | void> | void;
  handleCreateClass: (e: React.FormEvent) => Promise<void>;
  handleRetryRefreshOnly: () => Promise<void>;
  handleEnrollStudent: (e: React.FormEvent) => Promise<void>;
  handleAssignTeacher: (e: React.FormEvent) => Promise<void>;
}

export const ClassManagementForms: React.FC<ClassManagementFormsProps> = ({
  language, t, canManage, canLoadAccounts, activeForm, setActiveForm, opFeedback,
  visibleCreation, classReadback, creationPending, submitting, initialClasses, yearOptions,
  academicYearCode, setAcademicYearCode, levelCode, setLevelCode, className, setClassName,
  capacity, setCapacity, roomLabel, setRoomLabel, studentCode, setStudentCode,
  studentFullName, setStudentFullName, studentBirthDate, setStudentBirthDate,
  enrollClassId, setEnrollClassId, relationshipLabel, setRelationshipLabel,
  parentUserId, setParentUserId, linkedProfileId, setLinkedProfileId,
  teacherUserId, setTeacherUserId, assignClassId, setAssignClassId,
  isHomeroom, setIsHomeroom, teacherActive, setTeacherActive,
  teacherAccounts, parentAccounts, studentAccounts, accountsError,
  onRefresh, handleCreateClass, handleRetryRefreshOnly, handleEnrollStudent, handleAssignTeacher,
}) => {
  return (
    <>
      {opFeedback && (
        <div
          data-testid="classes-op-feedback"
          className={`p-3.5 rounded-2xl text-xs font-semibold flex flex-wrap items-center justify-between gap-3 ${
            opFeedback.type === 'error'
              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {opFeedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{opFeedback.text}</span>
          </div>
        </div>
      )}

      {visibleCreation && (
        <div
          data-testid="class-creation-feedback"
          role="status"
          aria-live="polite"
          className="p-3.5 rounded-2xl text-xs font-semibold border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 space-y-2"
        >
          {visibleCreation.outcome === 'pending' && <p>{t('loading')}</p>}
          {visibleCreation.outcome === 'failed' && <p>{visibleCreation.error || t('error')}</p>}
          {visibleCreation.outcome === 'unknown' && (
            <p>
              {pickText(
                {
                  ar: 'تعذر التأكد من إنشاء القسم. تحقق من قائمة الأقسام قبل المحاولة مجدداً لتجنب التكرار.',
                  fr: 'Création non confirmée. Vérifiez la liste des classes avant de réessayer pour éviter un doublon.',
                  en: 'Creation could not be confirmed. Check the class list before trying again to avoid a duplicate.',
                },
                language,
              )}
            </p>
          )}
          {visibleCreation.outcome === 'confirmed' && (
            <>
              <p data-testid="class-creation-confirmed">
                {pickText(
                  { ar: 'تم إنشاء القسم بنجاح.', fr: 'Classe créée avec succès.', en: 'Class created successfully.' },
                  language,
                )}{' '}
                {visibleCreation.receipt?.name}
              </p>
              <p data-testid="class-creation-readback">
                {pickText(
                  classReadback === 'pending'
                    ? { ar: 'جارٍ تحديث قائمة الأقسام…', fr: 'Actualisation de la liste…', en: 'Refreshing the class list…' }
                    : classReadback === 'failed'
                      ? {
                          ar: 'تعذر تحديث القائمة. القسم محفوظ؛ أعد تحديث القائمة فقط.',
                          fr: 'Actualisation impossible. La classe est enregistrée ; actualisez seulement la liste.',
                          en: 'List refresh failed. The class is saved; retry refreshing the list only.',
                        }
                      : classReadback === 'confirmed'
                        ? {
                            ar: 'القسم المحفوظ ظاهر الآن في القائمة.',
                            fr: 'La classe enregistrée est maintenant dans la liste.',
                            en: 'The saved class is now visible in the list.',
                          }
                        : {
                            ar: 'لم يتم التأكد بعد من ظهور القسم المحفوظ في القائمة.',
                            fr: 'La présence de la classe enregistrée dans la liste reste à vérifier.',
                            en: 'The saved class has not yet been confirmed in the list.',
                          },
                  language,
                )}
              </p>
              {onRefresh && classReadback !== 'confirmed' && (
                <button
                  type="button"
                  data-testid="retry-refresh-only-btn"
                  disabled={creationPending || submitting}
                  onClick={() => void handleRetryRefreshOnly()}
                  className="px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold disabled:opacity-50"
                >
                  {pickText(
                    { ar: 'تحديث قائمة الأقسام فقط', fr: 'Actualiser seulement la liste', en: 'Refresh class list only' },
                    language,
                  )}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {canManage && activeForm === 'create-class' && (
        <form
          onSubmit={handleCreateClass}
          className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-blue-200 dark:border-blue-900 shadow-sm space-y-4"
        >
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">
            {pickText({ ar: 'قسم دراسي جديد', fr: 'Nouvelle classe scolaire', en: 'New School Class' }, language)}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <select
              aria-label="Academic Year"
              data-testid="create-class-year-select"
              value={academicYearCode}
              onChange={(e) => setAcademicYearCode(e.target.value)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs font-semibold"
            >
              {yearOptions.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
            <select
              value={levelCode}
              onChange={(e) => setLevelCode(e.target.value)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            >
              {CANONICAL_SCHOOL_LEVELS.map((lvl) => (
                <option key={lvl.code} value={lvl.code}>
                  {language === 'ar' ? lvl.labelAr : language === 'fr' ? lvl.labelFr : lvl.labelEn}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder={pickText({ ar: 'اسم القسم (مثال: 1 أ)', fr: 'Nom (ex: 1ère A)', en: 'Class name (e.g. 1A)' }, language)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <input
              type="number"
              min={1}
              max={60}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value) || 28)}
              placeholder="28"
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <input
              type="text"
              value={roomLabel}
              onChange={(e) => setRoomLabel(e.target.value)}
              placeholder={pickText({ ar: 'القاعة', fr: 'Salle', en: 'Room' }, language)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setActiveForm('none')} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold">
              {t('cancel')}
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50">
              {submitting ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      )}

      {canManage && activeForm === 'enroll-student' && (
        <form
          onSubmit={handleEnrollStudent}
          className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-emerald-200 dark:border-emerald-900 shadow-sm space-y-4"
        >
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">
            {pickText({ ar: 'إضافة وتسجيل تلميذ في قسم', fr: 'Créer et inscrire un élève', en: 'Create & Enroll Student' }, language)}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input type="text" required value={studentCode} onChange={(e) => setStudentCode(e.target.value)} placeholder="KS-2026-001" className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs" />
            <input type="text" required value={studentFullName} onChange={(e) => setStudentFullName(e.target.value)} placeholder={pickText({ ar: 'الاسم الكامل للتلميذ', fr: 'Nom complet', en: 'Full name' }, language)} className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs" />
            <input type="date" required value={studentBirthDate} onChange={(e) => setStudentBirthDate(e.target.value)} className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs" />
            <select required value={enrollClassId} onChange={(e) => setEnrollClassId(e.target.value)} className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs">
              {initialClasses.length === 0 ? (
                <option value="">—</option>
              ) : (
                initialClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name} ({cls.academicYear})</option>
                ))
              )}
            </select>
            <input type="text" value={relationshipLabel} onChange={(e) => setRelationshipLabel(e.target.value)} placeholder="Parent" className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400">
                {pickText({ ar: 'ربط حساب الولي (اختياري)', fr: 'Lier un compte Parent (optionnel)', en: 'Link Parent Account (optional)' }, language)}
              </label>
              {parentAccounts.length > 0 && (
                <select
                  aria-label="Select parent account"
                  value={parentAccounts.some((p) => p.id === parentUserId) ? parentUserId : ''}
                  onChange={(e) => setParentUserId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                >
                  <option value="">{pickText({ ar: '— دون ربط ولي —', fr: '— Aucun parent sélectionné —', en: '— No parent account —' }, language)}</option>
                  {parentAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.fullName} (@{acc.username})</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={parentUserId}
                onChange={(e) => setParentUserId(e.target.value)}
                placeholder={pickText({ ar: 'معرف حساب الولي (UUID اختياري)', fr: 'UUID compte parent (optionnel)', en: 'Parent User UUID (optional)' }, language)}
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400">
                {pickText({ ar: 'ربط حساب التلميذ (اختياري)', fr: 'Lier un compte Élève (optionnel)', en: 'Link Student Account (optional)' }, language)}
              </label>
              {studentAccounts.length > 0 && (
                <select
                  aria-label="Select student account"
                  value={studentAccounts.some((s) => s.id === linkedProfileId) ? linkedProfileId : ''}
                  onChange={(e) => setLinkedProfileId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                >
                  <option value="">{pickText({ ar: '— دون ربط حساب تلميذ —', fr: '— Aucun compte élève —', en: '— No student account —' }, language)}</option>
                  {studentAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.fullName} (@{acc.username})</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={linkedProfileId}
                onChange={(e) => setLinkedProfileId(e.target.value)}
                placeholder={pickText({ ar: 'معرف حساب التلميذ (UUID اختياري)', fr: 'UUID compte élève (optionnel)', en: 'Linked Student Profile UUID (optional)' }, language)}
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs font-mono"
              />
            </div>
          </div>

          {!canLoadAccounts && (
            <p data-testid="assignable-accounts-blocked-notice" className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30 px-3.5 py-2.5 text-[11px] font-medium text-amber-900 dark:text-amber-200">
              {pickText(
                {
                  ar: 'قوائم اختيار الأولياء والتلاميذ بالاسم غير متاحة لهذا الحساب المفوض حالياً؛ يمكنك إدخال المعرف (UUID) يدوياً لربط الحساب.',
                  fr: 'Les listes nominatives de parents et d’élèves ne sont pas encore disponibles pour ce rôle délégué ; vous pouvez saisir l’identifiant (UUID) directement.',
                  en: 'Named parent and student selection lists are not yet available for this delegated role; you can still enter the account UUID directly.',
                },
                language,
              )}
            </p>
          )}
          {accountsError && <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">{accountsError}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setActiveForm('none')} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold">
              {t('cancel')}
            </button>
            <button type="submit" disabled={submitting || initialClasses.length === 0} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50">
              {submitting ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      )}

      {canManage && activeForm === 'assign-teacher' && (
        <form
          onSubmit={handleAssignTeacher}
          className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4"
        >
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">
            {pickText({ ar: 'تعيين أو سحب مربي للقسم', fr: 'Affecter ou retirer un enseignant', en: 'Assign or Unassign Class Teacher' }, language)}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
            <div className="space-y-1.5 sm:col-span-2">
              {teacherAccounts.length > 0 && (
                <select
                  aria-label="Select approved teacher"
                  value={teacherAccounts.some((acc) => acc.id === teacherUserId) ? teacherUserId : ''}
                  onChange={(e) => setTeacherUserId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                >
                  <option value="">{pickText({ ar: '— اختر مربياً معتمداً —', fr: '— Sélectionner un enseignant —', en: '— Select approved teacher —' }, language)}</option>
                  {teacherAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.fullName} (@{acc.username})</option>
                  ))}
                </select>
              )}
              <input type="text" required value={teacherUserId} onChange={(e) => setTeacherUserId(e.target.value)} placeholder="Teacher User UUID" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs font-mono" />
            </div>
            <select required value={assignClassId} onChange={(e) => setAssignClassId(e.target.value)} className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs">
              {initialClasses.length === 0 ? (
                <option value="">—</option>
              ) : (
                initialClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name} ({cls.academicYear})</option>
                ))
              )}
            </select>
            <div className="flex flex-col gap-1.5">
              <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={isHomeroom} onChange={(e) => setIsHomeroom(e.target.checked)} />
                <span>{pickText({ ar: 'مربي رئيسي', fr: 'Enseignant principal', en: 'Homeroom teacher' }, language)}</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={teacherActive} onChange={(e) => setTeacherActive(e.target.checked)} />
                <span>{pickText({ ar: 'تعيين نشط (إزالة التحديد للسحب)', fr: 'Affectation active (décocher pour retirer)', en: 'Active assignment (uncheck to unassign)' }, language)}</span>
              </label>
            </div>
          </div>
          {!canLoadAccounts && (
            <p data-testid="assignable-accounts-blocked-notice" className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30 px-3.5 py-2.5 text-[11px] font-medium text-amber-900 dark:text-amber-200">
              {pickText(
                {
                  ar: 'قائمة اختيار المربين بالاسم غير متاحة لهذا الحساب المفوض حالياً؛ يمكنك إدخال معرف المربي (UUID) يدوياً.',
                  fr: 'La liste nominative des enseignants n’est pas encore disponible pour ce rôle délégué ; vous pouvez saisir l’identifiant (UUID) directement.',
                  en: 'The named teacher selection list is not yet available for this delegated role; you can still enter the teacher UUID directly.',
                },
                language,
              )}
            </p>
          )}
          {accountsError && <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">{accountsError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setActiveForm('none')} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold">
              {t('cancel')}
            </button>
            <button type="submit" disabled={submitting || initialClasses.length === 0} className="px-4 py-2 rounded-xl bg-[#1E3A6D] hover:bg-[#162C54] text-white text-xs font-bold disabled:opacity-50">
              {submitting ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      )}
    </>
  );
};
