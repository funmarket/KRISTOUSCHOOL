import React from 'react';
import { ParentNotesPanel } from './Shared/ParentNotesPanel';
import type { NotificationTargetIntent } from '../../lib/notificationTargetNavigation';

export const ParentNotesView: React.FC<{ notificationTarget?: NotificationTargetIntent | null }> = ({ notificationTarget = null }) => {
  return (
    <div className="pb-12" data-testid="parent-notes-view">
      <ParentNotesPanel notificationTarget={notificationTarget} />
    </div>
  );
};
