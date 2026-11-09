import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  Bell,
  Users,
  BookOpen,
  Calendar,
  Utensils,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Send,
  CheckCircle2,
} from 'lucide-react';

interface HomeViewProps {
  setActiveTab: (tab: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ setActiveTab }) => {
  const { currentUser, currentRole, childrenList, announcements, foodMenu, t } = useApp();

  const userChildren = childrenList.filter(c => currentUser?.linkedChildrenIds?.includes(c.id));

  return (
    <div className="space-y-8 pb-12">
      
      {/* Hero Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-k-brand via-k-brand to-k-brand-strong text-white p-6 sm:p-10 overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>École Primaire Privée Kristou School</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3">
            {t('appName')}
          </h1>
          <p className="text-sm sm:text-base text-white/90 mb-6 leading-relaxed">
            {t('tagline')} — Un environnement numérique unifié pour l'éducation, la sécurité des élèves et la communication fluide entre parents, enseignants et administration.
          </p>

          <div className="flex flex-wrap gap-3">
            {currentRole === 'PARENT' && (
              <button
                onClick={() => setActiveTab('pickup')}
                className="px-5 py-2.5 bg-white text-k-brand-strong font-bold text-xs sm:text-sm rounded-xl shadow-lg hover:bg-white/90 transition-all flex items-center space-x-2 rtl:space-x-reverse"
              >
                <span>{t('pickup')}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            )}
            <button
              onClick={() => setActiveTab('community')}
              className="px-5 py-2.5 bg-k-brand-strong/75 hover:bg-k-brand-strong text-white font-semibold text-xs sm:text-sm rounded-xl border border-white/25 backdrop-blur-xs transition-all flex items-center space-x-2 rtl:space-x-reverse"
            >
              <span>{t('classCommunity')}</span>
            </button>
            <button
              onClick={() => setActiveTab('foodMenu')}
              className="px-5 py-2.5 bg-k-brand-strong/75 hover:bg-k-brand-strong text-white font-semibold text-xs sm:text-sm rounded-xl border border-white/25 backdrop-blur-xs transition-all flex items-center space-x-2 rtl:space-x-reverse"
            >
              <span>{t('foodMenu')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Role-Specific Quick Cards */}
      {currentRole === 'PARENT' && userChildren.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2 rtl:space-x-reverse">
            <Users className="w-5 h-5 text-blue-600" />
            <span>{t('myChildren')}</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {userChildren.map(child => (
              <div
                key={child.id}
                className="bg-white dark:bg-[#111111] p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center space-x-4 rtl:space-x-reverse"
              >
                <img
                  src={child.photoUrl}
                  alt={child.fullName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-blue-500 shadow-md"
                />
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 dark:text-white text-base">{child.fullName}</h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5">{child.className}</p>
                  <p className="text-xs text-gray-500 mt-1">Niveau: {child.level}</p>
                </div>
                <button
                  onClick={() => setActiveTab('pickup')}
                  className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-semibold text-xs rounded-xl hover:bg-emerald-100 transition-colors"
                >
                  Pickup
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Announcements & Food Menu Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Announcements */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center space-x-2 rtl:space-x-reverse">
              <Bell className="w-5 h-5 text-blue-600" />
              <span>{t('announcements')}</span>
            </h3>
            <button
              onClick={() => setActiveTab('community')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Voir tout
            </button>
          </div>

          <div className="space-y-3">
            {announcements.map(ann => (
              <div
                key={ann.id}
                className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">
                    {ann.authorRole} • {ann.authorName}
                  </span>
                  {ann.priority === 'URGENT' && (
                    <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-lg text-[10px] font-bold">
                      URGENT
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">{ann.title}</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{ann.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Food Menu Preview */}
        <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center space-x-2 rtl:space-x-reverse">
                <Utensils className="w-5 h-5 text-amber-500" />
                <span>{t('foodMenu')}</span>
              </h3>
              <span className="text-[10px] bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-lg font-bold">
                La Toque Gourmande
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">{foodMenu.weekRange}</p>

            <div className="space-y-3">
              {foodMenu.items.slice(0, 3).map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div className="font-bold text-xs text-blue-600 dark:text-blue-400 mb-1">{item.day}</div>
                  <div className="text-xs text-gray-800 dark:text-gray-200 font-medium">{item.main}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{item.dessert}</div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('foodMenu')}
            className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold text-xs rounded-xl transition-colors text-center mt-4"
          >
            Voir le menu complet de la semaine
          </button>
        </div>

      </div>

    </div>
  );
};
