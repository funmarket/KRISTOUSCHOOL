import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { pickText } from '../../i18n/homepages';
import { canAccessAppTab } from '../homepages/homepageAccess';
import { getCurrentNotificationTarget, getNotificationActorKey, resolveNotificationTarget, type NotificationTargetIntent } from '../../lib/notificationTargetNavigation';
import { EmptyFeatureState } from '../homepages/shared/EmptyFeatureState';
import {
  countUnreadThreads,
  listApprovedMessageRecipients,
  replyOperationalThread,
  sendOperationalMessage,
  SHORT_MESSAGE_MAX_CHARS,
} from '../../lib/schoolContent';
import { reconcileSelectedRecipientId } from '../../lib/appStateGuards';
import { MessageRecipientOption } from '../../types';
import { MessageSquare, Send, AlertCircle, CheckCircle2, Plus, Lock } from 'lucide-react';

export const MessagesView: React.FC<{ notificationTarget?: NotificationTargetIntent | null }> = ({ notificationTarget = null }) => {
  const {
    currentUser,
    language,
    messages,
    messagesStatus,
    messagesError,
    isHydratingSchoolData,
    refreshSchoolData,
    t,
  } = useApp();

  const [recipients, setRecipients] = useState<MessageRecipientOption[]>([]);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [replyText, setReplyText] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const isAuthorized = canAccessAppTab(currentUser, 'messages');
  const isBackendUnauthorized = messagesStatus === 'UNAUTHORIZED';
  const identityKey = `${currentUser?.id ?? 'anon'}::${currentUser?.accountStatus ?? 'none'}`;
  const notificationIntent = getCurrentNotificationTarget(notificationTarget, getNotificationActorKey(currentUser), 'messages');
  const notificationResolution = resolveNotificationTarget(notificationIntent, getNotificationActorKey(currentUser), messagesStatus, isHydratingSchoolData, messages);

  const mountedRef = useRef(true);
  const recipientsGenRef = useRef(0);
  const activeIdentityRef = useRef(identityKey);
  const appliedNotificationRequestRef = useRef<number | null>(null);
  activeIdentityRef.current = identityKey;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      recipientsGenRef.current += 1;
    };
  }, []);

  const loadRecipients = useCallback(async () => {
    if (!isAuthorized || !currentUser || currentUser.accountStatus !== 'APPROVED' || isBackendUnauthorized) {
      recipientsGenRef.current += 1;
      setRecipients([]);
      setRecipientId('');
      setRecipientsError(null);
      setLoadingRecipients(false);
      return;
    }

    const reqGen = ++recipientsGenRef.current;
    const capturedIdentity = activeIdentityRef.current;
    setLoadingRecipients(true);

    try {
      const res = await listApprovedMessageRecipients();
      if (
        !mountedRef.current ||
        reqGen !== recipientsGenRef.current ||
        activeIdentityRef.current !== capturedIdentity
      ) {
        return;
      }

      if (res.ok && res.data) {
        setRecipientsError(null);
        setRecipients(res.data);
        setRecipientId((prev) => reconcileSelectedRecipientId(prev, res.data!));
      } else if (res.status === 'UNAUTHORIZED') {
        setRecipients([]);
        setRecipientId('');
        setRecipientsError(res.errorMessage || res.errorCode || t('unauthorized'));
      } else if (res.status !== 'BLOCKED_BACKEND') {
        setRecipientsError(res.errorMessage || res.errorCode || t('error'));
      } else {
        setRecipientsError(null);
      }
    } catch (err) {
      if (
        mountedRef.current &&
        reqGen === recipientsGenRef.current &&
        activeIdentityRef.current === capturedIdentity
      ) {
        setRecipientsError(err instanceof Error ? err.message : t('error'));
      }
    } finally {
      if (
        mountedRef.current &&
        reqGen === recipientsGenRef.current &&
        activeIdentityRef.current === capturedIdentity
      ) {
        setLoadingRecipients(false);
      }
    }
  }, [currentUser, isAuthorized, isBackendUnauthorized, t]);

  // Reset obsolete recipient/thread state on identity or authority transitions, then reload
  useEffect(() => {
    recipientsGenRef.current += 1;
    setRecipients([]);
    setRecipientId('');
    setRecipientsError(null);
    setSelectedThreadId('');
    setSubject('');
    setNewContent('');
    setReplyText('');
    setFeedback(null);
    setShowCompose(false);

    if (isAuthorized && currentUser?.accountStatus === 'APPROVED' && !isBackendUnauthorized) {
      void loadRecipients();
    }
  }, [identityKey, isAuthorized, isBackendUnauthorized, currentUser?.accountStatus, loadRecipients]);

  useEffect(() => {
    if (isBackendUnauthorized) {
      setSelectedThreadId('');
      return;
    }
    if (notificationIntent) {
      if (appliedNotificationRequestRef.current !== notificationIntent.requestId) {
        if (notificationResolution.state === 'found' || notificationResolution.state === 'unavailable') {
          appliedNotificationRequestRef.current = notificationIntent.requestId;
          setSelectedThreadId(notificationResolution.state === 'found' ? notificationResolution.record.id : '');
        } else {
          setSelectedThreadId('');
        }
      }
      return;
    }
    if (messages.length > 0 && !messages.some((m) => m.id === selectedThreadId)) {
      setSelectedThreadId(messages[0].id);
    }
  }, [isBackendUnauthorized, messages, selectedThreadId, notificationIntent, notificationResolution.state, notificationResolution.record?.id]);

  useEffect(() => {
    if (notificationIntent && notificationResolution.state === 'found') {
      document.getElementById(`notification-thread-${notificationResolution.record.id}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [notificationIntent?.requestId, notificationResolution.state, notificationResolution.record?.id]);

  if (!isAuthorized) {
    return (
      <EmptyFeatureState
        state="UNAUTHORIZED"
        title={t('unauthorized')}
        description={pickText(
          {
            ar: 'الرسائل التشغيلية المباشرة متاحة للأولياء والفريق المدرسي فقط (غير متاحة لحسابات التلاميذ).',
            fr: 'La messagerie opérationnelle est réservée aux parents et au personnel autorisé (exclue pour les comptes élèves).',
            en: 'Operational short messaging is available to parents and approved staff only (students are excluded).',
          },
          language,
        )}
      />
    );
  }

  const unreadCount = countUnreadThreads(messages, messagesStatus);

  const activeThread = !isBackendUnauthorized
    ? messages.find((m) => m.id === selectedThreadId) ?? null
    : null;

  const handleSendNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || isBackendUnauthorized) return;
    const capturedIdentity = activeIdentityRef.current;
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await sendOperationalMessage(recipientId, subject, newContent);
      if (!mountedRef.current || activeIdentityRef.current !== capturedIdentity) return;
      if (!res.ok) {
        setFeedback({ type: 'error', text: res.errorMessage || res.errorCode || t('error') });
        return;
      }
      setSubject('');
      setNewContent('');
      setShowCompose(false);
      setFeedback({ type: 'success', text: t('success') });
      await refreshSchoolData();
      if (mountedRef.current && activeIdentityRef.current === capturedIdentity && res.data?.threadId) {
        setSelectedThreadId(res.data.threadId);
      }
    } catch (err) {
      if (mountedRef.current && activeIdentityRef.current === capturedIdentity) {
        setFeedback({ type: 'error', text: err instanceof Error ? err.message : t('error') });
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || submitting || isBackendUnauthorized) return;
    const capturedIdentity = activeIdentityRef.current;
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await replyOperationalThread(activeThread.id, replyText);
      if (!mountedRef.current || activeIdentityRef.current !== capturedIdentity) return;
      if (!res.ok) {
        setFeedback({ type: 'error', text: res.errorMessage || res.errorCode || t('error') });
        return;
      }
      setReplyText('');
      await refreshSchoolData();
    } catch (err) {
      if (mountedRef.current && activeIdentityRef.current === capturedIdentity) {
        setFeedback({ type: 'error', text: err instanceof Error ? err.message : t('error') });
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="space-y-6 pb-12" data-testid="messages-view">
      {/* Header */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">{t('messages')}</h1>
            {unreadCount > 0 && (
              <span
                data-testid="messages-unread-count-badge"
                className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-extrabold"
              >
                {unreadCount}{' '}
                {pickText({ ar: 'غير مقروءة', fr: 'non lu(s)', en: 'unread' }, language)}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {pickText(
              {
                ar: 'رسائل تشغيلية قصيرة (بحد أقصى 200 حرف) بين الأولياء والمربين والإدارة.',
                fr: 'Messages opérationnels courts (200 caractères max) entre parents, enseignants et administration.',
                en: 'Short operational messages (200 chars max) between parents, teachers, and administration.',
              },
              language,
            )}
          </p>
        </div>
        <button
          type="button"
          disabled={isBackendUnauthorized}
          onClick={() => setShowCompose((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>
            {pickText({ ar: 'رسالة جديدة', fr: 'Nouveau message', en: 'New message' }, language)}
          </span>
        </button>
      </div>

      {notificationIntent && notificationResolution.state === 'unavailable' && (
        <p role="status" data-testid="notification-target-unavailable" className="rounded-xl border border-amber-200 dark:border-amber-900 px-4 py-3 text-xs font-semibold text-amber-900 dark:text-amber-200">
          {pickText({ ar: 'العنصر المطلوب غير متاح أو ليس لديك إذن بالوصول إليه.', fr: 'Cet élément est indisponible ou vous n’avez pas le droit d’y accéder.', en: 'Requested item is unavailable or you do not have access.' }, language)}
        </p>
      )}
      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'error'
              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {!isBackendUnauthorized && showCompose && (
        <form
          onSubmit={handleSendNew}
          className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-blue-200 dark:border-blue-900 shadow-sm space-y-4"
        >
          <h2 className="font-bold text-sm text-gray-900 dark:text-white">
            {pickText({ ar: 'إرسال رسالة قصيرة', fr: 'Envoyer un message court', en: 'Send Short Message' }, language)}
          </h2>
          {recipientsError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-3"
            >
              <span>{recipientsError}</span>
              <button
                type="button"
                onClick={() => void loadRecipients()}
                className="px-3 py-1 rounded-lg bg-red-700 text-white font-bold text-[11px]"
              >
                {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={recipientId}
              disabled={loadingRecipients}
              onChange={(e) => setRecipientId(e.target.value)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            >
              {loadingRecipients ? (
                <option value="">{t('loading')}</option>
              ) : recipients.length === 0 ? (
                <option value="">
                  {pickText({ ar: 'لا يوجد مستلمون متاحون', fr: 'Aucun destinataire', en: 'No recipients available' }, language)}
                </option>
              ) : (
                recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fullName} ({r.role})
                  </option>
                ))
              )}
            </select>
            <input
              type="text"
              maxLength={140}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('subject')}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            />
          </div>
          <textarea
            required
            maxLength={SHORT_MESSAGE_MAX_CHARS}
            rows={3}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={t('max200')}
            className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-gray-400">
              {newContent.length} / {SHORT_MESSAGE_MAX_CHARS}
            </span>
            <button
              type="submit"
              disabled={submitting || !recipientId || loadingRecipients}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? t('loading') : t('publish')}</span>
            </button>
          </div>
        </form>
      )}

      {/* Always show UNAUTHORIZED or ERROR banners even when cached messages exist */}
      {isBackendUnauthorized && (
        <div
          data-testid="messages-unauthorized-state"
          role="alert"
          className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              {messagesError ||
                pickText(
                  {
                    ar: 'غير مصرح بالوصول إلى المحادثات التشغيلية. تم مسح البيانات الخاصة.',
                    fr: 'Accès non autorisé à la messagerie opérationnelle. Données masquées.',
                    en: 'Not authorized to access operational messages. Private threads cleared.',
                  },
                  language,
                )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void refreshSchoolData()}
            className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
          </button>
        </div>
      )}

      {messagesStatus === 'ERROR' && (
        <div
          data-testid="messages-error-state"
          role="alert"
          className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-xs text-red-800 dark:text-red-300"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {messagesError ||
                pickText(
                  {
                    ar: 'تعذر تحميل المحادثات التشغيلية من الخادم.',
                    fr: 'Impossible de charger les conversations depuis le serveur.',
                    en: 'Failed to load operational message threads from server.',
                  },
                  language,
                )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void refreshSchoolData()}
            className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
          </button>
        </div>
      )}

      {!isBackendUnauthorized && isHydratingSchoolData && messages.length === 0 ? (
        <div
          data-testid="messages-loading-state"
          className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center text-xs font-bold text-gray-500"
        >
          {t('loading')}
        </div>
      ) : !isBackendUnauthorized && messagesStatus === 'BLOCKED_BACKEND' && messages.length === 0 ? (
        <EmptyFeatureState
          state="BLOCKED_BACKEND"
          title={pickText(
            {
              ar: 'خدمة الرسائل بانتظار التفعيل في الخادم',
              fr: 'Messagerie en attente du contrat serveur',
              en: 'Operational Messaging Pending Backend Deployment',
            },
            language,
          )}
          description={pickText(
            {
              ar: 'جداول message_threads و thread_messages غير منشورة بعد في Supabase.',
              fr: 'Les tables message_threads et thread_messages ne sont pas encore déployées sur Supabase.',
              en: 'public.message_threads and public.thread_messages are awaiting deployment on Supabase.',
            },
            language,
          )}
        />
      ) : !isBackendUnauthorized ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Thread List */}
          <div className="bg-white dark:bg-[#111111] p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-2">
            {messages.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">
                {messagesStatus === 'READY' ? t('noItems') : ''}
              </p>
            ) : (
              messages.map((thread) => (
                <button
                  key={thread.id}
                  id={`notification-thread-${thread.id}`}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full text-start p-3 rounded-2xl border transition-all ${
                    selectedThreadId === thread.id
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
                      : 'border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
                      {thread.subject || thread.recipientName}
                    </span>
                    {thread.unread && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-gray-500 truncate mt-1">{thread.lastMessage}</p>
                </button>
              ))
            )}
          </div>

          {/* Active Thread */}
          <div className="lg:col-span-2 bg-white dark:bg-[#111111] p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between min-h-[20rem] space-y-4">
            {!activeThread ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
                <MessageSquare className="w-6 h-6" />
                <span>{messagesStatus === 'READY' ? t('noItems') : ''}</span>
              </div>
            ) : (
              <>
                {activeThread.unread && (
                  <div
                    data-testid="messages-unread-sync-notice"
                    className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30 px-3.5 py-2 text-[11px] font-medium text-amber-900 dark:text-amber-200"
                  >
                    {pickText(
                      {
                        ar: 'تُدار حالة الرسائل غير المقروءة من الخادم، ولا يتوفر حالياً تأكيد تلقائي لتغييرها عند فتح المحادثة.',
                        fr: 'Le statut « non lu » est géré par le serveur ; le marquage automatique comme lu à l’ouverture n’est pas encore disponible.',
                        en: 'Unread status is managed by the school server; marking threads as read upon opening is not yet available.',
                      },
                      language,
                    )}
                  </div>
                )}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {activeThread.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-2xl text-xs max-w-[85%] ${
                        m.senderId === currentUser?.id
                          ? 'ms-auto bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-zinc-900 text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      <div className="text-[10px] opacity-80 font-bold mb-1">
                        {m.senderName || (m.senderId === currentUser?.id ? currentUser?.fullName : 'School')}
                      </div>
                      <p>{m.content}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendReply} className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <input
                    type="text"
                    maxLength={SHORT_MESSAGE_MAX_CHARS}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t('replyPlaceholder')}
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                  />
                  <span className="text-[10px] font-mono text-gray-400">
                    {replyText.length}/{SHORT_MESSAGE_MAX_CHARS}
                  </span>
                  <button
                    type="submit"
                    disabled={submitting || !replyText.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
                  >
                    {t('reply')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
