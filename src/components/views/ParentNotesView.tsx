import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ParentNote } from '../../types';
import { EmptyFeatureState } from '../homepages/shared/EmptyFeatureState';
import { pickText } from '../../i18n/homepages';
import { isWithinParentNotesTunisWindow } from '../../lib/schoolContent';
import { Clock, AlertCircle, CheckCircle2, Send } from 'lucide-react';

export const ParentNotesView: React.FC = () => {
  const {
    currentUser,
    childrenList,
    parentNotes,
    notesStatus,
    remainingParentNotesToday,
    selectedChildId,
    setSelectedChildId,
    addParentNote,
    replyParentNote,
    language,
    t,
  } = useApp();

  const linkedChildren = useMemo(
    () =>
      currentUser?.linkedChildrenIds && currentUser.linkedChildrenIds.length > 0
        ? childrenList.filter((c) => currentUser.linkedChildrenIds?.includes(c.id))
        : [],
    [childrenList, currentUser?.linkedChildrenIds],
  );

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

  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyFeedback, setReplyFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (linkedChildren.length > 0 && !linkedChildren.some((c) => c.id === selectedChildId)) {
      setSelectedChildId(linkedChildren[0].id);
    }
  }, [linkedChildren, selectedChildId, setSelectedChildId]);

  const withinTunisWindow = isWithinParentNotesTunisWindow();
  const visibleNotes = useMemo(
    () =>
      isStaffReviewer
        ? parentNotes
        : parentNotes.filter((n) => n.parentId === currentUser?.id),
    [currentUser?.id, isStaffReviewer, parentNotes],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedChildId || !content.trim()) {
      setErrorMsg(
        pickText(
          {
            ar: 'يرجى اختيار التلميذ وكتابة نص الملاحظة.',
            fr: 'Veuillez sélectionner un enfant et saisir votre note.',
            en: 'Please select a linked child and enter note content.',
          },
          language,
        ),
      );
      return;
    }

    setSubmitting(true);
    const res = await addParentNote(selectedChildId, topic, content);
    setSubmitting(false);

    if (!res.success) {
      setErrorMsg(
        res.status === 'BLOCKED_BACKEND'
          ? pickText(
              {
                ar: 'إرسال ملاحظات الأولياء بانتظار نشر جدول parent_notes في Supabase.',
                fr: 'L’envoi des notes parents attend le déploiement de parent_notes sur Supabase.',
                en: 'Parent Notes persistence is awaiting Supabase backend deployment.',
              },
              language,
            )
          : res.error || res.errorCode || t('error'),
      );
      return;
    }

    setSuccessMsg(t('success'));
    setContent('');
  };

  const handleStaffReply = async (noteId: string) => {
    const replyContent = (replyTextMap[noteId] || '').trim();
    if (!replyContent) return;
    setReplyFeedback(null);
    setReplyingId(noteId);
    const res = await replyParentNote(noteId, replyContent);
    setReplyingId(null);

    if (!res.ok) {
      setReplyFeedback({
        type: 'error',
        text: res.errorMessage || res.errorCode || t('error'),
      });
      return;
    }

    setReplyTextMap((prev) => ({ ...prev, [noteId]: '' }));
    setReplyFeedback({
      type: 'success',
      text: pickText(
        { ar: 'تم إرسال الرد بنجاح.', fr: 'Réponse enregistrée.', en: 'Staff reply saved.' },
        language,
      ),
    });
  };

  const showSendForm = !isStaffReviewer || linkedChildren.length > 0;

  return (
    <div className="space-y-6 pb-12" data-testid="parent-notes-view">
      {/* Header */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
            {t('parentNotes')}
          </h1>
          <p className="text-xs text-gray-500 mt-1">{t('notesDescription')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`px-3.5 py-2 rounded-2xl border text-xs font-bold ${
              withinTunisWindow
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300'
            }`}
          >
            {withinTunisWindow
              ? pickText({ ar: 'مفتوح الآن (08:00–18:00 تونس)', fr: 'Ouvert (08h00–18h00 Tunis)', en: 'Open Now (08:00–18:00 Tunis)' }, language)
              : pickText({ ar: 'خارج أوقات الإرسال (08:00–18:00 تونس)', fr: 'Hors créneau (08h00–18h00 Tunis)', en: 'Closed Outside 08:00–18:00 Tunis' }, language)}
          </div>

          {showSendForm && (
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 px-4 py-2 rounded-2xl flex items-center gap-3">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase">
                  {t('dailyQuota')}
                </div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {remainingParentNotesToday} / 11 {t('notesRemaining')}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form to send note */}
        {showSendForm && (
          <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">{t('sendNote')}</h3>

            <p className="text-[11px] text-gray-500 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl">
              {t('sendingHours')}
            </p>

            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-xs rounded-xl font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 text-xs rounded-xl font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t('childConcerned')}
                </label>
                <select
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  disabled={linkedChildren.length === 0}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
                >
                  {linkedChildren.length === 0 ? (
                    <option value="">—</option>
                  ) : (
                    linkedChildren.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.fullName} ({child.className})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t('subject')}
                </label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as ParentNote['topic'])}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
                >
                  <option value="ABSENCE">{t('calendar')} / Retard</option>
                  <option value="HOMEWORK">{t('homework')}</option>
                  <option value="BEHAVIOR">BEHAVIOR</option>
                  <option value="HEALTH">HEALTH</option>
                  <option value="PICKUP">{t('pickup')}</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t('message')}
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder={t('notePlaceholder')}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-md transition-all disabled:opacity-50"
              >
                {submitting
                  ? t('loading')
                  : pickText({ ar: 'إرسال الملاحظة', fr: 'Envoyer la note', en: 'Send Note' }, language)}
              </button>
            </form>
          </div>
        )}

        {/* History of notes */}
        <div className={`${showSendForm ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-4`}>
          <h3 className="font-bold text-sm text-gray-900 dark:text-white">{t('noteHistory')}</h3>

          {replyFeedback && (
            <div
              className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                replyFeedback.type === 'error'
                  ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
              }`}
            >
              {replyFeedback.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{replyFeedback.text}</span>
            </div>
          )}

          {notesStatus === 'BLOCKED_BACKEND' && visibleNotes.length === 0 ? (
            <EmptyFeatureState
              state="BLOCKED_BACKEND"
              title={pickText(
                { ar: 'ملاحظات الأولياء بانتظار التفعيل في الخادم', fr: 'Notes parents en attente du contrat serveur', en: 'Parent Notes Pending Backend Deployment' },
                language,
              )}
              description={pickText(
                {
                  ar: 'الجدول parent_notes غير منشور بعد في Supabase. لا توجد أي ملاحظات وهمية.',
                  fr: 'La table parent_notes n’est pas encore déployée sur Supabase.',
                  en: 'public.parent_notes is awaiting deployment on Supabase. No mock notes are generated.',
                },
                language,
              )}
            />
          ) : (
            <div className="space-y-3">
              {visibleNotes.length === 0 ? (
                <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center text-gray-500 text-xs">
                  {t('noNotes')}
                </div>
              ) : (
                visibleNotes.map((n) => (
                  <div key={n.id} className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-bold text-[10px] rounded-xl uppercase">
                          {n.topic}
                        </span>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">
                          {n.childName} {n.parentName ? `• ${n.parentName}` : ''}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400">
                        {new Date(n.createdAt).toLocaleDateString()} • {n.status}
                      </span>
                    </div>

                    <p className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-3.5 rounded-2xl">
                      {n.content}
                    </p>

                    {n.replyContent && (
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3.5 rounded-2xl text-xs space-y-1">
                        <div className="font-bold text-[11px] text-emerald-700 dark:text-emerald-400">
                          {t('schoolReply')} {n.repliedByName ? `(${n.repliedByName})` : ''} :
                        </div>
                        <p className="text-emerald-900 dark:text-emerald-300">{n.replyContent}</p>
                      </div>
                    )}

                    {isStaffReviewer && (
                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="text"
                          value={replyTextMap[n.id] || ''}
                          onChange={(e) => setReplyTextMap((prev) => ({ ...prev, [n.id]: e.target.value }))}
                          placeholder={pickText({ ar: 'اكتب رداً رسمياً...', fr: 'Répondre au parent...', en: 'Write a school reply...' }, language)}
                          className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs"
                        />
                        <button
                          type="button"
                          disabled={replyingId === n.id}
                          onClick={() => void handleStaffReply(n.id)}
                          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{replyingId === n.id ? t('loading') : t('reply')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
