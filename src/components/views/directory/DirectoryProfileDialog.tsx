import React from 'react';
import { pickText } from '../../../i18n/homepages';
import type { AdminDirectoryMember, Language, TeacherDirectoryMember } from '../../../types';
import { X } from 'lucide-react';

interface DirectoryProfileDialogProps {
  detailDialogRef: React.RefObject<HTMLDialogElement | null>;
  language: Language;
  selectedMember: TeacherDirectoryMember | AdminDirectoryMember | undefined;
  selectedTeacher: TeacherDirectoryMember | undefined;
  detailTags: string[];
  detailLanguages: string[];
  canManage: boolean;
  onClose: () => void;
  onClearSelection: () => void;
}

export const DirectoryProfileDialog: React.FC<DirectoryProfileDialogProps> = ({
  detailDialogRef,
  language,
  selectedMember,
  selectedTeacher,
  detailTags,
  detailLanguages,
  canManage,
  onClose,
  onClearSelection,
}) => (
  <dialog
    ref={detailDialogRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="directory-detail-title"
    dir={language === 'ar' ? 'rtl' : 'ltr'}
    onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const dialog = event.currentTarget;
      const controls = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }}
    onClose={onClose}
    onCancel={onClearSelection}
    data-testid="directory-detail-dialog"
    className="m-auto w-[calc(100%-2rem)] max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-gray-200 bg-white p-5 sm:p-7 text-gray-900 shadow-2xl backdrop:bg-gray-950/70 dark:border-gray-800 dark:bg-[#111111] dark:text-white"
  >
    {selectedMember && (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <h2 id="directory-detail-title" className="text-xl font-extrabold leading-snug break-words">
            {selectedMember.name}
          </h2>
          <button
            type="button"
            data-testid="directory-detail-close"
            onClick={onClose}
            aria-label={pickText({ ar: 'إغلاق التفاصيل', fr: 'Fermer le profil', en: 'Close profile', es: 'Cerrar perfil', de: 'Profil schließen', pt: 'Fechar perfil' }, language)}
            className="rounded-xl p-2 shrink-0 text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {selectedMember.isPublished !== true && canManage && (
          <p data-testid="directory-unpublished-preview" className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {pickText({
              ar: 'معاينة إدارية — هذه البطاقة غير منشورة للزوار.',
              fr: 'Aperçu de gestion — cette fiche n’est pas publique.',
              en: 'Management preview — this profile is not published to visitors.',
              es: 'Vista de gestión — este perfil no está publicado para visitantes.',
              de: 'Verwaltungsvorschau — dieses Profil ist für Besucher nicht veröffentlicht.',
              pt: 'Pré-visualização de gestão — este perfil não está publicado para visitantes.',
            }, language)}
          </p>
        )}
        <div className="flex items-start gap-4">
          <img
            src={selectedMember.photoUrl || '/assets/kristou-logo.png'}
            onError={(event) => {
              if (!event.currentTarget.src.endsWith('/assets/kristou-logo.png')) {
                event.currentTarget.src = '/assets/kristou-logo.png';
              }
            }}
            alt={selectedMember.name}
            className="h-24 w-24 shrink-0 rounded-2xl border-2 border-blue-500 object-cover sm:h-28 sm:w-28"
          />
          <div className="min-w-0">
            {selectedMember.title && <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 break-words">{selectedMember.title}</p>}
            {detailLanguages.length > 0 && (
              <p className="mt-3 text-xs leading-relaxed">
                <strong>{pickText({ ar: 'اللغات', fr: 'Langues', en: 'Languages', es: 'Idiomas', de: 'Sprachen', pt: 'Idiomas' }, language)}: </strong>
                {detailLanguages.join(' · ')}
              </p>
            )}
          </div>
        </div>
        {selectedMember.bio && <p className="text-sm leading-7 whitespace-pre-wrap break-words">{selectedMember.bio}</p>}
        {detailTags.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold">
              {selectedTeacher
                ? pickText({ ar: 'الأقسام والمواد', fr: 'Classes et disciplines', en: 'Classes and subjects', es: 'Clases y asignaturas', de: 'Klassen und Fächer', pt: 'Turmas e disciplinas' }, language)
                : pickText({ ar: 'المسؤوليات', fr: 'Responsabilités', en: 'Responsibilities', es: 'Responsabilidades', de: 'Zuständigkeiten', pt: 'Responsabilidades' }, language)}
            </h3>
            <div className="flex flex-wrap gap-2">
              {detailTags.map((item, index) => (
                <span key={index} className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">{item}</span>
              ))}
            </div>
          </section>
        )}
      </div>
    )}
  </dialog>
);
