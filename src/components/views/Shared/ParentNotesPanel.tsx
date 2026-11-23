import React from 'react';
import { ParentNotesMainContent, ParentNotesMainContentProps } from '../parent-notes/ParentNotesMainContent';

export type ParentNotesPanelProps = ParentNotesMainContentProps;

export const ParentNotesPanel: React.FC<ParentNotesPanelProps> = (props) => {
  return <ParentNotesMainContent {...props} />;
};
