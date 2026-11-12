/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomeView } from './components/views/HomeView';
import { RoleWorkspaceView } from './components/views/RoleWorkspaceView';
import { ClassCommunityView } from './components/views/ClassCommunityView';
import { ParentNotesView } from './components/views/ParentNotesView';
import { PickupBoardView } from './components/views/PickupBoardView';
import { FoodMenuView } from './components/views/FoodMenuView';
import { DirectoryView } from './components/views/DirectoryView';
import { RegistrationView } from './components/views/RegistrationView';

function MainLayout() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const { currentUser, currentRole } = useApp();

  // A new school-role session always opens that person's own workspace.
  useEffect(() => { setActiveTab('home'); }, [currentUser?.id, currentRole]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] text-gray-900 dark:text-gray-100 flex flex-col transition-colors selection:bg-blue-600 selection:text-white">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-8">
        {activeTab === 'home' && (
          currentUser && currentRole !== 'GENERAL_USER'
            ? <RoleWorkspaceView setActiveTab={setActiveTab} />
            : <HomeView setActiveTab={setActiveTab} />
        )}
        {activeTab === 'community' && <ClassCommunityView />}
        {activeTab === 'notes' && <ParentNotesView />}
        {activeTab === 'pickup' && <PickupBoardView />}
        {activeTab === 'foodMenu' && <FoodMenuView />}
        {activeTab === 'directory' && <DirectoryView />}
        {activeTab === 'registration' && <RegistrationView />}
      </main>

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
