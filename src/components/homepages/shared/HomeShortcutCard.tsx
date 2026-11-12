import React from 'react';
import { CardAvailabilityState } from '../../../types';
import './HomePageLayout.css';

export type CardColorTone =
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange'
  | 'yellow'
  | 'teal'
  | 'red'
  | 'slate';

export interface HomeShortcutCardProps {
  id?: string;
  title: string;
  actionLabel: string;
  icon: React.ReactNode;
  tone: CardColorTone;
  state?: CardAvailabilityState;
  statusBadge?: string;
  onClick?: () => void;
}

export const HomeShortcutCard: React.FC<HomeShortcutCardProps> = ({
  id,
  title,
  actionLabel,
  icon,
  tone,
  state = 'AVAILABLE',
  statusBadge,
  onClick,
}) => {
  const isInteractive = state !== 'UNAUTHORIZED';

  return (
    <button
      type="button"
      data-testid={id ? `shortcut-card-${id}` : undefined}
      data-card-state={state}
      onClick={isInteractive ? onClick : undefined}
      disabled={!isInteractive}
      className={`kh-shortcut-card kh-tone-${tone} ${
        !isInteractive ? 'opacity-60 cursor-not-allowed' : ''
      }`}
    >
      <span className="kh-shortcut-card-circle" aria-hidden="true" />

      <div className="kh-shortcut-icon-wrap" aria-hidden="true">
        <span className="kh-shortcut-icon">{icon}</span>
        <span className="kh-shortcut-pedestal" />
      </div>

      <div className="kh-shortcut-body">
        <span className="kh-shortcut-title">{title}</span>
        <div className="kh-shortcut-footer">
          {(!statusBadge || statusBadge !== actionLabel) && (
            <span className="kh-shortcut-action">{actionLabel}</span>
          )}
          {statusBadge && (
            <span className="kh-shortcut-status-pill">{statusBadge}</span>
          )}
        </div>
      </div>
    </button>
  );
};
