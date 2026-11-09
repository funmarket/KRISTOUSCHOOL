/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomeView } from './components/views/HomeView';
import { ClassCommunityView } from './components/views/ClassCommunityView';
import { ParentNotesView } from './components/views/ParentNotesView';
import { PickupBoardView } from './components/views/PickupBoardView';
import { FoodMenuView } from './components/views/FoodMenuView';
import { DirectoryView } from './components/views/DirectoryView';
import { RegistrationView } from './components/views/RegistrationView';

function MainLayout() {
  const [activeTab, setActiveTab] = useState<string>('home');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] text-gray-900 dark:text-gray-100 flex flex-col transition-colors selection:bg-blue-600 selection:text-white">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'home' && <HomeView setActiveTab={setActiveTab} />}
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
