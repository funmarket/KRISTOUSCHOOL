import React from 'react';
import './HomePageLayout.css';

export interface HomePageHeaderProps {
  badgeText: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export const HomePageHeader: React.FC<HomePageHeaderProps> = ({
  badgeText,
  title,
  subtitle,
  children,
}) => {
  return (
    <header className="kh-role-header">
      <div className="kh-role-badge" data-testid="homepage-role-badge">
        <span>{badgeText}</span>
      </div>
      <h1 className="kh-role-title">{title}</h1>
      {subtitle && <p className="kh-role-subtitle">{subtitle}</p>}
      {children && <div className="w-full">{children}</div>}
    </header>
  );
};
