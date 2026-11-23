import React from 'react';
import type { useApp } from '../../../context/AppContext';
import { pickText } from '../../../i18n/homepages';
import type { Language } from '../../../types';
import { HomeSection } from '../shared/HomeSection';
import type { PublicInquiryFormState } from './usePublicHomePage';

export interface PublicInquiryContactSectionProps {
  language: Language;
  t: ReturnType<typeof useApp>['t'];
  contactSectionRef: React.RefObject<HTMLDivElement | null>;
  pickPublicEntry: (slug: string, field: 'title' | 'body') => string | null;
  inquiryForm: PublicInquiryFormState;
  setInquiryForm: React.Dispatch<React.SetStateAction<PublicInquiryFormState>>;
  inquirySubmitting: boolean;
  inquiryFeedback: { type: 'success' | 'error'; message: string } | null;
  handleInquirySubmit: (e: React.FormEvent) => Promise<void>;
}

export const PublicInquiryContactSection: React.FC<PublicInquiryContactSectionProps> = ({
  language,
  t,
  contactSectionRef,
  pickPublicEntry,
  inquiryForm,
  setInquiryForm,
  inquirySubmitting,
  inquiryFeedback,
  handleInquirySubmit,
}) => {
  return (
    <div ref={contactSectionRef}>
      <HomeSection
        title={
          pickPublicEntry('contact', 'title') ??
          pickText(
            {
              ar: `معلومات الاتصال — ${t('school')}`,
              fr: `Coordonnées — ${t('school')}`,
              en: `Contact & Location — ${t('school')}`,
            },
            language,
          )
        }
      >
        <div className="kh-info-panel">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <strong className="block text-[#1E3A6D] dark:text-white mb-1">
                📍 {pickText({ ar: 'الموقع', fr: 'Localisation', en: 'Location' }, language)}
              </strong>
              <span className="kh-info-panel-body">
                {t('school')} — {t('tunis')}
              </span>
            </div>
            <div>
              <strong className="block text-[#1E3A6D] dark:text-white mb-1">
                📞{' '}
                {pickText(
                  {
                    ar: 'الاستقبال والإدارة',
                    fr: 'Accueil & Secrétariat',
                    en: 'Reception & Office',
                  },
                  language,
                )}
              </strong>
              <span className="kh-info-panel-body">
                {pickPublicEntry('contact', 'body') ??
                  pickText(
                    {
                      ar: 'بيانات الهاتف والعنوان التفصيلي تُنشر بعد التحديث الرسمي من إدارة المدرسة.',
                      fr: 'Les coordonnées téléphoniques et l’adresse précise sont publiées après validation officielle par la direction.',
                      en: 'Official street address and reception telephone details are published upon school administration verification.',
                    },
                    language,
                  )}
              </span>
            </div>
            <div>
              <strong className="block text-[#1E3A6D] dark:text-white mb-1">
                📋{' '}
                {pickText(
                  { ar: 'القبول والتسجيل', fr: 'Inscriptions', en: 'Admissions' },
                  language,
                )}
              </strong>
              <span className="kh-info-panel-body">{t('enrollmentTitle')}</span>
            </div>
          </div>

          <form
            onSubmit={(e) => void handleInquirySubmit(e)}
            className="mt-5 pt-5 border-t border-slate-200 dark:border-zinc-800 space-y-3"
          >
            <h3 className="text-sm font-extrabold text-[#1E3A6D] dark:text-white">
              {pickText(
                {
                  ar: 'إرسال استفسار لإدارة المدرسة',
                  fr: 'Envoyer une demande d’information au secrétariat',
                  en: 'Send a Public School Inquiry',
                },
                language,
              )}
            </h3>

            {inquiryFeedback && (
              <div
                role="alert"
                className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                  inquiryFeedback.type === 'success'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                    : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
                }`}
              >
                {inquiryFeedback.message}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                required
                value={inquiryForm.senderName}
                onChange={(e) => setInquiryForm((p) => ({ ...p, senderName: e.target.value }))}
                placeholder={pickText(
                  { ar: 'الاسم الكامل', fr: 'Nom complet', en: 'Your full name' },
                  language,
                )}
                className="rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs"
              />
              <input
                type="tel"
                value={inquiryForm.phone}
                onChange={(e) => setInquiryForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder={pickText(
                  {
                    ar: 'رقم الهاتف (اختياري)',
                    fr: 'Téléphone (optionnel)',
                    en: 'Phone (optional)',
                  },
                  language,
                )}
                className="rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs"
              />
              <input
                type="email"
                value={inquiryForm.email}
                onChange={(e) => setInquiryForm((p) => ({ ...p, email: e.target.value }))}
                placeholder={pickText(
                  {
                    ar: 'البريد الإلكتروني (اختياري)',
                    fr: 'E-mail (optionnel)',
                    en: 'Email (optional)',
                  },
                  language,
                )}
                className="rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs"
              />
            </div>
            <input
              type="text"
              required
              value={inquiryForm.subject}
              onChange={(e) => setInquiryForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder={pickText(
                { ar: 'الموضوع', fr: 'Objet de la demande', en: 'Subject' },
                language,
              )}
              className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs"
            />
            <textarea
              rows={3}
              required
              value={inquiryForm.message}
              onChange={(e) => setInquiryForm((p) => ({ ...p, message: e.target.value }))}
              placeholder={pickText(
                {
                  ar: 'نص الاستفسار...',
                  fr: 'Votre message...',
                  en: 'Your question or message...',
                },
                language,
              )}
              className="w-full rounded-xl border border-slate-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs"
            />
            <button
              type="submit"
              disabled={inquirySubmitting}
              className="rounded-xl bg-[#0D8AE8] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#0B76C7] disabled:opacity-50"
            >
              {inquirySubmitting
                ? t('loading')
                : pickText(
                    {
                      ar: 'إرسال الاستفسار',
                      fr: 'Envoyer la demande',
                      en: 'Submit Inquiry',
                    },
                    language,
                  )}
            </button>
          </form>
        </div>
      </HomeSection>
    </div>
  );
};
