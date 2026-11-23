import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import {
  canAccessAppTab,
  canManageClassesUi,
  canReviewOrdinaryAccountsUi,
  resolveTeacherAssignedClasses,
} from '../../homepages/homepageAccess';
import { filterClassRoster, filterSchoolClasses } from '../../../lib/classes/classFilters';
import { CANONICAL_SCHOOL_LEVELS } from '../../../lib/schoolOperations';
import type { ClassesManagementViewProps } from '../ClassesManagementView';
import { useClassesMutations, type ActiveClassesForm } from './useClassesMutations';

export const ROSTER_PAGE_SIZE = 25;
export type { ActiveClassesForm };

export function useClassesManagement({
  initialClasses = [],
  initialRosters = {},
  backendStatus = 'BACKEND_NOT_IMPLEMENTED',
  onRefresh,
}: Pick<ClassesManagementViewProps, 'initialClasses' | 'initialRosters' | 'backendStatus' | 'onRefresh'>) {
  const {
    currentUser,
    language,
    t,
    selectedClassId: sharedSelectedClassId,
    setSelectedClassId: setSharedSelectedClassId,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedClassId, setLocalSelectedClassId] = useState<string | null>(sharedSelectedClassId || null);

  const setSelectedClassId = (id: string | null) => {
    setLocalSelectedClassId(id);
    if (id) {
      setSharedSelectedClassId?.(id);
    }
  };

  useEffect(() => {
    if (sharedSelectedClassId !== undefined && sharedSelectedClassId !== selectedClassId) {
      setLocalSelectedClassId(sharedSelectedClassId);
    }
  }, [sharedSelectedClassId]);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectionActorId, setSelectionActorId] = useState<string | null>(null);
  const rosterContainerRef = useRef<HTMLDivElement | null>(null);
  const lastClickedStudentIdRef = useRef<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [rosterPage, setRosterPage] = useState(1);

  useEffect(() => {
    if (backendStatus === 'READY' && selectedClassId && selectedStudentId) {
      const roster = initialRosters[selectedClassId];
      if (Array.isArray(roster)) {
        const exists = roster.some((s) => s.studentId === selectedStudentId);
        if (!exists) {
          setSelectedStudentId(null);
          setSelectionActorId(null);
        }
      }
    }
  }, [backendStatus, selectedClassId, selectedStudentId, initialRosters]);

  useEffect(() => {
    if (!selectedStudentId && lastClickedStudentIdRef.current) {
      const btn = rosterContainerRef.current?.querySelector<HTMLButtonElement>(
        `[data-testid="view-student-${lastClickedStudentIdRef.current}"]`,
      );
      if (btn instanceof HTMLElement) {
        btn.focus();
      } else {
        const heading = rosterContainerRef.current?.querySelector<HTMLElement>('#roster-heading');
        if (heading instanceof HTMLElement) heading.focus();
      }
      lastClickedStudentIdRef.current = null;
    }
  }, [selectedStudentId]);

  const isAuthorized = canAccessAppTab(currentUser, 'classes');
  const isBackendUnauthorized = backendStatus === 'UNAUTHORIZED';
  const canManage = canManageClassesUi(currentUser) && !isBackendUnauthorized;
  const isTeacherView = currentUser?.role === 'TEACHER' && !canManage;
  const canLoadAccounts = canManage && canReviewOrdinaryAccountsUi(currentUser);

  const scopedInitialClasses = useMemo(
    () => (isTeacherView ? resolveTeacherAssignedClasses(currentUser, initialClasses) : initialClasses),
    [isTeacherView, currentUser, initialClasses],
  );

  useEffect(() => {
    setSelectedClassId(null);
    setSelectedStudentId(null);
    setStudentSearchQuery('');
    setRosterPage(1);
    setSelectedLevel('ALL');
    setSelectedYear('ALL');
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    if (
      isBackendUnauthorized ||
      (selectedClassId && !scopedInitialClasses.some((cls) => cls.id === selectedClassId))
    ) {
      setSelectedClassId(null);
      setSelectedStudentId(null);
      setStudentSearchQuery('');
      setRosterPage(1);
    }
  }, [isBackendUnauthorized, scopedInitialClasses, selectedClassId]);

  const levelOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: { value: string; label: string }[] = [];
    if (!isTeacherView) {
      for (const lbl of [t('level1'), t('level2'), t('level3'), t('level4'), t('level5'), t('level6')]) {
        if (lbl && !seen.has(lbl)) {
          seen.add(lbl);
          list.push({ value: lbl, label: lbl });
        }
      }
      for (const lvl of CANONICAL_SCHOOL_LEVELS) {
        if (!seen.has(lvl.code)) {
          seen.add(lvl.code);
          list.push({
            value: lvl.code,
            label: language === 'ar' ? lvl.labelAr : language === 'fr' ? lvl.labelFr : lvl.labelEn,
          });
        }
      }
    }
    for (const cls of scopedInitialClasses) {
      if (cls.level && !seen.has(cls.level)) {
        seen.add(cls.level);
        list.push({ value: cls.level, label: cls.level });
      }
    }
    return list;
  }, [isTeacherView, scopedInitialClasses, language, t]);

  const yearOptions = useMemo(() => {
    const seen = new Set<string>(isTeacherView ? [] : ['2025-2026', '2026-2027']);
    for (const cls of scopedInitialClasses) {
      if (cls.academicYear) seen.add(cls.academicYear);
    }
    return [...seen];
  }, [isTeacherView, scopedInitialClasses]);

  const effectiveSelectedLevel =
    selectedLevel === 'ALL' ||
    levelOptions.some((opt) => opt.value === selectedLevel) ||
    scopedInitialClasses.some((cls) => cls.level === selectedLevel || cls.levelCode === selectedLevel)
      ? selectedLevel
      : 'ALL';

  const effectiveSelectedYear =
    selectedYear === 'ALL' || yearOptions.includes(selectedYear) ? selectedYear : 'ALL';

  const filteredClasses = useMemo(
    () => filterSchoolClasses(scopedInitialClasses, searchQuery, effectiveSelectedLevel, effectiveSelectedYear),
    [scopedInitialClasses, searchQuery, effectiveSelectedLevel, effectiveSelectedYear],
  );

  const selectedClass = useMemo(
    () =>
      !isBackendUnauthorized && selectedClassId
        ? scopedInitialClasses.find((cls) => cls.id === selectedClassId) ?? null
        : null,
    [isBackendUnauthorized, scopedInitialClasses, selectedClassId],
  );

  const rawRoster = useMemo(
    () => (selectedClass ? initialRosters[selectedClass.id] ?? [] : []),
    [initialRosters, selectedClass],
  );

  const filteredRoster = useMemo(
    () => filterClassRoster(rawRoster, studentSearchQuery),
    [rawRoster, studentSearchQuery],
  );

  const totalRosterPages = Math.max(1, Math.ceil(filteredRoster.length / ROSTER_PAGE_SIZE));
  const safeRosterPage = Math.min(rosterPage, totalRosterPages);
  const paginatedRoster = useMemo(() => {
    const start = (safeRosterPage - 1) * ROSTER_PAGE_SIZE;
    return filteredRoster.slice(start, start + ROSTER_PAGE_SIZE);
  }, [filteredRoster, safeRosterPage]);

  const mutations = useClassesMutations({
    currentUser,
    language,
    t,
    initialClasses,
    backendStatus,
    canManage,
    canLoadAccounts,
    onRefresh,
  });

  return {
    currentUser, language, t, sharedSelectedClassId, setSharedSelectedClassId,
    searchQuery, setSearchQuery, selectedLevel, setSelectedLevel, selectedYear, setSelectedYear,
    selectedClassId, setSelectedClassId, selectedStudentId, setSelectedStudentId,
    selectionActorId, setSelectionActorId, rosterContainerRef, lastClickedStudentIdRef,
    studentSearchQuery, setStudentSearchQuery, rosterPage, setRosterPage,
    isAuthorized, isBackendUnauthorized, canManage, isTeacherView, canLoadAccounts,
    scopedInitialClasses, levelOptions, yearOptions, effectiveSelectedLevel, effectiveSelectedYear,
    filteredClasses, selectedClass, rawRoster, filteredRoster, totalRosterPages, safeRosterPage,
    paginatedRoster,
    ...mutations,
  };
}
