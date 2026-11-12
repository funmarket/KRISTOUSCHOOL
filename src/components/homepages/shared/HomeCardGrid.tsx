import React from 'react';
import './HomePageLayout.css';

export interface HomeCardGridProps {
  children: React.ReactNode;
  ariaLabel?: string;
}

export const HomeCardGrid: React.FC<HomeCardGridProps> = ({ children, ariaLabel }) => {
  return (
    <div className="kh-card-grid" role="region" aria-label={ariaLabel}>
      {children}
    </div>
  );
};
