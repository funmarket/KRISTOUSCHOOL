import { isMatchingApprovedAccountContext, type AccountIdentityContext } from './appStateGuards.ts';
import {
  getParentNotesQuotaDay,
  getRemainingParentNotesQuota,
  getTunisTimeParts,
  isWithinParentNotesTunisWindow,
  PARENT_NOTES_DAILY_QUOTA,
} from './schoolContent.ts';
import type { BackendOpResult, BackendOpStatus, ParentNote } from '../types.ts';

export interface ParentNotesBoundarySnapshot {
  withinTunisWindow: boolean;
  activeQuotaDay: string;
  verifiedAt: Date | null;
  verifiedQuotaDay: string | null;
  quotaVerified: boolean;
  quotaStale: boolean;
  refreshing: boolean;
  error: string | null;
  status: BackendOpStatus | null;
}

export interface ParentNotesRequestToken {
  gen: number;
  seq: number;
  startedAt: Date;
  startQuotaDay: string;
  origin: AccountIdentityContext;
}

export interface ParentNotesBoundaryCheckResult {
  windowChanged: boolean;
  quotaDayChanged: boolean;
  refreshed: boolean;
}

function getTunisSecondOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Tunis',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const lookup = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const h = lookup('hour');
  const m = lookup('minute');
  const s = lookup('second');
  return h * 3600 + m * 60 + s;
}

/**
 * Computes milliseconds until the next Africa/Tunis sending/reset boundary (08:00:00 or 18:00:00),
 * capped at 30 seconds so suspended/throttled browser timers re-sync promptly.
 */
export function getNextTunisBoundaryDelayMs(now: Date = new Date()): number {
  const secOfDay = getTunisSecondOfDay(now);
  const eightAmSec = 8 * 3600;
  const sixPmSec = 18 * 3600;
  const daySec = 24 * 3600;

  let secondsUntilBoundary: number;
  if (secOfDay < eightAmSec) {
    secondsUntilBoundary = eightAmSec - secOfDay;
  } else if (secOfDay < sixPmSec) {
    secondsUntilBoundary = sixPmSec - secOfDay;
  } else {
    secondsUntilBoundary = daySec - secOfDay + eightAmSec;
  }

  const msUntilBoundary = Math.max(250, secondsUntilBoundary * 1000 + 50);
  return Math.min(30_000, msUntilBoundary);
}

export interface ParentNotesQuotaBoundaryControllerOptions {
  now?: () => Date;
  fetchNotes: () => Promise<BackendOpResult<ParentNote[]>>;
  getCurrentIdentity: () => AccountIdentityContext;
  onApplyNotes: (notes: ParentNote[]) => void;
  onClearNotes: () => void;
  onStatusChange?: (status: BackendOpStatus, error: string | null) => void;
  onSnapshotChange?: (snapshot: ParentNotesBoundarySnapshot) => void;
}

export function createParentNotesQuotaBoundaryController(
  options: ParentNotesQuotaBoundaryControllerOptions,
) {
  const nowFn = options.now ?? (() => new Date());

  let isEligible = false;
  let controllerGen = 0;
  let requestSeq = 0;
  let latestAppliedSeq = 0;
  let verifiedAt: Date | null = null;
  let verifiedQuotaDay: string | null = null;
  let refreshing = false;
  let error: string | null = null;
  let status: BackendOpStatus | null = null;
  let withinTunisWindow = isWithinParentNotesTunisWindow(nowFn());
  let activeQuotaDay = getParentNotesQuotaDay(nowFn());
  let inFlightRefresh: { gen: number; promise: Promise<boolean> } | null = null;

  const isQuotaVerified = (): boolean =>
    Boolean(
      isEligible &&
        verifiedAt !== null &&
        verifiedQuotaDay !== null &&
        verifiedQuotaDay === activeQuotaDay &&
        status === 'READY',
    );

  const isQuotaStale = (): boolean => Boolean(isEligible && verifiedQuotaDay !== activeQuotaDay);

  const getSnapshot = (): ParentNotesBoundarySnapshot => ({
    withinTunisWindow,
    activeQuotaDay,
    verifiedAt,
    verifiedQuotaDay,
    quotaVerified: isQuotaVerified(),
    quotaStale: isQuotaStale(),
    refreshing,
    error,
    status,
  });

  const emitSnapshot = () => {
    options.onSnapshotChange?.(getSnapshot());
  };

  const syncClock = () => {
    const currentNow = nowFn();
    const prevWindow = withinTunisWindow;
    const prevDay = activeQuotaDay;
    withinTunisWindow = isWithinParentNotesTunisWindow(currentNow);
    activeQuotaDay = getParentNotesQuotaDay(currentNow);
    return {
      currentNow,
      windowChanged: prevWindow !== withinTunisWindow,
      quotaDayChanged: prevDay !== activeQuotaDay,
    };
  };

  const setIdentity = (eligible: boolean) => {
    controllerGen += 1;
    latestAppliedSeq = requestSeq;
    isEligible = eligible;
    verifiedAt = null;
    verifiedQuotaDay = null;
    refreshing = false;
    error = null;
    status = null;
    inFlightRefresh = null;
    syncClock();
    emitSnapshot();
  };

  const beginHydrationRequest = (
    origin: AccountIdentityContext,
    isMounted = true,
  ): ParentNotesRequestToken | null => {
    if (!isEligible) return null;
    if (!isMatchingApprovedAccountContext(origin, options.getCurrentIdentity(), isMounted)) {
      return null;
    }
    const startedAt = nowFn();
    return {
      gen: controllerGen,
      seq: ++requestSeq,
      startedAt,
      startQuotaDay: getParentNotesQuotaDay(startedAt),
      origin: { ...origin },
    };
  };

  const isRequestCurrent = (
    token: ParentNotesRequestToken | null | undefined,
    isMounted = true,
  ): boolean => {
    if (!token || !isEligible) return false;
    if (token.gen !== controllerGen) return false;
    if (token.seq < latestAppliedSeq) return false;
    return isMatchingApprovedAccountContext(token.origin, options.getCurrentIdentity(), isMounted);
  };

  const recordHydratedResult = (
    origin: AccountIdentityContext,
    res: BackendOpResult<ParentNote[]>,
    confirmedAt: Date = nowFn(),
    isMounted = true,
    requestToken?: ParentNotesRequestToken | null,
  ): boolean => {
    if (!isMatchingApprovedAccountContext(origin, options.getCurrentIdentity(), isMounted)) {
      return false;
    }
    if (requestToken && !isRequestCurrent(requestToken, isMounted)) {
      return false;
    }
    const effectiveStartedAt = requestToken ? requestToken.startedAt : confirmedAt;
    const startQuotaDay = requestToken
      ? requestToken.startQuotaDay
      : getParentNotesQuotaDay(confirmedAt);
    const seq = requestToken ? requestToken.seq : ++requestSeq;
    latestAppliedSeq = Math.max(latestAppliedSeq, seq);

    syncClock();
    if (res.ok && res.data) {
      verifiedAt = effectiveStartedAt;
      verifiedQuotaDay = startQuotaDay;
      status = 'READY';
      error = null;
      refreshing = inFlightRefresh !== null;
      emitSnapshot();
      return verifiedQuotaDay === activeQuotaDay;
    }
    if (res.status === 'UNAUTHORIZED') {
      verifiedAt = null;
      verifiedQuotaDay = null;
      status = 'UNAUTHORIZED';
      error = res.errorMessage || res.errorCode || 'Not authorized to access parent notes.';
      refreshing = inFlightRefresh !== null;
      emitSnapshot();
      return false;
    }
    if (res.status === 'BLOCKED_BACKEND') {
      verifiedAt = null;
      verifiedQuotaDay = null;
      status = 'BLOCKED_BACKEND';
      error = null;
      refreshing = inFlightRefresh !== null;
      emitSnapshot();
      return false;
    }
    // Preserve previous verifiedAt/verifiedQuotaDay on transient ERROR so an exhausted
    // prior-cycle quota is never locally manufactured as reset when the server read failed.
    status = 'ERROR';
    error = res.errorMessage || res.errorCode || 'Failed to refresh parent notes.';
    refreshing = inFlightRefresh !== null;
    emitSnapshot();
    return false;
  };

  const refreshNow = async (): Promise<boolean> => {
    if (!isEligible) return false;
    const current = options.getCurrentIdentity();
    if (!current.userId || current.accountStatus !== 'APPROVED') return false;

    if (inFlightRefresh && inFlightRefresh.gen === controllerGen) {
      return inFlightRefresh.promise;
    }

    const capturedGen = controllerGen;
    const seq = ++requestSeq;
    const startedAt = nowFn();
    const startQuotaDay = getParentNotesQuotaDay(startedAt);
    const origin: AccountIdentityContext = { ...current };
    refreshing = true;
    error = null;
    emitSnapshot();

    let flightEntry: { gen: number; promise: Promise<boolean> } | null = null;
    const runRefresh = async (): Promise<boolean> => {
      try {
        const res = await options.fetchNotes();
        if (
          capturedGen !== controllerGen ||
          seq < latestAppliedSeq ||
          !isMatchingApprovedAccountContext(origin, options.getCurrentIdentity(), true)
        ) {
          return false;
        }
        latestAppliedSeq = Math.max(latestAppliedSeq, seq);
        syncClock();
        if (res.ok && res.data) {
          options.onApplyNotes(res.data);
          verifiedAt = startedAt;
          verifiedQuotaDay = startQuotaDay;
          status = 'READY';
          error = null;
          options.onStatusChange?.('READY', null);
          return verifiedQuotaDay === activeQuotaDay;
        }
        if (res.status === 'UNAUTHORIZED') {
          options.onClearNotes();
          verifiedAt = null;
          verifiedQuotaDay = null;
          status = 'UNAUTHORIZED';
          error = res.errorMessage || res.errorCode || 'Not authorized to access parent notes.';
          options.onStatusChange?.('UNAUTHORIZED', error);
          return false;
        }
        if (res.status === 'BLOCKED_BACKEND') {
          verifiedAt = null;
          verifiedQuotaDay = null;
          status = 'BLOCKED_BACKEND';
          error = null;
          options.onStatusChange?.('BLOCKED_BACKEND', null);
          return false;
        }
        status = 'ERROR';
        error = res.errorMessage || res.errorCode || 'Failed to refresh parent notes.';
        options.onStatusChange?.('ERROR', error);
        return false;
      } catch (err) {
        if (
          capturedGen !== controllerGen ||
          seq < latestAppliedSeq ||
          !isMatchingApprovedAccountContext(origin, options.getCurrentIdentity(), true)
        ) {
          return false;
        }
        latestAppliedSeq = Math.max(latestAppliedSeq, seq);
        status = 'ERROR';
        error = err instanceof Error ? err.message : 'Failed to refresh parent notes.';
        options.onStatusChange?.('ERROR', error);
        return false;
      } finally {
        if (flightEntry && inFlightRefresh === flightEntry) {
          inFlightRefresh = null;
        }
        if (
          capturedGen === controllerGen &&
          isMatchingApprovedAccountContext(origin, options.getCurrentIdentity(), true)
        ) {
          refreshing = false;
          emitSnapshot();
        }
      }
    };

    flightEntry = { gen: capturedGen, promise: runRefresh() };
    inFlightRefresh = flightEntry;
    return flightEntry.promise;
  };

  const checkBoundaryAndRefresh = async (): Promise<ParentNotesBoundaryCheckResult> => {
    const { windowChanged, quotaDayChanged } = syncClock();
    if (!isEligible) {
      if (windowChanged || quotaDayChanged) emitSnapshot();
      return { windowChanged, quotaDayChanged, refreshed: false };
    }

    const needsBoundaryRefresh = isQuotaStale();
    if (windowChanged || quotaDayChanged) {
      emitSnapshot();
    }

    if (needsBoundaryRefresh) {
      const refreshed = await refreshNow();
      return { windowChanged, quotaDayChanged, refreshed };
    }

    return { windowChanged, quotaDayChanged, refreshed: false };
  };

  const computeRemainingQuota = (
    notes: readonly ParentNote[],
    userId: string | null | undefined,
  ): number | null => {
    if (
      !isEligible ||
      !userId ||
      verifiedAt === null ||
      status === 'UNAUTHORIZED' ||
      status === 'BLOCKED_BACKEND'
    ) {
      return null;
    }
    return getRemainingParentNotesQuota(notes, userId, verifiedAt);
  };

  return {
    getSnapshot,
    setIdentity,
    beginHydrationRequest,
    isRequestCurrent,
    recordHydratedResult,
    refreshNow,
    checkBoundaryAndRefresh,
    computeRemainingQuota,
  };
}

export { getTunisTimeParts };
