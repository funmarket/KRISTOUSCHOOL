import React from 'react';
import './HomePageLayout.css';

export interface HomeSectionProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export const HomeSection: React.FC<HomeSectionProps> = ({
  title,
  subtitle,
  children,
  className = '',
}) => {
  return (
    <section className={`kh-section ${className}`.trim()}>
      {(title || subtitle) && (
        <div className="kh-section-header">
          {title && <h2 className="kh-section-title">{title}</h2>}
          {subtitle && <p className="kh-section-subtitle">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
};
