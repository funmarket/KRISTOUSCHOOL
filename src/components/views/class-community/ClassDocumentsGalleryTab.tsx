import React from 'react';
import { FileText, ImageIcon, Lock, ExternalLink } from 'lucide-react';
import { pickText } from '../../../i18n/homepages';
import { isSafeExternalOrAssetUrl } from '../../../lib/schoolContent';
import type { useClassCommunityView } from './useClassCommunityView';

export interface ClassDocumentsGalleryTabProps {
  vm: ReturnType<typeof useClassCommunityView>;
}

export const ClassDocumentsTab: React.FC<ClassDocumentsGalleryTabProps> = ({ vm }) => {
  const { language, canModerate, activeClass, scopedDocuments, communityStatus } = vm;

  return (
    <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
          <FileText className="w-4 h-4" />
          <span>
            {language === 'ar'
              ? `وثائق ومطبوعات القسم${activeClass ? ` (${activeClass.name})` : ''}`
              : language === 'fr'
              ? `Documents pédagogiques de la classe${activeClass ? ` (${activeClass.name})` : ''}`
              : `Class Documents & Learning Materials${activeClass ? ` (${activeClass.name})` : ''}`}
          </span>
        </div>

        {canModerate && activeClass && (
          <button
            type="button"
            disabled
            data-testid="class-documents-upload-disabled-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-200 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs font-bold cursor-not-allowed"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>
              {pickText(
                { ar: 'رفع وثيقة (مقفل)', fr: 'Importer document (verrouillé)', en: 'Upload Document (Locked)' },
                language,
              )}
            </span>
          </button>
        )}
      </div>

      {canModerate && activeClass && (
        <div
          data-testid="class-documents-blocked-actions"
          className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 font-medium"
        >
          {pickText(
            {
              ar: 'إضافة وحذف وثائق القسم غير متاحين حالياً لأن خدمة تحميل الملفات لم تُفعّل بعد. يمكنك الاطلاع على الوثائق المتاحة أدناه.',
              fr: 'L’ajout et la suppression de documents sont actuellement indisponibles car le service de téléversement n’est pas encore activé. Vous pouvez consulter les documents existants ci-dessous.',
              en: 'Uploading and deleting class documents is currently unavailable because the file upload service is not yet enabled. You can still view existing documents below.',
            },
            language,
          )}
        </div>
      )}

      {scopedDocuments.length === 0 ? (
        <p className="text-xs text-gray-500">
          {communityStatus === 'BLOCKED_BACKEND'
            ? pickText(
                {
                  ar: 'مكتبة وثائق القسم بانتظار النشر في Supabase (class_documents).',
                  fr: 'Les documents de classe attendent le déploiement de class_documents sur Supabase.',
                  en: 'Class documents are awaiting public.class_documents deployment on Supabase.',
                },
                language,
              )
            : pickText(
                { ar: 'لا توجد وثائق مرفقة لهذا القسم حالياً.', fr: 'Aucun document publié pour cette classe.', en: 'No documents published for this class yet.' },
                language,
              )}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scopedDocuments.map((doc) => {
            const safeUrl = isSafeExternalOrAssetUrl(doc.documentUrl);
            if (!safeUrl) {
              return (
                <div
                  key={doc.id}
                  data-testid={`class-document-unsafe-blocked-${doc.id}`}
                  className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 flex items-start justify-between gap-3"
                >
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300">
                      {doc.fileType} • {pickText({ ar: 'رابط محجوب', fr: 'Lien bloqué', en: 'Unsafe URL blocked' }, language)}
                    </span>
                    <h4 className="font-bold text-xs text-gray-900 dark:text-white mt-1.5">{doc.title}</h4>
                    {doc.description && <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>}
                  </div>
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                </div>
              );
            }
            return (
              <a
                key={doc.id}
                href={doc.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-2xl border border-gray-200 dark:border-zinc-800 hover:border-blue-500 transition-colors flex items-start justify-between gap-3"
              >
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                    {doc.fileType}
                  </span>
                  <h4 className="font-bold text-xs text-gray-900 dark:text-white mt-1.5">{doc.title}</h4>
                  {doc.description && <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>}
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const ClassGalleryTab: React.FC<ClassDocumentsGalleryTabProps> = ({ vm }) => {
  const { language, canModerate, activeClass, scopedGallery, communityStatus } = vm;

  return (
    <div className="bg-white dark:bg-[#111111] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
          <ImageIcon className="w-4 h-4" />
          <span>
            {language === 'ar'
              ? 'معرض أنشطة القسم والمدرسة'
              : language === 'fr'
              ? 'Galerie des activités scolaires'
              : 'Class & School Activity Gallery'}
          </span>
        </div>

        {canModerate && activeClass && (
          <button
            type="button"
            disabled
            data-testid="class-gallery-upload-disabled-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-200 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 text-xs font-bold cursor-not-allowed"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>
              {pickText(
                { ar: 'إضافة صورة (مقفل)', fr: 'Ajouter photo (verrouillé)', en: 'Upload Photo (Locked)' },
                language,
              )}
            </span>
          </button>
        )}
      </div>

      {canModerate && activeClass && (
        <div
          data-testid="class-gallery-blocked-actions"
          className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 font-medium"
        >
          {pickText(
            {
              ar: 'إضافة وحذف صور المعرض غير متاحين حالياً لأن خدمة رفع الصور لم تُفعّل بعد. يمكنك تصفح الصور المعتمدة أدناه.',
              fr: 'L’ajout et la suppression de photos sont actuellement indisponibles car le service d’envoi d’images n’est pas encore activé. Vous pouvez consulter la galerie ci-dessous.',
              en: 'Uploading and deleting gallery photos is currently unavailable because the image upload service is not yet enabled. You can still view published photos below.',
            },
            language,
          )}
        </div>
      )}

      {scopedGallery.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {scopedGallery.map((item) => {
            const safeImage = isSafeExternalOrAssetUrl(item.imageUrl);
            return (
              <figure key={item.id} className="space-y-2">
                {safeImage ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="rounded-2xl object-cover aspect-[4/3] w-full border border-gray-200 dark:border-gray-800"
                  />
                ) : (
                  <div
                    data-testid={`class-gallery-unsafe-blocked-${item.id}`}
                    className="rounded-2xl aspect-[4/3] w-full border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 flex items-center justify-center p-4 text-center text-xs font-bold text-amber-800 dark:text-amber-300"
                  >
                    {pickText({ ar: 'تم حجب رابط صورة غير آمن', fr: 'URL image non sécurisée bloquée', en: 'Unsafe image URL blocked' }, language)}
                  </div>
                )}
                <figcaption className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {item.title}
                </figcaption>
              </figure>
            );
          })}
        </div>
      ) : communityStatus === 'BLOCKED_BACKEND' ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            {pickText(
              {
                ar: 'معرض صور القسم بانتظار التفعيل في الخادم — يتم عرض صور الحرم المدرسي المعتمدة فقط.',
                fr: 'La galerie de classe attend le contrat serveur — aperçu campus affiché.',
                en: 'Class gallery is awaiting backend deployment — verified campus photos shown below.',
              },
              language,
            )}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              '/assets/kristou-home/hero-schoolchildren.png',
              '/assets/kristou-home/school-building.png',
              '/assets/kristou-home/enrollment-children.png',
            ].map((src, i) => (
              <div key={src} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 aspect-[4/3] bg-slate-100 dark:bg-zinc-900">
                <img src={src} alt={`Campus preview ${i + 1}`} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          {pickText({ ar: 'لا توجد صور منشورة في معرض القسم حالياً.', fr: 'Aucune photo publiée pour cette classe.', en: 'No gallery photos published for this class yet.' }, language)}
        </p>
      )}
    </div>
  );
};
