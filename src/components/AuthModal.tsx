import React from 'react';
import { useApp } from '../context/AppContext';
import { X, LockKeyhole } from 'lucide-react';

export const AuthModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { language, t } = useApp();

  // R1 containment only: do not present mock credentials or fake a valid session.
  // R2 will reconnect this entry point to verified, administrator-approved accounts.
  const unavailableMessage = {
    ar: 'تسجيل الدخول إلى الحسابات المدرسية غير متاح حالياً. لا يمكن تفعيل أي حساب أو صلاحية دون التحقق والموافقة من إدارة التطبيق.',
    fr: "La connexion aux comptes scolaires n'est pas encore disponible. Aucun compte ni rôle protégé ne peut être activé sans vérification et approbation de l'administration.",
    en: 'School account sign-in is not available yet. No protected account or role can be activated without verification and administrator approval.',
  }[language];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="kristou-signin-title" className="bg-white dark:bg-[#111111] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label={language === 'ar' ? 'إغلاق' : language === 'en' ? 'Close' : 'Fermer'}
          className="absolute top-4 end-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <img
            src="/assets/kristou-logo.png"
            alt="KRISTOU SCHOOL"
            className="w-14 h-14 rounded-2xl object-contain bg-white dark:bg-gray-800 p-1 mx-auto mb-3 shadow-md border border-gray-200 dark:border-gray-700"
          />
          <h2 id="kristou-signin-title" className="text-xl font-bold text-gray-900 dark:text-white">{t('login')}</h2>
          <p className="text-xs text-gray-500 mt-1">École Primaire Privée Kristou School</p>
        </div>

        <div role="status" className="rounded-2xl border border-k-brand/25 bg-k-brand/10 dark:bg-k-brand/15 p-5 text-center">
          <LockKeyhole className="w-7 h-7 mx-auto mb-3 text-k-brand" />
          <p className="text-sm leading-relaxed font-medium text-gray-800 dark:text-gray-100">{unavailableMessage}</p>
        </div>
      </div>
    </div>
  );
};
