import type React from 'react';
import type {
  BackendOpResult,
  ClassQuestion,
  ParentNote,
  User,
} from '../types';
import {
  moderateClassQuestion as moderateClassQuestionRpc,
  postClassQuestion as postClassQuestionRpc,
  replyClassQuestion as replyClassQuestionRpc,
  replyParentNote as replyParentNoteRpc,
  sendParentNote as sendParentNoteRpc,
} from '../lib/schoolContent';
import {
  isMatchingApprovedAccountContext,
  type AccountIdentityContext,
} from '../lib/appStateGuards';

interface UseCommunityAndNotesActionsParams {
  currentUser: User | null;
  getCurrentIdentity: () => AccountIdentityContext;
  mountedRef: React.RefObject<boolean>;
  setParentNotes: React.Dispatch<React.SetStateAction<ParentNote[]>>;
  setClassQuestions: React.Dispatch<React.SetStateAction<ClassQuestion[]>>;
}

export function useCommunityAndNotesActions({
  currentUser,
  getCurrentIdentity,
  mountedRef,
  setParentNotes,
  setClassQuestions,
}: UseCommunityAndNotesActionsParams) {

  const addParentNote = async (
    childId: string,
    topic: ParentNote['topic'],
    content: string,
    _teacherId?: string,
  ) => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED') {
      return {
        success: false,
        status: 'UNAUTHORIZED' as const,
        errorCode: 'actor_not_approved',
        error: 'Approved account required.',
      };
    }
    const origin: AccountIdentityContext = {
      userId: currentUser.id,
      accountStatus: currentUser.accountStatus,
      generation: getCurrentIdentity().generation,
    };
    const res = await sendParentNoteRpc(childId, topic, content);
    if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), mountedRef.current)) {
      return {
        success: false,
        status: 'ERROR' as const,
        errorCode: 'session_changed',
        error: 'Account session changed.',
      };
    }
    if (!res.ok || !res.data) {
      return {
        success: false,
        status: res.status,
        errorCode: res.errorCode,
        error: res.errorMessage,
      };
    }
    setParentNotes((prev) => [res.data!.note, ...prev]);
    return { success: true, status: res.status };
  };

  const replyParentNote = async (
    noteId: string,
    replyContent: string,
  ): Promise<BackendOpResult<ParentNote>> => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED') {
      return {
        ok: false,
        status: 'UNAUTHORIZED' as const,
        errorCode: 'actor_not_approved',
        errorMessage: 'Approved account required.',
      };
    }
    const origin: AccountIdentityContext = {
      userId: currentUser.id,
      accountStatus: currentUser.accountStatus,
      generation: getCurrentIdentity().generation,
    };
    const res = await replyParentNoteRpc(noteId, replyContent);
    if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), mountedRef.current)) {
      return {
        ok: false,
        status: 'ERROR' as const,
        errorCode: 'session_changed',
        errorMessage: 'Account session changed.',
      };
    }
    if (res.ok && res.data) {
      setParentNotes((prev) => prev.map((n) => (n.id === noteId ? res.data! : n)));
    }
    return res;
  };

  const addClassQuestion = async (classId: string, content: string) => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED') {
      return {
        success: false,
        status: 'UNAUTHORIZED' as const,
        errorCode: 'actor_not_approved',
        error: 'Approved account required.',
      };
    }
    const origin: AccountIdentityContext = {
      userId: currentUser.id,
      accountStatus: currentUser.accountStatus,
      generation: getCurrentIdentity().generation,
    };
    const res = await postClassQuestionRpc(classId, content);
    if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), mountedRef.current)) {
      return {
        success: false,
        status: 'ERROR' as const,
        errorCode: 'session_changed',
        error: 'Account session changed.',
      };
    }
    if (!res.ok || !res.data) {
      return {
        success: false,
        status: res.status,
        errorCode: res.errorCode,
        error: res.errorMessage,
      };
    }
    setClassQuestions((prev) => [res.data!, ...prev]);
    return { success: true, status: res.status };
  };

  const replyClassQuestion = async (
    questionId: string,
    content: string,
  ): Promise<BackendOpResult<unknown>> => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED') {
      return {
        ok: false,
        status: 'UNAUTHORIZED' as const,
        errorCode: 'actor_not_approved',
        errorMessage: 'Approved account required.',
      };
    }
    const origin: AccountIdentityContext = {
      userId: currentUser.id,
      accountStatus: currentUser.accountStatus,
      generation: getCurrentIdentity().generation,
    };
    const res = await replyClassQuestionRpc(questionId, content);
    if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), mountedRef.current)) {
      return {
        ok: false,
        status: 'ERROR' as const,
        errorCode: 'session_changed',
        errorMessage: 'Account session changed.',
      };
    }
    if (res.ok && res.data) {
      setClassQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== questionId) return q;
          const nextReplies = [...(q.replies || []), res.data!];
          return { ...q, replies: nextReplies, repliesCount: nextReplies.length };
        }),
      );
    }
    return res;
  };

  const moderateClassQuestion = async (
    questionId: string,
    hidden: boolean,
  ): Promise<BackendOpResult<unknown>> => {
    if (!currentUser || currentUser.accountStatus !== 'APPROVED') {
      return {
        ok: false,
        status: 'UNAUTHORIZED' as const,
        errorCode: 'actor_not_approved',
        errorMessage: 'Approved account required.',
      };
    }
    const origin: AccountIdentityContext = {
      userId: currentUser.id,
      accountStatus: currentUser.accountStatus,
      generation: getCurrentIdentity().generation,
    };
    const res = await moderateClassQuestionRpc(questionId, hidden);
    if (!isMatchingApprovedAccountContext(origin, getCurrentIdentity(), mountedRef.current)) {
      return {
        ok: false,
        status: 'ERROR' as const,
        errorCode: 'session_changed',
        errorMessage: 'Account session changed.',
      };
    }
    if (res.ok) {
      setClassQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, isHidden: hidden } : q)),
      );
    }
    return res;
  };

  return {
    addParentNote,
    replyParentNote,
    addClassQuestion,
    replyClassQuestion,
    moderateClassQuestion,
  };
}
