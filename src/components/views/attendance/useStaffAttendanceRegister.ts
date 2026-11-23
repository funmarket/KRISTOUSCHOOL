import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { fetchAttendanceAudit } from '../../../lib/attendance/api';
import {
  getNextTunisMidnightDelayMs,
  getTunisTodayIsoDate,
  isValidIsoDate,
} from '../../../lib/attendance/dateUtils';
import {
  applyMarkAllPresentToNotRecorded,
  buildAttendanceActorScopeKey,
  countAttendanceMarks,
  getEffectiveAttendanceEntry,
  isAttendanceAuditStateApplicable,
  resolveAttendanceAccessMode,
  resolveRegisterActionAvailability,
} from '../../../lib/attendance/logic';
import type { AttendanceAuditEvent, AttendanceMark, BackendOpStatus } from '../../../types';
import {
  useOfficeAttendanceDiscovery,
  type PendingContextSwitch,
} from './useOfficeAttendanceDiscovery';
import { useRegisterDraftAndSave } from './useRegisterDraftAndSave';

export interface ScopedAuditState {
  actorScopeKey: string;
  registerId: string;
  status: BackendOpStatus | 'LOADING';
  items: AttendanceAuditEvent[];
  errorMessage: string | null;
}

interface UseStaffAttendanceRegisterParams {
  onDirtyChange?: (isDirty: boolean) => void;
}

export function useStaffAttendanceRegister({ onDirtyChange }: UseStaffAttendanceRegisterParams) {
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
  const actorScopeKey = useMemo(() => buildAttendanceActorScopeKey(currentUser), [currentUser]);

  const [schoolDate, setSchoolDate] = useState<string>(() => getTunisTodayIsoDate());
  const [cutoffNow, setCutoffNow] = useState<Date>(() => new Date());
  const [pendingSwitch, setPendingSwitch] = useState<PendingContextSwitch | null>(null);
  const [showAuditPanel, setShowAuditPanel] = useState<boolean>(false);

  const [auditState, setAuditState] = useState<ScopedAuditState>({
    actorScopeKey,
    registerId: '',
    status: 'LOADING',
    items: [],
    errorMessage: null,
  });

  const mountedRef = useRef<boolean>(true);
  const auditSeqRef = useRef<number>(0);
  const visibleRegisterIdRef = useRef<string>('');
  const auditRegisterIdRef = useRef<string>('');
  const currentActorScopeRef = useRef<string>(actorScopeKey);
  currentActorScopeRef.current = actorScopeKey;
  auditRegisterIdRef.current = auditState.registerId;

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
    const syncClock = () => setCutoffNow(new Date());
    const onVisibility = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') syncClock();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', syncClock);
      window.addEventListener('pageshow', syncClock);
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
    const timer = setTimeout(syncClock, getNextTunisMidnightDelayMs(cutoffNow));
    return () => {
      clearTimeout(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', syncClock);
        window.removeEventListener('pageshow', syncClock);
      }
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [cutoffNow]);

  const prevTopActorScopeRef = useRef<string>(actorScopeKey);
  useEffect(() => {
    if (prevTopActorScopeRef.current !== actorScopeKey) {
      prevTopActorScopeRef.current = actorScopeKey;
      setShowAuditPanel(false);
      setPendingSwitch(null);
      invalidateAuditState(actorScopeKey);
    }
  }, [actorScopeKey, invalidateAuditState]);

  const discovery = useOfficeAttendanceDiscovery({
    currentUser,
    language,
    isTeacher,
    isOffice,
    actorScopeKey,
    classesList,
    sharedSelectedClassId,
    setSharedSelectedClassId,
    mountedRef,
  });

  const activeClassId = isTeacher
    ? discovery.activeTeacherClass?.id ?? ''
    : isOffice
    ? discovery.activeOfficeClass?.id ?? ''
    : '';
  const activeTeacherUserIdParam = isOffice ? discovery.activeOfficeTeacher?.userId ?? '' : '';
  const activeClassArchived = isOffice ? Boolean(discovery.activeOfficeClass?.isArchived) : false;

  const canReadRegisterNow =
    isValidIsoDate(schoolDate) &&
    Boolean(activeClassId) &&
    ((isTeacher && !isHydratingSchoolData && classesBackendStatus === 'READY') ||
      (isOffice && Boolean(discovery.officeSyncedData) && Boolean(activeTeacherUserIdParam)));

  const loadAuditHistory = useCallback(
    async (registerId: string) => {
      const seq = ++auditSeqRef.current;
      const originScope = actorScopeKey;
      if (!registerId || visibleRegisterIdRef.current !== registerId) return;
      auditRegisterIdRef.current = registerId;
      setAuditState({ actorScopeKey: originScope, registerId, status: 'LOADING', items: [], errorMessage: null });
      const res = await fetchAttendanceAudit({ registerId, language });
      if (
        !mountedRef.current ||
        seq !== auditSeqRef.current ||
        currentActorScopeRef.current !== originScope ||
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
      setAuditState({ actorScopeKey: originScope, registerId, status: 'READY', items: res.data ?? [], errorMessage: null });
    },
    [actorScopeKey, language],
  );

  const onOfficeSaved = useCallback(() => {
    discovery.setOfficeReloadSeq((n) => n + 1);
  }, [discovery]);

  const draftAndSave = useRegisterDraftAndSave({
    actorScopeKey,
    accessMode,
    isOffice,
    activeClassId,
    schoolDate,
    activeTeacherUserIdParam,
    canReadRegisterNow,
    language,
    t,
    mountedRef,
    auditRegisterIdRef,
    invalidateAuditState,
    showAuditPanel,
    loadAuditHistory,
    onOfficeSaved,
  });

  const {
    visibleRegister,
    draftByStudentId,
    setDraftByStudentId,
    reasonText,
    setSaveFeedback,
    confirmedSavePendingRefresh,
    isConflictRecoveryActive,
    resetDraftForContextSwitch,
    cancelRegisterRequests,
  } = draftAndSave;

  visibleRegisterIdRef.current = visibleRegister?.registerId ?? '';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelRegisterRequests();
      discovery.cancelOfficeRequests();
      auditSeqRef.current += 1;
      onDirtyChange?.(false);
    };
  }, [cancelRegisterRequests, discovery.cancelOfficeRequests, onDirtyChange]);

  useEffect(() => {
    if (showAuditPanel && visibleRegister?.registerId) void loadAuditHistory(visibleRegister.registerId);
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

  const effectiveCanEditFields = actionAvailability.canEditFields && !isConflictRecoveryActive;
  const effectiveCanSaveDraft = actionAvailability.canSaveDraft && !isConflictRecoveryActive;
  const effectiveCanSubmitOrCorrect = actionAvailability.canSubmitOrCorrect && !isConflictRecoveryActive;

  useEffect(() => {
    onDirtyChange?.(
      Boolean(
        visibleRegister &&
          (actionAvailability.isDirty || isConflictRecoveryActive) &&
          !confirmedSavePendingRefresh,
      ),
    );
  }, [visibleRegister, actionAvailability.isDirty, isConflictRecoveryActive, confirmedSavePendingRefresh, onDirtyChange]);

  const applyContextSwitch = (nextSwitch: PendingContextSwitch) => {
    resetDraftForContextSwitch();
    if (nextSwitch.kind === 'class') {
      if (isTeacher) {
        setSharedSelectedClassId(nextSwitch.classId);
      } else {
        discovery.setOfficeSelectedClassId(nextSwitch.classId);
        discovery.setOfficeHistoryTeacherFilter('');
        discovery.setOfficeHistoryOffset(0);
      }
    } else if (nextSwitch.kind === 'date') {
      setSchoolDate(nextSwitch.schoolDate);
    } else if (nextSwitch.kind === 'teacher') {
      discovery.setOfficeSelectedTeacherId(nextSwitch.teacherUserId);
    } else if (nextSwitch.kind === 'preset') {
      if (nextSwitch.classId !== activeClassId) {
        discovery.setOfficeHistoryTeacherFilter('');
        discovery.setOfficeHistoryOffset(0);
      }
      discovery.setOfficeSelectedClassId(nextSwitch.classId);
      discovery.setOfficeSelectedTeacherId(nextSwitch.teacherUserId);
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

  return {
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
    schoolDate,
    activeClassId,
    activeTeacherUserIdParam,
    activeClassArchived,
    pendingSwitch,
    setPendingSwitch,
    showAuditPanel,
    setShowAuditPanel,
    auditState,
    isAuditScopeSynced,
    loadAuditHistory,
    markCounts,
    actionAvailability,
    effectiveCanEditFields,
    effectiveCanSaveDraft,
    effectiveCanSubmitOrCorrect,
    applyContextSwitch,
    requestContextSwitch,
    updatePupilMark,
    updatePupilComment,
    handleMarkAllRemainingPresent,
    ...discovery,
    ...draftAndSave,
  };
}
