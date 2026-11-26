import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HomePageHeader } from './shared/HomePageHeader';
import { HomeShortcutCard } from './shared/HomeShortcutCard';
import { HomeCardGrid } from './shared/HomeCardGrid';
import { HomeSection } from './shared/HomeSection';
import { EmptyFeatureState } from './shared/EmptyFeatureState';
import { HOMEPAGE_BADGE_LABELS, HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';
import { canAccessAppTab } from './homepageAccess';
import { countUnreadThreads } from '../../lib/schoolContent';

export interface SchoolStaffHomePageProps {
  setActiveTab: (tab: string) => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory' | 'announcements', subTab: string) => void;
}

export const SchoolStaffHomePage: React.FC<SchoolStaffHomePageProps> = ({
  setActiveTab,
  onNavigateToSubTab,
}) => {
  const { language, currentUser, messages, messagesStatus } = useApp();
  const unreadMessagesCount = countUnreadThreads(messages, messagesStatus);
  const [selectedNotice, setSelectedNotice] = useState<{
    title: string;
    description: string;
  } | null>(null);

  const canViewPickupDesk = canAccessAppTab(currentUser, 'pickup');

  const openDirectorySubTab = (subTab: string) => {
    if (onNavigateToSubTab) {
      onNavigateToSubTab('directory', subTab);
    } else {
      setActiveTab('directory');
    }
  };

  const openActionLabel = pickText(HOMEPAGE_COMMON_TEXT.openAction, language);
  const comingSoonLabel = pickText(HOMEPAGE_COMMON_TEXT.comingSoonBadge, language);

  return (
    <div className="kh-role-page" data-testid="homepage-SCHOOL_STAFF_HOME">
      <HomePageHeader
        badgeText={pickText(HOMEPAGE_BADGE_LABELS.SCHOOL_STAFF_HOME, language)}
        title={pickText(HOMEPAGE_COMMON_TEXT.mainHeadline, language)}
        subtitle={pickText(
          {
            ar: 'بوابة العمليات اليومية لأعوان المدرسة، الخدمات، والمهام الميدانية دون كشف الملفات الأكاديمية الخاصة.',
            fr: 'Espace opérationnel quotidien du personnel scolaire : annonces internes, cantine, annuaire et services assignés.',
            en: 'Daily operational workspace for school support staff without exposing private academic or family records.',
            es: 'Espacio operativo diario para el personal escolar de apoyo sin exponer expedientes académicos ni familiares privados.',
            de: 'Täglicher Arbeitsbereich für das Schulpersonal ohne Offenlegung privater Schul- oder Familienakten.',
            pt: 'Espaço operacional diário para o pessoal escolar de apoio sem expor registos académicos ou familiares privados.',
          },
          language,
        )}
      />

      {selectedNotice && (
        <EmptyFeatureState
          state="COMING_SOON"
          title={selectedNotice.title}
          description={selectedNotice.description}
          onClose={() => setSelectedNotice(null)}
        />
      )}

      {/* Core Staff Cards matching Screenshot 2 + Section 9.2 */}
      <HomeCardGrid ariaLabel="School staff core cards">
        <HomeShortcutCard
          id="staff-internal-announcements"
          title={pickText(
            { ar: 'البلاغات الداخلية', fr: 'Annonces internes', en: 'Internal Announcements', es: 'Anuncios internos', de: 'Interne Mitteilungen', pt: 'Anúncios internos' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="📢"
          tone="blue"
          onClick={() => setActiveTab('announcements')}
        />

        <HomeShortcutCard
          id="staff-school-calendar"
          title={pickText(
            { ar: 'الروزنامة المدرسية', fr: 'Calendrier scolaire', en: 'School Calendar', es: 'Calendario escolar', de: 'Schulkalender', pt: 'Calendário escolar' },
            language,
          )}
          actionLabel={openActionLabel}
          icon="📅"
          tone="yellow"
          onClick={() =>
            onNavigateToSubTab
              ? onNavigateToSubTab('announcements', 'calendar')
              : setActiveTab('announcements')
          }
        />

        <HomeShortcutCard
          id="staff-food-menu"
          title={pickText({ ar: 'قائمة الطعام', fr: 'Menu de la cantine', en: 'Food Menu', es: 'Menú del comedor', de: 'Speiseplan', pt: 'Ementa da cantina' }, language)}
          actionLabel={openActionLabel}
          icon="🍽️"
          tone="green"
          onClick={() => setActiveTab('foodMenu')}
        />

        <HomeShortcutCard
          id="staff-teachers-directory"
          title={pickText({ ar: 'المربون', fr: 'Enseignants', en: 'Teachers', es: 'Docentes', de: 'Lehrkräfte', pt: 'Docentes' }, language)}
          actionLabel={openActionLabel}
          icon="👩‍🏫"
          tone="purple"
          onClick={() => openDirectorySubTab('teachers')}
        />

        <HomeShortcutCard
          id="staff-administration-directory"
          title={pickText({ ar: 'الإدارة', fr: 'Administration', en: 'Administration', es: 'Administración', de: 'Verwaltung', pt: 'Administração' }, language)}
          actionLabel={openActionLabel}
          icon="🏛️"
          tone="slate"
          onClick={() => openDirectorySubTab('admin')}
        />

        <HomeShortcutCard
          id="staff-messages"
          title={pickText({ ar: 'الرسائل', fr: 'Messages', en: 'Messages', es: 'Mensajes', de: 'Nachrichten', pt: 'Mensagens' }, language)}
          actionLabel={openActionLabel}
          statusBadge={unreadMessagesCount > 0 ? String(unreadMessagesCount) : undefined}
          icon="💬"
          tone="teal"
          onClick={() => setActiveTab('messages')}
        />

        <HomeShortcutCard
          id="staff-my-tasks"
          title={pickText(
            { ar: 'مهامي والطلبات', fr: 'Mes tâches & Demandes', en: 'My Tasks / Requests', es: 'Mis tareas y solicitudes', de: 'Meine Aufgaben & Anfragen', pt: 'Minhas tarefas e pedidos' },
            language,
          )}
          actionLabel={comingSoonLabel}
          statusBadge={comingSoonLabel}
          state="COMING_SOON"
          icon="🛠️"
          tone="orange"
          onClick={() =>
            setSelectedNotice({
              title: pickText(
                { ar: 'مهامي وطلبات الصيانة', fr: 'Mes tâches & Demandes', en: 'My Tasks / Service Requests', es: 'Mis tareas y solicitudes de servicio', de: 'Meine Aufgaben & Serviceanfragen', pt: 'Minhas tarefas e pedidos de serviço' },
                language,
              ),
              description: pickText(
                {
                  ar: 'وحدة مهام الأعوان وطلبات الصيانة قيد الربط مع الخادم (Coming Soon).',
                  fr: 'Le suivi des tâches opérationnelles sera activé avec le contrat serveur dédié.',
                  en: 'Operational task assignment and facility ticket persistence is marked Coming Soon pending backend tables.',
                  es: 'La asignación de tareas operativas y solicitudes de mantenimiento estará disponible próximamente.',
                  de: 'Die Aufgaben- und Wartungsverfolgung folgt demnächst nach Bereitstellung der Backend-Tabellen.',
                  pt: 'A atribuição de tarefas operacionais e pedidos de manutenção estará disponível em breve.',
                },
                language,
              ),
            })
          }
        />
      </HomeCardGrid>

      {/* Capability-gated operational service modules (Section 9.3) */}
      <HomeSection
        title={pickText(
          {
            ar: 'الوحدات الميدانية حسب التكليف',
            fr: 'Services opérationnels par habilitation',
            en: 'Assigned Operational Modules',
            es: 'Módulos operativos asignados',
            de: 'Zugewiesene Betriebsmodule',
            pt: 'Módulos operacionais atribuídos',
          },
          language,
        )}
        subtitle={pickText(
          {
            ar: 'تُفتح وحدات الاستلام أو المطعم أو المرافق حسب الصلاحيات المسندة لحسابك.',
            fr: 'Modules activés selon les habilitations attribuées à votre poste.',
            en: 'Modules unlocked according to your staff assignment and server capabilities.',
            es: 'Módulos habilitados según su asignación y facultades verificadas en el servidor.',
            de: 'Module entsprechend Ihrer Zuweisung und Serverberechtigungen freigeschaltet.',
            pt: 'Módulos desbloqueados de acordo com a sua atribuição e competências no servidor.',
          },
          language,
        )}
      >
        <HomeCardGrid ariaLabel="School staff capability modules">
          {canViewPickupDesk && (
            <HomeShortcutCard
              id="staff-pickup-desk"
              title={pickText(
                { ar: 'متابعة الاستلام المدرسي', fr: 'Suivi des sorties (Pickup)', en: 'Pickup Desk', es: 'Control de recogida', de: 'Abholschalter', pt: 'Balcão de recolha' },
                language,
              )}
              actionLabel={openActionLabel}
              icon="🚸"
              tone="teal"
              onClick={() => setActiveTab('pickup')}
            />
          )}

          <HomeShortcutCard
            id="staff-cafeteria"
            title={pickText(
              { ar: 'المطعم المدرسي', fr: 'Service Cantine', en: 'Cafeteria', es: 'Comedor', de: 'Mensa', pt: 'Cantina' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="🥗"
            tone="green"
            onClick={() => setActiveTab('foodMenu')}
          />

          <HomeShortcutCard
            id="staff-facilities"
            title={pickText(
              { ar: 'المرافق والصيانة', fr: 'Locaux & Maintenance', en: 'Facilities', es: 'Instalaciones', de: 'Gebäude & Wartung', pt: 'Instalações' },
              language,
            )}
            actionLabel={comingSoonLabel}
            statusBadge={comingSoonLabel}
            state="COMING_SOON"
            icon="🧰"
            tone="orange"
            onClick={() =>
              setSelectedNotice({
                title: pickText({ ar: 'المرافق والصيانة', fr: 'Locaux & Maintenance', en: 'Facilities', es: 'Instalaciones', de: 'Gebäude & Wartung', pt: 'Instalações' }, language),
                description: pickText(
                  {
                    ar: 'وحدة صيانة المرافق المدرسية ستتوفر قريباً.',
                    fr: 'Le module de maintenance des locaux sera bientôt disponible.',
                    en: 'Facilities maintenance reporting is marked Coming Soon.',
                    es: 'El módulo de mantenimiento de instalaciones estará disponible próximamente.',
                    de: 'Die Meldung zur Gebäudewartung ist demnächst verfügbar.',
                    pt: 'O módulo de manutenção das instalações estará disponível em breve.',
                  },
                  language,
                ),
              })
            }
          />

          <HomeShortcutCard
            id="staff-library-transport"
            title={pickText(
              { ar: 'المكتبة والنقل والأمن', fr: 'Bibliothèque, Transport & Sécurité', en: 'Library / Transport / Security', es: 'Biblioteca, transporte y seguridad', de: 'Bibliothek, Transport & Sicherheit', pt: 'Biblioteca, transporte e segurança' },
              language,
            )}
            actionLabel={comingSoonLabel}
            statusBadge={comingSoonLabel}
            state="COMING_SOON"
            icon="🚌"
            tone="slate"
            onClick={() =>
              setSelectedNotice({
                title: pickText(
                  { ar: 'خدمات المكتبة والنقل والأمن', fr: 'Services Bibliothèque, Transport & Sécurité', en: 'Library, Transport & Security Desk', es: 'Servicios de biblioteca, transporte y seguridad', de: 'Bibliothek, Transport & Sicherheitsdienst', pt: 'Serviços de biblioteca, transporte e segurança' },
                  language,
                ),
                description: pickText(
                  {
                    ar: 'هذه الوحدات الميدانية قيد الإعداد ولا تقوم بأي تعديل وهمي للبيانات.',
                    fr: 'Ces modules spécialisés sont en préparation (aucune fausse écriture locale).',
                    en: 'Specialized support desk modules are marked Coming Soon with no fake local mutations.',
                    es: 'Estos módulos especializados están en preparación sin simulaciones locales.',
                    de: 'Diese spezialisierten Module befinden sich in Vorbereitung ohne lokale Scheinspeicherungen.',
                    pt: 'Estes módulos especializados estão em preparação sem gravações locais fictícias.',
                  },
                  language,
                ),
              })
            }
          />
        </HomeCardGrid>
      </HomeSection>
    </div>
  );
};
