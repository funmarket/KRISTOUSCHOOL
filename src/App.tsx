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
  const { currentUser, currentRole, language } = useApp();

  // R1 frontend containment. Real server-side authorization belongs to R2.
  const requiresSchoolAccess = ['community', 'notes', 'pickup'].includes(activeTab);
  const hasSchoolAccess = currentUser !== null && currentRole !== 'PUBLIC';
  const accessUnavailable = {
    ar: 'هذه الصفحة مخصّصة للحسابات المدرسية المعتمدة. تسجيل الدخول غير متاح حالياً.',
    fr: "Cet espace est réservé aux comptes scolaires autorisés. La connexion n'est pas encore disponible.",
    en: 'This area is for approved school accounts. Sign-in is not available yet.',
  }[language];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] text-gray-900 dark:text-gray-100 flex flex-col transition-colors selection:bg-blue-600 selection:text-white">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'home' && <HomeView setActiveTab={setActiveTab} />}
        {requiresSchoolAccess && !hasSchoolAccess && (
          <section role="status" className="max-w-xl mx-auto rounded-3xl border border-k-brand/25 bg-white dark:bg-[#111111] p-6 text-center shadow-sm">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{accessUnavailable}</p>
          </section>
        )}
        {activeTab === 'community' && hasSchoolAccess && <ClassCommunityView />}
        {activeTab === 'notes' && hasSchoolAccess && <ParentNotesView />}
        {activeTab === 'pickup' && hasSchoolAccess && <PickupBoardView />}
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
