import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { resolveTeacherAssignedClasses } from '../../homepages/homepageAccess';
import {
  fetchOfficeAttendanceContext,
  fetchOfficeSavedRegisters,
  OFFICE_SAVED_REGISTERS_DEFAULT_LIMIT,
  type OfficeAttendanceContextResult,
} from '../../../lib/attendance/api';
import type {
  BackendOpStatus,
  Language,
  OfficeAttendanceRegisterSummary,
  OfficeAttendanceTeacherOption,
  User,
} from '../../../types';

export interface ScopedOfficeState {
  actorScopeKey: string;
  status: BackendOpStatus | 'LOADING';
  data: OfficeAttendanceContextResult | null;
  errorMessage: string | null;
}

export interface ScopedOfficeRegistersState {
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

export type PendingContextSwitch =
  | { kind: 'class'; classId: string }
  | { kind: 'date'; schoolDate: string }
  | { kind: 'teacher'; teacherUserId: string }
  | { kind: 'preset'; classId: string; teacherUserId: string; schoolDate: string };

interface UseOfficeAttendanceDiscoveryParams {
  currentUser: User | null;
  language: Language;
  isTeacher: boolean;
  isOffice: boolean;
  actorScopeKey: string;
  classesList: Array<{ id: string; name: string; academicYear?: string }>;
  sharedSelectedClassId: string;
  setSharedSelectedClassId: (classId: string) => void;
  mountedRef: MutableRefObject<boolean>;
}

export function useOfficeAttendanceDiscovery({
  currentUser,
  language,
  isTeacher,
  isOffice,
  actorScopeKey,
  classesList,
  sharedSelectedClassId,
  setSharedSelectedClassId,
  mountedRef,
}: UseOfficeAttendanceDiscoveryParams) {
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

  const officeSeqRef = useRef<number>(0);
  const officeRegistersSeqRef = useRef<number>(0);
  const prevOfficeScopeRef = useRef<string>(actorScopeKey);

  const cancelOfficeRequests = useCallback(() => {
    officeSeqRef.current += 1;
    officeRegistersSeqRef.current += 1;
  }, []);

  useEffect(() => {
    if (prevOfficeScopeRef.current !== actorScopeKey) {
      prevOfficeScopeRef.current = actorScopeKey;
      officeSeqRef.current += 1;
      officeRegistersSeqRef.current += 1;
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
  }, [actorScopeKey]);

  useEffect(() => {
    const seq = ++officeSeqRef.current;
    if (!isOffice) {
      setOfficeState({ actorScopeKey, status: 'UNAUTHORIZED', data: null, errorMessage: null });
      return;
    }

    setOfficeState({ actorScopeKey, status: 'LOADING', data: null, errorMessage: null });

    void fetchOfficeAttendanceContext({ language }).then((res) => {
      if (!mountedRef.current || seq !== officeSeqRef.current || prevOfficeScopeRef.current !== actorScopeKey) {
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
      setOfficeState({ actorScopeKey, status: 'READY', data: res.data ?? null, errorMessage: null });
    });
  }, [isOffice, actorScopeKey, officeReloadSeq, language, mountedRef]);

  const teacherAssignedClasses = useMemo(
    () => (isTeacher ? resolveTeacherAssignedClasses(currentUser, classesList) : []),
    [isTeacher, currentUser, classesList],
  );

  const activeTeacherClass = useMemo(() => {
    if (!isTeacher || teacherAssignedClasses.length === 0) return null;
    return teacherAssignedClasses.find((cls) => cls.id === sharedSelectedClassId) ?? teacherAssignedClasses[0];
  }, [isTeacher, teacherAssignedClasses, sharedSelectedClassId]);

  useEffect(() => {
    if (isTeacher && activeTeacherClass && activeTeacherClass.id !== sharedSelectedClassId) {
      setSharedSelectedClassId(activeTeacherClass.id);
    }
  }, [isTeacher, activeTeacherClass, sharedSelectedClassId, setSharedSelectedClassId]);

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

  useEffect(() => {
    const seq = ++officeRegistersSeqRef.current;
    const basePageScope = {
      actorScopeKey,
      classId: activeOfficeClassId,
      teacherFilterId: officeHistoryTeacherFilter,
      fromDate: officeHistoryFromDate,
      toDate: officeHistoryToDate,
      offset: officeHistoryOffset,
    };

    if (!isOffice || !officeSyncedData || !activeOfficeClassId) {
      setOfficeRegistersPageState({
        ...basePageScope,
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
      ...basePageScope,
      status: 'LOADING',
      errorMessage: null,
    }));

    void fetchOfficeSavedRegisters({
      classId: activeOfficeClassId,
      teacherUserId: officeHistoryTeacherFilter || null,
      startDate: officeHistoryFromDate || null,
      endDate: officeHistoryToDate || null,
      limit: OFFICE_SAVED_REGISTERS_DEFAULT_LIMIT,
      offset: officeHistoryOffset,
      language,
    }).then((res) => {
      if (!mountedRef.current || seq !== officeRegistersSeqRef.current || prevOfficeScopeRef.current !== actorScopeKey) {
        return;
      }
      if (!res.ok || !res.data) {
        setOfficeRegistersPageState({
          ...basePageScope,
          status: res.status,
          items: [],
          totalCount: null,
          hasMore: false,
          errorMessage: res.errorMessage || res.errorCode || null,
        });
        return;
      }
      setOfficeRegistersPageState({
        ...basePageScope,
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
    mountedRef,
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
    for (const tOpt of officeSyncedData.teachers) byId.set(tOpt.userId, tOpt);

    if (syncedOfficeRegistersPage?.status === 'READY' && clsId) {
      for (const reg of syncedOfficeRegistersPage.items) {
        const existing = byId.get(reg.teacherUserId);
        if (existing) {
          if (!existing.hasSavedRegisterInClass[clsId]) {
            byId.set(reg.teacherUserId, {
              ...existing,
              hasSavedRegisterInClass: { ...existing.hasSavedRegisterInClass, [clsId]: true },
            });
          }
        } else {
          byId.set(reg.teacherUserId, {
            userId: reg.teacherUserId,
            fullName: officeSyncedData.accountNamesById[reg.teacherUserId] || `@${reg.teacherUserId.slice(0, 8)}`,
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

  return {
    officeSelectedClassId,
    setOfficeSelectedClassId,
    officeSelectedTeacherId,
    setOfficeSelectedTeacherId,
    officeReloadSeq,
    setOfficeReloadSeq,
    officeHistoryTeacherFilter,
    setOfficeHistoryTeacherFilter,
    officeHistoryFromDate,
    setOfficeHistoryFromDate,
    officeHistoryToDate,
    setOfficeHistoryToDate,
    officeHistoryOffset,
    setOfficeHistoryOffset,
    officeHistoryReloadSeq,
    setOfficeHistoryReloadSeq,
    officeState,
    officeSyncedData,
    teacherAssignedClasses,
    activeTeacherClass,
    activeOfficeClass,
    activeOfficeTeacher,
    officeTeachersForActiveClass,
    syncedOfficeRegistersPage,
    cancelOfficeRequests,
  };
}
