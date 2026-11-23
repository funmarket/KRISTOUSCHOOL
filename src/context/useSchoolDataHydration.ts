import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BackendOpResult,
  BackendOpStatus,
  Child,
  ClassItem,
  EnrollmentApplication,
  MessageThread,
  OperationalCounts,
  PickupRecord,
  PublicContentEntry,
  PublicInquiryItem,
  User,
} from '../types';
import {
  fetchMySchoolContext,
  fetchSchoolClassesWithRosters,
  listEnrollmentApplications,
  listPublicInquiries,
  type SchoolClassWithRoster,
} from '../lib/schoolOperations';
import { listMessageThreads } from '../lib/schoolContent';
import {
  isMatchingApprovedAccountContext,
  reconcileSelectedClassId,
  resolveClassesRosterFetchStrategy,
  type AccountIdentityContext,
} from '../lib/appStateGuards';
import { canReviewOrdinaryAccountsUi } from '../components/homepages/homepageAccess';
import { usePublicDataHydration } from './usePublicDataHydration';
import { useClassCommunityHydration } from './useClassCommunityHydration';

interface UseSchoolDataHydrationParams {
  currentUser: User | null;
  identityContext: AccountIdentityContext;
  getCurrentIdentity: () => AccountIdentityContext;
  patchCurrentUserAssignments: (
    userId: string,
    patch: { linkedChildrenIds?: string[]; assignedClassIds?: string[] },
  ) => void;
  syncPreferencesIdentity: (ctx: AccountIdentityContext) => void;
  hydratePreferencesForAccount: (ctx: AccountIdentityContext) => Promise<void>;
  resetPreferencesState: () => void;
  syncNotificationsIdentity: (ctx: AccountIdentityContext) => void;
  hydrateNotificationsForAccount: (ctx: AccountIdentityContext) => Promise<void>;
  resetNotificationTracking: () => void;
  clearNotificationsState: () => void;
  applyPublicContentResponse: (contentRes: BackendOpResult<Record<string, PublicContentEntry>>) => void;
  onPublicContentHydrationError: (message: string) => void;
  hydrateParentNotesForUser: (
    user: User,
    origin: AccountIdentityContext,
    isStillValid: () => boolean,
  ) => Promise<void>;
  clearParentNotesState: () => void;
  mountedRef: React.MutableRefObject<boolean>;
}

export function useSchoolDataHydration({
  currentUser,
  identityContext,
  getCurrentIdentity,
  patchCurrentUserAssignments,
  syncPreferencesIdentity,
  hydratePreferencesForAccount,
  resetPreferencesState,
  syncNotificationsIdentity,
  hydrateNotificationsForAccount,
  resetNotificationTracking,
  clearNotificationsState,
  applyPublicContentResponse,
  onPublicContentHydrationError,
  hydrateParentNotesForUser,
  clearParentNotesState,
  mountedRef,
}: UseSchoolDataHydrationParams) {
  const pub = usePublicDataHydration({
    currentUserId: currentUser?.id ?? null,
    applyPublicContentResponse,
    onPublicContentHydrationError,
  });
  const { hydratePublicData, setCalendarEvents, setCalendarError } = pub;

  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [classesList, setClassesList] = useState<ClassItem[]>([]);
  const [classRosters, setClassRosters] = useState<SchoolClassWithRoster[]>([]);
  const [classesBackendStatus, setClassesBackendStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [classesError, setClassesError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [operationalCounts, setOperationalCounts] = useState<OperationalCounts>({});
  const [operationalCountsLoaded, setOperationalCountsLoaded] = useState<boolean>(false);
  const [isHydratingSchoolData, setIsHydratingSchoolData] = useState<boolean>(false);
  const [schoolContextError, setSchoolContextError] = useState<string | null>(null);

  const community = useClassCommunityHydration({
    currentUser,
    selectedClassId,
    getCurrentIdentity,
    mountedRef,
  });
  const { clearClassCommunityState, hydrateClassCommunityForUser, setIsLoadingClassCommunity } = community;

  const [messages, setMessages] = useState<MessageThread[]>([]);
  const [messagesStatus, setMessagesStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [pickupRecords] = useState<PickupRecord[]>([]);

  const [enrollmentApplications, setEnrollmentApplications] = useState<EnrollmentApplication[]>([]);
  const [enrollmentsStatus, setEnrollmentsStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [enrollmentsError, setEnrollmentsError] = useState<string | null>(null);
  const [publicInquiries, setPublicInquiries] = useState<PublicInquiryItem[]>([]);
  const [inquiriesStatus, setInquiriesStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');

  const authHydrationGenRef = useRef<number>(0);
  const lastSyncedGenRef = useRef<number>(identityContext.generation);

  useEffect(() => {
    syncPreferencesIdentity(identityContext);
    syncNotificationsIdentity(identityContext);
    if (lastSyncedGenRef.current !== identityContext.generation) {
      lastSyncedGenRef.current = identityContext.generation;
      resetNotificationTracking();
      setChildrenList([]);
      setClassesList([]);
      setClassRosters([]);
      setClassesBackendStatus('BLOCKED_BACKEND');
      setClassesError(null);
      setSelectedClassId('');
      setSelectedChildId('');
      setCalendarEvents([]);
      setCalendarError(null);
    }
  }, [identityContext, resetNotificationTracking, setCalendarError, setCalendarEvents, syncNotificationsIdentity, syncPreferencesIdentity]);

  const clearPrivateState = useCallback(() => {
    authHydrationGenRef.current += 1;
    clearNotificationsState();
    resetPreferencesState();
    setIsHydratingSchoolData(false);
    setChildrenList([]);
    setClassesList([]);
    setClassRosters([]);
    setClassesBackendStatus('BLOCKED_BACKEND');
    setClassesError(null);
    setSelectedClassId('');
    setSelectedChildId('');
    setOperationalCounts({});
    setOperationalCountsLoaded(false);
    setSchoolContextError(null);
    clearClassCommunityState();
    clearParentNotesState();
    setMessages([]);
    setMessagesStatus('BLOCKED_BACKEND');
    setMessagesError(null);
    setEnrollmentApplications([]);
    setEnrollmentsStatus('BLOCKED_BACKEND');
    setEnrollmentsError(null);
    setPublicInquiries([]);
    setInquiriesStatus('BLOCKED_BACKEND');
  }, [clearClassCommunityState, clearNotificationsState, clearParentNotesState, resetPreferencesState]);

  const hydrateAuthenticatedData = useCallback(
    async (user: User, activeClassFilter?: string): Promise<boolean> => {
      if (user.accountStatus !== 'APPROVED') {
        clearPrivateState();
        return false;
      }
      const currentIdent = getCurrentIdentity();
      const origin: AccountIdentityContext = {
        userId: user.id, accountStatus: user.accountStatus, generation: currentIdent.generation,
      };
      if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), mountedRef.current)) return false;

      const reqGen = ++authHydrationGenRef.current;
      const isStillValid = () =>
        mountedRef.current && reqGen === authHydrationGenRef.current &&
        isMatchingApprovedAccountContext(origin, getCurrentIdentity(), mountedRef.current);

      setIsHydratingSchoolData(true);
      setSchoolContextError(null);

      try {
        const [ctxRes] = await Promise.all([
          fetchMySchoolContext(),
          hydratePreferencesForAccount(origin),
          hydrateNotificationsForAccount(origin),
        ]);
        if (!isStillValid()) return false;

        let resolvedClassIds = user.assignedClassIds ?? [];
        if (ctxRes.ok && ctxRes.data) {
          setChildrenList(ctxRes.data.children);
          setClassesList(ctxRes.data.classes);
          setOperationalCounts(ctxRes.data.operationalCounts);
          setOperationalCountsLoaded(true);
          setSelectedChildId((prev) =>
            ctxRes.data!.children.length === 0 ? '' : ctxRes.data!.children.some((c) => c.id === prev) ? prev : ctxRes.data!.children[0].id,
          );
          resolvedClassIds = ctxRes.data.assignedClassIds;
          patchCurrentUserAssignments(user.id, {
            linkedChildrenIds: ctxRes.data.linkedChildrenIds,
            assignedClassIds: ctxRes.data.assignedClassIds,
          });
        } else {
          setOperationalCountsLoaded(false);
          if (ctxRes.status === 'UNAUTHORIZED') {
            setChildrenList([]);
            setClassesList([]);
            setSelectedChildId('');
            resolvedClassIds = [];
            patchCurrentUserAssignments(user.id, { linkedChildrenIds: [], assignedClassIds: [] });
          }
          if (ctxRes.status !== 'BLOCKED_BACKEND') {
            setSchoolContextError(ctxRes.errorMessage || ctxRes.errorCode || 'Unable to load school context.');
          }
        }

        const classesStrategy = resolveClassesRosterFetchStrategy(user, ctxRes);
        if (classesStrategy.action === 'SKIP_CONFIRMED_ZERO_ASSIGNMENTS') {
          setClassesBackendStatus('READY'); setClassesError(null); setClassRosters([]); resolvedClassIds = [];
        } else if (classesStrategy.action === 'SKIP_ROLE_NO_ROSTER_PERMISSION') {
          setClassesBackendStatus('UNAUTHORIZED'); setClassesError(null); setClassRosters([]);
        } else if (classesStrategy.action === 'SKIP_UNAUTHORIZED') {
          setClassesBackendStatus('UNAUTHORIZED'); setClassesError(classesStrategy.reason); setClassRosters([]); resolvedClassIds = [];
        } else {
          const rostersRes = await fetchSchoolClassesWithRosters();
          if (!isStillValid()) return false;
          setClassesBackendStatus(rostersRes.status);
          if (rostersRes.ok && rostersRes.data) {
            setClassRosters(rostersRes.data);
            setClassesError(null);
            if (user.role === 'APP_ADMIN' || user.role === 'ADMINISTRATIVE_PERSONNEL' || user.role === 'MANAGER') {
              setClassesList((prev) =>
                prev.length > 0 ? prev : rostersRes.data!.map((r) => ({
                  id: r.id, name: r.name, level: r.level, teacherId: '',
                  teacherName: r.homeroomTeacherName || '', academicYear: r.academicYear, studentCount: r.activeStudentCount,
                })),
              );
            }
            if (user.role === 'TEACHER') {
              resolvedClassIds = rostersRes.data.map((r) => r.id);
              patchCurrentUserAssignments(user.id, { assignedClassIds: resolvedClassIds });
            } else if (resolvedClassIds.length === 0 && rostersRes.data.length > 0) {
              resolvedClassIds = rostersRes.data.map((r) => r.id);
            }
          } else {
            setClassesError(rostersRes.status === 'BLOCKED_BACKEND' ? null : rostersRes.errorMessage || rostersRes.errorCode || 'Failed to load classes.');
            if (rostersRes.status === 'UNAUTHORIZED') {
              setClassRosters([]);
              if (user.role === 'TEACHER') { resolvedClassIds = []; patchCurrentUserAssignments(user.id, { assignedClassIds: [] }); }
            }
          }
        }

        const targetClassId = reconcileSelectedClassId(activeClassFilter ?? selectedClassId, resolvedClassIds);
        if (targetClassId !== selectedClassId) setSelectedClassId(targetClassId);

        const commOk = await hydrateClassCommunityForUser(user, targetClassId, isStillValid);
        if (!commOk || !isStillValid()) return false;

        await hydrateParentNotesForUser(user, origin, isStillValid);
        if (!isStillValid()) return false;

        if (user.role !== 'STUDENT') {
          const msgRes = await listMessageThreads(user.id);
          if (!isStillValid()) return false;
          setMessagesStatus(msgRes.status);
          if (msgRes.ok && msgRes.data) { setMessages(msgRes.data); setMessagesError(null); }
          else if (msgRes.status === 'UNAUTHORIZED') { setMessages([]); setMessagesError(msgRes.errorMessage || msgRes.errorCode || 'Not authorized to view messages.'); }
          else { setMessagesError(msgRes.status === 'ERROR' ? msgRes.errorMessage || msgRes.errorCode || 'Failed to load messages.' : null); }
        } else {
          setMessagesStatus('UNAUTHORIZED'); setMessages([]); setMessagesError('Direct messaging is unavailable for student accounts.');
        }

        const enrRes = await listEnrollmentApplications();
        if (!isStillValid()) return false;
        setEnrollmentsStatus(enrRes.status);
        if (enrRes.ok && enrRes.data) { setEnrollmentApplications(enrRes.data); setEnrollmentsError(null); }
        else if (enrRes.status === 'UNAUTHORIZED') { setEnrollmentApplications([]); setEnrollmentsError(enrRes.errorMessage || enrRes.errorCode || 'Not authorized to view enrollment queue.'); }
        else { setEnrollmentsError(enrRes.status === 'ERROR' ? enrRes.errorMessage || enrRes.errorCode || 'Failed to load enrollment queue.' : null); }

        if (canReviewOrdinaryAccountsUi(user) || user.role === 'MANAGER') {
          const inqRes = await listPublicInquiries();
          if (!isStillValid()) return false;
          setInquiriesStatus(inqRes.status);
          if (inqRes.ok && inqRes.data) setPublicInquiries(inqRes.data);
          else if (inqRes.status === 'UNAUTHORIZED') setPublicInquiries([]);
        } else {
          setInquiriesStatus('UNAUTHORIZED'); setPublicInquiries([]);
        }
        return true;
      } catch (err) {
        if (isStillValid()) setSchoolContextError(err instanceof Error ? err.message : 'Unable to load school data.');
        return false;
      } finally {
        if (mountedRef.current && reqGen === authHydrationGenRef.current) {
          setIsHydratingSchoolData(false); setIsLoadingClassCommunity(false);
        }
      }
    },
    [clearPrivateState, getCurrentIdentity, hydrateClassCommunityForUser, hydrateNotificationsForAccount, hydrateParentNotesForUser, hydratePreferencesForAccount, mountedRef, patchCurrentUserAssignments, selectedClassId],
  );

  const refreshSchoolData = useCallback(async (): Promise<boolean> => {
    const publicOk = await hydratePublicData(currentUser?.id ?? null);
    if (currentUser && currentUser.accountStatus === 'APPROVED') {
      const authOk = await hydrateAuthenticatedData(currentUser, selectedClassId || undefined);
      return publicOk && authOk;
    }
    return publicOk;
  }, [currentUser, hydrateAuthenticatedData, hydratePublicData, selectedClassId]);

  useEffect(() => {
    if (currentUser && currentUser.accountStatus === 'APPROVED') void hydrateAuthenticatedData(currentUser, selectedClassId || undefined);
    else clearPrivateState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.accountStatus]);

  return {
    ...pub,
    ...community,
    childrenList, classesList, classRosters, classesBackendStatus, classesError,
    selectedClassId, setSelectedClassId, selectedChildId, setSelectedChildId,
    operationalCounts, operationalCountsLoaded, isHydratingSchoolData,
    schoolContextError, messages, messagesStatus, messagesError,
    pickupRecords, enrollmentApplications, enrollmentsStatus, enrollmentsError,
    publicInquiries, inquiriesStatus, clearPrivateState, refreshSchoolData,
  };
}
