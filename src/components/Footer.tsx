import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, MapPin, Phone, Mail } from 'lucide-react';

export const Footer: React.FC = () => {
  const { t } = useApp();

  return (
    <footer className="bg-white dark:bg-[#090909] border-t border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 py-12 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        
        {/* Col 1 */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <img
              src="/public/assets/kristou-logo.png"
              alt="KRISTOU SCHOOL"
              className="w-9 h-9 rounded-xl object-contain bg-white dark:bg-gray-800 p-0.5 shadow-md border border-gray-200 dark:border-gray-700 shrink-0"
            />
            <span className="font-bold text-gray-900 dark:text-white text-base">
              KRISTOU SCHOOL
            </span>
          </div>
          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            École Primaire Privée Kristou School. Plateforme numérique unifiée pour l'administration, les enseignants, les parents et les élèves.
          </p>
          <div className="flex items-center space-x-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>Supabase PostgreSQL & Sécurité Active</span>
          </div>
        </div>

        {/* Col 2: Navigation */}
        <div>
          <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-3">Navigation</h4>
          <ul className="space-y-2 text-xs font-medium">
            <li><a href="#home" className="hover:text-blue-600 transition-colors">{t('home')}</a></li>
            <li><a href="#directory" className="hover:text-blue-600 transition-colors">{t('teachers')}</a></li>
            <li><a href="#foodMenu" className="hover:text-blue-600 transition-colors">{t('foodMenu')}</a></li>
            <li><a href="#registration" className="hover:text-blue-600 transition-colors">{t('registration')}</a></li>
          </ul>
        </div>

        {/* Col 3: Contact */}
        <div>
          <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-3">Contact & Localisation</h4>
          <ul className="space-y-2.5 text-xs">
            <li className="flex items-center space-x-2 rtl:space-x-reverse">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Tunis, Tunisie</span>
            </li>
            <li className="flex items-center space-x-2 rtl:space-x-reverse">
              <Phone className="w-4 h-4 text-blue-600 shrink-0" />
              <span>+216 71 000 000</span>
            </li>
            <li className="flex items-center space-x-2 rtl:space-x-reverse">
              <Mail className="w-4 h-4 text-blue-600 shrink-0" />
              <span>contact@kristou.edu.tn</span>
            </li>
          </ul>
        </div>

        {/* Col 4: Telegram & Web */}
        <div>
          <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-3">Accès Multi-Plateforme</h4>
          <p className="text-xs text-gray-500 mb-3">
            Accessible via Navigateur Web et Telegram Mini App avec la même base de données canonique sécurisée.
          </p>
          <div className="inline-flex items-center space-x-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-xl text-xs font-semibold">
            <span>🌐 Web & Telegram Sync</span>
          </div>
        </div>

      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} KRISTOU SCHOOL. Tous droits réservés.
      </div>
    </footer>
  );
};
