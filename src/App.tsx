/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import {
  AppTab,
  NotificationItem,
  ClassStudentRosterItem,
  CommunitySubTab,
  DirectorySubTab,
  HomePageKey,
} from './types';
import { Navbar } from './components/Navbar';
import { createNotificationTargetIntent, getNotificationActorKey, type NotificationTargetIntent } from './lib/notificationTargetNavigation';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { HomePageResolver } from './components/homepages/HomePageResolver';
import { PublicHomePage } from './components/homepages/PublicHomePage';
import { canAccessAppTab } from './components/homepages/homepageAccess';
import { ClassCommunityView } from './components/views/ClassCommunityView';
import { GlobalAnnouncementsCalendarView } from './components/views/GlobalAnnouncementsCalendarView';
import { MessagesView } from './components/views/MessagesView';
import { ParentNotesView } from './components/views/ParentNotesView';
import { PickupBoardView } from './components/views/PickupBoardView';
import { FoodMenuView } from './components/views/FoodMenuView';
import { DirectoryView } from './components/views/DirectoryView';
import { ClassesManagementView } from './components/views/ClassesManagementView';
import { RegistrationView } from './components/views/RegistrationView';

function MainLayout() {
  const {
    currentUser,
    classRosters,
    classesBackendStatus,
    isHydratingSchoolData,
    refreshSchoolData,
  } = useApp();
  const [activeTab, setActiveTab] = useState<string>('home');
  const [communitySubTab, setCommunitySubTab] = useState<CommunitySubTab>('announcements');
  const [directorySubTab, setDirectorySubTab] = useState<DirectorySubTab>('teachers');
  const [announcementsSubTab, setAnnouncementsSubTab] = useState<'broadcasts' | 'calendar'>('broadcasts');
  const [oversightHomePage, setOversightHomePage] = useState<HomePageKey | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [notificationTarget, setNotificationTarget] = useState<NotificationTargetIntent | null>(null);
  const notificationRequestSeq = useRef(0);

  useEffect(() => {
    setNotificationTarget(null);
  }, [currentUser?.id, currentUser?.role, currentUser?.accountStatus]);

  const handleNotificationTarget = (notification: NotificationItem): boolean => {
    const actorKey = getNotificationActorKey(currentUser);
    const intent = createNotificationTargetIntent(notification, actorKey, ++notificationRequestSeq.current);
    if (!intent || !canAccessAppTab(currentUser, intent.tab)) return false;
    setNotificationTarget(intent);
    setActiveTab(intent.tab);
    return true;
  };

  // Reset oversight inspection whenever the authenticated identity or role changes
  useEffect(() => {
    setOversightHomePage(null);
  }, [currentUser?.id, currentUser?.role]);

  const handleSetTab = (nextTab: string) => {
    setNotificationTarget(null);
    if (canAccessAppTab(currentUser, nextTab as AppTab)) {
      if (nextTab === 'announcements') {
        setAnnouncementsSubTab('broadcasts');
      }
      setActiveTab(nextTab);
    } else {
      setActiveTab('home');
    }
  };

  const handleNavigateToSubTab = (
    tab: 'community' | 'directory' | 'announcements',
    subTab: string,
  ) => {
    setNotificationTarget(null);
    if (tab === 'community') {
      if (!canAccessAppTab(currentUser, 'community')) {
        setActiveTab('home');
        return;
      }
      setCommunitySubTab(subTab as CommunitySubTab);
      setActiveTab('community');
      return;
    }

    if (tab === 'announcements') {
      if (!canAccessAppTab(currentUser, 'announcements')) {
        setActiveTab('home');
        return;
      }
      setAnnouncementsSubTab(subTab === 'calendar' ? 'calendar' : 'broadcasts');
      setActiveTab('announcements');
      return;
    }

    if (tab === 'directory') {
      setDirectorySubTab(subTab as DirectorySubTab);
      setActiveTab('directory');
    }
  };

  const rostersRecord = useMemo(() => {
    const map: Record<string, ClassStudentRosterItem[]> = {};
    for (const cls of classRosters) {
      map[cls.id] = cls.roster;
    }
    return map;
  }, [classRosters]);

  const mappedClassesStatus = isHydratingSchoolData
    ? 'LOADING'
    : classesBackendStatus === 'READY'
    ? 'READY'
    : classesBackendStatus === 'UNAUTHORIZED'
    ? 'UNAUTHORIZED'
    : classesBackendStatus === 'ERROR'
    ? 'ERROR'
    : 'BACKEND_NOT_IMPLEMENTED';

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
            onOpenAuth={() => setShowAuthModal(true)}
            onNavigateToSubTab={handleNavigateToSubTab}
            requestedHomePage={oversightHomePage}
            onInspectRoleHome={setOversightHomePage}
          />
        )}

        {activeTab === 'publicSite' && (
          <PublicHomePage
            setActiveTab={handleSetTab}
            onOpenAuth={() => setShowAuthModal(true)}
            onNavigateToSubTab={handleNavigateToSubTab}
          />
        )}

        {activeTab === 'announcements' &&
          (canAccessAppTab(currentUser, 'announcements') ? (
            <GlobalAnnouncementsCalendarView initialSubTab={announcementsSubTab} />
          ) : (
            <HomePageResolver
              setActiveTab={handleSetTab}
              onOpenAuth={() => setShowAuthModal(true)}
              onNavigateToSubTab={handleNavigateToSubTab}
            />
          ))}

        {activeTab === 'community' &&
          (canAccessAppTab(currentUser, 'community') ? (
            <ClassCommunityView initialSubTab={communitySubTab} />
          ) : (
            <HomePageResolver
              setActiveTab={handleSetTab}
              onOpenAuth={() => setShowAuthModal(true)}
              onNavigateToSubTab={handleNavigateToSubTab}
            />
          ))}

        {activeTab === 'notes' &&
          (canAccessAppTab(currentUser, 'notes') ? (
            <ParentNotesView notificationTarget={notificationTarget} />
          ) : (
            <HomePageResolver
              setActiveTab={handleSetTab}
              onOpenAuth={() => setShowAuthModal(true)}
              onNavigateToSubTab={handleNavigateToSubTab}
            />
          ))}

        {activeTab === 'messages' &&
          (canAccessAppTab(currentUser, 'messages') ? (
            <MessagesView notificationTarget={notificationTarget} />
          ) : (
            <HomePageResolver
              setActiveTab={handleSetTab}
              onOpenAuth={() => setShowAuthModal(true)}
              onNavigateToSubTab={handleNavigateToSubTab}
            />
          ))}

        {activeTab === 'pickup' &&
          (canAccessAppTab(currentUser, 'pickup') ? (
            <PickupBoardView />
          ) : (
            <HomePageResolver
              setActiveTab={handleSetTab}
              onOpenAuth={() => setShowAuthModal(true)}
              onNavigateToSubTab={handleNavigateToSubTab}
            />
          ))}

        {activeTab === 'classes' &&
          (canAccessAppTab(currentUser, 'classes') ? (
            <ClassesManagementView
              initialClasses={classRosters}
              initialRosters={rostersRecord}
              backendStatus={mappedClassesStatus}
              onRefresh={refreshSchoolData}
            />
          ) : (
            <HomePageResolver
              setActiveTab={handleSetTab}
              onOpenAuth={() => setShowAuthModal(true)}
              onNavigateToSubTab={handleNavigateToSubTab}
            />
          ))}

        {activeTab === 'foodMenu' && <FoodMenuView />}
        {activeTab === 'directory' && <DirectoryView initialSubTab={directorySubTab} />}
        {activeTab === 'registration' && <RegistrationView notificationTarget={notificationTarget} />}
      </main>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      <Footer onNavigate={handleSetTab} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
