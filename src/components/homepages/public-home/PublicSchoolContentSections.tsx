import React from 'react';
import { Globe, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import type { useApp } from '../../../context/AppContext';
import { pickText } from '../../../i18n/homepages';
import type { Announcement, Language } from '../../../types';
import { HomeSection } from '../shared/HomeSection';
import { PUBLIC_CAMPUS_PHOTOS } from './usePublicHomePage';

export interface PublicSchoolContentSectionsProps {
  language: Language;
  t: ReturnType<typeof useApp>['t'];
  publicContentStatus: string;
  publicContentError: string | null;
  publicContentHasError: boolean;
  canManagePublicContent: boolean;
  publishedCmsSlugs: string[];
  broadcastsStatus: string;
  broadcastsHasError: boolean;
  isAnnouncementsDemo: boolean;
  publicAnnouncements: Announcement[];
  pickPublicEntry: (slug: string, field: 'title' | 'body') => string | null;
  refreshSchoolData?: () => Promise<boolean>;
  levelsSectionRef: React.RefObject<HTMLDivElement | null>;
  activitiesSectionRef: React.RefObject<HTMLDivElement | null>;
  gallerySectionRef: React.RefObject<HTMLDivElement | null>;
  announcementsSectionRef: React.RefObject<HTMLDivElement | null>;
  serviceCardsGrid: React.ReactNode;
}

export const PublicSchoolContentSections: React.FC<PublicSchoolContentSectionsProps> = ({
  language,
  t,
  publicContentStatus,
  publicContentError,
  publicContentHasError,
  canManagePublicContent,
  publishedCmsSlugs,
  broadcastsStatus,
  broadcastsHasError,
  isAnnouncementsDemo,
  publicAnnouncements,
  pickPublicEntry,
  refreshSchoolData,
  levelsSectionRef,
  activitiesSectionRef,
  gallerySectionRef,
  announcementsSectionRef,
  serviceCardsGrid,
}) => {
  return (
    <>
      {publicContentHasError && (
        <div
          role="alert"
          data-testid="public-content-error-banner"
          className="mb-4 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300 flex flex-wrap items-center justify-between gap-3"
        >
          <span>
            {publicContentError ||
              pickText({ ar: 'تعذر تحميل نصوص الموقع العام المعتمدة من الخادم.', fr: 'Impossible de charger le contenu public officiel depuis le serveur.', en: 'Unable to load school-approved public content from server.', es: 'No se pudo cargar el contenido público oficial del servidor.', de: 'Offizielle öffentliche Inhalte konnten nicht vom Server geladen werden.', pt: 'Não foi possível carregar o conteúdo público oficial do servidor.' }, language)}
          </span>
          {typeof refreshSchoolData === 'function' && (
            <button
              type="button"
              onClick={() => void refreshSchoolData()}
              className="rounded-xl bg-red-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-800 shrink-0"
            >
              {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
            </button>
          )}
        </div>
      )}

      {canManagePublicContent && (
        <div
          data-testid="public-cms-management-banner"
          className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/90 dark:border-amber-900 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 space-y-1.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="font-extrabold">
              {pickText({ ar: 'إدارة المحتوى العام (قراءة فقط)', fr: 'Gestion du contenu public (lecture seule)', en: 'Public Content Management (Read-Only)', es: 'Gestión de contenido público (solo lectura)', de: 'Öffentliche Inhaltsverwaltung (Nur Lesen)', pt: 'Gestão de conteúdo público (só leitura)' }, language)}
            </strong>
            <div className="flex items-center gap-2">
              <span
                data-testid="public-cms-status-badge"
                className="rounded-lg bg-amber-200/70 dark:bg-amber-900/60 px-2 py-0.5 text-[10px] font-extrabold uppercase"
              >
                {publicContentStatus === 'READY'
                  ? pickText({ ar: `منشور: ${publishedCmsSlugs.length}`, fr: `Publiés : ${publishedCmsSlugs.length}`, en: `Published: ${publishedCmsSlugs.length}`, es: `Publicados: ${publishedCmsSlugs.length}`, de: `Veröffentlicht: ${publishedCmsSlugs.length}`, pt: `Publicados: ${publishedCmsSlugs.length}` }, language)
                  : publicContentStatus === 'ERROR'
                  ? pickText({ ar: 'تعذر التحميل', fr: 'Échec du chargement', en: 'Loading Failed', es: 'Error al cargar', de: 'Laden fehlgeschlagen', pt: 'Falha ao carregar' }, language)
                  : publicContentStatus === 'UNAUTHORIZED'
                  ? pickText({ ar: 'غير مصرح', fr: 'Accès refusé', en: 'Access Denied', es: 'Acceso denegado', de: 'Zugriff verweigert', pt: 'Acesso negado' }, language)
                  : pickText({ ar: 'غير متاح حالياً', fr: 'Service indisponible', en: 'Feature Unavailable', es: 'Función no disponible', de: 'Funktion nicht verfügbar', pt: 'Funcionalidade indisponível' }, language)}
              </span>
              {publicContentStatus === 'ERROR' && typeof refreshSchoolData === 'function' && (
                <button
                  type="button"
                  data-testid="public-cms-retry-btn"
                  onClick={() => void refreshSchoolData()}
                  className="rounded-lg bg-red-700 px-2.5 py-0.5 text-[10px] font-bold text-white hover:bg-red-800"
                >
                  {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] font-medium">
            {publicContentStatus === 'ERROR'
              ? pickText({ ar: 'تعذر تحميل حالة المحتوى العام من الخادم. يمكنك إعادة المحاولة لتحديث العرض.', fr: 'Impossible de charger le contenu public depuis le serveur. Vous pouvez réessayer.', en: 'Could not load public content from the server. Please try again.', es: 'No se pudo cargar el contenido público desde el servidor. Inténtalo de nuevo.', de: 'Öffentliche Inhalte konnten nicht vom Server geladen werden. Bitte erneut versuchen.', pt: 'Não foi possível carregar o conteúdo público do servidor. Tente novamente.' }, language)
              : publicContentStatus === 'UNAUTHORIZED'
              ? pickText({ ar: 'تم رفض الوصول إلى إعدادات المحتوى العام لهذا الحساب.', fr: 'L’accès au contenu public a été refusé pour ce compte.', en: 'Access to public content management was denied for this account.', es: 'Se denegó el acceso a la gestión de contenido público para esta cuenta.', de: 'Der Zugriff auf die öffentliche Inhaltsverwaltung wurde verweigert.', pt: 'O acesso à gestão de conteúdo público foi negado para esta conta.' }, language)
              : publicContentStatus === 'READY'
              ? pickText({ ar: 'نصوص الصفحة الرئيسية معروضة حالياً للقراءة فقط؛ التعديل والنشر عبر الويب غير مفعّلين بعد.', fr: 'Le contenu public est affiché en lecture seule ; la modification et la publication en ligne ne sont pas encore activées.', en: 'Public homepage content is currently read-only; online editing and publishing are not yet enabled.', es: 'El contenido público es de solo lectura; la edición y publicación en línea aún no están activas.', de: 'Öffentliche Startseiteninhalte sind derzeit schreibgeschützt; Online-Bearbeitung ist noch nicht aktiv.', pt: 'O conteúdo público está em modo de só leitura; a edição e publicação online ainda não estão ativas.' }, language)
              : pickText({ ar: 'ميزة تعديل ونشر نصوص الصفحة الرئيسية غير متاحة حالياً لأن خدمة النشر لم تُفعّل بعد.', fr: 'La modification et la publication du contenu public sont actuellement indisponibles car le service de publication n’est pas encore activé.', en: 'Public content editing and publishing are currently unavailable because the publishing service is not yet enabled.', es: 'La edición y publicación de contenido público no están disponibles porque el servicio aún no está activo.', de: 'Bearbeitung und Veröffentlichung öffentlicher Inhalte sind derzeit nicht verfügbar.', pt: 'A edição e publicação de conteúdo público estão indisponíveis porque o serviço ainda não foi ativado.' }, language)}
          </p>
        </div>
      )}

      <div className="kh-info-panels" data-testid="about-kristou-section">
        <article className="kh-info-panel" data-testid="about-kristou-intro-card">
          <div className="space-y-2">
            <h2 className="kh-info-panel-title">
              {pickPublicEntry('about', 'title') ??
                pickText({ ar: 'حول مدرسة كريستو (KRISTOU)', fr: 'À propos de KRISTOU', en: 'About KRISTOU', es: 'Sobre KRISTOU', de: 'Über KRISTOU', pt: 'Sobre a KRISTOU' }, language)}
            </h2>
            <p className="kh-info-panel-body">
              {pickPublicEntry('about', 'body') ??
                pickText({ ar: 'تجدون هنا التقديم المعتمد للمدرسة، مقاربتنا التربوية، ومعلومات التواصل العامة لمدرسة كريستو في تونس. يتم نشر المعطيات العامة كمحتوى مدرسي معتمد دون كشف أي بيانات خاصة بالتلاميذ.', fr: 'Présentation approuvée par l’école, approche pédagogique et informations de contact générales figurent ici. Les données publiques sont gérées indépendamment des dossiers privés des élèves.', en: 'School-approved introduction, educational approach and contact information live here. Public facts are maintained as school content rather than inferred from private data.', es: 'Aquí figuran la presentación oficial de la escuela, su enfoque educativo e información de contacto general, independiente de los datos privados del alumnado.', de: 'Hier finden Sie die offizielle Schulvorstellung, das pädagogische Konzept und allgemeine Kontaktdaten unabhängig von privaten Schülerdaten.', pt: 'Aqui constam a apresentação oficial da escola, a abordagem pedagógica e os contactos gerais, independentes dos dados privados dos alunos.' }, language)}
            </p>
          </div>
          <span className="kh-info-chip">{t('school')}</span>
        </article>

        <article className="kh-info-panel">
          <div className="space-y-2">
            <h2 className="kh-info-panel-title">
              {broadcastsStatus === 'READY' && publicAnnouncements[0]
                ? publicAnnouncements[0].title
                : pickText({ ar: 'أحدث إعلان عام', fr: 'Dernière annonce publique', en: 'Latest announcement', es: 'Último anuncio público', de: 'Neueste öffentliche Mitteilung', pt: 'Último anúncio público' }, language)}
            </h2>
            <p className="kh-info-panel-body">
              {broadcastsStatus === 'READY' && publicAnnouncements[0]
                ? publicAnnouncements[0].body
                : pickText({ ar: 'معلومات التسجيل للسنة الدراسية والأنشطة المدرسية العامة القادمة تُعرض هنا للعموم.', fr: 'Les informations d’inscription et la prochaine activité publique de l’école sont mises en avant ici.', en: 'Registration information and the next public school activity can be highlighted here.', es: 'La información de matrícula y las próximas actividades escolares públicas se destacan aquí.', de: 'Hier werden Anmeldeinformationen und die nächsten öffentlichen Schulaktivitäten hervorgehoben.', pt: 'As informações de matrícula e as próximas atividades escolares públicas são destacadas aqui.' }, language)}
            </p>
          </div>
          <span className="kh-info-chip">
            {pickText({ ar: 'عام', fr: 'Public', en: 'Public', es: 'Público', de: 'Öffentlich', pt: 'Público' }, language)}
          </span>
        </article>

        <article className="kh-info-panel" data-testid="about-contact-location-card">
          <div className="space-y-3">
            <h3 className="kh-info-panel-title">{t('contactLocation')}</h3>
            <ul className="space-y-2.5 text-xs text-[#526581] dark:text-zinc-400">
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-k-brand shrink-0" />
                <span>{t('tunis')}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-k-brand shrink-0" />
                <span>
                  {pickText({ ar: 'هاتف الإدارة عند تأكيد الطلب', fr: 'Ligne secrétariat communiquée sur dossier', en: 'Office phone shared via admissions & parent portal', es: 'Teléfono de secretaría facilitado en admisiones', de: 'Sekretariatsnummer wird über die Anmeldung mitgeteilt', pt: 'Telefone da secretaria partilhado via admissões' }, language)}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-k-brand shrink-0" />
                <span dir="ltr">contact@kristou.edu.tn</span>
              </li>
            </ul>
          </div>
        </article>

        <article className="kh-info-panel" data-testid="about-platform-security-card">
          <div className="space-y-2">
            <h3 className="kh-info-panel-title">{t('platformAccess')}</h3>
            <p className="kh-info-panel-body">{t('platformDescription')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 bg-k-brand/10 dark:bg-k-brand/15 text-k-brand px-3 py-1.5 rounded-xl text-xs font-semibold">
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>Web &amp; Telegram</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{t('securityActive')}</span>
            </span>
          </div>
        </article>
      </div>

      {serviceCardsGrid}

      <div ref={levelsSectionRef}>
        <HomeSection title={t('levelsTitle')} subtitle={t('levelsBody')}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { code: 'CP', label: t('level1') },
              { code: 'CE1', label: t('level2') },
              { code: 'CE2', label: t('level3') },
              { code: 'CM1', label: t('level4') },
              { code: 'CM2', label: t('level5') },
              { code: '6ème', label: t('level6') },
            ].map((lvl) => (
              <div key={lvl.code} className="kh-info-panel">
                <span className="kh-info-chip">{lvl.code}</span>
                <h3 className="kh-info-panel-title text-sm sm:text-base mt-1">{lvl.label}</h3>
              </div>
            ))}
          </div>
        </HomeSection>
      </div>

      <div ref={activitiesSectionRef}>
        <HomeSection
          title={pickText({ ar: 'ركائز المدرسة والأنشطة التربوية', fr: 'Piliers éducatifs & Vie scolaire', en: 'Educational Pillars & School Life', es: 'Pilares educativos y vida escolar', de: 'Bildungssäulen & Schulleben', pt: 'Pilares educativos e vida escolar' }, language)}
          subtitle={t('heroDescription')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              { icon: '👩‍🏫', title: t('featureQualified'), body: t('directoryDescription') },
              { icon: '📚', title: t('featureTracking'), body: t('growthBody') },
              { icon: '🎨', title: t('featureActivities'), body: t('creativityBody') },
              { icon: '🛡️', title: t('featureSafe'), body: t('storyBody') },
            ].map((pillar, idx) => (
              <div key={idx} className="kh-info-panel">
                <span className="text-2xl">{pillar.icon}</span>
                <h3 className="kh-info-panel-title text-sm sm:text-base mt-1">{pillar.title}</h3>
                <p className="kh-info-panel-body mt-1">{pillar.body}</p>
              </div>
            ))}
          </div>
        </HomeSection>
      </div>

      <div ref={gallerySectionRef}>
        <HomeSection
          title={pickText({ ar: 'المعرض العام لمدرسة كريستو', fr: 'Galerie publique du campus KRISTOU', en: 'KRISTOU Campus Public Gallery', es: 'Galería pública del campus KRISTOU', de: 'Öffentliche Campus-Galerie KRISTOU', pt: 'Galeria pública do campus KRISTOU' }, language)}
          subtitle={pickText({ ar: 'صور معتمدة من فضاءات المدرسة والأنشطة العامة.', fr: 'Photos officielles approuvées du campus et de la vie scolaire.', en: 'School-approved campus and public activity media only.', es: 'Solo fotos oficiales del campus y actividades públicas.', de: 'Nur offiziell genehmigte Campus- und Aktivitätsfotos.', pt: 'Apenas fotos oficiais do campus e atividades públicas.' }, language)}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PUBLIC_CAMPUS_PHOTOS.map((src, index) => (
              <div
                key={src}
                className="overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 aspect-[4/3] bg-slate-100 dark:bg-zinc-900"
              >
                <img
                  src={src}
                  alt={`KRISTOU School campus ${index + 1}`}
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </HomeSection>
      </div>

      <div ref={announcementsSectionRef}>
        <HomeSection
          title={pickText({ ar: 'البلاغات المدرسية العامة', fr: 'Annonces officielles de l’école', en: 'Public School Announcements', es: 'Anuncios públicos de la escuela', de: 'Öffentliche Schulmitteilungen', pt: 'Anúncios públicos da escola' }, language)}
          subtitle={
            broadcastsHasError
              ? t('error')
              : isAnnouncementsDemo
              ? t('demoPreview')
              : pickText({ ar: 'بلاغات المدرسة المعتمدة', fr: 'Annonces officielles publiées', en: 'Published school notices', es: 'Avisos escolares publicados', de: 'Veröffentlichte Schulhinweise', pt: 'Avisos escolares publicados' }, language)
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {publicAnnouncements.map((item) => (
              <article key={item.id} className="kh-info-panel">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="kh-info-chip">
                      {item.createdAt}
                      {item.isDemoPreview ? ` • ${t('demoPreview')}` : ''}
                    </span>
                    <span className="text-xs font-bold text-slate-500">{item.authorName}</span>
                  </div>
                  <h3 className="kh-info-panel-title">{item.title}</h3>
                  <p className="kh-info-panel-body">{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </HomeSection>
      </div>
    </>
  );
};
