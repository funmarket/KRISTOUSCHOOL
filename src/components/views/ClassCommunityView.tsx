import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CommunitySubTab } from '../../types';
import { canModerateCommunityUi } from '../homepages/homepageAccess';
import { EmptyFeatureState } from '../homepages/shared/EmptyFeatureState';
import { SchoolCalendarPanel } from './Shared/SchoolCalendarPanel';
import { pickText } from '../../i18n/homepages';
import { createClassAnnouncement, createClassHomework } from '../../lib/schoolContent';
import {
  BookOpen,
  FileText,
  Image as ImageIcon,
  Send,
  Plus,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';

export interface ClassCommunityViewProps {
  initialSubTab?: CommunitySubTab;
}

export const ClassCommunityView: React.FC<ClassCommunityViewProps> = ({
  initialSubTab = 'announcements',
}) => {
  const {
    currentUser,
    classesList,
    selectedClassId,
    setSelectedClassId,
    announcements,
    homeworkList,
    calendarEvents,
    calendarStatus,
    classDocuments,
    classGallery,
    classQuestions,
    communityStatus,
    addClassQuestion,
    replyClassQuestion,
    moderateClassQuestion,
    refreshSchoolData,
    language,
    t,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<CommunitySubTab>(initialSubTab);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [questionError, setQuestionError] = useState('');
  const [postingQuestion, setPostingQuestion] = useState(false);
  const [replyTextMap, setReplyTextMap] = useState<{ [key: string]: string }>({});
  const [replyErrorMap, setReplyErrorMap] = useState<{ [key: string]: string }>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);

  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annPriority, setAnnPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');

  const [showHomeworkForm, setShowHomeworkForm] = useState(false);
  const [hwTitle, setHwTitle] = useState('');
  const [hwDesc, setHwDesc] = useState('');
  const [hwDueDate, setHwDueDate] = useState('');

  const [actionFeedback, setActionFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  const canModerate = canModerateCommunityUi(currentUser);

  const accessibleClasses = useMemo(() => {
    if (
      currentUser &&
      (currentUser.role === 'PARENT' || currentUser.role === 'STUDENT' || currentUser.role === 'TEACHER')
    ) {
      if (!currentUser.assignedClassIds || currentUser.assignedClassIds.length === 0) return [];
      return classesList.filter((cls) => currentUser.assignedClassIds?.includes(cls.id));
    }
    return classesList;
  }, [classesList, currentUser]);

  const activeClass = useMemo(() => {
    if (accessibleClasses.length === 0) return null;
    return accessibleClasses.find((cls) => cls.id === selectedClassId) ?? accessibleClasses[0];
  }, [accessibleClasses, selectedClassId]);

  const scopedAnnouncements = useMemo(() => {
    if (!activeClass) return announcements.filter((a) => !a.classId);
    return announcements.filter((a) => !a.classId || a.classId === activeClass.id);
  }, [activeClass, announcements]);

  const scopedHomework = useMemo(() => {
    if (!activeClass) return homeworkList;
    return homeworkList.filter((hw) => hw.classId === activeClass.id);
  }, [activeClass, homeworkList]);

  const scopedCalendarEvents = useMemo(() => {
    return calendarEvents.filter((ev) => !ev.classId || (activeClass && ev.classId === activeClass.id));
  }, [activeClass, calendarEvents]);

  const scopedDocuments = useMemo(() => {
    if (!activeClass) return classDocuments;
    return classDocuments.filter((d) => d.classId === activeClass.id);
  }, [activeClass, classDocuments]);

  const scopedGallery = useMemo(() => {
    if (!activeClass) return classGallery;
    return classGallery.filter((g) => !g.classId || g.classId === activeClass.id);
  }, [activeClass, classGallery]);

  const visibleQuestions = useMemo(() => {
    const base = activeClass
      ? classQuestions.filter((q) => q.classId === activeClass.id)
      : classQuestions;
    return canModerate ? base : base.filter((q) => !q.isHidden);
  }, [activeClass, canModerate, classQuestions]);

  const handlePostQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    if (!activeClass) {
      setQuestionError(
        pickText(
          {
            ar: 'لا يوجد قسم مرتبط بحسابك حالياً.',
            fr: 'Aucune classe n’est rattachée à votre compte pour le moment.',
            en: 'No active class is linked to your account yet.',
          },
          language,
        ),
      );
      return;
    }
    if (newQuestionText.length > 200) {
      setQuestionError(t('max200'));
      return;
    }
    setQuestionError('');
    setPostingQuestion(true);
    const res = await addClassQuestion(activeClass.id, newQuestionText);
    setPostingQuestion(false);
    if (res.success) {
      setNewQuestionText('');
    } else {
      setQuestionError(res.error || res.errorCode || t('error'));
    }
  };

  const handleReplySubmit = async (questionId: string) => {
    const text = replyTextMap[questionId] || '';
    if (!text.trim()) return;
    setReplyErrorMap((prev) => ({ ...prev, [questionId]: '' }));
    setReplyingId(questionId);
    const res = await replyClassQuestion(questionId, text);
    setReplyingId(null);
    if (res.ok) {
      setReplyTextMap((prev) => ({ ...prev, [questionId]: '' }));
    } else {
      setReplyErrorMap((prev) => ({
        ...prev,
        [questionId]: res.errorMessage || res.errorCode || t('error'),
      }));
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClass) return;
    setActionFeedback(null);
    setSubmittingAction(true);
    const res = await createClassAnnouncement(activeClass.id, annTitle, annBody, annPriority);
    setSubmittingAction(false);
    if (!res.ok) {
      setActionFeedback({ type: 'error', text: res.errorMessage || res.errorCode || t('error') });
      return;
    }
    setAnnTitle('');
    setAnnBody('');
    setShowAnnouncementForm(false);
    setActionFeedback({
      type: 'success',
      text: pickText(
        { ar: 'تم نشر إعلان القسم بنجاح.', fr: 'Annonce de classe publiée.', en: 'Class announcement published.' },
        language,
      ),
    });
    await refreshSchoolData();
  };

  const handleCreateHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClass) return;
    setActionFeedback(null);
    setSubmittingAction(true);
    const res = await createClassHomework(activeClass.id, hwTitle, hwDesc, hwDueDate);
    setSubmittingAction(false);
    if (!res.ok) {
      setActionFeedback({ type: 'error', text: res.errorMessage || res.errorCode || t('error') });
      return;
    }
    setHwTitle('');
    setHwDesc('');
    setHwDueDate('');
    setShowHomeworkForm(false);
    setActionFeedback({
      type: 'success',
      text: pickText(
        { ar: 'تم إضافة الواجب بنجاح.', fr: 'Devoir publié.', en: 'Homework assignment saved.' },
        language,
      ),
    });
    await refreshSchoolData();
  };

  const handleModerateQuestion = async (questionId: string, hidden: boolean) => {
    setActionFeedback(null);
    const res = await moderateClassQuestion(questionId, hidden);
    if (!res.ok) {
      setActionFeedback({ type: 'error', text: res.errorMessage || res.errorCode || t('error') });
    }
  };

  return (
    <div className="space-y-6 pb-12" data-testid="class-community-view">
      {/* Header card */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-semibold mb-2">
              <BookOpen className="w-3.5 h-3.5" />
              <span>
                {activeClass
                  ? `${t('classActive')}: ${activeClass.name}`
                  : t('school')}
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
              {t('classCommunity')}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              {activeClass
                ? `${t('teacherLabel')} : ${activeClass.teacherName || '—'} • ${t('schoolYear')} ${activeClass.academicYear}`
                : `${t('school')} • ${t('tunis')}`}
            </p>
          </div>

          {/* Sub-tabs */}
          <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveSubTab('announcements')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeSubTab === 'announcements' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400'}`}
            >
              {t('announcements')}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('homework')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeSubTab === 'homework' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400'}`}
            >
              {t('homework')}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('calendar')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeSubTab === 'calendar' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400'}`}
            >
              {t('calendar')}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('questions')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeSubTab === 'questions' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400'}`}
            >
              {t('classQuestions')}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('documents')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeSubTab === 'documents' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400'}`}
            >
              {language === 'ar' ? 'الوثائق' : language === 'fr' ? 'Documents' : 'Documents'}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('gallery')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeSubTab === 'gallery' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400'}`}
            >
              {language === 'ar' ? 'المعرض' : language === 'fr' ? 'Galerie' : 'Gallery'}
            </button>
          </div>
        </div>

        {/* Class Switcher when user has multiple classes */}
        {accessibleClasses.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <span className="text-[11px] font-bold text-gray-500">
              {pickText({ ar: 'اختيار القسم:', fr: 'Classe :', en: 'Active Class:' }, language)}
            </span>
            {accessibleClasses.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => setSelectedClassId(cls.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors ${
                  activeClass?.id === cls.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300'
                }`}
              >
                {cls.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {actionFeedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
            actionFeedback.type === 'error'
              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
          }`}
        >
          {actionFeedback.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* Announcements Tab */}
      {activeSubTab === 'announcements' && (
        <div className="space-y-4">
          {canModerate && activeClass && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementForm((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{pickText({ ar: 'إعلان للقسم', fr: 'Publier annonce classe', en: 'New Class Announcement' }, language)}</span>
                </button>
              </div>
              {showAnnouncementForm && (
                <form
                  onSubmit={handleCreateAnnouncement}
                  className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-blue-200 dark:border-blue-900 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      value={annTitle}
                      onChange={(e) => setAnnTitle(e.target.value)}
                      placeholder={pickText({ ar: 'عنوان الإعلان', fr: 'Titre', en: 'Announcement title' }, language)}
                      className="sm:col-span-2 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                    />
                    <select
                      value={annPriority}
                      onChange={(e) => setAnnPriority(e.target.value as 'NORMAL' | 'URGENT')}
                      className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                    >
                      <option value="NORMAL">NORMAL</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </div>
                  <textarea
                    required
                    rows={3}
                    value={annBody}
                    onChange={(e) => setAnnBody(e.target.value)}
                    placeholder={pickText({ ar: 'نص الإعلان...', fr: 'Contenu...', en: 'Message...' }, language)}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowAnnouncementForm(false)} className="px-4 py-2 rounded-xl border text-xs font-semibold">
                      {t('cancel')}
                    </button>
                    <button type="submit" disabled={submittingAction} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50">
                      {submittingAction ? t('loading') : t('publish')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {communityStatus === 'BLOCKED_BACKEND' && (
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-4 py-2.5 rounded-2xl">
              {pickText(
                {
                  ar: 'إعلانات القسم المباشرة بانتظار نشر جداول المجتمع في Supabase.',
                  fr: 'Les annonces de classe attendent le déploiement du schéma communautaire Supabase.',
                  en: 'Live class announcements are awaiting Supabase community schema deployment.',
                },
                language,
              )}
            </p>
          )}

          {scopedAnnouncements.map((ann) => (
            <div key={ann.id} className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  {ann.authorName} ({ann.authorRole})
                </span>
                <span className="text-xs text-gray-400">{new Date(ann.createdAt).toLocaleDateString()}</span>
              </div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">{ann.title}</h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{ann.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Homework Tab */}
      {activeSubTab === 'homework' && (
        <div className="space-y-4">
          {canModerate && activeClass && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowHomeworkForm((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{pickText({ ar: 'إضافة واجب', fr: 'Ajouter un devoir', en: 'Add Homework' }, language)}</span>
                </button>
              </div>
              {showHomeworkForm && (
                <form
                  onSubmit={handleCreateHomework}
                  className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-blue-200 dark:border-blue-900 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={hwTitle}
                      onChange={(e) => setHwTitle(e.target.value)}
                      placeholder={pickText({ ar: 'عنوان الواجب', fr: 'Titre du devoir', en: 'Homework title' }, language)}
                      className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                    />
                    <input
                      type="date"
                      required
                      value={hwDueDate}
                      onChange={(e) => setHwDueDate(e.target.value)}
                      className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={hwDesc}
                    onChange={(e) => setHwDesc(e.target.value)}
                    placeholder={pickText({ ar: 'التعليمات...', fr: 'Consignes...', en: 'Instructions...' }, language)}
                    className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowHomeworkForm(false)} className="px-4 py-2 rounded-xl border text-xs font-semibold">
                      {t('cancel')}
                    </button>
                    <button type="submit" disabled={submittingAction} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50">
                      {submittingAction ? t('loading') : t('save')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {communityStatus === 'BLOCKED_BACKEND' && scopedHomework.length === 0 ? (
            <EmptyFeatureState
              state="BLOCKED_BACKEND"
              title={pickText(
                { ar: 'الواجبات المنزلية بانتظار التفعيل في الخادم', fr: 'Devoirs en attente du contrat serveur', en: 'Homework Persistence Pending Backend' },
                language,
              )}
              description={pickText(
                {
                  ar: 'الجدول class_homework_items غير منشور بعد في Supabase.',
                  fr: 'La table class_homework_items n’est pas encore déployée sur Supabase.',
                  en: 'public.class_homework_items is awaiting deployment on Supabase.',
                },
                language,
              )}
            />
          ) : scopedHomework.length === 0 ? (
            <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 text-center text-xs text-gray-500">
              {pickText({ ar: 'لا توجد واجبات منشورة حالياً.', fr: 'Aucun devoir publié pour cette classe.', en: 'No homework posted yet.' }, language)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scopedHomework.map((hw) => (
                <div key={hw.id} className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-xl">
                      {hw.dueDate}
                    </span>
                    <span className="text-xs text-gray-400">{hw.teacherName}</span>
                  </div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">{hw.title}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{hw.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calendar Tab */}
      {activeSubTab === 'calendar' && (
        <SchoolCalendarPanel
          events={scopedCalendarEvents}
          backendStatus={calendarStatus}
          classId={activeClass?.id ?? null}
          canManage={canModerate}
          onRefresh={refreshSchoolData}
        />
      )}

      {/* Class Questions Tab */}
      {activeSubTab === 'questions' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-2">{t('askClassmates')}</h3>
            <p className="text-xs text-gray-500 mb-4">{t('questionRule')}</p>

            {questionError && (
              <div className="mb-3 p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-xs rounded-xl font-medium">
                {questionError}
              </div>
            )}

            <form onSubmit={handlePostQuestion} className="space-y-3">
              <textarea
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                maxLength={200}
                rows={3}
                placeholder={t('questionPlaceholder')}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono ${newQuestionText.length > 180 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                  {newQuestionText.length} / 200
                </span>
                <button
                  type="submit"
                  disabled={postingQuestion}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{postingQuestion ? t('loading') : t('publish')}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            {visibleQuestions.map((q) => (
              <div key={q.id} className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {q.studentName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-gray-900 dark:text-white">{q.studentName}</h4>
                      <span className="text-[10px] text-gray-400">{new Date(q.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  {canModerate && (
                    <button
                      type="button"
                      onClick={() => void handleModerateQuestion(q.id, !q.isHidden)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 text-[11px] font-bold text-gray-600 dark:text-zinc-300"
                    >
                      {q.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span>{q.isHidden ? 'Unhide' : 'Hide'}</span>
                    </button>
                  )}
                </div>

                {q.isHidden && (
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    HIDDEN BY MODERATOR
                  </span>
                )}

                <p className="text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 p-3.5 rounded-2xl">
                  {q.content}
                </p>

                {q.replies && q.replies.length > 0 && (
                  <div className="space-y-2 ps-4 border-s-2 border-blue-500">
                    {q.replies.map((r) => (
                      <div key={r.id} className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-2xl text-xs space-y-1">
                        <div className="font-bold text-[11px] text-blue-600 dark:text-blue-400">{r.authorName}</div>
                        <p className="text-gray-700 dark:text-gray-300">{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {replyErrorMap[q.id] && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">{replyErrorMap[q.id]}</p>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={replyTextMap[q.id] || ''}
                    onChange={(e) => setReplyTextMap({ ...replyTextMap, [q.id]: e.target.value })}
                    maxLength={200}
                    placeholder={t('replyPlaceholder')}
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={replyingId === q.id}
                    onClick={() => void handleReplySubmit(q.id)}
                    className="px-3 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-xl disabled:opacity-50"
                  >
                    {replyingId === q.id ? t('loading') : t('reply')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeSubTab === 'documents' && (
        <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
            <FileText className="w-4 h-4" />
            <span>
              {language === 'ar'
                ? `وثائق ومطبوعات القسم${activeClass ? ` (${activeClass.name})` : ''}`
                : language === 'fr'
                ? `Documents pédagogiques de la classe${activeClass ? ` (${activeClass.name})` : ''}`
                : `Class Documents & Learning Materials${activeClass ? ` (${activeClass.name})` : ''}`}
            </span>
          </div>

          {scopedDocuments.length === 0 ? (
            <p className="text-xs text-gray-500">
              {communityStatus === 'BLOCKED_BACKEND'
                ? pickText(
                    {
                      ar: 'مكتبة وثائق القسم بانتظار النشر في Supabase (class_documents).',
                      fr: 'Les documents de classe attendent le déploiement de class_documents sur Supabase.',
                      en: 'Class documents are awaiting public.class_documents deployment on Supabase.',
                    },
                    language,
                  )
                : pickText(
                    { ar: 'لا توجد وثائق مرفقة لهذا القسم حالياً.', fr: 'Aucun document publié pour cette classe.', en: 'No documents published for this class yet.' },
                    language,
                  )}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scopedDocuments.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-2xl border border-gray-200 dark:border-zinc-800 hover:border-blue-500 transition-colors flex items-start justify-between gap-3"
                >
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                      {doc.fileType}
                    </span>
                    <h4 className="font-bold text-xs text-gray-900 dark:text-white mt-1.5">{doc.title}</h4>
                    {doc.description && <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>}
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Gallery Tab */}
      {activeSubTab === 'gallery' && (
        <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
            <ImageIcon className="w-4 h-4" />
            <span>
              {language === 'ar'
                ? 'معرض أنشطة القسم والمدرسة'
                : language === 'fr'
                ? 'Galerie des activités scolaires'
                : 'Class & School Activity Gallery'}
            </span>
          </div>

          {scopedGallery.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {scopedGallery.map((item) => (
                <figure key={item.id} className="space-y-2">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="rounded-2xl object-cover aspect-[4/3] w-full border border-gray-200 dark:border-gray-800"
                  />
                  <figcaption className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {item.title}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                {communityStatus === 'BLOCKED_BACKEND'
                  ? pickText(
                      {
                        ar: 'معرض صور القسم بانتظار التفعيل في الخادم — يتم عرض صور الحرم المدرسي المعتمدة فقط.',
                        fr: 'La galerie de classe attend le contrat serveur — aperçu campus affiché.',
                        en: 'Class gallery is awaiting backend deployment — verified campus photos shown below.',
                      },
                      language,
                    )
                  : pickText(
                      { ar: 'لا توجد صور مضافة لهذا القسم حالياً.', fr: 'Aucune photo publiée pour cette classe.', en: 'No class gallery photos posted yet.' },
                      language,
                    )}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  '/assets/kristou-home/hero-schoolchildren.png',
                  '/assets/kristou-home/school-building.png',
                  '/assets/kristou-home/enrollment-children.png',
                ].map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt="KRISTOU School Campus"
                    className="rounded-2xl object-cover aspect-[4/3] w-full border border-gray-200 dark:border-gray-800"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
