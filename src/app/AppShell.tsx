import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { CommunitySubTab, DirectorySubTab, HomePageKey, NotificationItem } from '../types';
import { Navbar } from '../components/Navbar';
import { AuthModal } from '../components/AuthModal';
import { HomePageResolver } from '../components/homepages/HomePageResolver';
import { PublicHomePage } from '../components/homepages/PublicHomePage';
import { canAccessAppTab } from '../components/homepages/homepageAccess';
import { ClassCommunityView } from '../components/views/ClassCommunityView';
import { GlobalAnnouncementsCalendarView } from '../components/views/GlobalAnnouncementsCalendarView';
import { PerformanceView } from '../components/views/PerformanceView';
import { MessagesView } from '../components/views/MessagesView';
import { ParentNotesView } from '../components/views/ParentNotesView';
import { PickupBoardView } from '../components/views/PickupBoardView';
import { FoodMenuView } from '../components/views/FoodMenuView';
import { DirectoryView } from '../components/views/DirectoryView';
import { ClassesManagementView } from '../components/views/ClassesManagementView';
import { RegistrationView } from '../components/views/RegistrationView';
import { StudentsManagementView } from '../components/views/StudentsManagementView';
import { AttendanceView } from '../components/views/AttendanceView';
import { pickText } from '../i18n/homepages';
import type { NotificationTargetIntent } from '../lib/notificationTargetNavigation';
import {
  buildClassRostersRecord, mapClassesBackendStatus, resolveNotificationTargetRoute,
  resolveSubTabTransition, resolveTabTransition, shouldInterceptDirtyAttendanceLeave,
  type AnnouncementsSubTab, type PendingAttendanceLeaveNav, type StudentNavOrigin, type SubTabTargetTab,
} from './routeModel';

export function AppShell() {
  const {
    currentUser, language, classRosters, classesBackendStatus, classesError,
    setSelectedClassId, isHydratingSchoolData, refreshSchoolData,
  } = useApp();
  const [activeTab, setActiveTab] = useState<string>('home');
  const [communitySubTab, setCommunitySubTab] = useState<CommunitySubTab>('announcements');
  const [directorySubTab, setDirectorySubTab] = useState<DirectorySubTab>('teachers');
  const [announcementsSubTab, setAnnouncementsSubTab] = useState<AnnouncementsSubTab>('broadcasts');
  const [oversightHomePage, setOversightHomePage] = useState<HomePageKey | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [notificationTarget, setNotificationTarget] = useState<NotificationTargetIntent | null>(null);
  const [selectedStudentDetailId, setSelectedStudentDetailId] = useState<string | null>(null);
  const [studentNavOrigin, setStudentNavOrigin] = useState<StudentNavOrigin>('students');
  const [isAttendanceDirty, setIsAttendanceDirty] = useState<boolean>(false);
  const [pendingAttendanceLeave, setPendingAttendanceLeave] = useState<PendingAttendanceLeaveNav | null>(null);
  const notificationRequestSeq = useRef(0);

  useEffect(() => {
    setNotificationTarget(null);
    setIsAttendanceDirty(false);
    setPendingAttendanceLeave(null);
    setSelectedStudentDetailId(null);
    setStudentNavOrigin('students');
  }, [currentUser?.id, currentUser?.role, currentUser?.accountStatus]);

  useEffect(() => {
    setOversightHomePage(null);
  }, [currentUser?.id, currentUser?.role]);

  const openAuthModal = () => setShowAuthModal(true);

  const applyNotificationTarget = (notification: NotificationItem): boolean => {
    const nextSeq = notificationRequestSeq.current + 1;
    const intent = resolveNotificationTargetRoute(currentUser, notification, nextSeq);
    if (!intent) return false;
    notificationRequestSeq.current = nextSeq;
    setNotificationTarget(intent);
    setActiveTab(intent.tab);
    return true;
  };

  const handleNotificationTarget = (notification: NotificationItem): boolean => {
    const previewIntent = resolveNotificationTargetRoute(
      currentUser,
      notification,
      notificationRequestSeq.current + 1,
    );
    if (!previewIntent) return false;
    if (shouldInterceptDirtyAttendanceLeave(activeTab, isAttendanceDirty)) {
      setPendingAttendanceLeave({ kind: 'notification', notification });
      return false;
    }
    return applyNotificationTarget(notification);
  };

  const applySetTab = (nextTab: string) => {
    setNotificationTarget(null);
    const resolution = resolveTabTransition(currentUser, nextTab);
    if (resolution.resetAnnouncementsSubTab) {
      setAnnouncementsSubTab(resolution.resetAnnouncementsSubTab);
    }
    setActiveTab(resolution.activeTab);
  };

  const handleSetTab = (nextTab: string) => {
    if (shouldInterceptDirtyAttendanceLeave(activeTab, isAttendanceDirty, nextTab)) {
      setPendingAttendanceLeave({ kind: 'tab', tab: nextTab });
      return;
    }
    if (nextTab === 'students') {
      setSelectedStudentDetailId(null);
      setStudentNavOrigin('students');
    }
    applySetTab(nextTab);
  };

  const applyNavigateToSubTab = (tab: SubTabTargetTab, subTab: string) => {
    setNotificationTarget(null);
    const resolution = resolveSubTabTransition(currentUser, tab, subTab);
    if (resolution.communitySubTab) setCommunitySubTab(resolution.communitySubTab);
    if (resolution.announcementsSubTab) setAnnouncementsSubTab(resolution.announcementsSubTab);
    if (resolution.directorySubTab) setDirectorySubTab(resolution.directorySubTab);
    setActiveTab(resolution.activeTab);
  };

  const handleNavigateToSubTab = (tab: SubTabTargetTab, subTab: string) => {
    if (shouldInterceptDirtyAttendanceLeave(activeTab, isAttendanceDirty)) {
      setPendingAttendanceLeave({ kind: 'subtab', tab, subTab });
      return;
    }
    applyNavigateToSubTab(tab, subTab);
  };

  const confirmLeaveDirtyAttendance = () => {
    const pending = pendingAttendanceLeave;
    setPendingAttendanceLeave(null);
    setIsAttendanceDirty(false);
    if (!pending) return;
    if (pending.kind === 'tab') {
      applySetTab(pending.tab);
    } else if (pending.kind === 'subtab') {
      applyNavigateToSubTab(pending.tab, pending.subTab);
    } else {
      applyNotificationTarget(pending.notification);
    }
  };

  const rostersRecord = useMemo(() => buildClassRostersRecord(classRosters), [classRosters]);
  const mappedClassesStatus = mapClassesBackendStatus(isHydratingSchoolData, classesBackendStatus);

  const renderFallbackHome = () => (
    <HomePageResolver
      setActiveTab={handleSetTab}
      onOpenAuth={openAuthModal}
      onNavigateToSubTab={handleNavigateToSubTab}
    />
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] text-gray-900 dark:text-gray-100 flex flex-col transition-colors selection:bg-blue-600 selection:text-white">
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleSetTab}
        onNavigateToSubTab={handleNavigateToSubTab}
        onNavigateToNotificationTarget={handleNotificationTarget}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-8">
        {activeTab === 'home' && (
          <HomePageResolver
            setActiveTab={handleSetTab}
            onOpenAuth={openAuthModal}
            onNavigateToSubTab={handleNavigateToSubTab}
            requestedHomePage={oversightHomePage}
            onInspectRoleHome={setOversightHomePage}
          />
        )}

        {activeTab === 'publicSite' && (
          <PublicHomePage
            setActiveTab={handleSetTab}
            onOpenAuth={openAuthModal}
            onNavigateToSubTab={handleNavigateToSubTab}
          />
        )}

        {activeTab === 'announcements' &&
          (canAccessAppTab(currentUser, 'announcements') ? (
            <GlobalAnnouncementsCalendarView initialSubTab={announcementsSubTab} />
          ) : (
            renderFallbackHome()
          ))}

        {activeTab === 'performance' &&
          (canAccessAppTab(currentUser, 'performance') ? <PerformanceView /> : renderFallbackHome())}

        {activeTab === 'attendance' &&
          (canAccessAppTab(currentUser, 'attendance') ? (
            <AttendanceView onDirtyChange={setIsAttendanceDirty} />
          ) : (
            renderFallbackHome()
          ))}

        {activeTab === 'community' &&
          (canAccessAppTab(currentUser, 'community') ? (
            <ClassCommunityView initialSubTab={communitySubTab} />
          ) : (
            renderFallbackHome()
          ))}

        {activeTab === 'notes' &&
          (canAccessAppTab(currentUser, 'notes') ? (
            <ParentNotesView notificationTarget={notificationTarget} />
          ) : (
            renderFallbackHome()
          ))}

        {activeTab === 'messages' &&
          (canAccessAppTab(currentUser, 'messages') ? (
            <MessagesView notificationTarget={notificationTarget} />
          ) : (
            renderFallbackHome()
          ))}

        {activeTab === 'pickup' &&
          (canAccessAppTab(currentUser, 'pickup') ? <PickupBoardView /> : renderFallbackHome())}

        {activeTab === 'classes' &&
          (canAccessAppTab(currentUser, 'classes') ? (
            <ClassesManagementView
              initialClasses={classRosters}
              initialRosters={rostersRecord}
              backendStatus={mappedClassesStatus}
              errorMessage={classesError}
              onRefresh={refreshSchoolData}
              onOpenClassCommunity={(classId) => {
                setSelectedClassId(classId);
                handleNavigateToSubTab('community', 'announcements');
              }}
              onOpenAttendance={(classId) => {
                setSelectedClassId(classId);
                handleSetTab('attendance');
              }}
              onOpenStudentDetail={(studentId) => {
                setSelectedStudentDetailId(studentId);
                setStudentNavOrigin('roster');
                applySetTab('students');
              }}
            />
          ) : (
            renderFallbackHome()
          ))}

        {activeTab === 'foodMenu' && <FoodMenuView />}
        {activeTab === 'directory' && <DirectoryView initialSubTab={directorySubTab} />}
        {activeTab === 'registration' && <RegistrationView notificationTarget={notificationTarget} />}
        {activeTab === 'students' &&
          (canAccessAppTab(currentUser, 'students') ? (
            <StudentsManagementView
              initialSelectedStudentId={selectedStudentDetailId}
              navOrigin={studentNavOrigin}
              onBackToOrigin={() => {
                if (studentNavOrigin === 'roster') {
                  applySetTab('classes');
                } else {
                  setSelectedStudentDetailId(null);
                }
              }}
            />
          ) : (
            renderFallbackHome()
          ))}
      </main>

      {pendingAttendanceLeave && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="attendance-leave-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111111] p-6 shadow-xl space-y-4"
          >
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {pickText(
                {
                  ar: 'تغييرات غير محفوظة في الحضور',
                  fr: 'Modifications non enregistrées',
                  en: 'Unsaved Attendance Changes',
                },
                language,
              )}
            </h3>
            <p className="text-xs font-medium text-slate-600 dark:text-zinc-300 leading-relaxed">
              {pickText(
                {
                  ar: 'لديك تعديلات غير محفوظة في سجل الحضور. هل تريد تجاهلها ومغادرة الصفحة؟',
                  fr: 'Vous avez des modifications non enregistrées dans le registre. Voulez-vous quitter et les annuler ?',
                  en: 'You have unsaved changes in the attendance register. Do you want to discard them and leave this page?',
                },
                language,
              )}
            </p>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                data-testid="attendance-stay-btn"
                onClick={() => setPendingAttendanceLeave(null)}
                className="rounded-xl border border-slate-200 dark:border-zinc-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900"
              >
                {pickText(
                  { ar: 'البقاء في الحضور', fr: 'Rester ici', en: 'Stay on Attendance' },
                  language,
                )}
              </button>
              <button
                type="button"
                data-testid="attendance-discard-leave-btn"
                onClick={confirmLeaveDirtyAttendance}
                className="rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 text-xs font-bold text-white"
              >
                {pickText(
                  {
                    ar: 'تجاهل التغييرات والمغادرة',
                    fr: 'Ignorer et quitter',
                    en: 'Discard Changes & Leave',
                  },
                  language,
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}
