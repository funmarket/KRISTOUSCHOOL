import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { pickText } from '../../i18n/homepages';
import { canAccessAppTab } from '../homepages/homepageAccess';
import { AppTab, NotificationItem } from '../../types';
import { filterLoadedNotifications, NOTIFICATION_CATEGORIES, type NotificationFilter } from '../../lib/notificationFilters';
import { useApp } from '../../context/AppContext';

import type { LocalizedText } from '../../i18n/homepages';

const NOTIFICATION_FILTER_LABELS: Record<NotificationFilter, LocalizedText> = {
  all: { ar: 'الكل', fr: 'Tout', en: 'All', es: 'Todo', de: 'Alle', pt: 'Tudo' },
  pickup: { ar: 'الاستلام', fr: 'Sortie', en: 'Pickup', es: 'Recogida', de: 'Abholung', pt: 'Saída' },
  note: { ar: 'ملاحظات', fr: 'Notes', en: 'Notes', es: 'Notas', de: 'Mitteilungen', pt: 'Notas' },
  announcement: { ar: 'الإعلانات', fr: 'Annonces', en: 'Announcements', es: 'Anuncios', de: 'Meldungen', pt: 'Anúncios' },
  message: { ar: 'الرسائل', fr: 'Messages', en: 'Messages', es: 'Mensajes', de: 'Nachrichten', pt: 'Mensagens' },
  calendar: { ar: 'التقويم', fr: 'Calendrier', en: 'Calendar', es: 'Calendario', de: 'Kalender', pt: 'Calendário' },
  system: { ar: 'النظام', fr: 'Système', en: 'System', es: 'Sistema', de: 'System', pt: 'Sistema' },
};

export interface NavbarNotificationMenuProps {
  setActiveTab?: (tab: string) => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory' | 'announcements', subTab: string) => void;
  onNavigateToNotificationTarget?: (notification: NotificationItem) => boolean;
}

export const NavbarNotificationMenu: React.FC<NavbarNotificationMenuProps> = ({
  setActiveTab,
  onNavigateToSubTab,
  onNavigateToNotificationTarget,
}) => {
  const {
    currentUser,
    language,
    t,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    notificationsError,
    markingNotificationIds,
    markingAllNotifications,
    refreshSchoolData,
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('all');
  const notificationsMenuRef = useRef<HTMLDivElement>(null);
  const notificationsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showNotifications) notificationsScrollRef.current?.focus({ preventScroll: true });
  }, [showNotifications]);

  useEffect(() => {
    setNotificationFilter('all');
  }, [currentUser?.id, currentUser?.accountStatus]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredNotifications = filterLoadedNotifications(notifications, notificationFilter);

  return (
    <div
      ref={notificationsMenuRef}
      className="relative"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setShowNotifications(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setShowNotifications(false);
      }}
    >
      <button
        type="button"
        onClick={() => setShowNotifications(!showNotifications)}
        aria-label={t('notifications')}
        aria-expanded={showNotifications}
        aria-controls="navbar-notifications"
        className="relative p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 end-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
            {unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <div id="navbar-notifications" className="absolute end-0 top-full pt-2 w-80 max-w-[calc(100vw-2rem)] z-50">
          <div ref={notificationsScrollRef} role="region" tabIndex={0} aria-label={t('notifications')} className="max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain bg-white dark:bg-[#111111] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-k-brand">
            <div className="px-4 pb-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                {t('notifications')}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-k-brand font-medium">
                  {unreadCount} {t('unread')}
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    disabled={markingAllNotifications}
                    onClick={markAllNotificationsRead}
                    title={pickText(
                      { ar: 'تحديد الكل كمقروء', fr: 'Tout lire', en: 'Mark all read', es: 'Marcar todo leído', de: 'Alle als gelesen markieren', pt: 'Marcar tudo lido' },
                      language,
                    )}
                    className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="px-3 pt-2" aria-label={pickText({ ar: 'تصفية الإشعارات', fr: 'Filtrer les notifications', en: 'Filter notifications', es: 'Filtrar notificaciones', de: 'Benachrichtigungen filtern', pt: 'Filtrar notificações' }, language)} role="group">
              <div className="flex gap-1.5 overflow-x-auto pb-1" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                {(['all', ...NOTIFICATION_CATEGORIES] as NotificationFilter[]).map((category) => (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={notificationFilter === category}
                    onClick={() => setNotificationFilter(category)}
                    className={notificationFilter === category
                      ? 'shrink-0 rounded-full bg-k-brand px-2.5 py-1 text-[11px] font-semibold text-white'
                      : 'shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'}
                  >
                    {pickText(NOTIFICATION_FILTER_LABELS[category], language)}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                {pickText({ ar: 'التصفية تشمل آخر 40 إشعاراً محمّلاً كحد أقصى', fr: 'Filtres sur les 40 dernières notifications chargées au maximum', en: 'Filters apply to up to 40 most recent loaded notifications', es: 'Los filtros aplican a las últimas 40 notificaciones cargadas como máximo', de: 'Filter gelten für bis zu 40 zuletzt geladene Benachrichtigungen', pt: 'Os filtros aplicam-se até às 40 notificações mais recentes carregadas' }, language)}
              </p>
            </div>
            {notificationsError && (
              <div
                role="alert"
                data-testid="notifications-error-alert"
                className="mx-3 mt-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-[11px] font-semibold text-red-700 dark:text-red-300 flex items-center justify-between gap-2"
              >
                <span>{notificationsError}</span>
                <button
                  type="button"
                  onClick={() => void refreshSchoolData()}
                  className="rounded-md bg-red-700 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-red-800 shrink-0"
                >
                  {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
                </button>
              </div>
            )}
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredNotifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  {notificationsError
                    ? pickText({ ar: 'تعذر تحميل الإشعارات', fr: 'Notifications indisponibles', en: 'Notifications unavailable', es: 'Notificaciones no disponibles', de: 'Benachrichtigungen nicht verfügbar', pt: 'Notificações indisponíveis' }, language)
                    : notifications.length === 0
                      ? t('noNotifications')
                      : pickText({ ar: 'لا توجد إشعارات في هذه الفئة ضمن العناصر المحمّلة', fr: 'Aucune notification de cette catégorie parmi les éléments chargés', en: 'No notifications in this category among loaded items', es: 'No hay notificaciones en esta categoría entre los elementos cargados', de: 'Keine Benachrichtigungen in dieser Kategorie unter den geladenen Einträgen', pt: 'Sem notificações nesta categoria entre os itens carregados' }, language)}
                </div>
              ) : (
                filteredNotifications.map((n) => {
                  const isBusy = markingAllNotifications || markingNotificationIds.includes(n.id);
                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (!n.read && !isBusy) {
                          markNotificationRead(n.id);
                        }
                        if (onNavigateToNotificationTarget?.(n)) {
                          setShowNotifications(false);
                        } else if (n.targetTab === 'calendar' && canAccessAppTab(currentUser, 'announcements')) {
                          if (onNavigateToSubTab) {
                            onNavigateToSubTab('announcements', 'calendar');
                          } else if (setActiveTab) {
                            setActiveTab('announcements');
                          }
                          setShowNotifications(false);
                        } else if (n.targetTab && canAccessAppTab(currentUser, n.targetTab as AppTab)) {
                          if (setActiveTab) {
                            setActiveTab(n.targetTab);
                          }
                          setShowNotifications(false);
                        }
                      }}
                      className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer ${
                        !n.read ? 'bg-k-brand/10 dark:bg-k-brand/10' : ''
                      } ${isBusy ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-gray-900 dark:text-white">
                          {n.title}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {isBusy ? t('loading') : n.time}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{n.message}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
