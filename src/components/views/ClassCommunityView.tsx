import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CommunitySubTab } from '../../types';
import {
  BookOpen,
  Calendar as CalendarIcon,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Send,
  Plus,
  CheckCircle,
  AlertCircle,
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
    announcements,
    homeworkList,
    calendarEvents,
    classQuestions,
    addClassQuestion,
    replyClassQuestion,
    language,
    t,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<CommunitySubTab>(initialSubTab);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [questionError, setQuestionError] = useState('');
  const [replyTextMap, setReplyTextMap] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  const assignedClass =
    currentUser?.assignedClassIds && currentUser.assignedClassIds.length > 0
      ? classesList.find((cls) => currentUser.assignedClassIds?.includes(cls.id)) ?? null
      : null;

  const handlePostQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    if (!assignedClass) {
      setQuestionError(t('error'));
      return;
    }
    if (newQuestionText.length > 200) {
      setQuestionError(t('max200'));
      return;
    }
    setQuestionError('');
    const res = addClassQuestion(assignedClass.id, newQuestionText);
    if (res.success) {
      setNewQuestionText('');
    } else {
      setQuestionError(res.error || t('error'));
    }
  };

  const handleReplySubmit = (questionId: string) => {
    const text = replyTextMap[questionId];
    if (!text || !text.trim()) return;
    replyClassQuestion(questionId, text);
    setReplyTextMap({ ...replyTextMap, [questionId]: '' });
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header card */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-semibold mb-2">
            <BookOpen className="w-3.5 h-3.5" />
            <span>
              {assignedClass
                ? `${t('classActive')}: ${assignedClass.name}`
                : t('school')}
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">
            {t('classCommunity')}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {assignedClass
              ? `${t('teacherLabel')} : ${assignedClass.teacherName} • ${t('schoolYear')} ${assignedClass.academicYear}`
              : `${t('school')} • ${t('tunis')}`}
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveSubTab('announcements')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeSubTab === 'announcements' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400'}`}
          >
            {t('announcements')}
          </button>
          <button
            onClick={() => setActiveSubTab('homework')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeSubTab === 'homework' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400'}`}
          >
            {t('homework')}
          </button>
          <button
            onClick={() => setActiveSubTab('calendar')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeSubTab === 'calendar' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400'}`}
          >
            {t('calendar')}
          </button>
          <button
            onClick={() => setActiveSubTab('questions')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeSubTab === 'questions' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400'}`}
          >
            {t('classQuestions')}
          </button>
          <button
            onClick={() => setActiveSubTab('documents')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeSubTab === 'documents' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400'}`}
          >
            {language === 'ar' ? 'الوثائق' : language === 'fr' ? 'Documents' : 'Documents'}
          </button>
          <button
            onClick={() => setActiveSubTab('gallery')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeSubTab === 'gallery' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-600 dark:text-gray-400'}`}
          >
            {language === 'ar' ? 'المعرض' : language === 'fr' ? 'Galerie' : 'Gallery'}
          </button>
        </div>
      </div>

      {/* Announcements Tab */}
      {activeSubTab === 'announcements' && (
        <div className="space-y-4">
          {announcements.map(ann => (
            <div key={ann.id} className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{ann.authorName} ({ann.authorRole})</span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {homeworkList.map(hw => (
            <div key={hw.id} className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-xl">
                  Pour le {hw.dueDate}
                </span>
                <span className="text-xs text-gray-400">{hw.teacherName}</span>
              </div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">{hw.title}</h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{hw.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Calendar Tab */}
      {activeSubTab === 'calendar' && (
        <div className="space-y-4">
          {calendarEvents.map(ev => (
            <div key={ev.id} className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                  {ev.date.split('-')[2]}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">{ev.title}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{ev.description}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-xl uppercase shrink-0">
                {ev.category}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Class Questions Tab (Student & Classmate Q&A with 200 char limit) */}
      {activeSubTab === 'questions' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-2">{t('askClassmates')}</h3>
            <p className="text-xs text-gray-500 mb-4">
              {t('questionRule')}
            </p>

            {questionError && (
              <div className="mb-3 p-3 bg-red-50 text-red-600 text-xs rounded-xl font-medium">
                {questionError}
              </div>
            )}

            <form onSubmit={handlePostQuestion} className="space-y-3">
              <textarea
                value={newQuestionText}
                onChange={e => setNewQuestionText(e.target.value)}
                maxLength={200}
                rows={3}
                placeholder={t('questionPlaceholder')}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono ${newQuestionText.length > 180 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                  {newQuestionText.length} / 200 caractères
                </span>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('publish')}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            {classQuestions.map(q => (
              <div key={q.id} className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {q.studentName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-gray-900 dark:text-white">{q.studentName}</h4>
                      <span className="text-[10px] text-gray-400">{new Date(q.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 p-3.5 rounded-2xl">
                  {q.content}
                </p>

                {/* Replies */}
                {q.replies && q.replies.length > 0 && (
                  <div className="space-y-2 ps-4 border-s-2 border-blue-500">
                    {q.replies.map(r => (
                      <div key={r.id} className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-2xl text-xs space-y-1">
                        <div className="font-bold text-[11px] text-blue-600 dark:text-blue-400">{r.authorName}</div>
                        <p className="text-gray-700 dark:text-gray-300">{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Form */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={replyTextMap[q.id] || ''}
                    onChange={e => setReplyTextMap({ ...replyTextMap, [q.id]: e.target.value })}
                    maxLength={200}
                    placeholder={t('replyPlaceholder')}
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none"
                  />
                  <button
                    onClick={() => handleReplySubmit(q.id)}
                    className="px-3 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-xl"
                  >
                    {t('reply')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'documents' && (
        <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
            <FileText className="w-4 h-4" />
            <span>
              {language === 'ar'
                ? `وثائق ومطبوعات القسم${assignedClass ? ` (${assignedClass.name})` : ''}`
                : language === 'fr'
                ? `Documents pédagogiques de la classe${assignedClass ? ` (${assignedClass.name})` : ''}`
                : `Class Documents & Learning Materials${assignedClass ? ` (${assignedClass.name})` : ''}`}
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {language === 'ar'
              ? 'تُعرض هنا الوثائق البيداغوجية والمطبوعات المعتمدة الخاصة بالقسم الدراسي.'
              : language === 'fr'
              ? 'Les fiches de révision, supports de cours et documents officiels de la classe sont publiés ici par l’enseignant.'
              : 'Approved worksheets, study guides, and class documents shared by your teacher appear in this space.'}
          </p>
        </div>
      )}

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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {['/kristou-2026-01.jpg', '/kristou-2026-02.jpg', '/kristou-2026-03.jpg'].map(
              (src) => (
                <img
                  key={src}
                  src={src}
                  alt="KRISTOU activity"
                  className="rounded-2xl object-cover aspect-[4/3] w-full border border-gray-200 dark:border-gray-800"
                />
              ),
            )}
          </div>
        </div>
      )}

    </div>
  );
};
