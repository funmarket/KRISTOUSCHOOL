import React from 'react';
import { ParentNotesPanel } from './Shared/ParentNotesPanel';

export const ParentNotesView: React.FC = () => {
  return (
    <div className="pb-12" data-testid="parent-notes-view">
      <ParentNotesPanel />
    </div>
  );
};
