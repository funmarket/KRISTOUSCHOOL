import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { pickText } from '../../i18n/homepages';
import { canAccessAppTab } from '../homepages/homepageAccess';
import { getCurrentNotificationTarget, getNotificationActorKey, resolveNotificationTarget, type NotificationTargetIntent } from '../../lib/notificationTargetNavigation';
import { EmptyFeatureState } from '../homepages/shared/EmptyFeatureState';
import { MessageComposerForm } from './messages/MessageComposerForm';
import { MessageThreadWorkspace } from './messages/MessageThreadWorkspace';
import {
  countUnreadThreads,
  listApprovedMessageRecipients,
  replyOperationalThread,
  sendOperationalMessage,
} from '../../lib/schoolContent';
import { reconcileSelectedRecipientId } from '../../lib/appStateGuards';
import { MessageRecipientOption } from '../../types';
import { AlertCircle, CheckCircle2, Plus, Lock } from 'lucide-react';

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
  const appliedNotificationRequestRef = useRef<string | null>(null);
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
      const requestKey = `${notificationIntent.actorKey}::${notificationIntent.requestId}`;
      if (appliedNotificationRequestRef.current !== requestKey) {
        if (notificationResolution.state === 'found') {
          appliedNotificationRequestRef.current = requestKey;
          setSelectedThreadId(notificationResolution.record.id);
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
        description={pickText({ ar: 'الرسائل التشغيلية المباشرة متاحة للأولياء والفريق المدرسي فقط (غير متاحة لحسابات التلاميذ).', fr: 'La messagerie opérationnelle est réservée aux parents et au personnel autorisé (exclue pour les comptes élèves).', en: 'Operational short messaging is available to parents and approved staff only (students are excluded).', es: 'La mensajería operativa está disponible solo para padres y personal aprobado (excluye alumnos).', de: 'Betriebliche Kurznachrichten sind nur für Eltern und genehmigtes Personal verfügbar.', pt: 'As mensagens operacionais estão disponíveis apenas para pais e pessoal aprovado (alunos excluídos).' }, language)}
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
      if (mountedRef.current) setSubmitting(false);
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
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12" data-testid="messages-view">
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
                {pickText({ ar: 'غير مقروءة', fr: 'non lu(s)', en: 'unread', es: 'sin leer', de: 'ungelesen', pt: 'por ler' }, language)}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {pickText({ ar: 'رسائل تشغيلية قصيرة (بحد أقصى 200 حرف) بين الأولياء والمربين والإدارة.', fr: 'Messages opérationnels courts (200 caractères max) entre parents, enseignants et administration.', en: 'Short operational messages (200 chars max) between parents, teachers, and administration.', es: 'Mensajes operativos cortos (máx. 200 caracteres) entre padres, docentes y administración.', de: 'Kurze betriebliche Nachrichten (max. 200 Zeichen) zwischen Eltern, Lehrkräften und Verwaltung.', pt: 'Mensagens operacionais curtas (máx. 200 carateres) entre pais, professores e administração.' }, language)}
          </p>
        </div>
        <button
          type="button"
          disabled={isBackendUnauthorized}
          onClick={() => setShowCompose((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>{pickText({ ar: 'رسالة جديدة', fr: 'Nouveau message', en: 'New message', es: 'Nuevo mensaje', de: 'Neue Nachricht', pt: 'Nova mensagem' }, language)}</span>
        </button>
      </div>

      {notificationIntent && notificationResolution.state === 'unavailable' && (
        <p role="status" data-testid="notification-target-unavailable" className="rounded-xl border border-amber-200 dark:border-amber-900 px-4 py-3 text-xs font-semibold text-amber-900 dark:text-amber-200">
          {pickText({ ar: 'العنصر المطلوب غير متاح أو ليس لديك إذن بالوصول إليه.', fr: 'Cet élément est indisponible ou vous n’avez pas le droit d’y accéder.', en: 'Requested item is unavailable or you do not have access.', es: 'El elemento solicitado no está disponible o no tienes acceso.', de: 'Das angeforderte Element ist nicht verfügbar oder Sie haben keinen Zugriff.', pt: 'O item pedido está indisponível ou não tem acesso.' }, language)}
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
          {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {!isBackendUnauthorized && showCompose && (
        <MessageComposerForm
          language={language}
          recipients={recipients}
          recipientsError={recipientsError}
          loadingRecipients={loadingRecipients}
          recipientId={recipientId}
          setRecipientId={setRecipientId}
          subject={subject}
          setSubject={setSubject}
          newContent={newContent}
          setNewContent={setNewContent}
          submitting={submitting}
          onRetryRecipients={() => void loadRecipients()}
          onSubmit={handleSendNew}
          t={t}
        />
      )}

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
                pickText({ ar: 'غير مصرح بالوصول إلى المحادثات التشغيلية. تم مسح البيانات الخاصة.', fr: 'Accès non autorisé à la messagerie opérationnelle. Données masquées.', en: 'Not authorized to access operational messages. Private threads cleared.', es: 'No autorizado para acceder a mensajes operativos. Hilos privados ocultos.', de: 'Kein Zugriff auf betriebliche Nachrichten. Private Verläufe ausgeblendet.', pt: 'Sem autorização para mensagens operacionais. Conversas privadas limpas.' }, language)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void refreshSchoolData()}
            className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
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
                pickText({ ar: 'تعذر تحميل المحادثات التشغيلية من الخادم.', fr: 'Impossible de charger les conversations depuis le serveur.', en: 'Failed to load operational message threads from server.', es: 'No se pudieron cargar los hilos de mensajes del servidor.', de: 'Nachrichtenverläufe konnten nicht vom Server geladen werden.', pt: 'Falha ao carregar conversas operacionais do servidor.' }, language)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void refreshSchoolData()}
            className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
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
          title={pickText({ ar: 'خدمة الرسائل بانتظار التفعيل في الخادم', fr: 'Messagerie en attente du contrat serveur', en: 'Operational Messaging Pending Backend Deployment', es: 'Mensajería operativa pendiente de despliegue en servidor', de: 'Nachrichtendienst wartet auf Server-Bereitstellung', pt: 'Mensagens operacionais a aguardar servidor' }, language)}
          description={pickText({ ar: 'جداول message_threads و thread_messages غير منشورة بعد في Supabase.', fr: 'Les tables message_threads et thread_messages ne sont pas encore déployées sur Supabase.', en: 'public.message_threads and public.thread_messages are awaiting deployment on Supabase.', es: 'Las tablas public.message_threads y public.thread_messages esperan despliegue en Supabase.', de: 'public.message_threads und public.thread_messages warten auf Bereitstellung in Supabase.', pt: 'As tabelas public.message_threads e public.thread_messages aguardam implementação no Supabase.' }, language)}
        />
      ) : !isBackendUnauthorized ? (
        <MessageThreadWorkspace
          currentUser={currentUser}
          messages={messages}
          messagesStatus={messagesStatus}
          selectedThreadId={selectedThreadId}
          onSelectThread={setSelectedThreadId}
          activeThread={activeThread}
          unreadSyncNotice={
            activeThread?.unread ? (
              <div
                data-testid="messages-unread-sync-notice"
                className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30 px-3.5 py-2 text-[11px] font-medium text-amber-900 dark:text-amber-200"
              >
                {pickText({ ar: 'تُدار حالة الرسائل غير المقروءة من الخادم، ولا يتوفر حالياً تأكيد تلقائي لتغييرها عند فتح المحادثة.', fr: 'Le statut « non lu » est géré par le serveur ; le marquage automatique comme lu à l’ouverture n’est pas encore disponible.', en: 'Unread status is managed by the school server; marking threads as read upon opening is not yet available.', es: 'El estado no leído lo gestiona el servidor; el marcado automático al abrir aún no está disponible.', de: 'Der Ungelesen-Status wird vom Server verwaltet; automatisches Markieren beim Öffnen ist noch nicht verfügbar.', pt: 'O estado por ler é gerido pelo servidor; a marcação automática ao abrir ainda não está disponível.' }, language)}
              </div>
            ) : null
          }
          replyText={replyText}
          setReplyText={setReplyText}
          submitting={submitting}
          onSendReply={handleSendReply}
          t={t}
        />
      ) : null}
    </div>
  );
};
