import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { CommunitySubTab } from '../../../types';
import {
  canAccessAppTab,
  canModerateCommunityUi,
  getCalendarPermissionsUi,
  resolveTeacherAssignedClasses,
} from '../../homepages/homepageAccess';
import {
  calendarEventMatchesClassScope,
  createClassAnnouncement,
  createClassHomework,
} from '../../../lib/schoolContent';
import { pickText } from '../../../i18n/homepages';

export function useClassCommunityView({ initialSubTab = 'announcements' }: { initialSubTab?: CommunitySubTab }) {
  const {
    currentUser,
    classesList,
    classRosters,
    selectedClassId,
    setSelectedClassId,
    announcements,
    homeworkList,
    calendarEvents,
    calendarStatus,
    calendarError,
    classDocuments,
    classGallery,
    classQuestions,
    communityStatus,
    communityError,
    isHydratingSchoolData,
    isLoadingClassCommunity,
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

  const allClassOptions = useMemo(() => {
    const byId = new Map<
      string,
      { id: string; name: string; level?: string; teacherName: string; academicYear: string }
    >();
    for (const c of classesList) {
      byId.set(c.id, {
        id: c.id,
        name: c.name,
        level: c.level,
        teacherName: c.teacherName,
        academicYear: c.academicYear,
      });
    }
    for (const r of classRosters ?? []) {
      if (!byId.has(r.id)) {
        byId.set(r.id, {
          id: r.id,
          name: r.name,
          level: r.level,
          teacherName: r.homeroomTeacherName || '',
          academicYear: r.academicYear,
        });
      }
    }
    return [...byId.values()];
  }, [classesList, classRosters]);

  const teacherAssignedClasses = useMemo(
    () =>
      currentUser?.role === 'TEACHER'
        ? resolveTeacherAssignedClasses(currentUser, allClassOptions)
        : [],
    [currentUser, allClassOptions],
  );

  const accessibleClasses = useMemo(() => {
    if (
      currentUser &&
      (currentUser.role === 'PARENT' || currentUser.role === 'STUDENT' || currentUser.role === 'TEACHER')
    ) {
      if (!currentUser.assignedClassIds || currentUser.assignedClassIds.length === 0) return [];
      return allClassOptions.filter((cls) => currentUser.assignedClassIds?.includes(cls.id));
    }
    return allClassOptions;
  }, [allClassOptions, currentUser]);

  const activeClass = useMemo(() => {
    if (accessibleClasses.length === 0) return null;
    return accessibleClasses.find((cls) => cls.id === selectedClassId) ?? accessibleClasses[0];
  }, [accessibleClasses, selectedClassId]);

  const calendarPerms = useMemo(
    () =>
      getCalendarPermissionsUi(currentUser, {
        classId: activeClass?.id ?? null,
        assignedClassIds: teacherAssignedClasses.map((c) => c.id),
      }),
    [currentUser, activeClass, teacherAssignedClasses],
  );

  const scopedAnnouncements = useMemo(() => {
    if (!activeClass) return announcements.filter((a) => !a.classId);
    return announcements.filter((a) => !a.classId || a.classId === activeClass.id);
  }, [activeClass, announcements]);

  const scopedHomework = useMemo(() => {
    if (!activeClass) return homeworkList;
    return homeworkList.filter((hw) => hw.classId === activeClass.id);
  }, [activeClass, homeworkList]);

  const scopedCalendarEvents = useMemo(() => {
    return calendarEvents.filter((ev) => calendarEventMatchesClassScope(ev, activeClass?.id ?? null));
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

  return {
    currentUser,
    activeSubTab,
    setActiveSubTab,
    newQuestionText,
    setNewQuestionText,
    questionError,
    postingQuestion,
    replyTextMap,
    setReplyTextMap,
    replyErrorMap,
    replyingId,
    showAnnouncementForm,
    setShowAnnouncementForm,
    annTitle,
    setAnnTitle,
    annBody,
    setAnnBody,
    annPriority,
    setAnnPriority,
    showHomeworkForm,
    setShowHomeworkForm,
    hwTitle,
    setHwTitle,
    hwDesc,
    setHwDesc,
    hwDueDate,
    setHwDueDate,
    actionFeedback,
    submittingAction,
    canModerate,
    allClassOptions,
    teacherAssignedClasses,
    accessibleClasses,
    activeClass,
    setSelectedClassId,
    calendarPerms,
    scopedAnnouncements,
    scopedHomework,
    scopedCalendarEvents,
    scopedDocuments,
    scopedGallery,
    visibleQuestions,
    calendarStatus,
    calendarError,
    communityStatus,
    communityError,
    isHydratingSchoolData,
    isLoadingClassCommunity,
    refreshSchoolData,
    language,
    t,
    handlePostQuestion,
    handleReplySubmit,
    handleCreateAnnouncement,
    handleCreateHomework,
    handleModerateQuestion,
  };
}
