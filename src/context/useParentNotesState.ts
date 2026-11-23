import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { BackendOpStatus, ParentNote, User } from '../types';
import type { AccountIdentityContext } from '../lib/appStateGuards';
import {
  createParentNotesQuotaBoundaryController,
  getNextTunisBoundaryDelayMs,
  type ParentNotesBoundarySnapshot,
} from '../lib/parentNotesBoundary';
import { listParentNotes } from '../lib/schoolContent';

export function isParentNotesEligibleUser(user: User | null | undefined): boolean {
  return Boolean(
    user &&
      user.accountStatus === 'APPROVED' &&
      user.role !== 'STUDENT' &&
      user.role !== 'SCHOOL_STAFF',
  );
}

export interface UseParentNotesStateParams {
  currentUser: User | null;
  identityContext: AccountIdentityContext;
  getCurrentIdentity: () => AccountIdentityContext;
  mountedRef?: React.MutableRefObject<boolean>;
}

export function useParentNotesState({
  currentUser,
  identityContext,
  getCurrentIdentity,
  mountedRef,
}: UseParentNotesStateParams) {
  const [parentNotes, setParentNotes] = useState<ParentNote[]>([]);
  const [notesStatus, setNotesStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [notesError, setNotesError] = useState<string | null>(null);

  const internalMountedRef = useRef<boolean>(true);
  const effectiveMountedRef = mountedRef ?? internalMountedRef;

  useEffect(() => {
    if (mountedRef) return;
    internalMountedRef.current = true;
    return () => {
      internalMountedRef.current = false;
    };
  }, [mountedRef]);

  const getCurrentIdentityRef = useRef(getCurrentIdentity);
  getCurrentIdentityRef.current = getCurrentIdentity;

  const notesBoundaryControllerRef = useRef<ReturnType<
    typeof createParentNotesQuotaBoundaryController
  > | null>(null);

  if (!notesBoundaryControllerRef.current) {
    notesBoundaryControllerRef.current = createParentNotesQuotaBoundaryController({
      fetchNotes: () => listParentNotes(),
      getCurrentIdentity: () => getCurrentIdentityRef.current(),
      onApplyNotes: (notes) => {
        if (effectiveMountedRef.current) setParentNotes(notes);
      },
      onClearNotes: () => {
        if (effectiveMountedRef.current) setParentNotes([]);
      },
      onStatusChange: (status, err) => {
        if (!effectiveMountedRef.current) return;
        setNotesStatus(status);
        setNotesError(err);
      },
      onSnapshotChange: (snapshot) => {
        if (effectiveMountedRef.current) setNotesBoundarySnapshot(snapshot);
      },
    });
  }

  const [notesBoundarySnapshot, setNotesBoundarySnapshot] = useState<ParentNotesBoundarySnapshot>(
    () => notesBoundaryControllerRef.current!.getSnapshot(),
  );

  const resetParentNotesState = useCallback(() => {
    setParentNotes([]);
    setNotesStatus('BLOCKED_BACKEND');
    setNotesError(null);
  }, []);

  const clearParentNotesState = useCallback(() => {
    resetParentNotesState();
    notesBoundaryControllerRef.current?.setIdentity(false);
  }, [resetParentNotesState]);

  const eligibleForNotes = isParentNotesEligibleUser(currentUser);
  const lastSyncedIdentityRef = useRef<{ generation: number; eligible: boolean } | null>(null);

  useEffect(() => {
    const prev = lastSyncedIdentityRef.current;
    if (
      prev === null ||
      prev.generation !== identityContext.generation ||
      prev.eligible !== eligibleForNotes
    ) {
      lastSyncedIdentityRef.current = {
        generation: identityContext.generation,
        eligible: eligibleForNotes,
      };
      if (prev !== null) {
        resetParentNotesState();
      }
      notesBoundaryControllerRef.current?.setIdentity(eligibleForNotes);
    }
  }, [eligibleForNotes, identityContext.generation, resetParentNotesState]);

  const hydrateParentNotesForUser = useCallback(
    async (user: User, origin: AccountIdentityContext, isStillValid: () => boolean) => {
      if (user.role !== 'STUDENT' && user.role !== 'SCHOOL_STAFF') {
        const notesReq = notesBoundaryControllerRef.current?.beginHydrationRequest(
          origin,
          effectiveMountedRef.current,
        );
        const notesRes = await listParentNotes();
        if (!isStillValid()) return;
        if (
          notesReq &&
          notesBoundaryControllerRef.current?.isRequestCurrent(
            notesReq,
            effectiveMountedRef.current,
          )
        ) {
          setNotesStatus(notesRes.status);
          const certifiedCurrentCycle = notesBoundaryControllerRef.current.recordHydratedResult(
            origin,
            notesRes,
            notesReq.startedAt,
            effectiveMountedRef.current,
            notesReq,
          );
          if (notesRes.ok && notesRes.data) {
            setParentNotes(notesRes.data);
            setNotesError(null);
            if (!certifiedCurrentCycle) {
              void notesBoundaryControllerRef.current.checkBoundaryAndRefresh();
            }
          } else if (notesRes.status === 'UNAUTHORIZED') {
            setParentNotes([]);
            setNotesError(
              notesRes.errorMessage || notesRes.errorCode || 'Not authorized to view parent notes.',
            );
          } else {
            setNotesError(
              notesRes.status === 'ERROR'
                ? notesRes.errorMessage || notesRes.errorCode || 'Failed to load parent notes.'
                : null,
            );
          }
        }
      } else {
        setNotesStatus('UNAUTHORIZED');
        setParentNotes([]);
        setNotesError('Parent notes are unavailable for this role.');
        notesBoundaryControllerRef.current?.setIdentity(false);
      }
    },
    [effectiveMountedRef],
  );

  useEffect(() => {
    const eligible = isParentNotesEligibleUser(currentUser);
    if (!eligible) return;
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const controller = notesBoundaryControllerRef.current;
    if (!controller) return;

    const runBoundaryCheck = () => {
      if (!cancelled) void controller.checkBoundaryAndRefresh();
    };
    const scheduleNext = () => {
      if (cancelled) return;
      timerId = setTimeout(() => {
        runBoundaryCheck();
        scheduleNext();
      }, getNextTunisBoundaryDelayMs());
    };
    scheduleNext();

    const handleVisibility = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        runBoundaryCheck();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', runBoundaryCheck);
      window.addEventListener('pageshow', runBoundaryCheck);
    }

    return () => {
      cancelled = true;
      if (timerId !== null) clearTimeout(timerId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', runBoundaryCheck);
        window.removeEventListener('pageshow', runBoundaryCheck);
      }
    };
  }, [currentUser?.id, currentUser?.accountStatus, currentUser?.role]);

  const refreshParentNotesQuota = useCallback(async (): Promise<boolean> => {
    if (!notesBoundaryControllerRef.current) return false;
    return notesBoundaryControllerRef.current.refreshNow();
  }, []);

  const remainingParentNotesToday = notesBoundaryControllerRef.current
    ? notesBoundaryControllerRef.current.computeRemainingQuota(parentNotes, currentUser?.id)
    : null;

  return {
    parentNotes,
    setParentNotes,
    notesStatus,
    notesError,
    notesBoundarySnapshot,
    isRefreshingParentNotesQuota: notesBoundarySnapshot.refreshing,
    parentNotesQuotaStale: notesBoundarySnapshot.quotaStale,
    parentNotesQuotaVerified: notesBoundarySnapshot.quotaVerified,
    remainingParentNotesToday,
    refreshParentNotesQuota,
    hydrateParentNotesForUser,
    resetParentNotesState,
    clearParentNotesState,
  };
}
