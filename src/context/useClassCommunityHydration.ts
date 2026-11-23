import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Announcement,
  BackendOpResult,
  BackendOpStatus,
  ClassDocumentItem,
  ClassGalleryItem,
  ClassQuestion,
  Homework,
  User,
} from '../types';
import { listClassCommunityContent } from '../lib/schoolContent';
import {
  isMatchingApprovedAccountContext,
  type AccountIdentityContext,
} from '../lib/appStateGuards';

interface UseClassCommunityHydrationParams {
  currentUser: User | null;
  selectedClassId: string;
  getCurrentIdentity: () => AccountIdentityContext;
  mountedRef: React.MutableRefObject<boolean>;
}

export function useClassCommunityHydration({
  currentUser,
  selectedClassId,
  getCurrentIdentity,
  mountedRef,
}: UseClassCommunityHydrationParams) {
  const [isLoadingClassCommunity, setIsLoadingClassCommunity] = useState<boolean>(false);
  const [classAnnouncements, setClassAnnouncements] = useState<Announcement[]>([]);
  const [homeworkList, setHomeworkList] = useState<Homework[]>([]);
  const [classDocuments, setClassDocuments] = useState<ClassDocumentItem[]>([]);
  const [classGallery, setClassGallery] = useState<ClassGalleryItem[]>([]);
  const [classQuestions, setClassQuestions] = useState<ClassQuestion[]>([]);
  const [communityStatus, setCommunityStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [communityError, setCommunityError] = useState<string | null>(null);
  const classCommGenRef = useRef<number>(0);

  const clearClassCommunityState = useCallback(() => {
    classCommGenRef.current += 1;
    setIsLoadingClassCommunity(false);
    setClassAnnouncements([]);
    setHomeworkList([]);
    setClassDocuments([]);
    setClassGallery([]);
    setClassQuestions([]);
    setCommunityStatus('BLOCKED_BACKEND');
    setCommunityError(null);
  }, []);

  const applyClassCommunityResult = useCallback(
    (commRes: BackendOpResult<{
      announcements: Announcement[];
      homework: Homework[];
      questions: ClassQuestion[];
      documents: ClassDocumentItem[];
      gallery: ClassGalleryItem[];
    }>) => {
      setCommunityStatus(commRes.status);
      if (commRes.ok && commRes.data) {
        setClassAnnouncements(commRes.data.announcements);
        setHomeworkList(commRes.data.homework);
        setClassQuestions(commRes.data.questions);
        setClassDocuments(commRes.data.documents);
        setClassGallery(commRes.data.gallery);
        setCommunityError(null);
      } else if (commRes.status === 'UNAUTHORIZED') {
        setClassAnnouncements([]);
        setHomeworkList([]);
        setClassQuestions([]);
        setClassDocuments([]);
        setClassGallery([]);
        setCommunityError(commRes.errorMessage || commRes.errorCode || 'Unauthorized for class community.');
      } else if (commRes.status === 'ERROR') {
        setCommunityError(commRes.errorMessage || commRes.errorCode || 'Unable to load class community.');
      } else {
        setCommunityError(null);
      }
    },
    [],
  );

  const hydrateClassCommunityForUser = useCallback(
    async (user: User, targetClassId: string, isStillValid: () => boolean) => {
      const canSeeCommunity =
        user.role !== 'SCHOOL_STAFF' ||
        Boolean(user.capabilities?.some((c) => c === 'ANNOUNCEMENTS_READ' || c === 'CALENDAR_READ' || c === 'CLASS_SUPPORT'));
      if (canSeeCommunity) {
        setIsLoadingClassCommunity(true);
        const commRes = await listClassCommunityContent(targetClassId || undefined);
        if (!isStillValid()) return false;
        setIsLoadingClassCommunity(false);
        applyClassCommunityResult(commRes);
      } else {
        setCommunityStatus('UNAUTHORIZED');
        setClassAnnouncements([]);
        setHomeworkList([]);
        setClassQuestions([]);
        setClassDocuments([]);
        setClassGallery([]);
        setCommunityError('Unauthorized for class community.');
      }
      return true;
    },
    [applyClassCommunityResult],
  );

  useEffect(() => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED' || !selectedClassId) return;
    const origin: AccountIdentityContext = {
      userId: currentUser.id,
      accountStatus: currentUser.accountStatus,
      generation: getCurrentIdentity().generation,
    };
    const reqGen = ++classCommGenRef.current;
    setIsLoadingClassCommunity(true);
    void listClassCommunityContent(selectedClassId)
      .then((commRes) => {
        if (!mountedRef.current || reqGen !== classCommGenRef.current || !isMatchingApprovedAccountContext(origin, getCurrentIdentity(), mountedRef.current)) return;
        applyClassCommunityResult(commRes);
      })
      .catch((err) => {
        if (!mountedRef.current || reqGen !== classCommGenRef.current || !isMatchingApprovedAccountContext(origin, getCurrentIdentity(), mountedRef.current)) return;
        setCommunityStatus('ERROR');
        setCommunityError(err instanceof Error ? err.message : 'Unable to load class community.');
      })
      .finally(() => {
        if (mountedRef.current && reqGen === classCommGenRef.current) setIsLoadingClassCommunity(false);
      });
  }, [applyClassCommunityResult, currentUser, getCurrentIdentity, mountedRef, selectedClassId]);

  return {
    isLoadingClassCommunity,
    setIsLoadingClassCommunity,
    classAnnouncements,
    homeworkList,
    classDocuments,
    classGallery,
    classQuestions,
    setClassQuestions,
    communityStatus,
    communityError,
    clearClassCommunityState,
    hydrateClassCommunityForUser,
  };
}
