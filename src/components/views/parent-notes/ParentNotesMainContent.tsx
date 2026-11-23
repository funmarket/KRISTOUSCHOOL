import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { ParentNote } from '../../../types';
import { EmptyFeatureState } from '../../homepages/shared/EmptyFeatureState';
import { canAccessAppTab } from '../../homepages/homepageAccess';
import { pickText } from '../../../i18n/homepages';
import {
  getParentNotesQuotaDay,
  isWithinParentNotesTunisWindow,
} from '../../../lib/schoolContent';
import { getNextTunisBoundaryDelayMs } from '../../../lib/parentNotesBoundary';
import { getCurrentNotificationTarget, getNotificationActorKey, resolveNotificationTarget, type NotificationTargetIntent } from '../../../lib/notificationTargetNavigation';
import { ParentNotesFormSection } from './ParentNotesFormSection';
import { ParentNotesHistorySection } from './ParentNotesHistorySection';

export interface ParentNotesMainContentProps {
  classId?: string | null;
  classNameLabel?: string | null;
  embeddedUnderCalendar?: boolean;
  notificationTarget?: NotificationTargetIntent | null;
}

export const ParentNotesMainContent: React.FC<ParentNotesMainContentProps> = ({
  classId = null,
  classNameLabel = null,
  embeddedUnderCalendar = false,
  notificationTarget = null,
}) => {
  const {
    currentUser,
    childrenList,
    parentNotes,
    notesStatus,
    notesError,
    remainingParentNotesToday,
    isRefreshingParentNotesQuota,
    parentNotesQuotaStale,
    parentNotesQuotaVerified,
    selectedChildId,
    setSelectedChildId,
    addParentNote,
    replyParentNote,
    refreshSchoolData,
    refreshParentNotesQuota,
    isHydratingSchoolData,
    language,
    t,
  } = useApp();

  const canAccessNotes = Boolean(currentUser && currentUser.accountStatus === 'APPROVED' && canAccessAppTab(currentUser, 'notes'));

  const linkedChildren = useMemo(() => {
    if (!canAccessNotes || !currentUser?.linkedChildrenIds?.length) return [];
    return childrenList.filter((c) => currentUser.linkedChildrenIds?.includes(c.id));
  }, [canAccessNotes, childrenList, currentUser?.linkedChildrenIds]);

  const scopedChildren = useMemo(() => {
    if (!classId) return linkedChildren;
    return linkedChildren.filter((c) => c.classId === classId);
  }, [classId, linkedChildren]);

  const activeChild = useMemo(() => {
    if (scopedChildren.length === 0) return null;
    return scopedChildren.find((c) => c.id === selectedChildId) ?? scopedChildren[0];
  }, [scopedChildren, selectedChildId]);

  const effectiveChildId = activeChild?.id ?? '';

  const isStaffReviewer =
    currentUser?.role === 'TEACHER' ||
    currentUser?.role === 'ADMINISTRATIVE_PERSONNEL' ||
    currentUser?.role === 'MANAGER' ||
    currentUser?.role === 'APP_ADMIN';

  const [topic, setTopic] = useState<ParentNote['topic']>('ABSENCE');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [withinTunisWindow, setWithinTunisWindow] = useState<boolean>(() => isWithinParentNotesTunisWindow());
  const lastObservedQuotaDayRef = useRef<string>(getParentNotesQuotaDay());
  const appliedNoteNotificationRequestRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const syncWindowAndBoundary = () => {
      if (cancelled) return;
      setWithinTunisWindow(isWithinParentNotesTunisWindow());
      const nextQuotaDay = getParentNotesQuotaDay();
      if (nextQuotaDay !== lastObservedQuotaDayRef.current) {
        lastObservedQuotaDayRef.current = nextQuotaDay;
        if (typeof refreshParentNotesQuota === 'function') void refreshParentNotesQuota();
      }
    };
    const scheduleNext = () => {
      if (cancelled) return;
      timerId = setTimeout(() => { syncWindowAndBoundary(); scheduleNext(); }, getNextTunisBoundaryDelayMs());
    };
    syncWindowAndBoundary();
    scheduleNext();
    return () => { cancelled = true; if (timerId !== null) clearTimeout(timerId); };
  }, [refreshParentNotesQuota]);

  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);

  const contextKey = `${currentUser?.id ?? 'anon'}::${classId ?? 'school'}::${effectiveChildId}`;
  const activeContextKeyRef = useRef(contextKey);
  activeContextKeyRef.current = contextKey;

  useEffect(() => {
    setContent('');
    setErrorMsg('');
    setSuccessMsg('');
    setReplyTextMap({});
  }, [contextKey]);

  useEffect(() => {
    if (canAccessNotes && scopedChildren.length > 0 && !scopedChildren.some((c) => c.id === selectedChildId)) {
      setSelectedChildId(scopedChildren[0].id);
    }
  }, [canAccessNotes, scopedChildren, selectedChildId, setSelectedChildId]);

  const visibleNotes = useMemo(() => {
    if (!canAccessNotes || notesStatus === 'UNAUTHORIZED') return [];
    const roleFiltered = isStaffReviewer ? parentNotes : parentNotes.filter((n) => n.parentId === currentUser?.id);
    if (!classId) return roleFiltered;
    return roleFiltered.filter((n) => n.classId === classId);
  }, [canAccessNotes, classId, currentUser?.id, isStaffReviewer, notesStatus, parentNotes]);

  const notificationIntent = getCurrentNotificationTarget(notificationTarget, getNotificationActorKey(currentUser), 'notes');
  const notificationResolution = resolveNotificationTarget(notificationIntent, getNotificationActorKey(currentUser), notesStatus, isHydratingSchoolData, visibleNotes);

  useEffect(() => {
    if (!notificationIntent || notificationResolution.state !== 'found' || appliedNoteNotificationRequestRef.current === notificationIntent.requestId) return;
    appliedNoteNotificationRequestRef.current = notificationIntent.requestId;
    const note = notificationResolution.record;
    if (currentUser?.role === 'PARENT' && scopedChildren.some((child) => child.id === note.childId) && selectedChildId !== note.childId) {
      setSelectedChildId(note.childId);
    }
    document.getElementById(`notification-parent-note-${note.id}`)?.scrollIntoView({ block: 'nearest' });
  }, [notificationIntent?.requestId, notificationResolution.state, notificationResolution.record?.id, currentUser?.role, scopedChildren, selectedChildId, setSelectedChildId]);

  if (!canAccessNotes) {
    if (embeddedUnderCalendar) return null;
    return <EmptyFeatureState state="UNAUTHORIZED" title={t('unauthorized')} description={t('loginRequired')} />;
  }

  const trimmedLength = content.trim().length;
  const isBlockedUnauthorized = notesStatus === 'UNAUTHORIZED';
  const isBlockedError = notesStatus === 'ERROR';
  const isRefreshingQuota = Boolean(isRefreshingParentNotesQuota);
  const isQuotaStale = Boolean(parentNotesQuotaStale);
  const isQuotaVerified = parentNotesQuotaVerified !== undefined ? Boolean(parentNotesQuotaVerified) && !isQuotaStale && notesStatus === 'READY' : remainingParentNotesToday !== null && remainingParentNotesToday !== undefined && !isQuotaStale && notesStatus === 'READY';
  const hasNumericEstimate = typeof remainingParentNotesToday === 'number' && Number.isFinite(remainingParentNotesToday);
  const isParentQuotaExhausted = hasNumericEstimate && remainingParentNotesToday <= 0;
  const hasEligibleChild = Boolean(effectiveChildId);
  const showSendForm = !isBlockedUnauthorized && (!isStaffReviewer || linkedChildren.length > 0);
  const showNoChildHint = Boolean(classId && !isStaffReviewer && linkedChildren.length > 0 && scopedChildren.length === 0);
  const canSubmitParentNote = hasEligibleChild && withinTunisWindow && isQuotaVerified && hasNumericEstimate && !isParentQuotaExhausted && !isBlockedUnauthorized && !isBlockedError && !isRefreshingQuota && !isQuotaStale && !submitting;

  const handleQuotaRefresh = () => {
    if (typeof refreshParentNotesQuota === 'function') return refreshParentNotesQuota();
    return refreshSchoolData();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || isRefreshingQuota) return;
    setErrorMsg('');
    setSuccessMsg('');
    if (!isWithinParentNotesTunisWindow()) {
      setErrorMsg(pickText({ ar: 'الإرسال مغلق خارج 08:00–18:00 بتوقيت تونس.', fr: 'Envoi fermé.', en: 'Parent notes can only be sent between 08:00 and 18:00 Africa/Tunis.' }, language));
      return;
    }
    if (!effectiveChildId) {
      setErrorMsg(t('error'));
      return;
    }
    if (trimmedLength < 1 || trimmedLength > 1000) {
      setErrorMsg(t('error'));
      return;
    }
    const capturedContext = activeContextKeyRef.current;
    setSubmitting(true);
    try {
      const res = await addParentNote(effectiveChildId, topic, content);
      if (activeContextKeyRef.current !== capturedContext) return;
      if (!res.success) {
        setErrorMsg(res.error || t('error'));
        return;
      }
      setSuccessMsg(t('success'));
      setContent('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStaffReply = async (noteId: string) => {
    const replyContent = (replyTextMap[noteId] || '').trim();
    if (!replyContent || replyingId || isBlockedUnauthorized) return;
    const capturedContext = activeContextKeyRef.current;
    setReplyingId(noteId);
    try {
      const res = await replyParentNote(noteId, replyContent);
      if (activeContextKeyRef.current !== capturedContext) return;
      if (!res.ok) return;
      setReplyTextMap((prev) => ({ ...prev, [noteId]: '' }));
    } finally {
      setReplyingId(null);
    }
  };

  return (
    <section className="space-y-5" data-testid={embeddedUnderCalendar ? 'under-calendar-parent-notes' : 'parent-notes-panel'}>
      {notificationIntent && notificationResolution.state === 'unavailable' && (
        <p role="status" data-testid="notification-target-unavailable" className="rounded-xl border border-amber-200 px-4 py-3 text-xs font-semibold text-amber-900">
          {t('unauthorized')}
        </p>
      )}
      <ParentNotesFormSection
        embeddedUnderCalendar={embeddedUnderCalendar}
        classNameLabel={classNameLabel}
        withinTunisWindow={withinTunisWindow}
        isStaffReviewer={isStaffReviewer}
        isRefreshingQuota={isRefreshingQuota}
        isQuotaStale={isQuotaStale}
        isQuotaVerified={isQuotaVerified}
        remainingParentNotesToday={remainingParentNotesToday ?? null}
        showNoChildHint={showNoChildHint}
        notesStatus={notesStatus}
        notesError={notesError}
        showSendForm={showSendForm}
        errorMsg={errorMsg}
        successMsg={successMsg}
        scopedChildren={scopedChildren}
        effectiveChildId={effectiveChildId}
        setSelectedChildId={setSelectedChildId}
        topic={topic}
        setTopic={setTopic}
        content={content}
        setContent={setContent}
        trimmedLength={trimmedLength}
        canSubmitParentNote={canSubmitParentNote}
        submitting={submitting}
        handleSubmit={(e) => void handleSubmit(e)}
        handleQuotaRefresh={handleQuotaRefresh}
        t={t as any}
        language={language}
      />
      <ParentNotesHistorySection
        visibleNotes={visibleNotes}
        isStaffReviewer={isStaffReviewer}
        replyTextMap={replyTextMap}
        setReplyTextMap={setReplyTextMap}
        replyingId={replyingId}
        handleStaffReply={(id) => void handleStaffReply(id)}
        t={t as any}
        language={language}
      />
    </section>
  );
};
