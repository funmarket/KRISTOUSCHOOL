import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  History,
  Lock,
  RefreshCw,
  Save,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { pickText } from '../../../i18n/homepages';
import { resolveTeacherAssignedClasses } from '../../homepages/homepageAccess';
import {
  fetchAttendanceAudit,
  fetchAttendanceRegister,
  fetchOfficeAttendanceContext,
  fetchOfficeSavedRegisters,
  OFFICE_SAVED_REGISTERS_DEFAULT_LIMIT,
  saveAttendanceRegister,
  type OfficeAttendanceContextResult,
} from '../../../lib/attendance/api';
import {
  formatAttendanceDateLabel,
  formatAttendanceTimestamp,
  getNextTunisMidnightDelayMs,
  getTunisTodayIsoDate,
  isValidIsoDate,
} from '../../../lib/attendance/dateUtils';
import {
  applyMarkAllPresentToNotRecorded,
  ATTENDANCE_MARKS,
  buildAttendanceActorScopeKey,
  buildAttendanceEntriesPayload,
  cloneAttendanceDraft,
  countAttendanceMarks,
  getEffectiveAttendanceEntry,
  isAttendanceAuditStateApplicable,
  isAttendanceRegisterResultApplicable,
  MAX_ATTENDANCE_TEXT_LENGTH,
  reconcileConflictWithFreshRegister,
  resolveAttendanceAccessMode,
  resolveAttendanceSaveIntent,
  resolveRegisterActionAvailability,
  type AttendanceAccessMode,
} from '../../../lib/attendance/logic';
import {
  getAttendanceMarkActiveButtonClass,
  getAttendanceMarkBadgeClass,
  getAttendanceMarkLabel,
  getAuditEventLabel,
  getRegisterStatusLabel,
} from './attendanceLabels';
import type {
  AttendanceAuditEvent,
  AttendanceEntryDraft,
  AttendanceMark,
  AttendanceRegisterData,
  AttendanceSaveIntent,
  AttendanceSaveReceipt,
  BackendOpStatus,
  OfficeAttendanceRegisterSummary,
  OfficeAttendanceTeacherOption,
} from '../../../types';

export interface StaffAttendanceRegisterPanelProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

interface ScopedRegisterState {
  actorScopeKey: string;
  accessMode: AttendanceAccessMode;
  classId: string;
  schoolDate: string;
  teacherUserId: string; // '' for Teacher (omitted in RPC); selected teacher UUID for Office
  status: BackendOpStatus | 'LOADING' | 'IDLE';
  data: AttendanceRegisterData | null;
  errorCode: string | null;
  errorMessage: string | null;
}

interface ScopedOfficeState {
  actorScopeKey: string;
  status: BackendOpStatus | 'LOADING';
  data: OfficeAttendanceContextResult | null;
  errorMessage: string | null;
}

interface ScopedOfficeRegistersState {
  actorScopeKey: string;
  classId: string;
  teacherFilterId: string;
  fromDate: string;
  toDate: string;
  offset: number;
  status: BackendOpStatus | 'LOADING' | 'IDLE';
  items: OfficeAttendanceRegisterSummary[];
  totalCount: number | null;
  hasMore: boolean;
  errorMessage: string | null;
}

interface ScopedAuditState {
  actorScopeKey: string;
  registerId: string;
  status: BackendOpStatus | 'LOADING';
  items: AttendanceAuditEvent[];
  errorMessage: string | null;
}

interface PendingConflictRecovery {
  actorScopeKey: string;
  accessMode: AttendanceAccessMode;
  classId: string;
  schoolDate: string;
  teacherUserId: string;
  conflictKind: 'version_conflict' | 'roster_conflict';
  previousRegister: AttendanceRegisterData;
  unsavedDraftByStudentId: Record<string, AttendanceEntryDraft>;
  unsavedReasonText: string;
  refreshErrorMessage: string | null;
}

function doesRecoveryMatchScope(
  recovery: PendingConflictRecovery | null,
  snap: {
    actorScopeKey: string;
    accessMode: AttendanceAccessMode;
    classId: string;
    schoolDate: string;
    teacherUserId: string;
  },
): recovery is PendingConflictRecovery {
  return Boolean(
    recovery &&
      recovery.actorScopeKey === snap.actorScopeKey &&
      recovery.accessMode === snap.accessMode &&
      recovery.classId === snap.classId &&
      recovery.schoolDate === snap.schoolDate &&
      recovery.teacherUserId === snap.teacherUserId,
  );
}

type PendingContextSwitch =
  | { kind: 'class'; classId: string }
  | { kind: 'date'; schoolDate: string }
  | { kind: 'teacher'; teacherUserId: string }
  | { kind: 'preset'; classId: string; teacherUserId: string; schoolDate: string };

export const StaffAttendanceRegisterPanel: React.FC<StaffAttendanceRegisterPanelProps> = ({
  onDirtyChange,
}) => {
  const {
    currentUser,
    language,
    t,
    classesList,
    selectedClassId: sharedSelectedClassId,
    setSelectedClassId: setSharedSelectedClassId,
    classesBackendStatus,
    classesError,
    isHydratingSchoolData,
    refreshSchoolData,
  } = useApp();

  const accessMode = resolveAttendanceAccessMode(currentUser);
  const isTeacher = accessMode === 'STAFF_TEACHER';
  const isOffice = accessMode === 'STAFF_OFFICE';
  const actorScopeKey = useMemo(
    () => buildAttendanceActorScopeKey(currentUser),
    [currentUser],
  );

  const [schoolDate, setSchoolDate] = useState<string>(() => getTunisTodayIsoDate());
  const [officeSelectedClassId, setOfficeSelectedClassId] = useState<string>('');
  const [officeSelectedTeacherId, setOfficeSelectedTeacherId] = useState<string>('');
  const [officeReloadSeq, setOfficeReloadSeq] = useState<number>(0);

  const [officeHistoryTeacherFilter, setOfficeHistoryTeacherFilter] = useState<string>('');
  const [officeHistoryFromDate, setOfficeHistoryFromDate] = useState<string>('');
  const [officeHistoryToDate, setOfficeHistoryToDate] = useState<string>('');
  const [officeHistoryOffset, setOfficeHistoryOffset] = useState<number>(0);
  const [officeHistoryReloadSeq, setOfficeHistoryReloadSeq] = useState<number>(0);

  const [officeState, setOfficeState] = useState<ScopedOfficeState>(() => ({
    actorScopeKey,
    status: 'LOADING',
    data: null,
    errorMessage: null,
  }));

  const [officeRegistersPageState, setOfficeRegistersPageState] =
    useState<ScopedOfficeRegistersState>(() => ({
      actorScopeKey,
      classId: '',
      teacherFilterId: '',
      fromDate: '',
      toDate: '',
      offset: 0,
      status: 'IDLE',
      items: [],
      totalCount: null,
      hasMore: false,
      errorMessage: null,
    }));

  const [cutoffNow, setCutoffNow] = useState<Date>(() => new Date());

  const [draftByStudentId, setDraftByStudentId] = useState<Record<string, AttendanceEntryDraft>>({});
  const [reasonText, setReasonText] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);
  const [confirmedSavePendingRefresh, setConfirmedSavePendingRefresh] =
    useState<AttendanceSaveReceipt | null>(null);
  const [conflictBanner, setConflictBanner] = useState<{
    kind: 'version_conflict' | 'roster_conflict';
    droppedCount: number;
    addedNames: string[];
  } | null>(null);
  const [pendingConflictRecovery, setPendingConflictRecoveryState] =
    useState<PendingConflictRecovery | null>(null);
  const [isRetryingConflictRefresh, setIsRetryingConflictRefresh] = useState<boolean>(false);
  const [pendingSwitch, setPendingSwitch] = useState<PendingContextSwitch | null>(null);
  const [showAuditPanel, setShowAuditPanel] = useState<boolean>(false);

  const [registerState, setRegisterState] = useState<ScopedRegisterState>(() => ({
    actorScopeKey,
    accessMode,
    classId: '',
    schoolDate: getTunisTodayIsoDate(),
    teacherUserId: '',
    status: 'IDLE',
    data: null,
    errorCode: null,
    errorMessage: null,
  }));

  const [auditState, setAuditState] = useState<ScopedAuditState>({
    actorScopeKey,
    registerId: '',
    status: 'LOADING',
    items: [],
    errorMessage: null,
  });

  const mountedRef = useRef<boolean>(false);
  const registerSeqRef = useRef<number>(0);
  const officeSeqRef = useRef<number>(0);
  const officeRegistersSeqRef = useRef<number>(0);
  const auditSeqRef = useRef<number>(0);
  const inFlightSaveRef = useRef<boolean>(false);
  const pendingIntentRef = useRef<AttendanceSaveIntent | null>(null);
  const pendingConflictRecoveryRef = useRef<PendingConflictRecovery | null>(null);
  const visibleRegisterIdRef = useRef<string>('');
  const auditRegisterIdRef = useRef<string>('');
  auditRegisterIdRef.current = auditState.registerId;

  const setPendingConflictRecovery = useCallback((next: PendingConflictRecovery | null) => {
    pendingConflictRecoveryRef.current = next;
    setPendingConflictRecoveryState(next);
  }, []);

  const invalidateAuditState = useCallback((nextActorScopeKey: string) => {
    auditSeqRef.current += 1;
    auditRegisterIdRef.current = '';
    setAuditState({
      actorScopeKey: nextActorScopeKey,
      registerId: '',
      status: 'LOADING',
      items: [],
      errorMessage: null,
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      registerSeqRef.current += 1;
      officeSeqRef.current += 1;
      officeRegistersSeqRef.current += 1;
      auditSeqRef.current += 1;
      onDirtyChange?.(false);
    };
  }, [onDirtyChange]);

  // Recheck Africa/Tunis midnight cutoff on focus, visibility change, pageshow, and midnight timer.
  useEffect(() => {
    const syncClock = () => setCutoffNow(new Date());
    const onVisibility = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        syncClock();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', syncClock);
      window.addEventListener('pageshow', syncClock);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    const timer = setTimeout(syncClock, getNextTunisMidnightDelayMs(cutoffNow));
    return () => {
      clearTimeout(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', syncClock);
        window.removeEventListener('pageshow', syncClock);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [cutoffNow]);

  // Reset all private register/draft/audit state immediately when actor scope changes.
  const prevActorScopeRef = useRef<string>(actorScopeKey);
  useEffect(() => {
    if (prevActorScopeRef.current !== actorScopeKey) {
      prevActorScopeRef.current = actorScopeKey;
      registerSeqRef.current += 1;
      officeSeqRef.current += 1;
      officeRegistersSeqRef.current += 1;
      pendingIntentRef.current = null;
      inFlightSaveRef.current = false;
      setPendingConflictRecovery(null);
      setIsRetryingConflictRefresh(false);
      setShowAuditPanel(false);
      invalidateAuditState(actorScopeKey);
      setDraftByStudentId({});
      setReasonText('');
      setSaveFeedback(null);
      setConfirmedSavePendingRefresh(null);
      setConflictBanner(null);
      setPendingSwitch(null);
      setIsSaving(false);
      setOfficeSelectedClassId('');
      setOfficeSelectedTeacherId('');
      setOfficeHistoryTeacherFilter('');
      setOfficeHistoryFromDate('');
      setOfficeHistoryToDate('');
      setOfficeHistoryOffset(0);
      setOfficeRegistersPageState({
        actorScopeKey,
        classId: '',
        teacherFilterId: '',
        fromDate: '',
        toDate: '',
        offset: 0,
        status: 'IDLE',
        items: [],
        totalCount: null,
        hasMore: false,
        errorMessage: null,
      });
    }
  }, [actorScopeKey, invalidateAuditState, setPendingConflictRecovery]);

  // Load Owner/Office metadata context when active role is APP_ADMIN or ADMINISTRATIVE_PERSONNEL.
  useEffect(() => {
    const seq = ++officeSeqRef.current;
    if (!isOffice) {
      setOfficeState({
        actorScopeKey,
        status: 'UNAUTHORIZED',
        data: null,
        errorMessage: null,
      });
      return;
    }

    setOfficeState({
      actorScopeKey,
      status: 'LOADING',
      data: null,
      errorMessage: null,
    });

    void fetchOfficeAttendanceContext(language).then((res) => {
      if (
        !mountedRef.current ||
        seq !== officeSeqRef.current ||
        prevActorScopeRef.current !== actorScopeKey
      ) {
        return;
      }
      if (!res.ok) {
        setOfficeState({
          actorScopeKey,
          status: res.status,
          data: null,
          errorMessage: res.errorMessage || res.errorCode || null,
        });
        return;
      }
      setOfficeState({
        actorScopeKey,
        status: 'READY',
        data: res.data ?? null,
        errorMessage: null,
      });
    });
  }, [isOffice, actorScopeKey, officeReloadSeq, language]);

  // Teacher assigned classes from existing AppContext owner
  const teacherAssignedClasses = useMemo(
    () => (isTeacher ? resolveTeacherAssignedClasses(currentUser, classesList) : []),
    [isTeacher, currentUser, classesList],
  );

  // Reconcile Teacher active class using shared AppContext selectedClassId
  const activeTeacherClass = useMemo(() => {
    if (!isTeacher || teacherAssignedClasses.length === 0) return null;
    return (
      teacherAssignedClasses.find((cls) => cls.id === sharedSelectedClassId) ??
      teacherAssignedClasses[0]
    );
  }, [isTeacher, teacherAssignedClasses, sharedSelectedClassId]);

  useEffect(() => {
    if (isTeacher && activeTeacherClass && activeTeacherClass.id !== sharedSelectedClassId) {
      setSharedSelectedClassId(activeTeacherClass.id);
    }
  }, [isTeacher, activeTeacherClass, sharedSelectedClassId, setSharedSelectedClassId]);

  // Office class & teacher selection reconciliation
  const officeSyncedData =
    isOffice && officeState.actorScopeKey === actorScopeKey && officeState.status === 'READY'
      ? officeState.data
      : null;

  const activeOfficeClass = useMemo(() => {
    if (!officeSyncedData || officeSyncedData.classes.length === 0) return null;
    return (
      officeSyncedData.classes.find((cls) => cls.id === officeSelectedClassId) ??
      officeSyncedData.classes.find((cls) => !cls.isArchived) ??
      officeSyncedData.classes[0]
    );
  }, [officeSyncedData, officeSelectedClassId]);

  const activeOfficeClassId = activeOfficeClass?.id ?? '';

  // Load server-filtered, paginated historical Office registers for active class (C3).
  useEffect(() => {
    const seq = ++officeRegistersSeqRef.current;
    if (!isOffice || !officeSyncedData || !activeOfficeClassId) {
      setOfficeRegistersPageState({
        actorScopeKey,
        classId: activeOfficeClassId,
        teacherFilterId: officeHistoryTeacherFilter,
        fromDate: officeHistoryFromDate,
        toDate: officeHistoryToDate,
        offset: officeHistoryOffset,
        status: 'IDLE',
        items: [],
        totalCount: null,
        hasMore: false,
        errorMessage: null,
      });
      return;
    }

    setOfficeRegistersPageState((prev) => ({
      ...prev,
      actorScopeKey,
      classId: activeOfficeClassId,
      teacherFilterId: officeHistoryTeacherFilter,
      fromDate: officeHistoryFromDate,
      toDate: officeHistoryToDate,
      offset: officeHistoryOffset,
      status: 'LOADING',
      errorMessage: null,
    }));

    void fetchOfficeSavedRegisters({
      classId: activeOfficeClassId,
      teacherUserId: officeHistoryTeacherFilter || null,
      fromDate: officeHistoryFromDate || null,
      toDate: officeHistoryToDate || null,
      limit: OFFICE_SAVED_REGISTERS_DEFAULT_LIMIT,
      offset: officeHistoryOffset,
      language,
    }).then((res) => {
      if (
        !mountedRef.current ||
        seq !== officeRegistersSeqRef.current ||
        prevActorScopeRef.current !== actorScopeKey
      ) {
        return;
      }
      if (!res.ok || !res.data) {
        setOfficeRegistersPageState({
          actorScopeKey,
          classId: activeOfficeClassId,
          teacherFilterId: officeHistoryTeacherFilter,
          fromDate: officeHistoryFromDate,
          toDate: officeHistoryToDate,
          offset: officeHistoryOffset,
          status: res.status,
          items: [],
          totalCount: null,
          hasMore: false,
          errorMessage: res.errorMessage || res.errorCode || null,
        });
        return;
      }
      setOfficeRegistersPageState({
        actorScopeKey,
        classId: activeOfficeClassId,
        teacherFilterId: officeHistoryTeacherFilter,
        fromDate: officeHistoryFromDate,
        toDate: officeHistoryToDate,
        offset: res.data.offset,
        status: 'READY',
        items: res.data.items,
        totalCount: res.data.totalCount,
        hasMore: res.data.hasMore,
        errorMessage: null,
      });
    });
  }, [
    isOffice,
    officeSyncedData,
    actorScopeKey,
    activeOfficeClassId,
    officeHistoryTeacherFilter,
    officeHistoryFromDate,
    officeHistoryToDate,
    officeHistoryOffset,
    officeReloadSeq,
    officeHistoryReloadSeq,
    language,
  ]);

  const syncedOfficeRegistersPage =
    isOffice &&
    officeRegistersPageState.actorScopeKey === actorScopeKey &&
    officeRegistersPageState.classId === activeOfficeClassId &&
    officeRegistersPageState.teacherFilterId === officeHistoryTeacherFilter &&
    officeRegistersPageState.fromDate === officeHistoryFromDate &&
    officeRegistersPageState.toDate === officeHistoryToDate &&
    officeRegistersPageState.offset === officeHistoryOffset
      ? officeRegistersPageState
      : null;

  const officeTeachersForActiveClass = useMemo(() => {
    if (!officeSyncedData) return [];
    const clsId = activeOfficeClass?.id ?? '';
    const byId = new Map<string, OfficeAttendanceTeacherOption>();
    for (const tOpt of officeSyncedData.teachers) {
      byId.set(tOpt.userId, tOpt);
    }
    if (syncedOfficeRegistersPage?.status === 'READY' && clsId) {
      for (const reg of syncedOfficeRegistersPage.items) {
        const existing = byId.get(reg.teacherUserId);
        if (existing) {
          if (!existing.hasSavedRegisterInClass[clsId]) {
            byId.set(reg.teacherUserId, {
              ...existing,
              hasSavedRegisterInClass: {
                ...existing.hasSavedRegisterInClass,
                [clsId]: true,
              },
            });
          }
        } else {
          byId.set(reg.teacherUserId, {
            userId: reg.teacherUserId,
            fullName:
              officeSyncedData.accountNamesById[reg.teacherUserId] ||
              `@${reg.teacherUserId.slice(0, 8)}`,
            username: '',
            accountStatus: null,
            hasActiveAssignmentInClass: {},
            hasSavedRegisterInClass: { [clsId]: true },
            isHomeroomInClass: {},
          });
        }
      }
    }
    return [...byId.values()].sort((a, b) => {
      const aScore =
        (clsId && a.isHomeroomInClass[clsId] ? 4 : 0) +
        (clsId && a.hasActiveAssignmentInClass[clsId] ? 2 : 0) +
        (clsId && a.hasSavedRegisterInClass[clsId] ? 1 : 0);
      const bScore =
        (clsId && b.isHomeroomInClass[clsId] ? 4 : 0) +
        (clsId && b.hasActiveAssignmentInClass[clsId] ? 2 : 0) +
        (clsId && b.hasSavedRegisterInClass[clsId] ? 1 : 0);
      if (aScore !== bScore) return bScore - aScore;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [officeSyncedData, activeOfficeClass, syncedOfficeRegistersPage]);

  const activeOfficeTeacher = useMemo(() => {
    if (!isOffice || officeTeachersForActiveClass.length === 0) return null;
    const explicit = officeTeachersForActiveClass.find((tOpt) => tOpt.userId === officeSelectedTeacherId);
    if (explicit) return explicit;
    const clsId = activeOfficeClass?.id ?? '';
    return (
      officeTeachersForActiveClass.find((tOpt) => clsId && tOpt.hasActiveAssignmentInClass[clsId]) ??
      officeTeachersForActiveClass.find((tOpt) => clsId && tOpt.hasSavedRegisterInClass[clsId]) ??
      officeTeachersForActiveClass[0]
    );
  }, [isOffice, officeTeachersForActiveClass, officeSelectedTeacherId, activeOfficeClass]);

  const activeClassId = isTeacher
    ? activeTeacherClass?.id ?? ''
    : isOffice
    ? activeOfficeClass?.id ?? ''
    : '';
  const activeTeacherUserIdParam = isOffice ? activeOfficeTeacher?.userId ?? '' : '';
  const activeClassArchived = isOffice ? Boolean(activeOfficeClass?.isArchived) : false;

  const canReadRegisterNow =
    isValidIsoDate(schoolDate) &&
    Boolean(activeClassId) &&
    ((isTeacher && !isHydratingSchoolData && classesBackendStatus === 'READY') ||
      (isOffice && Boolean(officeSyncedData) && Boolean(activeTeacherUserIdParam)));

  const currentSnapshotRef = useRef({
    actorScopeKey,
    accessMode,
    classId: activeClassId,
    schoolDate,
    teacherUserId: activeTeacherUserIdParam,
    canReadRegisterNow,
  });
  currentSnapshotRef.current = {
    actorScopeKey,
    accessMode,
    classId: activeClassId,
    schoolDate,
    teacherUserId: activeTeacherUserIdParam,
    canReadRegisterNow,
  };

  const loadRegister = useCallback(
    async (options?: {
      preserveDraftOnSuccess?: boolean;
      recoverySnapshot?: PendingConflictRecovery;
    }) => {
      const snap = currentSnapshotRef.current;
      const seq = ++registerSeqRef.current;

      if (!snap.canReadRegisterNow || !snap.classId) {
        setPendingConflictRecovery(null);
        setIsRetryingConflictRefresh(false);
        invalidateAuditState(snap.actorScopeKey);
        setRegisterState({
          actorScopeKey: snap.actorScopeKey,
          accessMode: snap.accessMode,
          classId: snap.classId,
          schoolDate: snap.schoolDate,
          teacherUserId: snap.teacherUserId,
          status: 'IDLE',
          data: null,
          errorCode: null,
          errorMessage: null,
        });
        return { ok: false as const, data: null };
      }

      const candidateRecovery =
        options?.recoverySnapshot ?? pendingConflictRecoveryRef.current;
      const activeRecovery = doesRecoveryMatchScope(candidateRecovery, snap)
        ? candidateRecovery
        : null;

      if (activeRecovery) {
        setIsRetryingConflictRefresh(true);
        setRegisterState({
          actorScopeKey: snap.actorScopeKey,
          accessMode: snap.accessMode,
          classId: snap.classId,
          schoolDate: snap.schoolDate,
          teacherUserId: snap.teacherUserId,
          status: 'READY',
          data: activeRecovery.previousRegister,
          errorCode: null,
          errorMessage: null,
        });
      } else {
        setRegisterState({
          actorScopeKey: snap.actorScopeKey,
          accessMode: snap.accessMode,
          classId: snap.classId,
          schoolDate: snap.schoolDate,
          teacherUserId: snap.teacherUserId,
          status: 'LOADING',
          data: null,
          errorCode: null,
          errorMessage: null,
        });
      }

      const res = await fetchAttendanceRegister({
        classId: snap.classId,
        schoolDate: snap.schoolDate,
        teacherUserId: snap.teacherUserId || undefined,
        language,
      });

      if (
        !isAttendanceRegisterResultApplicable({
          isMounted: mountedRef.current,
          requestSeq: seq,
          currentRequestSeq: registerSeqRef.current,
          originActorScopeKey: snap.actorScopeKey,
          originClassId: snap.classId,
          originSchoolDate: snap.schoolDate,
          originTeacherUserId: snap.teacherUserId,
          currentActorScopeKey: currentSnapshotRef.current.actorScopeKey,
          currentAccessMode: currentSnapshotRef.current.accessMode,
          currentClassId: currentSnapshotRef.current.classId,
          currentSchoolDate: currentSnapshotRef.current.schoolDate,
          currentTeacherUserId: currentSnapshotRef.current.teacherUserId,
        })
      ) {
        if (mountedRef.current && seq === registerSeqRef.current) {
          setIsRetryingConflictRefresh(false);
        }
        return { ok: false as const, data: null };
      }

      setIsRetryingConflictRefresh(false);

      if (!res.ok || !res.data) {
        if (res.status === 'UNAUTHORIZED') {
          setPendingConflictRecovery(null);
          setDraftByStudentId({});
          setReasonText('');
          pendingIntentRef.current = null;
          invalidateAuditState(snap.actorScopeKey);
          setRegisterState({
            actorScopeKey: snap.actorScopeKey,
            accessMode: snap.accessMode,
            classId: snap.classId,
            schoolDate: snap.schoolDate,
            teacherUserId: snap.teacherUserId,
            status: 'UNAUTHORIZED',
            data: null,
            errorCode: res.errorCode || null,
            errorMessage: res.errorMessage || res.errorCode || null,
          });
          return { ok: false as const, data: null };
        }

        if (activeRecovery) {
          const refreshErr =
            res.errorMessage ||
            res.errorCode ||
            pickText(
              {
                ar: 'تعذر تحديث السجل من الخادم. تم الاحتفاظ بمسودتك للمحاولة مجدداً.',
                fr: 'Impossible d’actualiser le registre. Votre brouillon est conservé pour réessayer.',
                en: 'Could not refresh the latest register. Your unsaved edits are preserved to retry safely.',
              },
              language,
            );
          setPendingConflictRecovery({
            ...activeRecovery,
            refreshErrorMessage: refreshErr,
          });
          setDraftByStudentId(cloneAttendanceDraft(activeRecovery.unsavedDraftByStudentId));
          setReasonText(activeRecovery.unsavedReasonText);
          pendingIntentRef.current = null;
          setRegisterState({
            actorScopeKey: snap.actorScopeKey,
            accessMode: snap.accessMode,
            classId: snap.classId,
            schoolDate: snap.schoolDate,
            teacherUserId: snap.teacherUserId,
            status: 'READY',
            data: activeRecovery.previousRegister,
            errorCode: null,
            errorMessage: null,
          });
          return { ok: false as const, data: null };
        }

        invalidateAuditState(snap.actorScopeKey);
        setRegisterState({
          actorScopeKey: snap.actorScopeKey,
          accessMode: snap.accessMode,
          classId: snap.classId,
          schoolDate: snap.schoolDate,
          teacherUserId: snap.teacherUserId,
          status: res.status,
          data: null,
          errorCode: res.errorCode || null,
          errorMessage: res.errorMessage || res.errorCode || null,
        });
        return { ok: false as const, data: null };
      }

      if (activeRecovery) {
        const reconciled = reconcileConflictWithFreshRegister(
          res.data,
          activeRecovery.unsavedDraftByStudentId,
          activeRecovery.previousRegister.entries,
        );
        setPendingConflictRecovery(null);
        pendingIntentRef.current = null;
        setDraftByStudentId(reconciled.preservedDraftByStudentId);
        setReasonText(res.data.status === 'SUBMITTED' ? activeRecovery.unsavedReasonText : '');
        setSaveFeedback(null);
        setConflictBanner({
          kind: activeRecovery.conflictKind,
          droppedCount: reconciled.droppedStudentIds.length,
          addedNames: reconciled.addedUnmarkedStudentNames,
        });
      } else if (!options?.preserveDraftOnSuccess) {
        setDraftByStudentId({});
        setReasonText('');
        pendingIntentRef.current = null;
      }

      if ((res.data.registerId ?? '') !== auditRegisterIdRef.current) {
        invalidateAuditState(snap.actorScopeKey);
      }

      setConfirmedSavePendingRefresh(null);
      setRegisterState({
        actorScopeKey: snap.actorScopeKey,
        accessMode: snap.accessMode,
        classId: snap.classId,
        schoolDate: snap.schoolDate,
        teacherUserId: snap.teacherUserId,
        status: 'READY',
        data: res.data,
        errorCode: null,
        errorMessage: null,
      });

      return { ok: true as const, data: res.data };
    },
    [invalidateAuditState, language, setPendingConflictRecovery],
  );

  useEffect(() => {
    pendingIntentRef.current = null;
    setPendingConflictRecovery(null);
    setIsRetryingConflictRefresh(false);
    invalidateAuditState(actorScopeKey);
    setDraftByStudentId({});
    setReasonText('');
    setSaveFeedback(null);
    setConfirmedSavePendingRefresh(null);
    setConflictBanner(null);
    void loadRegister();
  }, [
    actorScopeKey,
    accessMode,
    activeClassId,
    schoolDate,
    activeTeacherUserIdParam,
    canReadRegisterNow,
    loadRegister,
    invalidateAuditState,
    setPendingConflictRecovery,
  ]);

  // Synchronous render-time scope gate for register data
  const isRegisterScopeSynced =
    registerState.actorScopeKey === actorScopeKey &&
    registerState.accessMode === accessMode &&
    registerState.classId === activeClassId &&
    registerState.schoolDate === schoolDate &&
    registerState.teacherUserId === activeTeacherUserIdParam;

  const visibleRegister: AttendanceRegisterData | null =
    isRegisterScopeSynced && registerState.status === 'READY' ? registerState.data : null;

  visibleRegisterIdRef.current = visibleRegister?.registerId ?? '';

  const activeRecoveryForScope = doesRecoveryMatchScope(pendingConflictRecovery, {
    actorScopeKey,
    accessMode,
    classId: activeClassId,
    schoolDate,
    teacherUserId: activeTeacherUserIdParam,
  })
    ? pendingConflictRecovery
    : null;
  const isConflictRecoveryActive = Boolean(activeRecoveryForScope);

  const loadAuditHistory = useCallback(
    async (registerId: string) => {
      const seq = ++auditSeqRef.current;
      const originScope = actorScopeKey;
      if (!registerId || visibleRegisterIdRef.current !== registerId) return;
      auditRegisterIdRef.current = registerId;
      setAuditState({
        actorScopeKey: originScope,
        registerId,
        status: 'LOADING',
        items: [],
        errorMessage: null,
      });
      const res = await fetchAttendanceAudit({ registerId, language });
      if (
        !mountedRef.current ||
        seq !== auditSeqRef.current ||
        currentSnapshotRef.current.actorScopeKey !== originScope ||
        visibleRegisterIdRef.current !== registerId
      ) {
        return;
      }
      if (!res.ok) {
        setAuditState({
          actorScopeKey: originScope,
          registerId,
          status: res.status,
          items: [],
          errorMessage: res.errorMessage || res.errorCode || null,
        });
        return;
      }
      setAuditState({
        actorScopeKey: originScope,
        registerId,
        status: 'READY',
        items: res.data ?? [],
        errorMessage: null,
      });
    },
    [actorScopeKey, language],
  );

  useEffect(() => {
    if (showAuditPanel && visibleRegister?.registerId) {
      void loadAuditHistory(visibleRegister.registerId);
    }
  }, [showAuditPanel, visibleRegister?.registerId, loadAuditHistory]);

  const isAuditScopeSynced = isAttendanceAuditStateApplicable({
    actorScopeKey,
    visibleRegisterId: visibleRegister?.registerId,
    auditActorScopeKey: auditState.actorScopeKey,
    auditRegisterId: auditState.registerId,
  });

  const markCounts = useMemo(
    () =>
      visibleRegister
        ? countAttendanceMarks(visibleRegister.entries, draftByStudentId)
        : { total: 0, notRecorded: 0, present: 0, absent: 0, late: 0, excused: 0 },
    [visibleRegister, draftByStudentId],
  );

  const actionAvailability = useMemo(
    () =>
      resolveRegisterActionAvailability({
        register: visibleRegister,
        accessMode,
        classIsArchived: activeClassArchived,
        draftByStudentId,
        reasonText,
        now: cutoffNow,
      }),
    [visibleRegister, accessMode, activeClassArchived, draftByStudentId, reasonText, cutoffNow],
  );

  const effectiveCanEditFields =
    actionAvailability.canEditFields && !isConflictRecoveryActive;
  const effectiveCanSaveDraft =
    actionAvailability.canSaveDraft && !isConflictRecoveryActive;
  const effectiveCanSubmitOrCorrect =
    actionAvailability.canSubmitOrCorrect && !isConflictRecoveryActive;

  useEffect(() => {
    onDirtyChange?.(
      Boolean(
        visibleRegister &&
          (actionAvailability.isDirty || isConflictRecoveryActive) &&
          !confirmedSavePendingRefresh,
      ),
    );
  }, [
    visibleRegister,
    actionAvailability.isDirty,
    isConflictRecoveryActive,
    confirmedSavePendingRefresh,
    onDirtyChange,
  ]);

  const applyContextSwitch = (nextSwitch: PendingContextSwitch) => {
    pendingIntentRef.current = null;
    setPendingConflictRecovery(null);
    setIsRetryingConflictRefresh(false);
    invalidateAuditState(actorScopeKey);
    setDraftByStudentId({});
    setReasonText('');
    setSaveFeedback(null);
    setConflictBanner(null);
    setConfirmedSavePendingRefresh(null);
    if (nextSwitch.kind === 'class') {
      if (isTeacher) {
        setSharedSelectedClassId(nextSwitch.classId);
      } else {
        setOfficeSelectedClassId(nextSwitch.classId);
        setOfficeHistoryTeacherFilter('');
        setOfficeHistoryOffset(0);
      }
    } else if (nextSwitch.kind === 'date') {
      setSchoolDate(nextSwitch.schoolDate);
    } else if (nextSwitch.kind === 'teacher') {
      setOfficeSelectedTeacherId(nextSwitch.teacherUserId);
    } else if (nextSwitch.kind === 'preset') {
      if (nextSwitch.classId !== activeClassId) {
        setOfficeHistoryTeacherFilter('');
        setOfficeHistoryOffset(0);
      }
      setOfficeSelectedClassId(nextSwitch.classId);
      setOfficeSelectedTeacherId(nextSwitch.teacherUserId);
      setSchoolDate(nextSwitch.schoolDate);
    }
    setPendingSwitch(null);
  };

  const requestContextSwitch = (nextSwitch: PendingContextSwitch) => {
    if (visibleRegister && (actionAvailability.isDirty || isConflictRecoveryActive)) {
      setPendingSwitch(nextSwitch);
      return;
    }
    applyContextSwitch(nextSwitch);
  };

  const updatePupilMark = (studentId: string, nextMark: AttendanceMark | null) => {
    if (!visibleRegister || !effectiveCanEditFields || confirmedSavePendingRefresh) return;
    const serverEntry = visibleRegister.entries.find((e) => e.studentId === studentId);
    if (!serverEntry) return;
    if (visibleRegister.status === 'SUBMITTED' && nextMark === null) return;
    setSaveFeedback(null);
    setDraftByStudentId((prev) => {
      const current = getEffectiveAttendanceEntry(serverEntry, prev);
      const updated = { mark: nextMark, internalComment: current.internalComment };
      if (updated.mark === serverEntry.mark && updated.internalComment === serverEntry.internalComment) {
        const clone = { ...prev };
        delete clone[studentId];
        return clone;
      }
      return { ...prev, [studentId]: updated };
    });
  };

  const updatePupilComment = (studentId: string, nextComment: string) => {
    if (!visibleRegister || !effectiveCanEditFields || confirmedSavePendingRefresh) return;
    const serverEntry = visibleRegister.entries.find((e) => e.studentId === studentId);
    if (!serverEntry) return;
    setSaveFeedback(null);
    setDraftByStudentId((prev) => {
      const current = getEffectiveAttendanceEntry(serverEntry, prev);
      const updated = { mark: current.mark, internalComment: nextComment };
      if (updated.mark === serverEntry.mark && updated.internalComment === serverEntry.internalComment) {
        const clone = { ...prev };
        delete clone[studentId];
        return clone;
      }
      return { ...prev, [studentId]: updated };
    });
  };

  const handleMarkAllRemainingPresent = () => {
    if (!visibleRegister || !effectiveCanEditFields || confirmedSavePendingRefresh) return;
    setSaveFeedback(null);
    setDraftByStudentId((prev) => applyMarkAllPresentToNotRecorded(visibleRegister.entries, prev));
  };

  const handleSaveOrSubmit = async (submit: boolean) => {
    if (
      !visibleRegister ||
      inFlightSaveRef.current ||
      confirmedSavePendingRefresh ||
      isConflictRecoveryActive
    ) {
      return;
    }

    const payloadResult = buildAttendanceEntriesPayload(visibleRegister.entries, draftByStudentId);
    if (!payloadResult.ok) {
      setSaveFeedback({ type: 'error', text: payloadResult.errorMessage });
      return;
    }

    const intent = resolveAttendanceSaveIntent(pendingIntentRef.current, {
      classId: visibleRegister.classId,
      schoolDate: visibleRegister.schoolDate,
      teacherUserId: isOffice ? activeTeacherUserIdParam : null,
      expectedVersion: visibleRegister.version,
      rosterFingerprint: visibleRegister.rosterFingerprint,
      submit,
      reason: visibleRegister.status === 'SUBMITTED' ? reasonText : null,
      entries: payloadResult.patches,
    });
    pendingIntentRef.current = intent;

    inFlightSaveRef.current = true;
    setIsSaving(true);
    setSaveFeedback(null);

    const originScope = actorScopeKey;
    const originClassId = visibleRegister.classId;
    const originSchoolDate = visibleRegister.schoolDate;
    const originTeacherParam = activeTeacherUserIdParam;

    try {
      const saveRes = await saveAttendanceRegister({
        classId: intent.classId,
        schoolDate: intent.schoolDate,
        expectedVersion: intent.expectedVersion,
        rosterFingerprint: intent.rosterFingerprint,
        requestId: intent.requestId,
        entries: intent.entries,
        submit: intent.submit,
        reason: intent.reason,
        teacherUserId: intent.teacherUserId,
        language,
      });

      const currentSnap = currentSnapshotRef.current;
      if (
        !mountedRef.current ||
        currentSnap.actorScopeKey !== originScope ||
        currentSnap.classId !== originClassId ||
        currentSnap.schoolDate !== originSchoolDate ||
        currentSnap.teacherUserId !== originTeacherParam
      ) {
        return;
      }

      if (!saveRes.ok || !saveRes.data) {
        if (saveRes.status === 'UNAUTHORIZED') {
          pendingIntentRef.current = null;
          setPendingConflictRecovery(null);
          invalidateAuditState(originScope);
          setDraftByStudentId({});
          setReasonText('');
          setRegisterState({
            actorScopeKey: originScope,
            accessMode,
            classId: originClassId,
            schoolDate: originSchoolDate,
            teacherUserId: originTeacherParam,
            status: 'UNAUTHORIZED',
            data: null,
            errorCode: saveRes.errorCode || null,
            errorMessage: saveRes.errorMessage || null,
          });
          return;
        }

        if (
          saveRes.errorCode === 'version_conflict' ||
          saveRes.errorCode === 'roster_conflict'
        ) {
          pendingIntentRef.current = null;
          setConflictBanner(null);
          const recovery: PendingConflictRecovery = {
            actorScopeKey: originScope,
            accessMode,
            classId: originClassId,
            schoolDate: originSchoolDate,
            teacherUserId: originTeacherParam,
            conflictKind: saveRes.errorCode,
            previousRegister: visibleRegister,
            unsavedDraftByStudentId: cloneAttendanceDraft(draftByStudentId),
            unsavedReasonText: reasonText,
            refreshErrorMessage: null,
          };
          setPendingConflictRecovery(recovery);
          await loadRegister({ recoverySnapshot: recovery });
          return;
        }

        if (saveRes.errorCode === 'idempotency_conflict') {
          pendingIntentRef.current = null;
        }

        setSaveFeedback({
          type: 'error',
          text: saveRes.errorMessage || t('error'),
        });
        return;
      }

      // Confirmed/replayed save receipt received. Always read back fresh register state.
      pendingIntentRef.current = { ...intent, confirmedSavePendingRefresh: true };
      const freshReadback = await loadRegister();
      if (!mountedRef.current || currentSnapshotRef.current.actorScopeKey !== originScope) {
        return;
      }

      if (!freshReadback.ok || !freshReadback.data) {
        setConfirmedSavePendingRefresh(saveRes.data);
        setSaveFeedback({
          type: 'warning',
          text: pickText(
            {
              ar: `تم الحفظ على الخادم (نسخة ${saveRes.data.version})، لكن تعذر تحديث العرض النهائي تلقائياً. أعد القراءة دون إعادة الإرسال.`,
              fr: `Enregistré sur le serveur (v${saveRes.data.version}), mais le rafraîchissement a échoué. Actualisez la lecture sans renvoyer la sauvegarde.`,
              en: `Saved on the server (v${saveRes.data.version}), but refreshing the latest register state failed. Reload readback safely without re-submitting.`,
            },
            language,
          ),
        });
        return;
      }

      pendingIntentRef.current = null;
      setConfirmedSavePendingRefresh(null);
      setConflictBanner(null);
      setSaveFeedback({
        type: 'success',
        text:
          freshReadback.data.status === 'SUBMITTED'
            ? visibleRegister.status === 'SUBMITTED'
              ? pickText(
                  {
                    ar: `تم حفظ التصحيح المعتمد بنجاح (نسخة ${freshReadback.data.version}).`,
                    fr: `Correction enregistrée avec succès (v${freshReadback.data.version}).`,
                    en: `Submitted correction saved (v${freshReadback.data.version}).`,
                  },
                  language,
                )
              : pickText(
                  {
                    ar: `تم اعتماد سجل الحضور بنجاح (نسخة ${freshReadback.data.version}).`,
                    fr: `Registre soumis avec succès (v${freshReadback.data.version}).`,
                    en: `Attendance register submitted (v${freshReadback.data.version}).`,
                  },
                  language,
                )
            : pickText(
                {
                  ar: `تم حفظ المسودة بنجاح (نسخة ${freshReadback.data.version}).`,
                  fr: `Brouillon enregistré avec succès (v${freshReadback.data.version}).`,
                  en: `Draft saved (v${freshReadback.data.version}).`,
                },
                language,
              ),
      });

      if (showAuditPanel && freshReadback.data.registerId) {
        void loadAuditHistory(freshReadback.data.registerId);
      }
      if (isOffice) {
        setOfficeReloadSeq((n) => n + 1);
      }
    } finally {
      inFlightSaveRef.current = false;
      if (mountedRef.current) {
        setIsSaving(false);
      }
    }
  };

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

  // Teacher context loading/error/empty checks
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

  // Office context loading/error/empty checks
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

  if (isOffice && officeSyncedData && (officeSyncedData.classes.length === 0 || officeSyncedData.teachers.length === 0)) {
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

  const officeHistoryPageItems =
    syncedOfficeRegistersPage?.status === 'READY' ? syncedOfficeRegistersPage.items : [];
  const officeHistoryHasFilters = Boolean(
    officeHistoryTeacherFilter || officeHistoryFromDate || officeHistoryToDate,
  );
  const officeHistoryRangeStart = officeHistoryPageItems.length > 0 ? officeHistoryOffset + 1 : 0;
  const officeHistoryRangeEnd = officeHistoryOffset + officeHistoryPageItems.length;
  const officeHistoryTotalCount =
    syncedOfficeRegistersPage?.status === 'READY' ? syncedOfficeRegistersPage.totalCount : null;

  return (
    <div
      className="space-y-5"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      data-testid={isOffice ? 'office-attendance-workspace' : 'teacher-attendance-workspace'}
    >
      {/* Selector Bar */}
      <section className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Class Selector */}
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
                      ? ` — [${pickText({ ar: 'مؤرشف', fr: 'Archivée', en: 'Archived' }, language)}]`
                      : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Responsible Teacher Selector (Office/Owner only) OR Teacher Self Badge */}
          {isOffice ? (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                {pickText({ ar: 'المربي المسؤول', fr: 'Enseignant responsable', en: 'Responsible Teacher' }, language)}
              </label>
              <select
                aria-label={pickText({ ar: 'المربي المسؤول', fr: 'Enseignant responsable', en: 'Responsible Teacher' }, language)}
                data-testid="attendance-office-teacher-select"
                value={activeTeacherUserIdParam}
                onChange={(e) =>
                  requestContextSwitch({ kind: 'teacher', teacherUserId: e.target.value })
                }
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
              >
                {officeTeachersForActiveClass.map((tOpt) => {
                  const tags: string[] = [];
                  if (tOpt.hasActiveAssignmentInClass[activeClassId]) {
                    tags.push(pickText({ ar: 'مكلف حالياً', fr: 'Assigné', en: 'Assigned' }, language));
                  }
                  if (tOpt.hasSavedRegisterInClass[activeClassId]) {
                    tags.push(pickText({ ar: 'له سجل محفوظ', fr: 'Registres existants', en: 'Has Registers' }, language));
                  }
                  if (tOpt.accountStatus && tOpt.accountStatus !== 'APPROVED') {
                    tags.push(tOpt.accountStatus);
                  }
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
                {pickText({ ar: 'المربي المسؤول', fr: 'Enseignant responsable', en: 'Responsible Teacher' }, language)}
              </span>
              <div className="min-h-[44px] rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/50 px-3 py-2 flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-zinc-200">
                <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="truncate">{currentUser?.fullName}</span>
              </div>
            </div>
          )}

          {/* School Date Selector (Africa/Tunis YYYY-MM-DD) */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              {pickText({ ar: 'تاريخ اليوم الدراسي (تونس)', fr: 'Date scolaire (Africa/Tunis)', en: 'School Date (Africa/Tunis)' }, language)}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="School Date"
                data-testid="attendance-school-date-input"
                value={schoolDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    requestContextSwitch({ kind: 'date', schoolDate: val });
                  }
                }}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3 py-2 text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-white"
              />
              <button
                type="button"
                data-testid="attendance-refresh-btn"
                onClick={() => void loadRegister()}
                disabled={(registerState.status === 'LOADING' && isRegisterScopeSynced) || isRetryingConflictRefresh}
                className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                title={pickText({ ar: 'إعادة قراءة من الخادم', fr: 'Recharger depuis le serveur', en: 'Reload from server' }, language)}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Office Server-Filtered & Paginated Historical Registers Discovery (C3) */}
        {isOffice && activeClassId && (
          <div
            data-testid="office-historical-registers-panel"
            className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0" />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  {pickText(
                    {
                      ar: 'السجلات المحفوظة لهذا القسم (بحث وترقيم من الخادم):',
                      fr: 'Registres enregistrés pour cette classe (filtres et pagination serveur) :',
                      en: 'Saved registers for this class (server-filtered & paginated):',
                    },
                    language,
                  )}
                </span>
              </div>
              {officeHistoryPageItems.length > 0 && (
                <span
                  data-testid="office-registers-range-label"
                  className="text-[11px] font-mono tabular-nums font-bold text-slate-500 dark:text-zinc-400"
                >
                  {officeHistoryRangeStart}–{officeHistoryRangeEnd}
                  {officeHistoryTotalCount !== null ? ` / ${officeHistoryTotalCount}` : ''}
                </span>
              )}
            </div>

            {officeSyncedData?.hasMoreSavedRegisters && (
              <p
                data-testid="office-registers-bounded-notice"
                className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:text-amber-200"
              >
                {pickText(
                  {
                    ar: `الفهرس الأولي للمعلمين غطى أحدث ${officeSyncedData.savedRegisters.length} سجلاً من أصل ${officeSyncedData.totalSavedRegistersCount ?? '2000+'}. استخدم البحث والترقيم أدناه للوصول إلى جميع السجلات التاريخية من الخادم.`,
                    fr: `L’aperçu initial des enseignants couvre les ${officeSyncedData.savedRegisters.length} registres les plus récents sur ${officeSyncedData.totalSavedRegistersCount ?? '2000+'}. La liste paginée ci-dessous interroge l’historique complet côté serveur.`,
                    en: `Initial teacher-summary pre-index loaded the newest ${officeSyncedData.savedRegisters.length} of ${officeSyncedData.totalSavedRegistersCount ?? '2000+'} school registers. Use the server filters and pagination below to reach all historical registers.`,
                  },
                  language,
                )}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <select
                aria-label={pickText({ ar: 'تصفية حسب المربي', fr: 'Filtrer par enseignant', en: 'Filter by teacher' }, language)}
                data-testid="office-history-teacher-filter"
                value={officeHistoryTeacherFilter}
                onChange={(e) => {
                  setOfficeHistoryTeacherFilter(e.target.value);
                  setOfficeHistoryOffset(0);
                }}
                className="min-h-[38px] rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-zinc-100"
              >
                <option value="">
                  {pickText({ ar: 'جميع المربين', fr: 'Tous les enseignants', en: 'All Teachers' }, language)}
                </option>
                {officeTeachersForActiveClass.map((tOpt) => (
                  <option key={tOpt.userId} value={tOpt.userId}>
                    {tOpt.fullName}
                    {tOpt.accountStatus && tOpt.accountStatus !== 'APPROVED' ? ` (${tOpt.accountStatus})` : ''}
                  </option>
                ))}
              </select>

              <input
                type="date"
                aria-label={pickText({ ar: 'من تاريخ', fr: 'Du', en: 'From date' }, language)}
                data-testid="office-history-from-date"
                value={officeHistoryFromDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || isValidIsoDate(val)) {
                    setOfficeHistoryFromDate(val);
                    setOfficeHistoryOffset(0);
                  }
                }}
                className="min-h-[38px] rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3 py-1.5 text-xs font-mono tabular-nums font-bold text-slate-800 dark:text-zinc-100"
              />

              <input
                type="date"
                aria-label={pickText({ ar: 'إلى تاريخ', fr: 'Au', en: 'To date' }, language)}
                data-testid="office-history-to-date"
                value={officeHistoryToDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || isValidIsoDate(val)) {
                    setOfficeHistoryToDate(val);
                    setOfficeHistoryOffset(0);
                  }
                }}
                className="min-h-[38px] rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3 py-1.5 text-xs font-mono tabular-nums font-bold text-slate-800 dark:text-zinc-100"
              />

              {officeHistoryHasFilters && (
                <button
                  type="button"
                  data-testid="office-history-clear-filters-btn"
                  onClick={() => {
                    setOfficeHistoryTeacherFilter('');
                    setOfficeHistoryFromDate('');
                    setOfficeHistoryToDate('');
                    setOfficeHistoryOffset(0);
                  }}
                  className="min-h-[38px] rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-zinc-200"
                >
                  {pickText({ ar: 'مسح التصفية', fr: 'Réinitialiser', en: 'Clear Filters' }, language)}
                </button>
              )}
            </div>

            {!syncedOfficeRegistersPage || syncedOfficeRegistersPage.status === 'LOADING' ? (
              <p data-testid="office-registers-loading" className="text-xs font-semibold text-slate-500">
                {t('loading')}
              </p>
            ) : syncedOfficeRegistersPage.status !== 'READY' ? (
              <div
                data-testid="office-registers-error"
                role="alert"
                className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-red-700 dark:text-red-300"
              >
                <span>{syncedOfficeRegistersPage.errorMessage || t('error')}</span>
                <button
                  type="button"
                  onClick={() => setOfficeHistoryReloadSeq((n) => n + 1)}
                  className="rounded-lg bg-red-700 hover:bg-red-800 px-2.5 py-1 text-white text-[11px] font-bold"
                >
                  {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
                </button>
              </div>
            ) : officeHistoryPageItems.length === 0 ? (
              <p data-testid="office-registers-empty" className="text-xs text-slate-500 dark:text-zinc-400">
                {pickText(
                  {
                    ar: 'لا توجد سجلات حضور مطابقة لمعايير البحث في هذا القسم.',
                    fr: 'Aucun registre enregistré ne correspond aux filtres sélectionnés.',
                    en: 'No saved attendance registers match the selected filters for this class.',
                  },
                  language,
                )}
              </p>
            ) : (
              <div className="space-y-2.5">
                <div className="flex flex-wrap gap-2">
                  {officeHistoryPageItems.map((reg) => {
                    const teacherName =
                      officeSyncedData?.accountNamesById[reg.teacherUserId] ||
                      `@${reg.teacherUserId.slice(0, 8)}`;
                    const isActive =
                      reg.classId === activeClassId &&
                      reg.teacherUserId === activeTeacherUserIdParam &&
                      reg.schoolDate === schoolDate;
                    return (
                      <button
                        key={reg.registerId}
                        type="button"
                        data-testid={`office-saved-register-${reg.registerId}`}
                        onClick={() =>
                          requestContextSwitch({
                            kind: 'preset',
                            classId: reg.classId,
                            teacherUserId: reg.teacherUserId,
                            schoolDate: reg.schoolDate,
                          })
                        }
                        className={`rounded-xl border px-3 py-1.5 text-[11px] font-bold font-mono tabular-nums transition-colors ${
                          isActive
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {reg.schoolDate} • {teacherName} • {reg.status} v{reg.version}
                      </button>
                    );
                  })}
                </div>

                {(officeHistoryOffset > 0 || syncedOfficeRegistersPage.hasMore) && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      data-testid="office-registers-prev-btn"
                      disabled={officeHistoryOffset === 0}
                      onClick={() =>
                        setOfficeHistoryOffset((prev) =>
                          Math.max(0, prev - OFFICE_SAVED_REGISTERS_DEFAULT_LIMIT),
                        )
                      }
                      className="min-h-[34px] rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-1 text-[11px] font-bold text-slate-700 dark:text-zinc-200 disabled:opacity-40"
                    >
                      {pickText({ ar: 'الأحدث (السابق)', fr: 'Plus récents', en: 'Newer' }, language)}
                    </button>
                    <button
                      type="button"
                      data-testid="office-registers-next-btn"
                      disabled={!syncedOfficeRegistersPage.hasMore}
                      onClick={() =>
                        setOfficeHistoryOffset((prev) => prev + OFFICE_SAVED_REGISTERS_DEFAULT_LIMIT)
                      }
                      className="min-h-[34px] rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-1 text-[11px] font-bold text-slate-700 dark:text-zinc-200 disabled:opacity-40"
                    >
                      {pickText({ ar: 'الأقدم (التالي)', fr: 'Plus anciens', en: 'Older' }, language)}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Pending Switch Confirmation Dialog */}
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
                {pickText(
                  {
                    ar: 'لديك تعديلات غير محفوظة في سجل الحضور الحالي.',
                    fr: 'Vous avez des modifications non enregistrées dans ce registre.',
                    en: 'You have unsaved changes in the current attendance register.',
                  },
                  language,
                )}
              </p>
              <p className="font-normal text-amber-800 dark:text-amber-300">
                {pickText(
                  {
                    ar: 'تبديل القسم أو التاريخ أو المربي سيؤدي إلى تجاهل التعديلات غير المحفوظة.',
                    fr: 'Changer de classe, de date ou d’enseignant ignorera vos modifications non enregistrées.',
                    en: 'Switching class, date, or responsible teacher will discard unsaved edits.',
                  },
                  language,
                )}
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
              {pickText(
                { ar: 'تجاهل التعديلات والمتابعة', fr: 'Ignorer et continuer', en: 'Discard & Switch' },
                language,
              )}
            </button>
            <button
              type="button"
              onClick={() => setPendingSwitch(null)}
              className="min-h-[40px] rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 px-4 py-2 text-xs font-bold text-amber-900 dark:text-amber-200"
            >
              {pickText({ ar: 'البقاء والمتابعة', fr: 'Rester ici', en: 'Keep Editing' }, language)}
            </button>
          </div>
        </div>
      )}

      {/* Confirmed Save + Failed Refresh Banner (never auto-retries save!) */}
      {confirmedSavePendingRefresh && (
        <div
          role="alert"
          data-testid="attendance-save-refresh-failed-banner"
          className="rounded-3xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="space-y-0.5">
            <p className="font-extrabold">
              {pickText(
                {
                  ar: `تم تأكيد الحفظ (النسخة ${confirmedSavePendingRefresh.version})، بانتظار تحديث القراءة.`,
                  fr: `Sauvegarde confirmée (v${confirmedSavePendingRefresh.version}), lecture actualisée requise.`,
                  en: `Save confirmed on server (v${confirmedSavePendingRefresh.version}), waiting for fresh readback.`,
                },
                language,
              )}
            </p>
          </div>
          <button
            type="button"
            data-testid="attendance-reload-readback-btn"
            onClick={() => void loadRegister()}
            className="min-h-[40px] rounded-xl bg-amber-700 hover:bg-amber-800 px-4 py-2 text-xs font-bold text-white inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>
              {pickText({ ar: 'تحديث القراءة', fr: 'Actualiser la lecture', en: 'Refresh Readback' }, language)}
            </span>
          </button>
        </div>
      )}

      {/* Register Load States */}
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
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
          </button>
        </div>
      )}

      {/* Conflict Refresh Failure Banner (recoverable snapshot kept; stale save disabled until read succeeds) */}
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
                  ? pickText(
                      {
                        ar: 'تغيرت قائمة القسم أثناء الحفظ، وتعذر تحديث أحدث نسخة من الخادم بعد.',
                        fr: 'La liste de la classe a changé pendant l’enregistrement et l’actualisation serveur a échoué.',
                        en: 'The class roster changed during save, and refreshing the latest register failed.',
                      },
                      language,
                    )
                  : pickText(
                      {
                        ar: 'تم تحديث السجل في جلسة أخرى، وتعذر قراءة النسخة الأحدث من الخادم بعد.',
                        fr: 'Ce registre a été modifié ailleurs et l’actualisation serveur a échoué.',
                        en: 'This register changed elsewhere, and refreshing the latest server state failed.',
                      },
                      language,
                    )}
              </span>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              {activeRecoveryForScope.refreshErrorMessage ||
                pickText(
                  {
                    ar: 'تم الاحتفاظ بتعديلاتك غير المحفوظة وبقائمة السجل السابقة بشكل آمن. أعد القراءة للمصالحة قبل الحفظ.',
                    fr: 'Vos saisies non enregistrées sont conservées en toute sécurité. Relancez la lecture pour réconcilier avant d’enregistrer.',
                    en: 'Your unsaved draft entries are safely preserved. Retry loading the server register to reconcile before saving.',
                  },
                  language,
                )}
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
                  : pickText(
                      { ar: 'إعادة قراءة السجل', fr: 'Réessayer l’actualisation', en: 'Retry Refresh' },
                      language,
                    )}
              </span>
            </button>
            <button
              type="button"
              data-testid="attendance-conflict-discard-btn"
              disabled={isRetryingConflictRefresh}
              onClick={() => {
                setPendingConflictRecovery(null);
                setDraftByStudentId({});
                setReasonText('');
                pendingIntentRef.current = null;
                void loadRegister();
              }}
              className="min-h-[40px] rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs font-bold text-amber-900 dark:text-amber-200 disabled:opacity-50"
            >
              {pickText(
                { ar: 'تجاهل المسودة وإعادة التحميل', fr: 'Abandonner et recharger', en: 'Discard Draft & Reload' },
                language,
              )}
            </button>
          </div>
        </div>
      )}

      {/* Loaded Register Workspace */}
      {visibleRegister && (
        <div className="space-y-4">
          {/* Conflict Reconciliation Banner */}
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
                    ? pickText(
                        {
                          ar: 'تغيرت قائمة التلاميذ على الخادم. تم تحديث القائمة والاحتفاظ بتعديلاتك للتلاميذ المتبقين للمراجعة قبل الحفظ.',
                          fr: 'La liste des élèves a changé sur le serveur. Vos saisies conservées sont prêtes à être vérifiées avant enregistrement.',
                          en: 'The eligible class roster changed on the server. Your edits for remaining pupils are preserved for explicit review before saving.',
                        },
                        language,
                      )
                    : pickText(
                        {
                          ar: 'تم تحديث السجل في جلسة أخرى. تم تحميل أحدث نسخة من الخادم مع الاحتفاظ بتعديلاتك للمراجعة قبل الحفظ.',
                          fr: 'Ce registre a été modifié ailleurs. La dernière version serveur a été chargée avec vos saisies conservées pour vérification.',
                          en: 'The register was updated elsewhere. Latest server state loaded with your draft changes preserved for review before saving.',
                        },
                        language,
                      )}
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
                  {pickText(
                    {
                      ar: `تم استبعاد ${conflictBanner.droppedCount} تلميذ(اً) لم يعودوا مؤهلين لهذا التاريخ.`,
                      fr: `${conflictBanner.droppedCount} élève(s) retiré(s) car non éligibles à cette date.`,
                      en: `${conflictBanner.droppedCount} pupil(s) removed from eligible roster for this date.`,
                    },
                    language,
                  )}
                </p>
              )}
            </div>
          )}

          {/* Save / Validation Feedback */}
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
              {saveFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{saveFeedback.text}</span>
            </div>
          )}

          {/* Register Status Summary + Bulk Action */}
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
                    <span>
                      {getRegisterStatusLabel(visibleRegister.status, visibleRegister.version, language)}
                    </span>
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
                  {pickText(
                    {
                      ar: 'تشمل الحصة اليومية جميع المواد في هذا القسم دون تقسيم السجل حسب المادة.',
                      fr: 'Ce registre quotidien de classe s’applique à l’ensemble des matières enseignées dans cette classe.',
                      en: 'This daily class register covers all subjects taught in this class; switching subjects does not split the register.',
                    },
                    language,
                  )}
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
                  <span>
                    {pickText({ ar: 'سجل التعديلات', fr: 'Historique d’audit', en: 'Audit History' }, language)}
                  </span>
                </button>
              )}
            </div>

            {/* Teacher Cutoff Lock Banner */}
            {actionAvailability.isTeacherCutoffClosed && (
              <div
                data-testid="attendance-teacher-cutoff-banner"
                className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3.5 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200"
              >
                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold">
                    {pickText(
                      {
                        ar: 'هذا السجل المعتمد للقراءة فقط',
                        fr: 'Ce registre soumis est en lecture seule',
                        en: 'This submitted register is read-only',
                      },
                      language,
                    )}
                  </p>
                  <p className="text-[11px] mt-0.5">
                    {pickText(
                      {
                        ar: 'انتهت مهلة التعديل للمربي عند منتصف الليل بتوقيت تونس. لإجراء تصحيح تاريخي، يرجى التواصل مع إدارة المدرسة.',
                        fr: 'Le délai de correction enseignant (minuit heure de Tunis) est écoulé. Contactez l’administration pour toute correction.',
                        en: 'The Teacher correction cutoff (midnight Africa/Tunis) has passed. Contact the School Office or Owner for historical corrections.',
                      },
                      language,
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Archived Class Notice */}
            {activeClassArchived && (
              <div
                data-testid="attendance-archived-class-banner"
                className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 p-3.5 text-xs font-semibold text-slate-600 dark:text-zinc-300"
              >
                {actionAvailability.isNewRegister
                  ? pickText(
                      {
                        ar: 'هذا القسم مؤرشف ولا يمكن إنشاء سجل حضور جديد له.',
                        fr: 'Cette classe est archivée ; aucun nouveau registre ne peut être créé.',
                        en: 'This class is archived; new registers cannot be created for it.',
                      },
                      language,
                    )
                  : pickText(
                      {
                        ar: 'هذا القسم مؤرشف. يمكن للإدارة تصحيح السجلات المحفوظة مسبقاً فقط.',
                        fr: 'Classe archivée. La direction peut uniquement corriger les registres déjà existants.',
                        en: 'Archived class. Office / Owner may still correct pre-existing saved registers with an audit reason.',
                      },
                      language,
                    )}
              </div>
            )}

            {/* Mark Distribution Strip + Mark All Remaining Present */}
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
                  {pickText(
                    {
                      ar: 'تعيين الباقين كـ «حاضر»',
                      fr: 'Marquer les restants « Présent »',
                      en: 'Mark all remaining Present',
                    },
                    language,
                  )}
                </button>
              )}
            </div>

            {/* Roster Entries */}
            {visibleRegister.entries.length === 0 ? (
              <div
                data-testid="attendance-empty-roster"
                className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40 p-6 text-center text-xs font-semibold text-slate-600 dark:text-zinc-300"
              >
                {pickText(
                  {
                    ar: 'لا يوجد تلاميذ مؤهلون في هذا القسم لهذا التاريخ.',
                    fr: 'Aucun élève éligible inscrit dans cette classe à cette date.',
                    en: 'No eligible pupils enrolled in this class on this school date.',
                  },
                  language,
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                {visibleRegister.entries.map((entry) => {
                  const effective = getEffectiveAttendanceEntry(entry, draftByStudentId);
                  const rowDirty =
                    effective.mark !== entry.mark ||
                    effective.internalComment !== entry.internalComment;
                  return (
                    <div
                      key={entry.studentId}
                      data-testid={`attendance-row-${entry.studentId}`}
                      className={`p-4 space-y-3 transition-colors ${
                        rowDirty ? 'bg-blue-50/40 dark:bg-blue-950/15' : 'bg-white dark:bg-[#111111]'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                              {entry.fullName}
                            </span>
                            {entry.studentCode && (
                              <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-zinc-400">
                                {entry.studentCode}
                              </span>
                            )}
                            <span
                              data-testid={`attendance-row-badge-${entry.studentId}`}
                              className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-extrabold ${getAttendanceMarkBadgeClass(effective.mark)}`}
                            >
                              {getAttendanceMarkLabel(effective.mark, language)}
                            </span>
                          </div>
                        </div>

                        {/* Large Accessible Mark Buttons */}
                        <div
                          role="group"
                          aria-label={`${entry.fullName} attendance mark`}
                          className="flex flex-wrap gap-1.5"
                        >
                          {visibleRegister.status === 'DRAFT' && (
                            <button
                              type="button"
                              disabled={!effectiveCanEditFields || isSaving || Boolean(confirmedSavePendingRefresh)}
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
                                disabled={!effectiveCanEditFields || isSaving || Boolean(confirmedSavePendingRefresh)}
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

                      {/* Staff-Private Internal Comment */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 shrink-0">
                          {pickText(
                            {
                              ar: 'ملاحظة داخلية للفريق فقط (لا تظهر للعائلات):',
                              fr: 'Note interne équipe (jamais visible aux familles) :',
                              en: 'Staff-only internal note (never shown to families):',
                            },
                            language,
                          )}
                        </label>
                        <input
                          type="text"
                          maxLength={MAX_ATTENDANCE_TEXT_LENGTH}
                          disabled={!effectiveCanEditFields || isSaving || Boolean(confirmedSavePendingRefresh)}
                          value={effective.internalComment}
                          onChange={(e) => updatePupilComment(entry.studentId, e.target.value)}
                          placeholder={pickText(
                            {
                              ar: 'ملاحظة اختيارية للطاقم التربوي والإداري...',
                              fr: 'Observation interne optionnelle...',
                              en: 'Optional internal staff note...',
                            },
                            language,
                          )}
                          className="flex-1 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3 py-2 text-xs text-slate-900 dark:text-white disabled:opacity-60"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Mandatory Correction Reason (Submitted Registers) */}
            {actionAvailability.requiresCorrectionReason && actionAvailability.canEditFields && (
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-extrabold text-slate-800 dark:text-zinc-200">
                  {pickText(
                    {
                      ar: 'سبب التصحيح (إلزامي لتعديل سجل معتمد):',
                      fr: 'Motif de correction (obligatoire pour un registre soumis) :',
                      en: 'Correction reason (required for editing a submitted register):',
                    },
                    language,
                  )}
                </label>
                <textarea
                  rows={2}
                  maxLength={MAX_ATTENDANCE_TEXT_LENGTH}
                  data-testid="attendance-correction-reason-input"
                  value={reasonText}
                  disabled={!effectiveCanEditFields || isSaving || Boolean(confirmedSavePendingRefresh)}
                  onChange={(e) => setReasonText(e.target.value)}
                  placeholder={pickText(
                    {
                      ar: 'مثال: وصول متأخر مؤكد من الاستقبال...',
                      fr: 'Ex. : arrivée tardive confirmée à l’accueil...',
                      en: 'e.g. Late arrival confirmed at front desk...',
                    },
                    language,
                  )}
                  className="w-full rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white"
                />
                <div className="flex justify-between text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                  <span>
                    {reasonText.trim().length === 0
                      ? pickText(
                          { ar: 'يرجى كتابة سبب واضح للتدقيق.', fr: 'Un motif clair est requis pour l’audit.', en: 'Clear audit reason required.' },
                          language,
                        )
                      : ''}
                  </span>
                  <span>
                    {reasonText.length} / {MAX_ATTENDANCE_TEXT_LENGTH}
                  </span>
                </div>
              </div>
            )}

            {/* Separate Save Draft & Submit / Save Correction Actions */}
            {actionAvailability.canEditFields && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                  {actionAvailability.hasUnmarkedEligiblePupils
                    ? pickText(
                        {
                          ar: `بقي ${markCounts.notRecorded} تلميذ(اً) بحالة «غير مسجل» — يمكنك حفظ المسودة والعودة لاحقاً، أما الاعتماد فيتطلب تحديد جميع التلاميذ.`,
                          fr: `${markCounts.notRecorded} élève(s) « Non enregistré » : le brouillon peut être sauvegardé, mais la soumission exige que tous soient marqués.`,
                          en: `${markCounts.notRecorded} pupil(s) are Not Recorded — you may save a draft, while Submit requires every eligible pupil marked.`,
                        },
                        language,
                      )
                    : !actionAvailability.isSubmitted && !actionAvailability.isRosterEmpty
                    ? pickText(
                        {
                          ar: 'جميع التلاميذ المؤهلين مسجلون وجاهزون للاعتماد.',
                          fr: 'Tous les élèves éligibles sont marqués et prêts pour la soumission.',
                          en: 'All eligible pupils are marked and ready to submit.',
                        },
                        language,
                      )
                    : ''}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!actionAvailability.isSubmitted && (
                    <button
                      type="button"
                      data-testid="attendance-save-draft-btn"
                      disabled={
                        isSaving ||
                        Boolean(confirmedSavePendingRefresh) ||
                        !effectiveCanSaveDraft
                      }
                      onClick={() => void handleSaveOrSubmit(false)}
                      className="min-h-[44px] inline-flex items-center gap-2 rounded-2xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 px-4 py-2.5 text-xs font-extrabold text-slate-800 dark:text-zinc-100 disabled:opacity-45"
                    >
                      <Save className="w-4 h-4" />
                      <span>
                        {isSaving
                          ? t('loading')
                          : pickText({ ar: 'حفظ كمسودة', fr: 'Enregistrer brouillon', en: 'Save Draft' }, language)}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="attendance-submit-btn"
                    disabled={
                      isSaving ||
                      Boolean(confirmedSavePendingRefresh) ||
                      !effectiveCanSubmitOrCorrect
                    }
                    onClick={() => void handleSaveOrSubmit(true)}
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-2xl bg-[#1E3A6D] hover:bg-[#162C54] px-5 py-2.5 text-xs font-extrabold text-white disabled:opacity-45"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isSaving
                        ? t('loading')
                        : actionAvailability.isSubmitted
                        ? pickText(
                            { ar: 'حفظ التصحيح المعتمد', fr: 'Enregistrer la correction', en: 'Save Correction' },
                            language,
                          )
                        : pickText(
                            { ar: 'اعتماد السجل وإرساله', fr: 'Soumettre le registre', en: 'Submit Register' },
                            language,
                          )}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Staff Audit History Panel */}
          {showAuditPanel && visibleRegister.registerId && (
            <section
              data-testid="attendance-audit-panel"
              className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-zinc-200 flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>
                    {pickText({ ar: 'سجل التدقيق غير القابل للتعديل', fr: 'Journal d’audit immuable', en: 'Immutable Attendance Audit Trail' }, language)}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => visibleRegister.registerId && void loadAuditHistory(visibleRegister.registerId)}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {pickText({ ar: 'تحديث', fr: 'Actualiser', en: 'Refresh' }, language)}
                </button>
              </div>

              {!isAuditScopeSynced || auditState.status === 'LOADING' ? (
                <p data-testid="attendance-audit-loading" className="text-xs text-slate-500">
                  {t('loading')}
                </p>
              ) : auditState.status !== 'READY' ? (
                <p data-testid="attendance-audit-error" className="text-xs font-semibold text-red-600 dark:text-red-400">
                  {auditState.errorMessage || t('error')}
                </p>
              ) : (() => {
                const scopedAuditItems = auditState.items.filter(
                  (ev) => ev.registerId === visibleRegister.registerId,
                );
                if (scopedAuditItems.length === 0) {
                  return (
                    <p className="text-xs text-slate-500">
                      {pickText({ ar: 'لا توجد أحداث مسجلة بعد.', fr: 'Aucun événement enregistré.', en: 'No audit events recorded yet.' }, language)}
                    </p>
                  );
                }
                return (
                  <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {scopedAuditItems.map((ev) => {
                      const actorName =
                        ev.actorUserId === currentUser?.id
                          ? currentUser.fullName
                          : officeSyncedData?.accountNamesById[ev.actorUserId] ||
                            `@${ev.actorUserId.slice(0, 8)}`;
                      return (
                        <div key={ev.id} className="py-2.5 text-xs space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-slate-900 dark:text-white">
                                {getAuditEventLabel(ev.eventType, language)}
                              </span>
                              <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                                v{ev.registerVersion}
                              </span>
                              <span className="text-slate-600 dark:text-zinc-300">
                                — {actorName}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-zinc-400">
                              {formatAttendanceTimestamp(ev.recordedAt, language)}
                            </span>
                          </div>
                          {ev.reason && (
                            <p className="text-slate-700 dark:text-zinc-300">
                              <span className="font-bold">
                                {pickText({ ar: 'السبب:', fr: 'Motif :', en: 'Reason:' }, language)}{' '}
                              </span>
                              {ev.reason}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </section>
          )}
        </div>
      )}
    </div>
  );
};
