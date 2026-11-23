import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import {
  listSchoolStudents,
  getSchoolStudentIdentity,
  listAcademicYears,
  fetchSchoolClassesWithRosters,
  type SchoolStudentSummary,
  type SchoolStudentIdentityDetail,
  type AcademicYearItem,
} from '../../../lib/schoolOperations';
import { canAccessAppTab } from '../../homepages/homepageAccess';

export interface AvailableStudentClassItem {
  id: string;
  name: string;
  levelCode: string;
  academicYear?: string;
}

export function useStudentsManagement({
  initialSelectedStudentId,
}: {
  initialSelectedStudentId?: string | null;
}) {
  const { currentUser, language } = useApp();
  const isAuthorized = canAccessAppTab(currentUser, 'students');

  // List filters & state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('ALL');
  const [availableClasses, setAvailableClasses] = useState<AvailableStudentClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ALL');
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

  const [studentsData, setStudentsData] = useState<SchoolStudentSummary[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [listError, setListError] = useState<string | null>(null);

  // Detail view state
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    initialSelectedStudentId || null,
  );
  const [studentDetail, setStudentDetail] = useState<SchoolStudentIdentityDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRetrySeq, setDetailRetrySeq] = useState<number>(0);

  const actorKeyRef = useRef(currentUser?.id || 'anonymous');
  const actorSignature = `${currentUser?.id || 'anonymous'}:${currentUser?.role || ''}:${currentUser?.accountStatus || ''}`;
  const prevActorSignatureRef = useRef(actorSignature);
  const requestSeqRef = useRef(0);
  const detailSeqRef = useRef(0);
  const listViewRef = useRef<HTMLDivElement>(null);

  // Handle actor change cleanup before data-loading effects run
  useEffect(() => {
    if (prevActorSignatureRef.current === actorSignature) {
      return;
    }
    prevActorSignatureRef.current = actorSignature;
    actorKeyRef.current = currentUser?.id || 'anonymous';
    requestSeqRef.current++;
    detailSeqRef.current++;
    setSelectedStudentId(null);
    setStudentDetail(null);
    setStudentsData([]);
    setTotalCount(0);
    setSearchQuery('');
    setDebouncedQuery('');
    setListError(null);
    setDetailError(null);
    setLoadingList(false);
    setLoadingDetail(false);
  }, [actorSignature, currentUser?.id]);

  useEffect(() => {
    if (initialSelectedStudentId !== undefined) {
      setSelectedStudentId(initialSelectedStudentId || null);
    }
  }, [initialSelectedStudentId]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().slice(0, 100));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedYearId, selectedClassId, statusFilter]);

  // Load academic years and classes on mount
  useEffect(() => {
    if (!isAuthorized) return;
    let active = true;
    async function loadMetadata() {
      const [yearsRes, classesRes] = await Promise.all([
        listAcademicYears(),
        fetchSchoolClassesWithRosters(),
      ]);
      if (!active) return;
      if (yearsRes.ok && yearsRes.data) {
        setAcademicYears(yearsRes.data);
      }
      if (classesRes.ok && classesRes.data) {
        setAvailableClasses(
          classesRes.data.map((c) => ({
            id: c.id,
            name: c.name,
            levelCode: c.levelCode || 'CP',
            academicYear: c.academicYear,
          })),
        );
      }
    }
    void loadMetadata();
    return () => {
      active = false;
    };
  }, [isAuthorized, currentUser?.id]);

  // Fetch student list from server
  const loadStudents = async () => {
    if (!isAuthorized) return;
    const currentActor = currentUser?.id || 'anonymous';
    if (actorKeyRef.current !== currentActor) {
      actorKeyRef.current = currentActor;
    }
    const reqId = ++requestSeqRef.current;

    setLoadingList(true);
    setListError(null);

    const offset = (page - 1) * pageSize;
    const res = await listSchoolStudents({
      p_search: debouncedQuery || null,
      p_academic_year_id: selectedYearId === 'ALL' ? null : selectedYearId,
      p_class_id: selectedClassId === 'ALL' ? null : selectedClassId,
      p_status: statusFilter,
      p_limit: pageSize,
      p_offset: offset,
    });

    if (
      reqId !== requestSeqRef.current ||
      actorKeyRef.current !== (currentUser?.id || 'anonymous')
    ) {
      return; // superseded or actor changed
    }

    setLoadingList(false);
    if (!res.ok) {
      setListError(res.errorMessage || 'Failed to load school students.');
      setStudentsData([]);
      setTotalCount(0);
      return;
    }

    if (res.data) {
      setStudentsData(res.data.items || []);
      setTotalCount(res.data.total ?? 0);
    }
  };

  useEffect(() => {
    void loadStudents();
  }, [debouncedQuery, selectedYearId, selectedClassId, statusFilter, page, currentUser?.id]);

  // Fetch student detail when selectedStudentId changes
  useEffect(() => {
    if (!selectedStudentId) {
      setStudentDetail(null);
      setDetailError(null);
      return;
    }
    const currentActor = currentUser?.id || 'anonymous';
    const reqId = ++detailSeqRef.current;
    let active = true;

    async function loadDetail() {
      setLoadingDetail(true);
      setDetailError(null);
      const res = await getSchoolStudentIdentity(selectedStudentId!);
      if (!active || reqId !== detailSeqRef.current || actorKeyRef.current !== currentActor) {
        return;
      }
      setLoadingDetail(false);
      if (!res.ok || !res.data) {
        setDetailError(res.errorMessage || 'Failed to load student identity details.');
        setStudentDetail(null);
        return;
      }
      if (res.data.studentId !== selectedStudentId) {
        setDetailError('Student identity mismatch detected.');
        setStudentDetail(null);
        return;
      }
      setStudentDetail(res.data);
    }
    void loadDetail();
    return () => {
      active = false;
    };
  }, [selectedStudentId, currentUser?.id, detailRetrySeq]);

  return {
    language,
    isAuthorized,
    searchQuery,
    setSearchQuery,
    academicYears,
    selectedYearId,
    setSelectedYearId,
    availableClasses,
    selectedClassId,
    setSelectedClassId,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    pageSize,
    studentsData,
    totalCount,
    loadingList,
    listError,
    loadStudents,
    selectedStudentId,
    setSelectedStudentId,
    studentDetail,
    setStudentDetail,
    loadingDetail,
    detailError,
    setDetailRetrySeq,
    listViewRef,
  };
}
