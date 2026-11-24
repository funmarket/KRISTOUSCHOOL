import React, { useEffect, useState } from 'react';
import { CalendarDays, Home } from 'lucide-react';
import type { AppTab, User } from '../types';
import type { TranslationKey } from '../i18n/translations';
import type { SubTabTargetTab } from '../app/routeModel';
import { canAccessAppTab } from './homepages/homepageAccess';

export interface BottomNavBarProps {
  activeTab: AppTab;
  currentUser: User | null;
  t: (key: TranslationKey) => string;
  onSelectTab: (tab: AppTab) => void;
  onNavigateToSubTab: (tab: SubTabTargetTab, subTab: string) => void;
}

interface NavItemConfig {
  id: 'home' | 'pickup' | 'announcements' | 'directory';
  label: string;
  renderIcon: () => React.ReactNode;
  onClick: () => void;
}

function PickupOutlineIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-6 h-6 shrink-0"
    >
      <path d="M5 11.5 6.8 6.8A2 2 0 0 1 8.7 5.5h6.6a2 2 0 0 1 1.9 1.3l1.4 3.7" />
      <path d="M3.5 14.5v-2a2 2 0 0 1 2-2h9" />
      <path d="M4.5 14.5v2a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1v-1" />
      <path d="M6.5 13h2" />
      <path d="M17 11.5c2 .9 3.5 1.4 3.5 1.4v3.2c0 2.5-1.6 4.4-3.5 5.1-1.9-.7-3.5-2.6-3.5-5.1v-3.2s1.5-.5 3.5-1.4Z" />
      <path d="m15.6 16.3 1 1 2-2.1" />
    </svg>
  );
}

function TeachersOutlineIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="w-6 h-6 shrink-0"
    >
      <circle cx="12" cy="6.2" r="3" />
      <path d="M7.5 13.1a5.2 5.2 0 0 1 9 0" />
      <path d="M12 14.2v6.3" />
      <path d="M4.5 13.5c2.5 0 5.3.4 7.5 1.3 2.2-.9 5-1.3 7.5-1.3v6c-2.5 0-5.3.4-7.5 1.3-2.2-.9-5-1.3-7.5-1.3v-6Z" />
    </svg>
  );
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  currentUser,
  t,
  onSelectTab,
  onNavigateToSubTab,
}) => {
  const isApprovedUser = Boolean(currentUser && currentUser.accountStatus === 'APPROVED');
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    setIsHidden(false);
  }, [activeTab, currentUser?.id]);

  useEffect(() => {
    if (!isApprovedUser) {
      setIsHidden(false);
      return;
    }

    let lastScrollY = Math.max(0, window.scrollY || document.documentElement?.scrollTop || 0);
    let rafId: number | null = null;

    const updateVisibility = () => {
      rafId = null;
      const currentY = Math.max(0, window.scrollY || document.documentElement?.scrollTop || 0);
      const delta = currentY - lastScrollY;
      const viewportH = window.innerHeight || 0;
      const docHeight = document.documentElement?.scrollHeight || 0;
      const atBottom = docHeight > viewportH && currentY + viewportH >= docHeight - 24;

      if (currentY <= 24 || atBottom) {
        setIsHidden(false);
      } else if (delta > 8 && currentY > 48) {
        setIsHidden(true);
      } else if (delta < -6) {
        setIsHidden(false);
      }

      lastScrollY = currentY;
    };

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(updateVisibility);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [isApprovedUser]);

  if (!isApprovedUser || !currentUser) {
    return null;
  }

  const items: NavItemConfig[] = [
    {
      id: 'home',
      label: t('home'),
      renderIcon: () => <Home aria-hidden="true" className="w-6 h-6 shrink-0" strokeWidth={2} />,
      onClick: () => onSelectTab('home'),
    },
  ];

  if (canAccessAppTab(currentUser, 'pickup')) {
    items.push({
      id: 'pickup',
      label: t('navPickupShort'),
      renderIcon: () => <PickupOutlineIcon />,
      onClick: () => onSelectTab('pickup'),
    });
  }

  if (canAccessAppTab(currentUser, 'announcements')) {
    items.push({
      id: 'announcements',
      label: t('navCalendarShort'),
      renderIcon: () => <CalendarDays aria-hidden="true" className="w-6 h-6 shrink-0" strokeWidth={2} />,
      onClick: () => onNavigateToSubTab('announcements', 'calendar'),
    });
  }

  items.push({
    id: 'directory',
    label: t('teachers'),
    renderIcon: () => <TeachersOutlineIcon />,
    onClick: () => onNavigateToSubTab('directory', 'teachers'),
  });

  const gridColsClass =
    items.length === 4 ? 'grid-cols-4' : items.length === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))]">
      <nav
        aria-label={t('navigation')}
        dir="ltr"
        data-testid="bottom-nav-bar"
        data-hidden={isHidden ? 'true' : 'false'}
        className={`pointer-events-auto max-w-lg mx-auto rounded-[28px] bg-white/95 dark:bg-[#0B0F14]/95 border border-slate-200/85 dark:border-zinc-800 shadow-[0_8px_30px_rgba(11,44,82,0.12)] backdrop-blur-md px-2 py-2 grid ${gridColsClass} gap-1 transition-all duration-200 ease-out ${
          isHidden ? 'translate-y-[calc(100%+1.5rem)] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}
      >
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`bottom-nav-item-${item.id}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={item.onClick}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 min-h-[54px] rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-k-brand ${
                isActive
                  ? 'bg-[#DFF7F4] dark:bg-teal-950/60 text-[#0B8F85] dark:text-[#2dd4bf]'
                  : 'text-[#0B2C52] dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-zinc-900'
              }`}
            >
              {item.renderIcon()}
              <span className="text-xs font-bold leading-tight whitespace-nowrap truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
