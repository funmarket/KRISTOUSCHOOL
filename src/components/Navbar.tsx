import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AuthModal } from './AuthModal';
import {
  Bell,
  Globe,
  Moon,
  Sun,
  User as UserIcon,
  LogOut,
  Shield,
  Send,
  Menu,
  X,
  BookOpen,
  Utensils,
  GraduationCap,
  Users,
  Calendar,
  MessageSquare,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const {
    currentUser,
    currentRole,
    setCurrentRole,
    language,
    setLanguage,
    theme,
    setTheme,
    t,
    logout,
    notifications,
    markNotificationRead,
    connectTelegram,
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const rolesList: { role: any; label: string; icon: any }[] = [
    { role: 'PUBLIC', label: 'Visiteur Public', icon: Globe },
    { role: 'PARENT', label: 'Parent (Karim)', icon: Users },
    { role: 'STUDENT', label: 'Élève (Yasmine)', icon: GraduationCap },
    { role: 'TEACHER', label: 'Enseignante (Fatma)', icon: BookOpen },
    { role: 'MANAGER', label: 'Manager (Anis)', icon: ShieldCheck },
    { role: 'ADMIN', label: 'Admin Direction', icon: Shield },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-[#090909]/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-3 rtl:space-x-reverse cursor-pointer" onClick={() => setActiveTab('home')}>
          <div className="w-10 h-10 rounded-xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20">
            K
          </div>
          <div>
            <span className="font-bold text-gray-900 dark:text-white tracking-wide text-lg block leading-none">
              KRISTOU
            </span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              École Primaire Privée
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1 rtl:space-x-reverse text-sm font-medium text-gray-700 dark:text-gray-300">
          <button
            onClick={() => setActiveTab('home')}
            className={`px-3 py-2 rounded-lg transition-colors ${activeTab === 'home' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 font-semibold' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            {t('home')}
          </button>
          
          {(currentRole === 'PARENT' || currentRole === 'STUDENT' || currentRole === 'TEACHER' || currentRole === 'ADMIN') && (
            <button
              onClick={() => setActiveTab('community')}
              className={`px-3 py-2 rounded-lg transition-colors ${activeTab === 'community' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 font-semibold' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              {t('classCommunity')}
            </button>
          )}

          {(currentRole === 'PARENT' || currentRole === 'TEACHER' || currentRole === 'ADMIN') && (
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-3 py-2 rounded-lg transition-colors ${activeTab === 'notes' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 font-semibold' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              {t('parentNotes')}
            </button>
          )}

          {(currentRole === 'PARENT' || currentRole === 'TEACHER' || currentRole === 'MANAGER' || currentRole === 'ADMIN') && (
            <button
              onClick={() => setActiveTab('pickup')}
              className={`px-3 py-2 rounded-lg transition-colors flex items-center space-x-1 rtl:space-x-reverse ${activeTab === 'pickup' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 font-semibold' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{t('pickup')}</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('foodMenu')}
            className={`px-3 py-2 rounded-lg transition-colors ${activeTab === 'foodMenu' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 font-semibold' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            {t('foodMenu')}
          </button>

          <button
            onClick={() => setActiveTab('directory')}
            className={`px-3 py-2 rounded-lg transition-colors ${activeTab === 'directory' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 font-semibold' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            {t('teachers')}
          </button>
        </nav>

        {/* Right Actions: Language, Theme, Notifications, Profile, Role Switcher */}
        <div className="flex items-center space-x-2 rtl:space-x-reverse shrink-0">
          
          {/* Language Dropdown */}
          <div className="relative flex items-center">
            <select
              value={language}
              onChange={e => setLanguage(e.target.value as any)}
              className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-bold px-2 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer uppercase"
            >
              <option value="ar">AR</option>
              <option value="fr">FR</option>
              <option value="en">EN</option>
            </select>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'pitch-black' : 'light')}
            className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={theme === 'light' ? t('pitchBlack') : t('lightMode')}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
          </button>

          {/* Role Switcher Button */}
          <button
            onClick={() => setShowRoleModal(true)}
            className="hidden sm:flex items-center space-x-1 rtl:space-x-reverse px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-xs font-semibold rounded-xl border border-blue-200 dark:border-blue-900 transition-colors"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{currentRole}</span>
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#111111] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 py-3 z-50">
                <div className="px-4 pb-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">{t('notifications')}</h3>
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{unreadCount} non lues</span>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">Aucune notification</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => markNotificationRead(n.id)}
                        className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer ${!n.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-gray-900 dark:text-white">{n.title}</span>
                          <span className="text-[10px] text-gray-400">{n.time}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile / Auth */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-2 rtl:space-x-reverse p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <img
                  src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={currentUser.fullName}
                  className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                />
                <span className="hidden lg:inline text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {currentUser.fullName}
                </span>
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-64 bg-white dark:bg-[#111111] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <p className="font-bold text-sm text-gray-900 dark:text-white">{currentUser.fullName}</p>
                    <p className="text-xs text-gray-500 uppercase font-mono mt-0.5">{currentUser.role}</p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => { setActiveTab('home'); setShowProfileMenu(false); }}
                      className="w-full text-start px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 rtl:space-x-reverse"
                    >
                      <UserIcon className="w-4 h-4 text-gray-400" />
                      <span>Mon Profil & Enfants</span>
                    </button>
                    {!currentUser.telegramLinked && (
                      <button
                        onClick={() => { connectTelegram(); setShowProfileMenu(false); }}
                        className="w-full text-start px-4 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2 rtl:space-x-reverse"
                      >
                        <Send className="w-4 h-4" />
                        <span>{t('telegramConnect')}</span>
                      </button>
                    )}
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-800 py-1">
                    <button
                      onClick={() => { logout(); setShowProfileMenu(false); }}
                      className="w-full text-start px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center space-x-2 rtl:space-x-reverse"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t('logout')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
            >
              {t('login')}
            </button>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-[#111111] border-b border-gray-200 dark:border-gray-800 px-4 py-4 space-y-2">
          <button
            onClick={() => { setActiveTab('home'); setMobileMenuOpen(false); }}
            className="w-full text-start px-3 py-2 rounded-xl font-medium text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {t('home')}
          </button>
          <button
            onClick={() => { setActiveTab('community'); setMobileMenuOpen(false); }}
            className="w-full text-start px-3 py-2 rounded-xl font-medium text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {t('classCommunity')}
          </button>
          <button
            onClick={() => { setActiveTab('notes'); setMobileMenuOpen(false); }}
            className="w-full text-start px-3 py-2 rounded-xl font-medium text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {t('parentNotes')}
          </button>
          <button
            onClick={() => { setActiveTab('pickup'); setMobileMenuOpen(false); }}
            className="w-full text-start px-3 py-2 rounded-xl font-medium text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {t('pickup')}
          </button>
          <button
            onClick={() => { setActiveTab('foodMenu'); setMobileMenuOpen(false); }}
            className="w-full text-start px-3 py-2 rounded-xl font-medium text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {t('foodMenu')}
          </button>
          <button
            onClick={() => { setActiveTab('directory'); setMobileMenuOpen(false); }}
            className="w-full text-start px-3 py-2 rounded-xl font-medium text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {t('teachers')}
          </button>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => { setShowRoleModal(true); setMobileMenuOpen(false); }}
              className="w-full text-start px-3 py-2 rounded-xl font-semibold text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 flex items-center space-x-2 rtl:space-x-reverse"
            >
              <Shield className="w-4 h-4" />
              <span>Changer de rôle (Rôle actuel: {currentRole})</span>
            </button>
          </div>
        </div>
      )}

      {/* Role Switcher Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111111] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Sélectionner un Rôle</h3>
              <button onClick={() => setShowRoleModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Testez instantanément l'application depuis différentes perspectives d'utilisateurs selon les exigences de KRISTOU SCHOOL.
            </p>
            <div className="space-y-2">
              {rolesList.map(r => {
                const IconComponent = r.icon;
                const isSelected = currentRole === r.role;
                return (
                  <button
                    key={r.role}
                    onClick={() => {
                      setCurrentRole(r.role);
                      setShowRoleModal(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all ${isSelected ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold' : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-800 dark:text-gray-200'}`}
                  >
                    <div className="flex items-center space-x-3 rtl:space-x-reverse">
                      <div className={`p-2 rounded-xl ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <span className="text-sm">{r.label}</span>
                    </div>
                    {isSelected && <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </header>
  );
};
