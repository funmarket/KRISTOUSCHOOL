import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { ParentNote } from '../../../types';
import { EmptyFeatureState } from '../../homepages/shared/EmptyFeatureState';
import { canAccessAppTab } from '../../homepages/homepageAccess';
import { pickText } from '../../../i18n/homepages';
import {
  isWithinParentNotesTunisWindow,
  PARENT_NOTES_DAILY_QUOTA,
} from '../../../lib/schoolContent';
import { Clock, AlertCircle, CheckCircle2, Send, Lock, ShieldCheck } from 'lucide-react';

export interface ParentNotesPanelProps {
  classId?: string | null;
  classNameLabel?: string | null;
  embeddedUnderCalendar?: boolean;
}

export const ParentNotesPanel: React.FC<ParentNotesPanelProps> = ({
  classId = null,
  classNameLabel = null,
  embeddedUnderCalendar = false,
}) => {
  const {
    currentUser,
    childrenList,
    classesList,
    parentNotes,
    notesStatus,
    notesError,
    remainingParentNotesToday,
    selectedChildId,
    setSelectedChildId,
    addParentNote,
    replyParentNote,
    refreshSchoolData,
    isHydratingSchoolData,
    language,
    t,
  } = useApp();

  // Fail closed: never mount or render private notes/child controls for anonymous,
  // unapproved, STUDENT, or SCHOOL_STAFF accounts.
  const canAccessNotes = Boolean(
    currentUser &&
      currentUser.accountStatus === 'APPROVED' &&
      canAccessAppTab(currentUser, 'notes'),
  );

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

  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyFeedback, setReplyFeedback] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  // Context key prevents stale draft or late response from bleeding across
  // user/child/class switches.
  const contextKey = `${currentUser?.id ?? 'anon'}::${classId ?? 'school'}::${effectiveChildId}`;
  const activeContextKeyRef = useRef(contextKey);
  activeContextKeyRef.current = contextKey;

  useEffect(() => {
    setContent('');
    setErrorMsg('');
    setSuccessMsg('');
    setReplyTextMap({});
    setReplyFeedback(null);
  }, [contextKey]);

  useEffect(() => {
    if (
      canAccessNotes &&
      scopedChildren.length > 0 &&
      !scopedChildren.some((c) => c.id === selectedChildId)
    ) {
      setSelectedChildId(scopedChildren[0].id);
    }
  }, [canAccessNotes, scopedChildren, selectedChildId, setSelectedChildId]);

  const visibleNotes = useMemo(() => {
    if (!canAccessNotes || notesStatus === 'UNAUTHORIZED') return [];
    const roleFiltered = isStaffReviewer
      ? parentNotes
      : parentNotes.filter((n) => n.parentId === currentUser?.id);
    if (!classId) return roleFiltered;
    return roleFiltered.filter((n) => n.classId === classId);
  }, [canAccessNotes, classId, currentUser?.id, isStaffReviewer, notesStatus, parentNotes]);

  if (!canAccessNotes) {
    if (embeddedUnderCalendar) {
      return null;
    }
    return (
      <EmptyFeatureState
        state="UNAUTHORIZED"
        title={t('unauthorized')}
        description={t('loginRequired')}
      />
    );
  }

  const withinTunisWindow = isWithinParentNotesTunisWindow();
  const activeChildClass = activeChild
    ? classesList.find((cls) => cls.id === activeChild.classId)
    : undefined;
  const informationalTeacherName = activeChildClass?.teacherName?.trim() || '—';

  const trimmedLength = content.trim().length;
  const isParentQuotaExhausted = remainingParentNotesToday <= 0;
  const isBlockedUnauthorized = notesStatus === 'UNAUTHORIZED';
  const hasEligibleChild = Boolean(effectiveChildId);
  const showSendForm = !isStaffReviewer || linkedChildren.length > 0;
  const canSubmitParentNote =
    hasEligibleChild &&
    withinTunisWindow &&
    !isParentQuotaExhausted &&
    !isBlockedUnauthorized &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (!effectiveChildId) {
      setErrorMsg(
        classId
          ? pickText(
              {
                ar: 'لا يوجد تلميذ مرتبط بحسابك مسجل في هذا القسم.',
                fr: 'Aucun enfant rattaché à votre compte n’est inscrit dans cette classe.',
                en: 'No linked child enrolled in this class.',
              },
              language,
            )
          : pickText(
              {
                ar: 'لا يوجد تلميذ مرتبط بحسابك حالياً.',
                fr: 'Aucun enfant n’est rattaché à votre compte.',
                en: 'No linked child is associated with your account.',
              },
              language,
            ),
      );
      return;
    }

    if (trimmedLength < 1 || trimmedLength > 1000) {
      setErrorMsg(
        pickText(
          {
            ar: 'يجب أن يتراوح نص الملاحظة بين 1 و1000 حرف.',
            fr: 'La note doit contenir entre 1 et 1000 caractères.',
            en: 'Note content must be between 1 and 1000 characters.',
          },
          language,
        ),
      );
      return;
    }

    const capturedContext = activeContextKeyRef.current;
    setSubmitting(true);
    try {
      const res = await addParentNote(effectiveChildId, topic, content);
      if (activeContextKeyRef.current !== capturedContext) {
        return;
      }
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
    } finally {
      setSubmitting(false);
    }
  };

  const handleStaffReply = async (noteId: string) => {
    const replyContent = (replyTextMap[noteId] || '').trim();
    if (!replyContent || replyingId || isBlockedUnauthorized) return;
    const capturedContext = activeContextKeyRef.current;
    setReplyFeedback(null);
    setReplyingId(noteId);
    try {
      const res = await replyParentNote(noteId, replyContent);
      if (activeContextKeyRef.current !== capturedContext) {
        return;
      }
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
    } finally {
      setReplyingId(null);
    }
  };

  return (
    <section
      className="space-y-5"
      data-testid={embeddedUnderCalendar ? 'under-calendar-parent-notes' : 'parent-notes-panel'}
    >
      {/* Header */}
      <div className="bg-white dark:bg-[#111111] p-5 sm:p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-blue-600 dark:text-blue-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              {classNameLabel
                ? `${t('parentNotes')} • ${classNameLabel}`
                : t('parentNotes')}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
            {embeddedUnderCalendar
              ? pickText(
                  {
                    ar: 'ملاحظات الأولياء الخاصة تحت الروزنامة',
                    fr: 'Notes privées des parents sous le calendrier',
                    en: 'Private Parent–School Notes',
                  },
                  language,
                )
              : t('parentNotes')}
          </h2>
          <p className="text-xs text-gray-500">{t('notesDescription')}</p>
          <p className="text-[11px] text-gray-400">
            {pickText(
              {
                ar: 'مراسلة خاصة بالتلميذ (حتى 1000 حرف، 11/يوم مع إعادة الضبط على الساعة 08:00 بتوقيت تونس). منفصلة عن الرسائل القصيرة (200 حرف) والروزنامة العامة.',
                fr: 'Échange privé lié à l’élève (1–1000 car., 11/jour réinitialisé à 08h00 Tunis). Distinct des Messages courts (200 car.) et du calendrier public.',
                en: 'Private family-staff note (1–1000 chars, shared 11/day quota resetting 08:00 Africa/Tunis). Separate from 200-char Messages and public calendar.',
              },
              language,
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div
            data-testid="parent-notes-window-badge"
            className={`px-3.5 py-2 rounded-2xl border text-xs font-bold ${
              withinTunisWindow
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300'
            }`}
          >
            {withinTunisWindow
              ? pickText(
                  {
                    ar: 'مفتوح الآن (08:00–18:00 تونس)',
                    fr: 'Ouvert (08h00–18h00 Tunis)',
                    en: 'Open Now (08:00–18:00 Tunis)',
                  },
                  language,
                )
              : pickText(
                  {
                    ar: 'مغلق خارج 08:00–18:00 تونس (القراءة متاحة)',
                    fr: 'Fermé hors 08h00–18h00 Tunis (lecture active)',
                    en: 'Closed Outside 08:00–18:00 Tunis (History Readable)',
                  },
                  language,
                )}
          </div>

          {showSendForm && (
            <div
              data-testid="parent-notes-quota-badge"
              className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 px-4 py-2 rounded-2xl flex items-center gap-3"
            >
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase">
                  {t('dailyQuota')} • 08:00 Tunis
                </div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {remainingParentNotesToday} / {PARENT_NOTES_DAILY_QUOTA} {t('notesRemaining')}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status banners shown even when cached rows exist */}
      {notesStatus === 'UNAUTHORIZED' && (
        <div
          data-testid="parent-notes-unauthorized-state"
          role="alert"
          className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-5 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-xs text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              {notesError ||
                pickText(
                  {
                    ar: 'غير مصرح بالوصول إلى ملاحظات الأولياء. تم إخفاء السجلات الخاصة.',
                    fr: 'Accès non autorisé aux notes des parents. Données masquées.',
                    en: 'Not authorized to access parent notes. Private records cleared.',
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

      {notesStatus === 'ERROR' && (
        <div
          data-testid="parent-notes-error-state"
          role="alert"
          className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-5 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-xs text-red-800 dark:text-red-300"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {notesError ||
                pickText(
                  {
                    ar: 'تعذر تحديث ملاحظات الأولياء من الخادم.',
                    fr: 'Impossible de charger les notes des parents.',
                    en: 'Failed to load parent notes from server.',
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

      {notesStatus === 'BLOCKED_BACKEND' && visibleNotes.length === 0 && (
        <EmptyFeatureState
          state="BLOCKED_BACKEND"
          title={pickText(
            {
              ar: 'ملاحظات الأولياء بانتظار التفعيل في الخادم',
              fr: 'Notes parents en attente du contrat serveur',
              en: 'Parent Notes Pending Backend Deployment',
            },
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
      )}

      {notesStatus !== 'UNAUTHORIZED' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form to send note */}
          {showSendForm && (
            <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">{t('sendNote')}</h3>

              <p className="text-[11px] text-gray-500 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl">
                {t('sendingHours')}
              </p>

              {!withinTunisWindow && (
                <div
                  data-testid="parent-notes-window-closed-notice"
                  className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs font-semibold"
                >
                  {pickText(
                    {
                      ar: 'الإرسال متاح يومياً من 08:00 إلى 18:00 بتوقيت تونس. يمكنك قراءة المراسلات السابقة أدناه.',
                      fr: 'Envoi ouvert de 08h00 à 18h00 (Tunis). La lecture de l’historique reste disponible.',
                      en: 'Sending is closed outside 08:00–18:00 Africa/Tunis. Existing correspondence below remains readable.',
                    },
                    language,
                  )}
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-xs rounded-xl font-medium flex items-center gap-2"
                >
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
                    data-testid="parent-note-child-select"
                    value={effectiveChildId}
                    onChange={(e) => setSelectedChildId(e.target.value)}
                    disabled={scopedChildren.length === 0}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
                  >
                    {scopedChildren.length === 0 ? (
                      <option value="">
                        {classId
                          ? pickText(
                              {
                                ar: 'لا يوجد تلميذ مرتبط في هذا القسم',
                                fr: 'Aucun enfant lié dans cette classe',
                                en: 'No linked child in this class',
                              },
                              language,
                            )
                          : '—'}
                      </option>
                    ) : (
                      scopedChildren.map((child) => (
                        <option key={child.id} value={child.id}>
                          {child.fullName} ({child.className})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Informational read-only teacher tag (no selectable picker since send_parent_note auto-routes) */}
                <div
                  data-testid="parent-note-teacher-tag"
                  className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[11px] space-y-0.5"
                >
                  <div className="font-bold text-gray-700 dark:text-gray-300">
                    {t('teacherLabel')}: {informationalTeacherName}
                  </div>
                  <div className="text-gray-500">
                    {pickText(
                      {
                        ar: 'يوجه الخادم الملاحظة تلقائياً لمربي القسم المرتبط بالتلميذ.',
                        fr: 'Le serveur achemine automatiquement la note vers l’enseignant affecté à la classe.',
                        en: 'Server auto-routes the note to the assigned class teacher.',
                      },
                      language,
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {t('subject')}
                  </label>
                  <select
                    data-testid="parent-note-topic-select"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value as ParentNote['topic'])}
                    className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white"
                  >
                    <option value="ABSENCE">ABSENCE</option>
                    <option value="HOMEWORK">HOMEWORK</option>
                    <option value="BEHAVIOR">BEHAVIOR</option>
                    <option value="HEALTH">HEALTH</option>
                    <option value="PICKUP">PICKUP</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {t('message')}
                    </label>
                    <span className="text-[10px] font-mono text-gray-400">
                      {trimmedLength} / 1000
                    </span>
                  </div>
                  <textarea
                    data-testid="parent-note-content-input"
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
                  data-testid="parent-note-submit-btn"
                  disabled={!canSubmitParentNote}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-md transition-all disabled:opacity-50"
                >
                  {submitting
                    ? t('loading')
                    : isParentQuotaExhausted
                    ? pickText(
                        { ar: 'تم استنفاد رصيد اليوم (11/11)', fr: 'Quota quotidien atteint (11/11)', en: 'Daily Quota Reached (11/11)' },
                        language,
                      )
                    : pickText({ ar: 'إرسال الملاحظة', fr: 'Envoyer la note', en: 'Send Note' }, language)}
                </button>
              </form>
            </div>
          )}

          {/* History of notes (always readable outside 08:00–18:00 when authorized) */}
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
                {replyFeedback.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span>{replyFeedback.text}</span>
              </div>
            )}

            {isHydratingSchoolData && visibleNotes.length === 0 ? (
              <div
                data-testid="parent-notes-loading-state"
                className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center text-gray-500 text-xs font-bold"
              >
                {t('loading')}
              </div>
            ) : visibleNotes.length === 0 && notesStatus === 'READY' ? (
              <div
                data-testid="parent-notes-empty-state"
                className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center text-gray-500 text-xs"
              >
                {t('noNotes')}
              </div>
            ) : (
              <div className="space-y-3">
                {visibleNotes.map((n) => {
                  const noteTeacherName =
                    (n.classId
                      ? classesList.find((cls) => cls.id === n.classId)?.teacherName?.trim()
                      : '') || '';
                  return (
                  <div
                    key={n.id}
                    className="bg-white dark:bg-[#111111] p-5 sm:p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-bold text-[10px] rounded-xl uppercase">
                          {n.topic}
                        </span>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">
                          {n.childName} {n.parentName ? `• ${n.parentName}` : ''}
                        </span>
                        {noteTeacherName && (
                          <span className="text-[11px] font-medium text-gray-500">
                            → {noteTeacherName}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400">
                        {n.schoolDay || new Date(n.createdAt).toLocaleDateString()} • {n.status}
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
                          onChange={(e) =>
                            setReplyTextMap((prev) => ({ ...prev, [n.id]: e.target.value }))
                          }
                          placeholder={pickText(
                            {
                              ar: 'اكتب رداً رسمياً...',
                              fr: 'Répondre au parent...',
                              en: 'Write a school reply...',
                            },
                            language,
                          )}
                          className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs"
                        />
                        <button
                          type="button"
                          disabled={replyingId === n.id || isBlockedUnauthorized}
                          onClick={() => void handleStaffReply(n.id)}
                          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{replyingId === n.id ? t('loading') : t('reply')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
