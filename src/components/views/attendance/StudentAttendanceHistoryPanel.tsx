import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, CheckCircle2, AlertCircle, Lock, RefreshCw } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { pickText } from '../../../i18n/homepages';
import { fetchStudentAttendanceHistory } from '../../../lib/attendance/api';
import {
  addDaysIso,
  formatAttendanceDateLabel,
  getTunisTodayIsoDate,
  isWithinAttendanceHistoryRange,
} from '../../../lib/attendance/dateUtils';
import {
  buildAttendanceActorScopeKey,
  canCallFamilyAttendanceHistory,
  canCallStaffAttendanceEndpoints,
  isAttendanceHistoryResultApplicable,
} from '../../../lib/attendance/logic';
import {
  getAttendanceMarkBadgeClass,
  getAttendanceMarkLabel,
} from './attendanceLabels';
import type {
  BackendOpStatus,
  Language,
  StudentAttendanceRecord,
  User,
} from '../../../types';

export interface StudentAttendanceHistoryPanelProps {
  studentId: string;
  studentName: string;
  scopeClassId?: string;
  language?: Language;
  currentUserOverride?: User | null;
  testId?: string;
}

interface ScopedHistoryState {
  actorScopeKey: string;
  studentId: string;
  fromDate: string;
  toDate: string;
  status: BackendOpStatus | 'LOADING';
  items: StudentAttendanceRecord[];
  errorMessage: string | null;
}

export const StudentAttendanceHistoryPanel: React.FC<StudentAttendanceHistoryPanelProps> = ({
  studentId,
  studentName,
  scopeClassId,
  language: propLanguage,
  currentUserOverride,
  testId = 'student-attendance-history-panel',
}) => {
  const { currentUser: ctxUser, language: ctxLanguage, classesList, t } = useApp();
  const currentUser = currentUserOverride !== undefined ? currentUserOverride : ctxUser;
  const language = propLanguage ?? ctxLanguage;

  const isTeacher =
    currentUser?.accountStatus === 'APPROVED' && currentUser?.role === 'TEACHER';
  const hasAssignedClass =
    !isTeacher ||
    !scopeClassId ||
    (Array.isArray(currentUser?.assignedClassIds) &&
      currentUser.assignedClassIds.includes(scopeClassId));
  const isAccessAllowed =
    Boolean(studentId) &&
    hasAssignedClass &&
    (canCallStaffAttendanceEndpoints(currentUser) || canCallFamilyAttendanceHistory(currentUser));

  const actorScopeKey = useMemo(
    () => buildAttendanceActorScopeKey(currentUser),
    [currentUser],
  );

  const defaultToDate = useMemo(() => getTunisTodayIsoDate(), []);
  const defaultFromDate = useMemo(() => addDaysIso(defaultToDate, -30), [defaultToDate]);

  const [fromDate, setFromDate] = useState<string>(defaultFromDate);
  const [toDate, setToDate] = useState<string>(defaultToDate);
  const [reloadSeq, setReloadSeq] = useState<number>(0);

  const [historyState, setHistoryState] = useState<ScopedHistoryState>(() => ({
    actorScopeKey,
    studentId,
    fromDate: defaultFromDate,
    toDate: defaultToDate,
    status: 'LOADING',
    items: [],
    errorMessage: null,
  }));

  const mountedRef = useRef<boolean>(false);
  const requestSeqRef = useRef<number>(0);
  const latestSnapshotRef = useRef({
    actorScopeKey,
    isAccessAllowed,
    studentId,
    fromDate,
    toDate,
  });
  latestSnapshotRef.current = {
    actorScopeKey,
    isAccessAllowed,
    studentId,
    fromDate,
    toDate,
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSeqRef.current += 1;
    };
  }, []);

  const isRangeValid = isWithinAttendanceHistoryRange(fromDate, toDate);

  const loadHistory = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    const snap = latestSnapshotRef.current;
    if (!snap.isAccessAllowed || !snap.studentId) {
      setHistoryState({
        actorScopeKey: snap.actorScopeKey,
        studentId: snap.studentId,
        fromDate: snap.fromDate,
        toDate: snap.toDate,
        status: 'UNAUTHORIZED',
        items: [],
        errorMessage: null,
      });
      return;
    }
    if (!isWithinAttendanceHistoryRange(snap.fromDate, snap.toDate)) {
      setHistoryState({
        actorScopeKey: snap.actorScopeKey,
        studentId: snap.studentId,
        fromDate: snap.fromDate,
        toDate: snap.toDate,
        status: 'ERROR',
        items: [],
        errorMessage: pickText(
          {
            ar: 'يرجى تحديد نطاق زمني صالح بحد أقصى 366 يوماً.',
            fr: 'Veuillez sélectionner une période valide (366 jours maximum).',
            en: 'Please select a valid date range (366 days maximum).',
          },
          language,
        ),
      });
      return;
    }

    setHistoryState({
      actorScopeKey: snap.actorScopeKey,
      studentId: snap.studentId,
      fromDate: snap.fromDate,
      toDate: snap.toDate,
      status: 'LOADING',
      items: [],
      errorMessage: null,
    });

    const res = await fetchStudentAttendanceHistory({
      studentId: snap.studentId,
      fromDate: snap.fromDate,
      toDate: snap.toDate,
      language,
    });

    if (
      !isAttendanceHistoryResultApplicable({
        isMounted: mountedRef.current,
        requestSeq: seq,
        currentRequestSeq: requestSeqRef.current,
        originActorScopeKey: snap.actorScopeKey,
        originStudentId: snap.studentId,
        originFromDate: snap.fromDate,
        originToDate: snap.toDate,
        currentActorScopeKey: latestSnapshotRef.current.actorScopeKey,
        currentAccessAllowed: latestSnapshotRef.current.isAccessAllowed,
        currentStudentId: latestSnapshotRef.current.studentId,
        currentFromDate: latestSnapshotRef.current.fromDate,
        currentToDate: latestSnapshotRef.current.toDate,
      })
    ) {
      return;
    }

    if (!res.ok) {
      setHistoryState({
        actorScopeKey: snap.actorScopeKey,
        studentId: snap.studentId,
        fromDate: snap.fromDate,
        toDate: snap.toDate,
        status: res.status,
        items: [],
        errorMessage: res.errorMessage || res.errorCode || null,
      });
      return;
    }

    setHistoryState({
      actorScopeKey: snap.actorScopeKey,
      studentId: snap.studentId,
      fromDate: snap.fromDate,
      toDate: snap.toDate,
      status: 'READY',
      items: res.data ?? [],
      errorMessage: null,
    });
  }, [language]);

  useEffect(() => {
    void loadHistory();
  }, [actorScopeKey, studentId, fromDate, toDate, isAccessAllowed, reloadSeq, loadHistory]);

  // Synchronous render-time scope gate: never render prior actor/student/date history.
  const isScopeSynced =
    isAccessAllowed &&
    historyState.actorScopeKey === actorScopeKey &&
    historyState.studentId === studentId &&
    historyState.fromDate === fromDate &&
    historyState.toDate === toDate;

  const effectiveStatus: BackendOpStatus | 'LOADING' = !isAccessAllowed
    ? 'UNAUTHORIZED'
    : !isRangeValid
    ? 'ERROR'
    : !isScopeSynced
    ? 'LOADING'
    : historyState.status;

  const visibleItems =
    isScopeSynced && effectiveStatus === 'READY' ? historyState.items : [];

  const classMap = useMemo(() => {
    const map = new Map<string, { name: string; teacherId: string; teacherName: string }>();
    const safeClasses = Array.isArray(classesList) ? classesList : [];
    for (const cls of safeClasses) {
      map.set(cls.id, { name: cls.name, teacherId: cls.teacherId, teacherName: cls.teacherName });
    }
    return map;
  }, [classesList]);

  const resolveClassLabel = (classId: string) =>
    classMap.get(classId)?.name || `#${classId.slice(0, 8)}`;

  const resolveTeacherLabel = (classId: string, teacherUserId: string) => {
    if (currentUser && teacherUserId === currentUser.id) {
      return currentUser.fullName;
    }
    const cls = classMap.get(classId);
    if (cls && cls.teacherId === teacherUserId && cls.teacherName) {
      return cls.teacherName;
    }
    return `#${teacherUserId.slice(0, 8)}`;
  };

  if (!isAccessAllowed) {
    return (
      <section
        data-testid={testId}
        className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-5"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-zinc-300">
          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>
            {pickText(
              {
                ar: 'سجل الحضور غير متاح لهذا الحساب أو القسم.',
                fr: 'L’historique des présences n’est pas autorisé pour ce périmètre.',
                en: 'Attendance history is not authorized for this account or class scope.',
              },
              language,
            )}
          </span>
        </div>
      </section>
    );
  }

  return (
    <section
      data-testid={testId}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>
              {pickText(
                {
                  ar: `سجل الحضور المعتمد — ${studentName}`,
                  fr: `Présences soumises — ${studentName}`,
                  en: `Submitted Attendance History — ${studentName}`,
                },
                language,
              )}
            </span>
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            {isTeacher
              ? pickText(
                  {
                    ar: 'يعرض السجلات المعتمدة التي قمت بتسجيلها لهذا التلميذ فقط (366 يوماً كحد أقصى).',
                    fr: 'Affiche uniquement vos registres soumis autorisés pour cet élève (366 jours max).',
                    en: 'Shows only your currently authorized submitted registers for this pupil (max 366 days).',
                  },
                  language,
                )
              : pickText(
                  {
                    ar: 'سجلات الحضور المعتمدة رسمياً من المدرسة (بتوقيت تونس).',
                    fr: 'Enregistrements de présence officiellement soumis par l’école (heure de Tunis).',
                    en: 'Officially submitted school attendance observations (Africa/Tunis).',
                  },
                  language,
                )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-zinc-300">
            <span>{pickText({ ar: 'من', fr: 'Du', en: 'From' }, language)}</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-mono tabular-nums"
            />
          </label>
          <label className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-zinc-300">
            <span>{pickText({ ar: 'إلى', fr: 'Au', en: 'To' }, language)}</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-mono tabular-nums"
            />
          </label>
          <button
            type="button"
            onClick={() => setReloadSeq((n) => n + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{pickText({ ar: 'تحديث', fr: 'Actualiser', en: 'Refresh' }, language)}</span>
          </button>
        </div>
      </div>

      {!isRangeValid && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            {pickText(
              {
                ar: 'نطاق التاريخ غير صالح: يجب أن يكون تاريخ البداية قبل أو مساوياً لتاريخ النهاية وبحد أقصى 366 يوماً.',
                fr: 'Période invalide : la date de début doit précéder la fin (366 jours maximum).',
                en: 'Invalid date range: start date must be on or before end date and within 366 days.',
              },
              language,
            )}
          </span>
        </div>
      )}

      {effectiveStatus === 'LOADING' && (
        <div className="py-6 text-center text-xs font-bold text-slate-500 dark:text-zinc-400">
          {t('loading')}
        </div>
      )}

      {effectiveStatus === 'UNAUTHORIZED' && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2"
        >
          <Lock className="w-4 h-4 shrink-0" />
          <span>
            {historyState.errorMessage ||
              pickText(
                {
                  ar: 'غير مصرح بعرض سجل الحضور لهذا التلميذ.',
                  fr: 'Accès non autorisé à l’historique de présence.',
                  en: 'Not authorized to view attendance history for this pupil.',
                },
                language,
              )}
          </span>
        </div>
      )}

      {effectiveStatus === 'BLOCKED_BACKEND' && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 px-4 py-3 text-xs font-semibold text-slate-600 dark:text-zinc-300">
          {historyState.errorMessage ||
            pickText(
              {
                ar: 'خدمة سجل الحضور غير متاحة حالياً على الخادم.',
                fr: 'Service d’historique des présences indisponible.',
                en: 'Attendance history service is unavailable.',
              },
              language,
            )}
        </div>
      )}

      {effectiveStatus === 'ERROR' && isRangeValid && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300 flex flex-wrap items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {historyState.errorMessage ||
                pickText(
                  {
                    ar: 'تعذر تحميل سجل الحضور من الخادم.',
                    fr: 'Impossible de charger l’historique des présences.',
                    en: 'Failed to load attendance history from the server.',
                  },
                  language,
                )}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setReloadSeq((n) => n + 1)}
            className="rounded-xl bg-red-700 hover:bg-red-800 px-3 py-1.5 text-white text-xs font-bold"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
          </button>
        </div>
      )}

      {effectiveStatus === 'READY' && visibleItems.length === 0 && (
        <div
          data-testid={`${testId}-empty`}
          className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40 px-4 py-6 text-center text-xs font-semibold text-slate-500 dark:text-zinc-400"
        >
          {pickText(
            {
              ar: 'لا توجد سجلات حضور معتمدة في الفترة المحددة.',
              fr: 'Aucun enregistrement de présence soumis pour cette période.',
              en: 'No submitted attendance records found for this date range.',
            },
            language,
          )}
        </div>
      )}

      {effectiveStatus === 'READY' && visibleItems.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-extrabold">
              <tr>
                <th className="py-2.5 px-3 text-start">
                  {pickText({ ar: 'التاريخ', fr: 'Date', en: 'Date' }, language)}
                </th>
                <th className="py-2.5 px-3 text-start">
                  {pickText({ ar: 'القسم', fr: 'Classe', en: 'Class' }, language)}
                </th>
                <th className="py-2.5 px-3 text-start">
                  {pickText({ ar: 'المربي المسؤول', fr: 'Enseignant responsable', en: 'Responsible Teacher' }, language)}
                </th>
                <th className="py-2.5 px-3 text-start">
                  {pickText({ ar: 'الحالة', fr: 'Statut', en: 'Mark' }, language)}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {visibleItems.map((row) => (
                <tr key={row.registerId} className="hover:bg-slate-50/60 dark:hover:bg-zinc-900/40">
                  <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    <div>{row.schoolDate}</div>
                    <div className="text-[10px] font-sans font-normal text-slate-500 dark:text-zinc-400">
                      {formatAttendanceDateLabel(row.schoolDate, language)}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-zinc-200">
                    {resolveClassLabel(row.classId)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">
                    {resolveTeacherLabel(row.classId, row.teacherUserId)}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold ${getAttendanceMarkBadgeClass(row.mark)}`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{getAttendanceMarkLabel(row.mark, language)}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
