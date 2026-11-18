import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ClassStudentRosterItem, SchoolClassSummary } from '../../types';
import {
  canAccessAppTab,
  canManageClassesUi,
  canReviewOrdinaryAccountsUi,
  resolveTeacherAssignedClasses,
} from '../homepages/homepageAccess';
import { StudentOverviewPanel } from './Shared/StudentOverviewPanel';
import { resolveStudentOverviewSelection } from '../../lib/classes/studentOverview';
import { HomePageHeader } from '../homepages/shared/HomePageHeader';
import { EmptyFeatureState } from '../homepages/shared/EmptyFeatureState';
import { HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';
import {
  CANONICAL_SCHOOL_LEVELS,
  assignTeacherToClass,
  createAndEnrollStudent,
  createSchoolClass,
} from '../../lib/schoolOperations';
import { listAccountDirectory, type GovernanceAccountRecord } from '../../lib/accountGovernance';
import {
  ArrowLeft,
  Search,
  Users,
  GraduationCap,
  Calendar,
  Plus,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Lock,
  MessageSquare,
  ClipboardCheck,
} from 'lucide-react';
import '../homepages/shared/HomePageLayout.css';

export type ClassesBackendStatus =
  | 'LOADING'
  | 'BACKEND_NOT_IMPLEMENTED'
  | 'READY'
  | 'ERROR'
  | 'UNAUTHORIZED';

export interface ClassesManagementViewProps {
  initialClasses?: SchoolClassSummary[];
  initialRosters?: Record<string, ClassStudentRosterItem[]>;
  backendStatus?: ClassesBackendStatus;
  errorMessage?: string | null;
  onRefresh?: () => Promise<boolean | void> | void;
  onOpenClassCommunity?: (classId: string) => void;
  onOpenAttendance?: (classId: string) => void;
}

const ROSTER_PAGE_SIZE = 25;

export function filterSchoolClasses(
  classes: readonly SchoolClassSummary[],
  query: string,
  levelFilter: string,
  yearFilter: string,
): SchoolClassSummary[] {
  const q = query.trim().toLowerCase();
  return classes.filter((cls) => {
    if (levelFilter !== 'ALL' && cls.level !== levelFilter && cls.levelCode !== levelFilter) return false;
    if (yearFilter !== 'ALL' && cls.academicYear !== yearFilter) return false;
    if (!q) return true;
    return (
      cls.name.toLowerCase().includes(q) ||
      cls.level.toLowerCase().includes(q) ||
      (cls.homeroomTeacherName?.toLowerCase().includes(q) ?? false)
    );
  });
}

export function filterClassRoster(
  students: readonly ClassStudentRosterItem[],
  query: string,
): ClassStudentRosterItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...students];
  return students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q) ||
      (s.primaryGuardianName?.toLowerCase().includes(q) ?? false),
  );
}

export const ClassesManagementView: React.FC<ClassesManagementViewProps> = ({
  initialClasses = [],
  initialRosters = {},
  backendStatus = 'BACKEND_NOT_IMPLEMENTED',
  errorMessage = null,
  onRefresh,
  onOpenClassCommunity,
  onOpenAttendance,
}) => {
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
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
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

  const [activeForm, setActiveForm] = useState<'none' | 'create-class' | 'enroll-student' | 'assign-teacher'>('none');
  const [opFeedback, setOpFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create class state
  const [academicYearCode, setAcademicYearCode] = useState('2026-2027');
  const [levelCode, setLevelCode] = useState('CP');
  const [className, setClassName] = useState('');
  const [capacity, setCapacity] = useState(28);
  const [roomLabel, setRoomLabel] = useState('');

  // Enroll student state
  const [studentCode, setStudentCode] = useState('');
  const [studentFullName, setStudentFullName] = useState('');
  const [studentBirthDate, setStudentBirthDate] = useState('');
  const [enrollClassId, setEnrollClassId] = useState('');
  const [relationshipLabel, setRelationshipLabel] = useState('Parent');
  const [parentUserId, setParentUserId] = useState('');
  const [linkedProfileId, setLinkedProfileId] = useState('');

  // Assign teacher state
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

  const isAuthorized = canAccessAppTab(currentUser, 'classes');
  const isBackendUnauthorized = backendStatus === 'UNAUTHORIZED';
  const canManage = canManageClassesUi(currentUser) && !isBackendUnauthorized;
  const isTeacherView = currentUser?.role === 'TEACHER' && !canManage;
  const canLoadAccounts = canManage && canReviewOrdinaryAccountsUi(currentUser);

  const scopedInitialClasses = useMemo(
    () =>
      isTeacherView
        ? resolveTeacherAssignedClasses(currentUser, initialClasses)
        : initialClasses,
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
        const firstError = responses.find(
          (res) => !res.ok && res.errorCode !== 'backend_unavailable',
        );
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
    return Array.from(seen);
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
    () =>
      filterSchoolClasses(
        scopedInitialClasses,
        searchQuery,
        effectiveSelectedLevel,
        effectiveSelectedYear,
      ),
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

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const currentActorKey = currentUser ? `${currentUser.id}::${currentUser.role}::${currentUser.accountStatus}` : null;
  const actorKeyRef = useRef(currentActorKey);
  actorKeyRef.current = currentActorKey;

  const [needsRefreshRetry, setNeedsRefreshRetry] = useState(false);
  const inFlightCreateRef = useRef(false);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || inFlightCreateRef.current || !canManage) return;
    const initiatingActor = actorKeyRef.current;
    inFlightCreateRef.current = true;
    setOpFeedback(null);
    setSubmitting(true);
    setNeedsRefreshRetry(false);

    let createRes;
    try {
      createRes = await createSchoolClass({
        academicYearCode,
        levelCode,
        name: className,
        capacity,
        roomLabel,
      });
    } catch (err) {
      if (!mountedRef.current || actorKeyRef.current !== initiatingActor) return;
      setSubmitting(false);
      inFlightCreateRef.current = false;
      setOpFeedback({ type: 'error', text: err instanceof Error ? err.message : t('error') });
      return;
    }

    if (!mountedRef.current || actorKeyRef.current !== initiatingActor) {
      setSubmitting(false);
      inFlightCreateRef.current = false;
      return;
    }

    if (!createRes.ok || !createRes.data) {
      setSubmitting(false);
      inFlightCreateRef.current = false;
      setOpFeedback({ type: 'error', text: createRes.errorMessage || createRes.errorCode || t('error') });
      return;
    }

    setClassName('');
    setRoomLabel('');
    setActiveForm('none');
    setOpFeedback({
      type: 'success',
      text: pickText(
        { ar: 'تم إنشاء القسم بنجاح على الخادم.', fr: 'Classe créée sur le serveur avec succès.', en: 'Class created on server successfully.' },
        language,
      ),
    });

    let refreshSuccess = true;
    let readbackConfirmed = false;
    try {
      if (onRefresh) {
        const refreshRes = await onRefresh();
        if (!mountedRef.current || actorKeyRef.current !== initiatingActor) {
          setSubmitting(false);
          inFlightCreateRef.current = false;
          return;
        }
        if (refreshRes === false) {
          refreshSuccess = false;
        } else if (refreshRes === true) {
          readbackConfirmed = true;
        }
      } else {
        refreshSuccess = false;
      }
    } catch (refreshErr) {
      if (!mountedRef.current || actorKeyRef.current !== initiatingActor) {
        setSubmitting(false);
        inFlightCreateRef.current = false;
        return;
      }
      refreshSuccess = false;
    }

    setSubmitting(false);
    inFlightCreateRef.current = false;

    if (!refreshSuccess) {
      setNeedsRefreshRetry(true);
      setOpFeedback({
        type: 'success',
        text: pickText(
          {
            ar: 'تم إنشاء القسم على الخادم بنجاح، ولكن تعذر تحديث القائمة تلقائياً. انقر أدناه لإعادة تحديث القائمة وحدها.',
            fr: 'Classe créée avec succès, mais le rafraîchissement a échoué. Cliquez ci-dessous pour rafraîchir.',
            en: 'Class created successfully, but list refresh failed. Click below to retry refresh only.',
          },
          language,
        ),
      });
    } else if (!readbackConfirmed) {
      setOpFeedback({
        type: 'success',
        text: pickText(
          {
            ar: 'تم إنشاء القسم على الخادم بنجاح.',
            fr: 'Classe créée avec succès sur le serveur.',
            en: 'Class created on server successfully.',
          },
          language,
        ),
      });
    }
  };

  const handleRetryRefreshOnly = async () => {
    if (submitting || !onRefresh) return;
    const initiatingActor = actorKeyRef.current;
    setSubmitting(true);
    setOpFeedback(null);
    try {
      const refreshRes = await onRefresh();
      if (!mountedRef.current || actorKeyRef.current !== initiatingActor) {
        setSubmitting(false);
        return;
      }
      if (refreshRes === false) {
        setNeedsRefreshRetry(true);
        setOpFeedback({
          type: 'error',
          text: pickText(
            { ar: 'تعذر تحديث القائمة. يرجى المحاولة لاحقاً.', fr: 'Échec du rafraîchissement de la liste.', en: 'Failed to refresh list.' },
            language,
          ),
        });
      } else {
        setNeedsRefreshRetry(false);
        setOpFeedback({
          type: 'success',
          text: pickText(
            { ar: 'تم تحديث القائمة بنجاح.', fr: 'Liste actualisée avec succès.', en: 'List successfully refreshed.' },
            language,
          ),
        });
      }
    } catch (err) {
      if (!mountedRef.current || actorKeyRef.current !== initiatingActor) {
        setSubmitting(false);
        return;
      }
      setNeedsRefreshRetry(true);
      setOpFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : t('error'),
      });
    } finally {
      if (mountedRef.current && actorKeyRef.current === initiatingActor) {
        setSubmitting(false);
      }
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

  if (!isAuthorized) {
    return (
      <div className="kh-role-page" data-testid="classes-view-unauthorized">
        <EmptyFeatureState
          state="UNAUTHORIZED"
          title={pickText(
            {
              ar: 'غير مصرح بالدخول إلى إدارة الأقسام والتلاميذ',
              fr: 'Accès non autorisé aux Classes & Listes d’élèves',
              en: 'Unauthorized Access to Classes & Student Rosters',
            },
            language,
          )}
          description={pickText(
            {
              ar: 'هذه الوحدة مخصصة حصرياً لمالك المدرسة (APP_ADMIN) أو المدير المفوض بصلاحية CLASSES_ROSTER_VIEW.',
              fr: 'Cette vue est strictement réservée au Fondateur (APP_ADMIN) ou aux rôles disposant de l’habilitation serveur CLASSES_ROSTER_VIEW.',
              en: 'This view is restricted to the School Owner (APP_ADMIN) or staff explicitly granted the server-verified CLASSES_ROSTER_VIEW capability.',
            },
            language,
          )}
        />
      </div>
    );
  }

  // Screen 2: Class Detail -> Student Roster View
  if (selectedClass) {
    const selectionAuth = resolveStudentOverviewSelection({
      currentUser,
      selectedClassId,
      selectedStudentId,
      selectionActorId,
      classes: scopedInitialClasses,
      rosters: initialRosters,
      backendStatus,
    });

    if (selectionAuth.allowed && selectionAuth.schoolClass && selectionAuth.student) {
      return (
        <div className="kh-role-page space-y-6 pb-12" data-testid="student-overview-view">
          <StudentOverviewPanel
            student={selectionAuth.student}
            schoolClass={selectionAuth.schoolClass}
            onBack={() => {
              setSelectedStudentId(null);
              setSelectionActorId(null);
            }}
            language={language}
          />
        </div>
      );
    }

    const isZeroStudentsEnrolled = rawRoster.length === 0;
    return (
      <div ref={rosterContainerRef} className="kh-role-page space-y-6 pb-12" data-testid="class-detail-roster-view">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="back-to-classes-btn"
              onClick={() => {
                setSelectedClassId(null);
                setSelectedStudentId(null);
                setSelectionActorId(null);
                setStudentSearchQuery('');
                setRosterPage(1);
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] px-4 py-2.5 text-xs font-extrabold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>
                {pickText(
                  isTeacherView
                    ? {
                        ar: 'العودة إلى أقسامي',
                        fr: 'Retour à mes classes',
                        en: 'Back to My Classes',
                      }
                    : {
                        ar: 'العودة إلى قائمة الأقسام',
                        fr: 'Retour aux classes',
                        en: 'Back to Classes',
                      },
                  language,
                )}
              </span>
            </button>

            {onOpenClassCommunity && (
              <button
                type="button"
                data-testid={`open-class-community-from-roster-${selectedClass.id}`}
                onClick={() => {
                  setSharedSelectedClassId?.(selectedClass.id);
                  onOpenClassCommunity(selectedClass.id);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-4 py-2.5 text-xs font-extrabold text-[#1E3A6D] dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/70 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>
                  {pickText(
                    {
                      ar: 'فتح فضاء القسم',
                      fr: 'Ouvrir l’espace classe',
                      en: 'Open Class Community',
                    },
                    language,
                  )}
                </span>
              </button>
            )}
            {isTeacherView && onOpenAttendance && (
              <button
                type="button"
                data-testid={`take-attendance-from-roster-${selectedClass.id}`}
                onClick={() => {
                  setSharedSelectedClassId?.(selectedClass.id);
                  onOpenAttendance(selectedClass.id);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5 text-xs font-extrabold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 transition-colors"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>
                  {pickText(
                    {
                      ar: 'تسجيل الحضور والغياب',
                      fr: 'Faire l’appel',
                      en: 'Take Attendance',
                    },
                    language,
                  )}
                </span>
              </button>
            )}
          </div>

          <span className="kh-info-chip">
            {selectedClass.academicYear} • {selectedClass.level}
          </span>
        </div>

        <div id="roster-heading" tabIndex={-1} className="outline-none focus:ring-2 focus:ring-blue-500 rounded-2xl">
          <HomePageHeader
            badgeText={pickText(
              isTeacherView
                ? { ar: 'أقسامي', fr: 'Mes classes', en: 'My Classes' }
                : HOMEPAGE_COMMON_TEXT.classesNav,
              language,
            )}
            title={selectedClass.name}
            subtitle={pickText(
              {
                ar: `المربي الرئيسي: ${selectedClass.homeroomTeacherName || 'غير معين'} • عدد التلاميذ المسجلين: ${selectedClass.activeStudentCount}`,
                fr: `Enseignant principal : ${selectedClass.homeroomTeacherName || 'Non assigné'} • Élèves inscrits : ${selectedClass.activeStudentCount}`,
                en: `Homeroom Teacher: ${selectedClass.homeroomTeacherName || 'Unassigned'} • Enrolled Students: ${selectedClass.activeStudentCount}`,
              },
              language,
            )}
          />
        </div>

        {backendStatus === 'ERROR' && (
          <div
            data-testid="classes-error-state"
            role="alert"
            className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-red-800 dark:text-red-300"
          >
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                {errorMessage ||
                  pickText(
                    {
                      ar: 'تعذر تحديث قائمة التلاميذ من الخادم.',
                      fr: 'Impossible de rafraîchir la liste des élèves depuis le serveur.',
                      en: 'Failed to refresh student roster from the server.',
                    },
                    language,
                  )}
              </span>
            </div>
            {onRefresh && (
              <button
                type="button"
                data-testid="classes-retry-btn"
                onClick={() => void onRefresh()}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs"
              >
                {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
              </button>
            )}
          </div>
        )}

        {/* Roster Search Bar */}
        <div className="bg-white dark:bg-[#111111] p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute start-3.5 top-3" />
            <input
              type="search"
              data-testid="roster-student-search"
              value={studentSearchQuery}
              onChange={(e) => {
                setStudentSearchQuery(e.target.value);
                setRosterPage(1);
              }}
              placeholder={pickText(
                {
                  ar: 'البحث عن تلميذ بالاسم أو المعرف المدرسي أو الولي...',
                  fr: 'Rechercher un élève par nom, code élève ou parent...',
                  en: 'Search student by full name, student code, or guardian...',
                },
                language,
              )}
              className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-2.5 ps-10 pe-4 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="text-xs font-bold text-slate-600 dark:text-zinc-300 px-2">
            {pickText(
              {
                ar: `النتائج: ${filteredRoster.length}`,
                fr: `Élèves affichés : ${filteredRoster.length}`,
                en: `Showing: ${filteredRoster.length} students`,
              },
              language,
            )}
          </div>
        </div>

        {/* Student Roster Table / Empty State */}
        {paginatedRoster.length === 0 ? (
          <div data-testid="roster-empty-state">
            <EmptyFeatureState
              state="AVAILABLE_READ_ONLY"
              title={pickText(
                isZeroStudentsEnrolled
                  ? {
                      ar: 'لا يوجد تلاميذ مسجلون في هذا القسم حالياً',
                      fr: 'Aucun élève inscrit dans cette classe',
                      en: 'No students enrolled in this class',
                    }
                  : {
                      ar: 'لا يوجد تلاميذ مطابقون للبحث',
                      fr: 'Aucun élève ne correspond à la recherche',
                      en: 'No matching students found',
                    },
                language,
              )}
              description={pickText(
                isZeroStudentsEnrolled
                  ? {
                      ar: 'لم يتم تسجيل أي تلميذ في هذا القسم حتى الآن. ستظهر القائمة بمجرد تأكيد التسجيل من الإدارة.',
                      fr: 'Aucun élève n’est encore inscrit dans cette classe. La liste apparaîtra dès la validation par la direction.',
                      en: 'No student enrollments are linked to this class yet. Verified students will appear here once enrolled.',
                    }
                  : {
                      ar: 'جرّب تعديل كلمات البحث لعرض التلاميذ المسجلين في هذا القسم.',
                      fr: 'Modifiez votre recherche pour afficher les élèves inscrits dans cette classe.',
                      en: 'Try adjusting your search query to view enrolled students in this class.',
                    },
                language,
              )}
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-[#111111] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-900/80 border-b border-gray-200 dark:border-gray-800 text-slate-600 dark:text-zinc-400 uppercase font-extrabold">
                  <tr>
                    <th className="py-3.5 px-4 text-start">
                      {pickText({ ar: 'المعرف', fr: 'Code élève', en: 'Student Code' }, language)}
                    </th>
                    <th className="py-3.5 px-4 text-start">
                      {pickText({ ar: 'اسم التلميذ', fr: 'Nom complet', en: 'Student Name' }, language)}
                    </th>
                    <th className="py-3.5 px-4 text-start">
                      {pickText({ ar: 'الولي الرئيسي', fr: 'Parent / Tuteur', en: 'Primary Guardian' }, language)}
                    </th>
                    <th className="py-3.5 px-4 text-start">
                      {pickText({ ar: 'تاريخ التسجيل', fr: 'Date d’inscription', en: 'Enrolled Date' }, language)}
                    </th>
                    <th className="py-3.5 px-4 text-start">
                      {pickText({ ar: 'الحالة', fr: 'Statut', en: 'Status' }, language)}
                    </th>
                    {isTeacherView && (
                      <th className="py-3.5 px-4 text-end">
                        {pickText({ ar: 'إجراءات', fr: 'Actions', en: 'Actions' }, language)}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paginatedRoster.map((student) => (
                    <tr
                      key={student.studentId}
                      data-testid={`roster-student-row-${student.studentId}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-600 dark:text-zinc-400">
                        {student.studentCode}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-gray-900 dark:text-white">
                        {student.fullName}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                        {student.primaryGuardianName || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {student.enrolledAt}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-xl text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {student.enrollmentStatus}
                        </span>
                      </td>
                      {isTeacherView && (
                        <td className="py-3 px-4 text-end">
                          <button
                            type="button"
                            data-testid={`view-student-${student.studentId}`}
                            onClick={() => {
                              lastClickedStudentIdRef.current = student.studentId;
                              setSelectedStudentId(student.studentId);
                              setSelectionActorId(currentUser?.id ?? null);
                            }}
                            aria-label={pickText(
                              {
                                ar: `عرض ملف التلميذ ${student.fullName}`,
                                fr: `Afficher le profil de l’élève ${student.fullName}`,
                                en: `View student profile for ${student.fullName}`,
                              },
                              language,
                            )}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/70 text-[#1E3A6D] dark:text-blue-300 font-extrabold text-[11px] transition-colors"
                          >
                            <span>{pickText({ ar: 'عرض', fr: 'Voir', en: 'View' }, language)}</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalRosterPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                <button
                  type="button"
                  data-testid="roster-prev-page-btn"
                  disabled={safeRosterPage <= 1}
                  onClick={() => setRosterPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 font-bold disabled:opacity-40"
                >
                  {pickText({ ar: 'السابق', fr: 'Précédent', en: 'Previous' }, language)}
                </button>
                <span data-testid="roster-page-indicator" className="font-bold text-gray-600 dark:text-gray-400">
                  {safeRosterPage} / {totalRosterPages}
                </span>
                <button
                  type="button"
                  data-testid="roster-next-page-btn"
                  disabled={safeRosterPage >= totalRosterPages}
                  onClick={() => setRosterPage((p) => Math.min(totalRosterPages, p + 1))}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 font-bold disabled:opacity-40"
                >
                  {pickText({ ar: 'التالي', fr: 'Suivant', en: 'Next' }, language)}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Screen 1: Classes List View
  return (
    <div className="kh-role-page space-y-6 pb-12" data-testid="classes-management-view">
      <HomePageHeader
        badgeText={pickText(
          isTeacherView
            ? { ar: 'أقسامي', fr: 'Mes classes', en: 'My Classes' }
            : HOMEPAGE_COMMON_TEXT.classesNav,
          language,
        )}
        title={pickText(
          isTeacherView
            ? {
                ar: 'أقسامي وقوائم التلاميذ',
                fr: 'Mes classes & Listes d’élèves',
                en: 'My Classes & Student Rosters',
              }
            : {
                ar: 'إدارة الأقسام وقوائم التلاميذ',
                fr: 'Gestion des Classes & Listes d’Élèves',
                en: 'School Classes & Student Rosters',
              },
          language,
        )}
        subtitle={pickText(
          isTeacherView
            ? {
                ar: 'استعرض الأقسام المسندة إليك وافتح قائمة التلاميذ المسجلين في كل قسم أو انتقل إلى فضاء القسم.',
                fr: 'Consultez vos classes assignées, ouvrez la liste des élèves inscrits ou accédez à l’espace de classe.',
                en: 'Browse your assigned classes, open each class’s enrolled student roster, or jump to its class community.',
              }
            : {
                ar: 'استعرض جميع الأقسام الدراسية لمدرسة كريستو وافتح كل قسم لمعاينة قائمة التلاميذ المسجلين فيه.',
                fr: 'Consultez les classes de l’école KRISTOU et ouvrez chaque classe pour afficher la liste nominative des élèves inscrits.',
                en: 'Browse KRISTOU School classes by level and academic year, and open any class to inspect its enrolled student roster.',
              },
          language,
        )}
      >
        {canManage && (
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              data-testid="toggle-create-class-btn"
              onClick={() => setActiveForm((prev) => (prev === 'create-class' ? 'none' : 'create-class'))}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{pickText({ ar: 'إنشاء قسم', fr: 'Créer une classe', en: 'Create Class' }, language)}</span>
            </button>
            <button
              type="button"
              data-testid="toggle-enroll-student-btn"
              onClick={() => {
                if (!enrollClassId && initialClasses[0]) setEnrollClassId(initialClasses[0].id);
                setActiveForm((prev) => (prev === 'enroll-student' ? 'none' : 'enroll-student'));
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{pickText({ ar: 'تسجيل تلميذ', fr: 'Inscrire un élève', en: 'Enroll Student' }, language)}</span>
            </button>
            <button
              type="button"
              data-testid="toggle-assign-teacher-btn"
              onClick={() => {
                if (!assignClassId && initialClasses[0]) setAssignClassId(initialClasses[0].id);
                setActiveForm((prev) => (prev === 'assign-teacher' ? 'none' : 'assign-teacher'));
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 text-xs font-bold shadow-xs"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>{pickText({ ar: 'تعيين مربي', fr: 'Affecter enseignant', en: 'Assign Teacher' }, language)}</span>
            </button>
          </div>
        )}
      </HomePageHeader>

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
          {needsRefreshRetry && onRefresh && (
            <button
              type="button"
              data-testid="retry-refresh-only-btn"
              onClick={() => void handleRetryRefreshOnly()}
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
            >
              {pickText({ ar: 'إعادة تحديث القائمة فقط', fr: 'Rafraîchir uniquement', en: 'Retry Refresh Only' }, language)}
            </button>
          )}
        </div>
      )}

      {/* Admin Create / Enroll / Assign Forms */}
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
                <option key={yr} value={yr}>
                  {yr}
                </option>
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
            <button
              type="button"
              onClick={() => setActiveForm('none')}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
            >
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
            <input
              type="text"
              required
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              placeholder="KS-2026-001"
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <input
              type="text"
              required
              value={studentFullName}
              onChange={(e) => setStudentFullName(e.target.value)}
              placeholder={pickText({ ar: 'الاسم الكامل للتلميذ', fr: 'Nom complet', en: 'Full name' }, language)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <input
              type="date"
              required
              value={studentBirthDate}
              onChange={(e) => setStudentBirthDate(e.target.value)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
            <select
              required
              value={enrollClassId}
              onChange={(e) => setEnrollClassId(e.target.value)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            >
              {initialClasses.length === 0 ? (
                <option value="">—</option>
              ) : (
                initialClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.academicYear})
                  </option>
                ))
              )}
            </select>
            <input
              type="text"
              value={relationshipLabel}
              onChange={(e) => setRelationshipLabel(e.target.value)}
              placeholder="Parent"
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400">
                {pickText(
                  { ar: 'ربط حساب الولي (اختياري)', fr: 'Lier un compte Parent (optionnel)', en: 'Link Parent Account (optional)' },
                  language,
                )}
              </label>
              {parentAccounts.length > 0 && (
                <select
                  aria-label="Select parent account"
                  value={parentAccounts.some((p) => p.id === parentUserId) ? parentUserId : ''}
                  onChange={(e) => setParentUserId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                >
                  <option value="">
                    {pickText({ ar: '— دون ربط ولي —', fr: '— Aucun parent sélectionné —', en: '— No parent account —' }, language)}
                  </option>
                  {parentAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.fullName} (@{acc.username})
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={parentUserId}
                onChange={(e) => setParentUserId(e.target.value)}
                placeholder={pickText(
                  { ar: 'معرف حساب الولي (UUID اختياري)', fr: 'UUID compte parent (optionnel)', en: 'Parent User UUID (optional)' },
                  language,
                )}
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400">
                {pickText(
                  { ar: 'ربط حساب التلميذ (اختياري)', fr: 'Lier un compte Élève (optionnel)', en: 'Link Student Account (optional)' },
                  language,
                )}
              </label>
              {studentAccounts.length > 0 && (
                <select
                  aria-label="Select student account"
                  value={studentAccounts.some((s) => s.id === linkedProfileId) ? linkedProfileId : ''}
                  onChange={(e) => setLinkedProfileId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                >
                  <option value="">
                    {pickText({ ar: '— دون ربط حساب تلميذ —', fr: '— Aucun compte élève —', en: '— No student account —' }, language)}
                  </option>
                  {studentAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.fullName} (@{acc.username})
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={linkedProfileId}
                onChange={(e) => setLinkedProfileId(e.target.value)}
                placeholder={pickText(
                  { ar: 'معرف حساب التلميذ (UUID اختياري)', fr: 'UUID compte élève (optionnel)', en: 'Linked Student Profile UUID (optional)' },
                  language,
                )}
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs font-mono"
              />
            </div>
          </div>

          {!canLoadAccounts && (
            <p
              data-testid="assignable-accounts-blocked-notice"
              className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30 px-3.5 py-2.5 text-[11px] font-medium text-amber-900 dark:text-amber-200"
            >
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

          {accountsError && (
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">{accountsError}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setActiveForm('none')}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || initialClasses.length === 0}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
            >
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
                  <option value="">
                    {pickText({ ar: '— اختر مربياً معتمداً —', fr: '— Sélectionner un enseignant —', en: '— Select approved teacher —' }, language)}
                  </option>
                  {teacherAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.fullName} (@{acc.username})
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                required
                value={teacherUserId}
                onChange={(e) => setTeacherUserId(e.target.value)}
                placeholder="Teacher User UUID"
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs font-mono"
              />
            </div>
            <select
              required
              value={assignClassId}
              onChange={(e) => setAssignClassId(e.target.value)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            >
              {initialClasses.length === 0 ? (
                <option value="">—</option>
              ) : (
                initialClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.academicYear})
                  </option>
                ))
              )}
            </select>
            <div className="flex flex-col gap-1.5">
              <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={isHomeroom}
                  onChange={(e) => setIsHomeroom(e.target.checked)}
                />
                <span>{pickText({ ar: 'مربي رئيسي', fr: 'Enseignant principal', en: 'Homeroom teacher' }, language)}</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={teacherActive}
                  onChange={(e) => setTeacherActive(e.target.checked)}
                />
                <span>
                  {pickText(
                    { ar: 'تعيين نشط (إزالة التحديد للسحب)', fr: 'Affectation active (décocher pour retirer)', en: 'Active assignment (uncheck to unassign)' },
                    language,
                  )}
                </span>
              </label>
            </div>
          </div>
          {!canLoadAccounts && (
            <p
              data-testid="assignable-accounts-blocked-notice"
              className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30 px-3.5 py-2.5 text-[11px] font-medium text-amber-900 dark:text-amber-200"
            >
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
          {accountsError && (
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">{accountsError}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setActiveForm('none')}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || initialClasses.length === 0}
              className="px-4 py-2 rounded-xl bg-[#1E3A6D] hover:bg-[#162C54] text-white text-xs font-bold disabled:opacity-50"
            >
              {submitting ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      )}

      {/* Search and Filter Bar */}
      <div className="bg-white dark:bg-[#111111] p-4 sm:p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute start-3.5 top-3" />
          <input
            type="search"
            data-testid="classes-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={pickText(
              {
                ar: 'بحث باسم القسم أو المربي...',
                fr: 'Rechercher une classe ou un enseignant...',
                en: 'Search by class name or teacher...',
              },
              language,
            )}
            className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-2.5 ps-10 pe-4 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <select
            aria-label="Filter by level"
            data-testid="classes-level-filter"
            value={effectiveSelectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-2.5 px-3.5 text-xs font-semibold text-gray-900 dark:text-white"
          >
            <option value="ALL">
              {pickText({ ar: 'جميع المستويات', fr: 'Tous les niveaux', en: 'All Levels' }, language)}
            </option>
            {levelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            aria-label="Filter by academic year"
            data-testid="classes-year-filter"
            value={effectiveSelectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-2.5 px-3.5 text-xs font-semibold text-gray-900 dark:text-white"
          >
            <option value="ALL">
              {pickText(
                { ar: 'جميع السنوات الدراسية', fr: 'Toutes les années scolaires', en: 'All Academic Years' },
                language,
              )}
            </option>
            {yearOptions.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* State 1: Loading */}
      {backendStatus === 'LOADING' && (
        <div
          data-testid="classes-loading-state"
          className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center text-xs font-bold text-gray-500"
        >
          {t('loading')}
        </div>
      )}

      {/* State 2: Backend Not Implemented (Honest Default until Supabase tables are deployed) */}
      {backendStatus === 'BACKEND_NOT_IMPLEMENTED' && scopedInitialClasses.length === 0 && (
        <div data-testid="classes-backend-pending-state">
          <EmptyFeatureState
            state="BLOCKED_BACKEND"
            title={pickText(
              isTeacherView
                ? {
                    ar: 'خدمة الأقسام قيد التفعيل على الخادم',
                    fr: 'Service des classes en attente d’activation serveur',
                    en: 'Classes Service Unavailable on Backend',
                  }
                : {
                    ar: 'جداول الأقسام وقوائم التلاميذ بانتظار التفعيل في الخادم (Pending Backend)',
                    fr: 'Tables des classes et listes d’élèves en attente du contrat serveur (Pending Backend)',
                    en: 'Classes & Student Roster Persistence Pending Backend Deployment',
                  },
              language,
            )}
            description={pickText(
              isTeacherView
                ? {
                    ar: 'تعذر الوصول إلى خدمة الأقسام في الخادم حالياً. لا يتم عرض أي أقسام أو تلاميذ غير موثقين.',
                    fr: 'Le service serveur des classes n’est pas encore disponible. Aucune classe ni liste d’élèves fictive n’est affichée.',
                    en: 'The school classes service is not yet available from the backend. No unverified classes or students are shown.',
                  }
                : {
                    ar: 'واجهة إدارة الأقسام جاهزة ومحمية بصلاحيات الإدارة المدرسية، ولكن لم يتم بعد نشر جداول الأقسام والتلاميذ في الخادم. التزاماً بقواعد الأمان، لا يتم عرض أي أقسام أو تلاميذ وهميين.',
                    fr: 'L’interface Classes → Élèves est prête et protégée, mais les services serveur des classes ne sont pas encore déployés. Conformément aux règles de sécurité, aucune donnée fictive n’est affichée.',
                    en: 'The Classes & Student Roster UI is wired and access-controlled, but backend services are not deployed yet. Zero mock classes or mock student records are fabricated.',
                  },
              language,
            )}
          />
        </div>
      )}

      {/* State 2a: Backend Unauthorized (always shown, hides private rosters) */}
      {isBackendUnauthorized && (
        <div
          data-testid="classes-unauthorized-state"
          role="alert"
          className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              {errorMessage ||
                pickText(
                  {
                    ar: 'غير مصرح بعرض قائمة الأقسام أو التلاميذ من الخادم.',
                    fr: 'Accès non autorisé aux classes et listes d’élèves.',
                    en: 'Not authorized to access school classes and student rosters.',
                  },
                  language,
                )}
            </span>
          </div>
          {onRefresh && (
            <button
              type="button"
              data-testid="classes-unauthorized-retry-btn"
              onClick={() => void onRefresh()}
              className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs"
            >
              {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
            </button>
          )}
        </div>
      )}

      {/* State 2b: Backend Error (shown even if cached classes exist) */}
      {backendStatus === 'ERROR' && (
        <div
          data-testid="classes-error-state"
          role="alert"
          className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-xs text-red-800 dark:text-red-300"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {errorMessage ||
                pickText(
                  {
                    ar: 'تعذر تحميل قائمة الأقسام والتلاميذ من الخادم.',
                    fr: 'Impossible de charger les classes et listes d’élèves depuis le serveur.',
                    en: 'Failed to load classes and student rosters from server.',
                  },
                  language,
                )}
            </span>
          </div>
          {onRefresh && (
            <button
              type="button"
              data-testid="classes-retry-btn"
              onClick={() => void onRefresh()}
              className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs"
            >
              {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
            </button>
          )}
        </div>
      )}

      {/* State 3: Ready but 0 matching classes */}
      {backendStatus === 'READY' && filteredClasses.length === 0 && (
        <div data-testid="classes-empty-state">
          <EmptyFeatureState
            state="AVAILABLE_READ_ONLY"
            title={pickText(
              isTeacherView && scopedInitialClasses.length === 0
                ? {
                    ar: 'لا توجد أقسام مسندة لحسابك حالياً',
                    fr: 'Aucune classe assignée pour le moment',
                    en: 'No classes assigned yet',
                  }
                : {
                    ar: 'لا توجد أقسام مطابقة للبحث',
                    fr: 'Aucune classe trouvée',
                    en: 'No classes found',
                  },
              language,
            )}
            description={pickText(
              isTeacherView && scopedInitialClasses.length === 0
                ? {
                    ar: 'ستظهر هنا الأقسام الدراسية المسندة إليك وقوائم التلاميذ الخاصة بها فور تعيينها من طرف إدارة المدرسة.',
                    fr: 'Vos classes assignées et leurs listes d’élèves apparaîtront ici dès leur affectation par la direction de l’école.',
                    en: 'Your assigned classes and student rosters will appear here once assigned by school administration.',
                  }
                : {
                    ar: 'لم يتم العثور على أقسام مسجلة تطابق معايير التصفية الحالية.',
                    fr: 'Aucune classe enregistrée ne correspond aux filtres sélectionnés.',
                    en: 'No server-verified classes match the current search or filter criteria.',
                  },
              language,
            )}
          />
        </div>
      )}

      {/* State 4: Verified class cards (never shown when UNAUTHORIZED) */}
      {!isBackendUnauthorized && filteredClasses.length > 0 && (
        <div
          data-testid="classes-card-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredClasses.map((cls) => {
            const isSharedSelected = Boolean(sharedSelectedClassId && sharedSelectedClassId === cls.id);
            return (
              <article
                key={cls.id}
                data-testid={`class-card-${cls.id}`}
                data-selected={isSharedSelected ? 'true' : 'false'}
                className={`kh-info-panel flex flex-col justify-between gap-4 ${
                  isSharedSelected ? 'ring-2 ring-[#1E3A6D] dark:ring-blue-500' : ''
                }`}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="kh-info-chip">{cls.level}</span>
                      {isSharedSelected && (
                        <span
                          data-testid={`class-selected-badge-${cls.id}`}
                          className="inline-flex items-center px-2 py-0.5 rounded-xl text-[10px] font-extrabold bg-blue-100 text-[#1E3A6D] dark:bg-blue-950/70 dark:text-blue-300"
                        >
                          {pickText({ ar: 'محدد', fr: 'Sélectionnée', en: 'Selected' }, language)}
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-zinc-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{cls.academicYear}</span>
                    </span>
                  </div>

                  <h2 className="kh-info-panel-title text-lg">{cls.name}</h2>

                  <div className="space-y-1 text-xs text-slate-600 dark:text-zinc-300">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>
                        {t('teacherLabel')} :{' '}
                        <strong>{cls.homeroomTeacherName || '—'}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        {pickText(
                          {
                            ar: `التلاميذ المسجلون: ${cls.activeStudentCount}${cls.capacity ? ` / السعة: ${cls.capacity}` : ''}`,
                            fr: `Élèves inscrits : ${cls.activeStudentCount}${cls.capacity ? ` / Capacité : ${cls.capacity}` : ''}`,
                            en: `Enrolled students: ${cls.activeStudentCount}${cls.capacity ? ` / Capacity: ${cls.capacity}` : ''}`,
                          },
                          language,
                        )}
                      </span>
                    </div>
                    {cls.roomLabel && (
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                        {pickText(
                          {
                            ar: `القاعة: ${cls.roomLabel}`,
                            fr: `Salle : ${cls.roomLabel}`,
                            en: `Room: ${cls.roomLabel}`,
                          },
                          language,
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    data-testid={`view-class-students-${cls.id}`}
                    onClick={() => {
                      setSharedSelectedClassId?.(cls.id);
                      setSelectedClassId(cls.id);
                      setStudentSearchQuery('');
                      setRosterPage(1);
                    }}
                    className="w-full rounded-2xl bg-[#1E3A6D] hover:bg-[#162C54] text-white font-extrabold text-xs py-3 px-4 transition-colors flex items-center justify-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    <span>
                      {pickText(
                        {
                          ar: 'عرض قائمة التلاميذ',
                          fr: 'Voir les élèves',
                          en: 'View Students',
                        },
                        language,
                      )}
                    </span>
                  </button>

                  {onOpenClassCommunity && (
                    <button
                      type="button"
                      data-testid={`open-class-community-${cls.id}`}
                      onClick={() => {
                        setSharedSelectedClassId?.(cls.id);
                        onOpenClassCommunity(cls.id);
                      }}
                      className="w-full rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/70 hover:bg-slate-100 dark:hover:bg-zinc-900 text-[#1E3A6D] dark:text-blue-300 font-extrabold text-xs py-2.5 px-4 transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>
                        {pickText(
                          {
                            ar: 'فتح فضاء القسم',
                            fr: 'Ouvrir l’espace classe',
                            en: 'Open Class Community',
                          },
                          language,
                        )}
                      </span>
                    </button>
                  )}
                  {isTeacherView && onOpenAttendance && (
                    <button
                      type="button"
                      data-testid={`take-attendance-${cls.id}`}
                      onClick={() => {
                        setSharedSelectedClassId?.(cls.id);
                        onOpenAttendance(cls.id);
                      }}
                      className="w-full rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs py-2.5 px-4 transition-colors flex items-center justify-center gap-2"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      <span>
                        {pickText(
                          {
                            ar: 'تسجيل الحضور والغياب',
                            fr: 'Faire l’appel',
                            en: 'Take Attendance',
                          },
                          language,
                        )}
                      </span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
