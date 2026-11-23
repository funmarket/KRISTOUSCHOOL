import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, GraduationCap, Lock, Users } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { pickText } from '../../../i18n/homepages';
import { resolveParentLinkedChildren } from '../../homepages/homepageAccess';
import { resolveStudentSelfRecord } from '../../../lib/attendance/api';
import { buildAttendanceActorScopeKey } from '../../../lib/attendance/logic';
import { StudentAttendanceHistoryPanel } from './StudentAttendanceHistoryPanel';
import type { BackendOpStatus, StudentSelfRecord } from '../../../types';

interface StudentSelfState {
  actorScopeKey: string;
  status: BackendOpStatus | 'LOADING';
  record: StudentSelfRecord | null;
  errorMessage: string | null;
}

export const FamilyAttendanceHistoryPanel: React.FC = () => {
  const {
    currentUser,
    language,
    childrenList,
    selectedChildId,
    setSelectedChildId,
    isHydratingSchoolData,
    schoolContextError,
    refreshSchoolData,
    t,
  } = useApp();

  const isApproved = currentUser?.accountStatus === 'APPROVED';
  const isParent = Boolean(isApproved && currentUser?.role === 'PARENT');
  const isStudent = Boolean(isApproved && currentUser?.role === 'STUDENT');
  const actorScopeKey = useMemo(
    () => buildAttendanceActorScopeKey(currentUser),
    [currentUser],
  );

  const linkedChildren = useMemo(
    () => (isParent ? resolveParentLinkedChildren(currentUser, childrenList) : []),
    [isParent, currentUser, childrenList],
  );

  const activeChild = useMemo(() => {
    if (!isParent || linkedChildren.length === 0) return null;
    return linkedChildren.find((c) => c.id === selectedChildId) ?? linkedChildren[0];
  }, [isParent, linkedChildren, selectedChildId]);

  useEffect(() => {
    if (isParent && activeChild && activeChild.id !== selectedChildId) {
      setSelectedChildId(activeChild.id);
    }
  }, [isParent, activeChild, selectedChildId, setSelectedChildId]);

  const [studentSelfState, setStudentSelfState] = useState<StudentSelfState>(() => ({
    actorScopeKey,
    status: 'LOADING',
    record: null,
    errorMessage: null,
  }));

  const mountedRef = useRef(false);
  const seqRef = useRef(0);
  const latestScopeRef = useRef({ actorScopeKey, isStudent, userId: currentUser?.id ?? '' });
  latestScopeRef.current = { actorScopeKey, isStudent, userId: currentUser?.id ?? '' };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      seqRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const seq = ++seqRef.current;
    if (!isStudent || !currentUser?.id) {
      setStudentSelfState({
        actorScopeKey,
        status: 'UNAUTHORIZED',
        record: null,
        errorMessage: null,
      });
      return;
    }

    setStudentSelfState({
      actorScopeKey,
      status: 'LOADING',
      record: null,
      errorMessage: null,
    });

    void resolveStudentSelfRecord({ userId: currentUser.id, language }).then((res) => {
      const latest = latestScopeRef.current;
      if (
        !mountedRef.current ||
        seq !== seqRef.current ||
        !latest.isStudent ||
        latest.actorScopeKey !== actorScopeKey ||
        latest.userId !== currentUser.id
      ) {
        return;
      }
      if (!res.ok) {
        setStudentSelfState({
          actorScopeKey,
          status: res.status,
          record: null,
          errorMessage: res.errorMessage || res.errorCode || null,
        });
        return;
      }
      setStudentSelfState({
        actorScopeKey,
        status: 'READY',
        record: res.data ?? null,
        errorMessage: null,
      });
    });
  }, [actorScopeKey, isStudent, currentUser?.id, language]);

  if (!isParent && !isStudent) {
    return (
      <div
        data-testid="family-attendance-unauthorized"
        className="rounded-3xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-6 flex items-center gap-3 text-xs font-bold text-amber-800 dark:text-amber-300"
      >
        <Lock className="w-4 h-4 shrink-0" />
        <span>{t('unauthorized')}</span>
      </div>
    );
  }

  if (isParent) {
    if (isHydratingSchoolData) {
      return (
        <div
          data-testid="family-attendance-loading"
          className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-8 text-center text-xs font-bold text-slate-500"
        >
          {t('loading')}
        </div>
      );
    }

    if (schoolContextError) {
      return (
        <div
          role="alert"
          data-testid="family-attendance-context-error"
          className="rounded-3xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-5 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-red-700 dark:text-red-300"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{schoolContextError}</span>
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

    if (linkedChildren.length === 0) {
      return (
        <div
          data-testid="family-attendance-no-children"
          className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-6 space-y-2 text-xs"
        >
          <div className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-white">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{t('noLinkedChildren')}</span>
          </div>
          <p className="text-slate-500 dark:text-zinc-400">
            {pickText(
              {
                ar: 'بمجرد ربط حسابك بملف طفلك من إدارة المدرسة، سيظهر سجل الحضور المعتمد هنا.',
                fr: 'Dès qu’un enfant est lié à votre compte par l’administration, son historique de présence apparaîtra ici.',
                en: 'Once school administration links your child to your account, their submitted attendance records will appear here.',
              },
              language,
            )}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4" data-testid="parent-attendance-history-view">
        {linkedChildren.length > 1 && (
          <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-slate-600 dark:text-zinc-300 me-2">
              {t('childConcerned')}:
            </span>
            {linkedChildren.map((child) => {
              const selected = activeChild?.id === child.id;
              return (
                <button
                  key={child.id}
                  type="button"
                  data-testid={`attendance-child-select-${child.id}`}
                  onClick={() => setSelectedChildId(child.id)}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                    selected
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {child.fullName} ({child.className})
                </button>
              );
            })}
          </div>
        )}

        {activeChild && (
          <StudentAttendanceHistoryPanel
            studentId={activeChild.id}
            studentName={activeChild.fullName}
            testId="parent-student-attendance-panel"
          />
        )}
      </div>
    );
  }

  // STUDENT self-history view
  const isStudentSynced = studentSelfState.actorScopeKey === actorScopeKey;
  if (!isStudentSynced || studentSelfState.status === 'LOADING') {
    return (
      <div
        data-testid="student-attendance-loading"
        className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-8 text-center text-xs font-bold text-slate-500"
      >
        {t('loading')}
      </div>
    );
  }

  if (studentSelfState.status !== 'READY') {
    return (
      <div
        role="alert"
        data-testid="student-attendance-error"
        className="rounded-3xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-5 text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-2"
      >
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>
          {studentSelfState.errorMessage ||
            pickText(
              {
                ar: 'تعذر التحقق من ملف التلميذ المرتبط بحسابك.',
                fr: 'Impossible de vérifier le profil élève associé à votre compte.',
                en: 'Unable to verify the student record linked to your account.',
              },
              language,
            )}
        </span>
      </div>
    );
  }

  if (!studentSelfState.record) {
    return (
      <div
        data-testid="student-attendance-unlinked"
        className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-6 space-y-2 text-xs"
      >
        <div className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-white">
          <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>
            {pickText(
              {
                ar: 'حسابك غير مرتبط بملف تلميذ نشط بعد.',
                fr: 'Votre compte n’est pas encore lié à un dossier élève actif.',
                en: 'Your account is not linked to an active student record yet.',
              },
              language,
            )}
          </span>
        </div>
        <p className="text-slate-500 dark:text-zinc-400">
          {pickText(
            {
              ar: 'يرجى التواصل مع إدارة المدرسة لربط حسابك التلميذ بسجلك الدراسي.',
              fr: 'Veuillez contacter l’administration pour lier votre compte élève.',
              en: 'Please contact school administration to link your student account.',
            },
            language,
          )}
        </p>
      </div>
    );
  }

  return (
    <div data-testid="student-self-attendance-view">
      <StudentAttendanceHistoryPanel
        studentId={studentSelfState.record.id}
        studentName={studentSelfState.record.fullName}
        testId="student-self-attendance-panel"
      />
    </div>
  );
};
