import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider, useApp } from '../../src/context/AppContext';

// Mount the actual AppProvider and read its backward-compatible public useApp surface.
function PublicConsumer() {
  const app = useApp();
  useEffect(() => {
    (window as any).__arch01UseAppReady = true;
    (window as any).__arch01UseAppSetLanguage = app.setLanguage;
  }, [app]);
  return <pre data-testid="arch01-useapp-state">{JSON.stringify({
    language: app.language, dir: app.dir, theme: app.theme,
    hasMarkRead: typeof app.markNotificationRead === 'function',
    hasMarkAll: typeof app.markAllNotificationsRead === 'function',
    notifications: app.notifications,
    preferencesStatus: app.preferencesSyncStatus,
    preferencesError: app.preferencesError,
  })}</pre>;
}
createRoot(document.getElementById('root')!).render(<AppProvider><PublicConsumer /></AppProvider>);

