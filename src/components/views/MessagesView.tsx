import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { pickText } from '../../i18n/homepages';
import { canAccessAppTab } from '../homepages/homepageAccess';
import { EmptyFeatureState } from '../homepages/shared/EmptyFeatureState';
import {
  listApprovedMessageRecipients,
  replyOperationalThread,
  sendOperationalMessage,
  SHORT_MESSAGE_MAX_CHARS,
} from '../../lib/schoolContent';
import { MessageRecipientOption } from '../../types';
import { MessageSquare, Send, AlertCircle, CheckCircle2, Plus } from 'lucide-react';

export const MessagesView: React.FC = () => {
  const {
    currentUser,
    language,
    messages,
    messagesStatus,
    refreshSchoolData,
    t,
  } = useApp();

  const [recipients, setRecipients] = useState<MessageRecipientOption[]>([]);
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [newContent, setNewContent] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [replyText, setReplyText] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const isAuthorized = canAccessAppTab(currentUser, 'messages');

  useEffect(() => {
    if (!isAuthorized) return;
    void listApprovedMessageRecipients().then((res) => {
      if (res.ok && res.data) {
        setRecipients(res.data);
        if (res.data.length > 0 && !recipientId) {
          setRecipientId(res.data[0].id);
        }
      }
    });
  }, [isAuthorized, recipientId]);

  useEffect(() => {
    if (messages.length > 0 && !messages.some((m) => m.id === selectedThreadId)) {
      setSelectedThreadId(messages[0].id);
    }
  }, [messages, selectedThreadId]);

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

  const activeThread = messages.find((m) => m.id === selectedThreadId) ?? null;

  const handleSendNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    const res = await sendOperationalMessage(recipientId, subject, newContent);
    setSubmitting(false);
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.errorMessage || t('error') });
      return;
    }
    setSubject('');
    setNewContent('');
    setShowCompose(false);
    setFeedback({ type: 'success', text: t('success') });
    await refreshSchoolData();
    if (res.data?.threadId) {
      setSelectedThreadId(res.data.threadId);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread) return;
    setFeedback(null);
    setSubmitting(true);
    const res = await replyOperationalThread(activeThread.id, replyText);
    setSubmitting(false);
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.errorMessage || t('error') });
      return;
    }
    setReplyText('');
    await refreshSchoolData();
  };

  return (
    <div className="space-y-6 pb-12" data-testid="messages-view">
      {/* Header */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">{t('messages')}</h1>
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
          onClick={() => setShowCompose((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>
            {pickText({ ar: 'رسالة جديدة', fr: 'Nouveau message', en: 'New message' }, language)}
          </span>
        </button>
      </div>

      {feedback && (
        <div
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

      {showCompose && (
        <form
          onSubmit={handleSendNew}
          className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-blue-200 dark:border-blue-900 shadow-sm space-y-4"
        >
          <h2 className="font-bold text-sm text-gray-900 dark:text-white">
            {pickText({ ar: 'إرسال رسالة قصيرة', fr: 'Envoyer un message court', en: 'Send Short Message' }, language)}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
            >
              {recipients.length === 0 ? (
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
              disabled={submitting || !recipientId}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? t('loading') : t('publish')}</span>
            </button>
          </div>
        </form>
      )}

      {messagesStatus === 'BLOCKED_BACKEND' && messages.length === 0 ? (
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
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Thread List */}
          <div className="bg-white dark:bg-[#111111] p-4 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-2">
            {messages.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">{t('noItems')}</p>
            ) : (
              messages.map((thread) => (
                <button
                  key={thread.id}
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
                <span>{t('noItems')}</span>
              </div>
            ) : (
              <>
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
      )}
    </div>
  );
};
