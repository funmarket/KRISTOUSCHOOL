/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppTab, CommunitySubTab, DirectorySubTab, HomePageKey } from './types';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { HomePageResolver } from './components/homepages/HomePageResolver';
import { PublicHomePage } from './components/homepages/PublicHomePage';
import { canAccessAppTab } from './components/homepages/homepageAccess';
import { ClassCommunityView } from './components/views/ClassCommunityView';
import { ParentNotesView } from './components/views/ParentNotesView';
import { PickupBoardView } from './components/views/PickupBoardView';
import { FoodMenuView } from './components/views/FoodMenuView';
import { DirectoryView } from './components/views/DirectoryView';
import { ClassesManagementView } from './components/views/ClassesManagementView';
import { RegistrationView } from './components/views/RegistrationView';

function MainLayout() {
  const { currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<string>('home');
  const [communitySubTab, setCommunitySubTab] = useState<CommunitySubTab>('announcements');
  const [directorySubTab, setDirectorySubTab] = useState<DirectorySubTab>('teachers');
  const [oversightHomePage, setOversightHomePage] = useState<HomePageKey | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  // Reset oversight inspection whenever the authenticated identity or role changes
  useEffect(() => {
    setOversightHomePage(null);
  }, [currentUser?.id, currentUser?.role]);

  const handleSetTab = (nextTab: string) => {
    if (canAccessAppTab(currentUser, nextTab as AppTab)) {
      setActiveTab(nextTab);
    } else {
      setActiveTab('home');
    }
  };

  const handleNavigateToSubTab = (tab: 'community' | 'directory', subTab: string) => {
    if (tab === 'community') {
      if (!canAccessAppTab(currentUser, 'community')) {
        setActiveTab('home');
        return;
      }
      setCommunitySubTab(subTab as CommunitySubTab);
      setActiveTab('community');
      return;
    }

    if (tab === 'directory') {
      setDirectorySubTab(subTab as DirectorySubTab);
      setActiveTab('directory');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] text-gray-900 dark:text-gray-100 flex flex-col transition-colors selection:bg-blue-600 selection:text-white">
      <Navbar activeTab={activeTab} setActiveTab={handleSetTab} />

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
            <ParentNotesView />
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
            <ClassesManagementView />
          ) : (
            <HomePageResolver
              setActiveTab={handleSetTab}
              onOpenAuth={() => setShowAuthModal(true)}
              onNavigateToSubTab={handleNavigateToSubTab}
            />
          ))}

        {activeTab === 'foodMenu' && <FoodMenuView />}
        {activeTab === 'directory' && <DirectoryView initialSubTab={directorySubTab} />}
        {activeTab === 'registration' && <RegistrationView />}
      </main>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      <Footer />
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
