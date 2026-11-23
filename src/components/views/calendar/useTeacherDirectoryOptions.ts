import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { canReviewOrdinaryAccountsUi } from '../../homepages/homepageAccess';
import { listAccountDirectory } from '../../../lib/accountGovernance';
import type { CalendarTeacherOption } from '../../../lib/calendar/calendarAudience';
import type { User } from '../../../types';

interface UseTeacherDirectoryOptionsParams {
  teacherOptions?: CalendarTeacherOption[];
  isSchoolCalendarManager: boolean;
  isAccountUnapproved: boolean;
  isUnauthorized: boolean;
  currentUser: User | null;
  activeScopeKey: string;
  mountedRef: MutableRefObject<boolean>;
  activeScopeRef: MutableRefObject<string>;
}

export function useTeacherDirectoryOptions({
  teacherOptions,
  isSchoolCalendarManager,
  isAccountUnapproved,
  isUnauthorized,
  currentUser,
  activeScopeKey,
  mountedRef,
  activeScopeRef,
}: UseTeacherDirectoryOptionsParams) {
  const [loadedTeacherOptions, setLoadedTeacherOptions] = useState<CalendarTeacherOption[]>([]);
  const [teacherDirectoryBlocked, setTeacherDirectoryBlocked] = useState<boolean>(false);
  const [loadingTeachers, setLoadingTeachers] = useState<boolean>(false);
  const teacherFetchGenRef = useRef<number>(0);

  const isTeacherDirectoryBlockedLocally =
    teacherOptions === undefined &&
    isSchoolCalendarManager &&
    !isAccountUnapproved &&
    !canReviewOrdinaryAccountsUi(currentUser);
  const effectiveTeacherOptions = teacherOptions ?? loadedTeacherOptions;
  const effectiveTeacherPickerBlocked =
    teacherOptions === undefined &&
    isSchoolCalendarManager &&
    (isTeacherDirectoryBlockedLocally || teacherDirectoryBlocked);

  useEffect(() => {
    return () => {
      teacherFetchGenRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (teacherOptions !== undefined) {
      setLoadedTeacherOptions([]);
      setTeacherDirectoryBlocked(false);
      setLoadingTeachers(false);
      return;
    }
    if (!isSchoolCalendarManager || isUnauthorized) {
      teacherFetchGenRef.current += 1;
      setLoadedTeacherOptions([]);
      setTeacherDirectoryBlocked(false);
      setLoadingTeachers(false);
      return;
    }
    if (!canReviewOrdinaryAccountsUi(currentUser)) {
      teacherFetchGenRef.current += 1;
      setLoadedTeacherOptions([]);
      setTeacherDirectoryBlocked(true);
      setLoadingTeachers(false);
      return;
    }

    const capturedScope = activeScopeKey;
    const teacherGen = ++teacherFetchGenRef.current;
    setLoadingTeachers(true);
    setTeacherDirectoryBlocked(false);

    void (async () => {
      const pageSize = 100;
      const collected: CalendarTeacherOption[] = [];
      const seenIds = new Set<string>();
      for (let offset = 0; ; offset += pageSize) {
        let res;
        try {
          res = await listAccountDirectory({
            status: 'APPROVED',
            role: 'TEACHER',
            limit: pageSize,
            offset,
          });
        } catch {
          res = { ok: false, errorCode: 'governance_operation_failed' as const };
        }
        if (
          !mountedRef.current ||
          activeScopeRef.current !== capturedScope ||
          teacherFetchGenRef.current !== teacherGen
        ) {
          return;
        }
        if (!res.ok || !res.data) {
          setLoadedTeacherOptions([]);
          setTeacherDirectoryBlocked(true);
          setLoadingTeachers(false);
          return;
        }
        for (const acc of res.data.items) {
          if (
            acc.accountStatus === 'APPROVED' &&
            (acc.activeRoles.includes('TEACHER') || acc.requestedRole === 'TEACHER') &&
            !seenIds.has(acc.id)
          ) {
            seenIds.add(acc.id);
            collected.push({
              id: acc.id,
              fullName: acc.fullName,
              username: acc.username,
            });
          }
        }
        if (
          res.data.items.length < pageSize ||
          offset + res.data.items.length >= res.data.totalCount
        ) {
          break;
        }
      }
      if (
        !mountedRef.current ||
        activeScopeRef.current !== capturedScope ||
        teacherFetchGenRef.current !== teacherGen
      ) {
        return;
      }
      setLoadedTeacherOptions(collected);
      setTeacherDirectoryBlocked(false);
      setLoadingTeachers(false);
    })();
  }, [teacherOptions, isSchoolCalendarManager, isUnauthorized, currentUser, activeScopeKey, mountedRef, activeScopeRef]);

  return {
    loadingTeachers,
    effectiveTeacherOptions,
    effectiveTeacherPickerBlocked,
  };
}
