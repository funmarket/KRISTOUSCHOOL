/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider } from './context/AppContext';
import { AppShell } from './app/AppShell';

/**
 * Root application bootstrap composing providers and delegating top-level
 * routing & layout orchestration to AppShell:
 * - Home routing through HomePageResolver
 * - Role-gated tabs including activeTab === 'performance' ->
 *   canAccessAppTab(currentUser, 'performance') ? <PerformanceView /> : HomePageResolver
 */
export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
