import React, { useEffect, useRef, useState } from 'react';
import type { Language, SchoolClassSummary, User } from '../../../types';
import {
  ClassOperationGate,
  classifyClassCreationResult,
  classifyClassRefreshResult,
  getClassCreationScope,
  resolveClassReadback,
  type ClassCreationFeedback,
} from '../../../lib/classes/classCreation';
import { pickText } from '../../../i18n/homepages';
import {
  assignTeacherToClass,
  createAndEnrollStudent,
  createSchoolClass,
} from '../../../lib/schoolOperations';
import { listAccountDirectory, type GovernanceAccountRecord } from '../../../lib/accountGovernance';
import type { ClassesBackendStatus } from '../ClassesManagementView';

export type ActiveClassesForm = 'none' | 'create-class' | 'enroll-student' | 'assign-teacher';

interface UseClassesMutationsParams {
  currentUser: User | null;
  language: Language;
  t: (key: any) => string;
  initialClasses: SchoolClassSummary[];
  backendStatus: ClassesBackendStatus;
  canManage: boolean;
  canLoadAccounts: boolean;
  onRefresh?: () => Promise<boolean | void> | void;
}

export function useClassesMutations({
  currentUser,
  language,
  t,
  initialClasses,
  backendStatus,
  canManage,
  canLoadAccounts,
  onRefresh,
}: UseClassesMutationsParams) {
  const [activeForm, setActiveForm] = useState<ActiveClassesForm>('none');
  const [opFeedback, setOpFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [academicYearCode, setAcademicYearCode] = useState('2026-2027');
  const [levelCode, setLevelCode] = useState('CP');
  const [className, setClassName] = useState('');
  const [capacity, setCapacity] = useState(28);
  const [roomLabel, setRoomLabel] = useState('');

  const [studentCode, setStudentCode] = useState('');
  const [studentFullName, setStudentFullName] = useState('');
  const [studentBirthDate, setStudentBirthDate] = useState('');
  const [enrollClassId, setEnrollClassId] = useState('');
  const [relationshipLabel, setRelationshipLabel] = useState('Parent');
  const [parentUserId, setParentUserId] = useState('');
  const [linkedProfileId, setLinkedProfileId] = useState('');

  const [teacherUserId, setTeacherUserId] = useState('');
  const [assignClassId, setAssignClassId] = useState('');
  const [isHomeroom, setIsHomeroom] = useState(true);
  const [teacherActive, setTeacherActive] = useState(true);

  const [teacherAccounts, setTeacherAccounts] = useState<GovernanceAccountRecord[]>([]);
  const [parentAccounts, setParentAccounts] = useState<GovernanceAccountRecord[]>([]);
  const [studentAccounts, setStudentAccounts] = useState<GovernanceAccountRecord[]>([]);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!canLoadAccounts) {
      setTeacherAccounts((prev) => (prev.length === 0 ? prev : []));
      setParentAccounts((prev) => (prev.length === 0 ? prev : []));
      setStudentAccounts((prev) => (prev.length === 0 ? prev : []));
      setAccountsError((prev) => (prev === null ? prev : null));
      return;
    }
    let cancelled = false;
    void Promise.all([
      listAccountDirectory({ status: 'APPROVED', role: 'TEACHER', limit: 100 }),
      listAccountDirectory({ status: 'APPROVED', role: 'PARENT', limit: 100 }),
      listAccountDirectory({ status: 'APPROVED', role: 'STUDENT', limit: 100 }),
    ])
      .then(([teachersRes, parentsRes, studentsRes]) => {
        if (cancelled) return;
        const responses = [teachersRes, parentsRes, studentsRes];
        const firstError = responses.find((res) => !res.ok && res.errorCode !== 'backend_unavailable');
        setTeacherAccounts(
          teachersRes.ok && teachersRes.data
            ? teachersRes.data.items.filter(
                (acc) => acc.activeRoles.includes('TEACHER') || acc.requestedRole === 'TEACHER',
              )
            : [],
        );
        setParentAccounts(
          parentsRes.ok && parentsRes.data
            ? parentsRes.data.items.filter(
                (acc) => acc.activeRoles.includes('PARENT') || acc.requestedRole === 'PARENT',
              )
            : [],
        );
        setStudentAccounts(
          studentsRes.ok && studentsRes.data
            ? studentsRes.data.items.filter(
                (acc) => acc.activeRoles.includes('STUDENT') || acc.requestedRole === 'STUDENT',
              )
            : [],
        );
        setAccountsError(
          firstError ? firstError.errorMessage || firstError.errorCode || tRef.current('error') : null,
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setTeacherAccounts([]);
        setParentAccounts([]);
        setStudentAccounts([]);
        setAccountsError(err instanceof Error ? err.message : tRef.current('error'));
      });
    return () => {
      cancelled = true;
    };
  }, [canLoadAccounts, currentUser?.id]);

  const classGateRef = useRef(new ClassOperationGate());
  const classGate = classGateRef.current;
  const creationScope = getClassCreationScope(currentUser, canManage);
  classGate.configure(creationScope);
  const creationGeneration = classGate.generation;
  const [classCreation, setClassCreation] = useState<ClassCreationFeedback | null>(null);
  const visibleCreation = classCreation?.generation === creationGeneration ? classCreation : null;
  const creationPending = visibleCreation?.outcome === 'pending' || visibleCreation?.refresh === 'pending';
  const classReadback =
    visibleCreation &&
    resolveClassReadback(visibleCreation.receipt, visibleCreation.refresh, backendStatus, initialClasses);

  useEffect(() => {
    classGate.resume();
    return () => classGate.dispose();
  }, [classGate]);

  useEffect(() => {
    setClassCreation(null);
    setOpFeedback(null);
    setSubmitting(false);
    setActiveForm('none');
  }, [creationScope]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !canManage || backendStatus !== 'READY') return;
    const token = classGate.begin();
    if (!token) return;
    setOpFeedback(null);
    setClassCreation({ generation: token.generation, outcome: 'pending', refresh: 'unverified' });
    setSubmitting(true);
    try {
      let outcome: ReturnType<typeof classifyClassCreationResult>;
      try {
        const res = await createSchoolClass({ academicYearCode, levelCode, name: className, capacity, roomLabel });
        if (!classGate.isCurrent(token)) return;
        outcome = classifyClassCreationResult(res);
      } catch {
        if (!classGate.isCurrent(token)) return;
        outcome = { outcome: 'unknown' };
      }
      if (outcome.outcome !== 'confirmed') {
        setClassCreation({ generation: token.generation, ...outcome, refresh: 'unverified' });
        return;
      }
      setClassName('');
      setRoomLabel('');
      setActiveForm('none');
      const confirmation: ClassCreationFeedback = {
        generation: token.generation,
        outcome: 'confirmed',
        receipt: outcome.receipt,
        refresh: 'pending',
      };
      setClassCreation(confirmation);
      let refresh: ClassCreationFeedback['refresh'] = 'unverified';
      try {
        if (onRefresh) refresh = classifyClassRefreshResult(await onRefresh());
      } catch {
        refresh = 'failed';
      }
      if (!classGate.isCurrent(token)) return;
      setClassCreation({ ...confirmation, refresh });
    } finally {
      if (classGate.release(token)) setSubmitting(false);
    }
  };

  const handleRetryRefreshOnly = async () => {
    if (submitting || !onRefresh || !canManage || visibleCreation?.outcome !== 'confirmed') return;
    const token = classGate.begin();
    if (!token) return;
    const confirmation = visibleCreation;
    setSubmitting(true);
    setClassCreation({ ...confirmation, refresh: 'pending' });
    try {
      let refresh: ClassCreationFeedback['refresh'];
      try {
        refresh = classifyClassRefreshResult(await onRefresh());
      } catch {
        refresh = 'failed';
      }
      if (!classGate.isCurrent(token)) return;
      setClassCreation({ ...confirmation, refresh });
    } finally {
      if (classGate.release(token)) setSubmitting(false);
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !canManage) return;
    setOpFeedback(null);
    setSubmitting(true);
    const targetClassId = enrollClassId || initialClasses[0]?.id || '';
    try {
      const res = await createAndEnrollStudent({
        studentCode,
        fullName: studentFullName,
        birthDate: studentBirthDate,
        classId: targetClassId,
        relationshipLabel,
        parentUserId: parentUserId.trim() || null,
        linkedProfileId: linkedProfileId.trim() || null,
      });
      if (!res.ok) {
        setOpFeedback({ type: 'error', text: res.errorMessage || res.errorCode || t('error') });
        return;
      }
      setStudentCode('');
      setStudentFullName('');
      setStudentBirthDate('');
      setParentUserId('');
      setLinkedProfileId('');
      setActiveForm('none');
      setOpFeedback({
        type: 'success',
        text: pickText(
          { ar: 'تم تسجيل التلميذ في القسم بنجاح.', fr: 'Élève inscrit dans la classe.', en: 'Student created and enrolled.' },
          language,
        ),
      });
      await onRefresh?.();
    } catch (err) {
      setOpFeedback({ type: 'error', text: err instanceof Error ? err.message : t('error') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !canManage) return;
    setOpFeedback(null);
    setSubmitting(true);
    const targetClassId = assignClassId || initialClasses[0]?.id || '';
    try {
      const res = await assignTeacherToClass({
        teacherUserId: teacherUserId.trim(),
        classId: targetClassId,
        isHomeroom,
        active: teacherActive,
      });
      if (!res.ok) {
        setOpFeedback({ type: 'error', text: res.errorMessage || res.errorCode || t('error') });
        return;
      }
      setTeacherUserId('');
      setTeacherActive(true);
      setActiveForm('none');
      setOpFeedback({
        type: 'success',
        text: teacherActive
          ? pickText(
              { ar: 'تم تعيين المربي للقسم بنجاح.', fr: 'Enseignant affecté à la classe.', en: 'Teacher assigned to class.' },
              language,
            )
          : pickText(
              { ar: 'تم إلغاء تعيين المربي من القسم.', fr: 'Enseignant retiré de la classe.', en: 'Teacher unassigned from class.' },
              language,
            ),
      });
      await onRefresh?.();
    } catch (err) {
      setOpFeedback({ type: 'error', text: err instanceof Error ? err.message : t('error') });
    } finally {
      setSubmitting(false);
    }
  };

  return {
    activeForm, setActiveForm, opFeedback, submitting,
    academicYearCode, setAcademicYearCode, levelCode, setLevelCode,
    className, setClassName, capacity, setCapacity, roomLabel, setRoomLabel,
    studentCode, setStudentCode, studentFullName, setStudentFullName,
    studentBirthDate, setStudentBirthDate, enrollClassId, setEnrollClassId,
    relationshipLabel, setRelationshipLabel, parentUserId, setParentUserId,
    linkedProfileId, setLinkedProfileId, teacherUserId, setTeacherUserId,
    assignClassId, setAssignClassId, isHomeroom, setIsHomeroom, teacherActive, setTeacherActive,
    teacherAccounts, parentAccounts, studentAccounts, accountsError,
    visibleCreation, creationPending, classReadback,
    handleCreateClass, handleRetryRefreshOnly, handleEnrollStudent, handleAssignTeacher,
  };
}
