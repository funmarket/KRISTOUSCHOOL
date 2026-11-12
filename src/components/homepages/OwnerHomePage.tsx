import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CardAvailabilityState, HomePageKey } from '../../types';
import { HomePageHeader } from './shared/HomePageHeader';
import { HomeShortcutCard } from './shared/HomeShortcutCard';
import { HomeCardGrid } from './shared/HomeCardGrid';
import { HomeSection } from './shared/HomeSection';
import { EmptyFeatureState } from './shared/EmptyFeatureState';
import { HOMEPAGE_BADGE_LABELS, HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';

export interface OwnerHomePageProps {
  setActiveTab: (tab: string) => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory', subTab: string) => void;
  onInspectRoleHome?: (homeKey: HomePageKey | null) => void;
}

const INSPECTABLE_WORKSPACES: HomePageKey[] = [
  'PUBLIC_HOME',
  'PARENT_HOME',
  'STUDENT_HOME',
  'TEACHER_HOME',
  'SCHOOL_STAFF_HOME',
  'ADMINISTRATIVE_PERSONNEL_HOME',
  'MANAGER_HOME',
];

export const OwnerHomePage: React.FC<OwnerHomePageProps> = ({
  setActiveTab,
  onNavigateToSubTab,
  onInspectRoleHome,
}) => {
  const { language } = useApp();
  const [governancePanel, setGovernancePanel] = useState<{
    title: string;
    description: string;
    state: CardAvailabilityState;
  } | null>(null);

  const openCommunitySubTab = (subTab: string) => {
    if (onNavigateToSubTab) {
      onNavigateToSubTab('community', subTab);
    } else {
      setActiveTab('community');
    }
  };

  const openDirectorySubTab = (subTab: string) => {
    if (onNavigateToSubTab) {
      onNavigateToSubTab('directory', subTab);
    } else {
      setActiveTab('directory');
    }
  };

  const openActionLabel = pickText(HOMEPAGE_COMMON_TEXT.openAction, language);
  const blockedBackendLabel = pickText(HOMEPAGE_COMMON_TEXT.backendBlockedBadge, language);
  const comingSoonLabel = pickText(HOMEPAGE_COMMON_TEXT.comingSoonBadge, language);

  return (
    <div className="kh-role-page" data-testid="homepage-OWNER_HOME">
      <HomePageHeader
        badgeText={pickText(HOMEPAGE_BADGE_LABELS.OWNER_HOME, language)}
        title={pickText(HOMEPAGE_COMMON_TEXT.mainHeadline, language)}
        subtitle={pickText(
          {
            ar: 'السلطة الإدارية العليا لمدرسة كريستو: تسيير العمليات اليومية، حوكمة الأدوار، واعتماد الحسابات.',
            fr: 'Autorité générale de l’école KRISTOU : opérations scolaires, gouvernance des rôles et approbation des comptes.',
            en: 'Highest school authority for KRISTOU School: daily school operations, role governance, and account approvals.',
          },
          language,
        )}
      >
        {/* Non-impersonating Owner Workspace Oversight Selector (Section 12.3) */}
        {onInspectRoleHome && (
          <div className="mt-2">
            <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">
              {pickText(
                {
                  ar: 'معاينة فضاءات الأدوار (إشراف المالك دون انتحال هوية):',
                  fr: 'Inspecter un espace de rôle (supervision sans changement d’identité) :',
                  en: 'View role workspace (non-impersonating Owner oversight):',
                },
                language,
              )}
            </span>
            <div className="kh-selector-bar" aria-label="Owner workspace oversight selector">
              {INSPECTABLE_WORKSPACES.map((key) => (
                <button
                  key={key}
                  type="button"
                  data-testid={`owner-inspect-${key}`}
                  onClick={() => onInspectRoleHome(key)}
                  className="kh-selector-pill"
                >
                  👁️ {pickText(HOMEPAGE_BADGE_LABELS[key], language)}
                </button>
              ))}
            </div>
          </div>
        )}
      </HomePageHeader>

      {governancePanel && (
        <EmptyFeatureState
          state={governancePanel.state}
          title={governancePanel.title}
          description={governancePanel.description}
          onClose={() => setGovernancePanel(null)}
        />
      )}

      {/* Group 1: School Operations — matching Screenshot 7 (ADMIN HOME / SCHOOL OWNER HOME) */}
      <HomeSection
        title={pickText(
          {
            ar: 'العمليات المدرسية اليومية',
            fr: 'Opérations scolaires',
            en: 'School Operations',
          },
          language,
        )}
      >
        <HomeCardGrid ariaLabel="School Owner operations cards">
          <HomeShortcutCard
            id="owner-control-center"
            title={pickText(
              { ar: 'مركز القيادة', fr: 'Centre de contrôle', en: 'Control Center' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="🛠️"
            tone="slate"
            onClick={() =>
              setGovernancePanel({
                state: 'AVAILABLE_READ_ONLY',
                title: pickText(
                  { ar: 'مركز القيادة للمؤسس (APP_ADMIN)', fr: 'Centre de contrôle Fondateur (APP_ADMIN)', en: 'School Owner Control Center (APP_ADMIN)' },
                  language,
                ),
                description: pickText(
                  {
                    ar: 'يمكنك الإشراف على جميع الوحدات المدرسية ومعاينة كل فضاء دور من شريط الإشراف أعلاه دون تغيير هويتك.',
                    fr: 'Supervisez l’ensemble des modules scolaires et inspectez chaque espace de rôle ci-dessus sans modifier votre session APP_ADMIN.',
                    en: 'Supervise all school modules and inspect any role workspace using the oversight bar above while keeping your APP_ADMIN identity.',
                  },
                  language,
                ),
              })
            }
          />

          <HomeShortcutCard
            id="owner-pickup"
            title={pickText({ ar: 'الاستلام المدرسي', fr: 'Sortie & Pickup', en: 'Pickup' }, language)}
            actionLabel={openActionLabel}
            icon="🚸"
            tone="green"
            onClick={() => setActiveTab('pickup')}
          />

          <HomeShortcutCard
            id="owner-classes"
            title={pickText(
              {
                ar: 'الأقسام وقوائم التلاميذ',
                fr: 'Classes & Élèves',
                en: 'Classes & Students',
              },
              language,
            )}
            actionLabel={openActionLabel}
            icon="🏫"
            tone="teal"
            onClick={() => setActiveTab('classes')}
          />

          <HomeShortcutCard
            id="owner-registration"
            title={pickText(
              { ar: 'ملفات التسجيل', fr: 'Inscriptions', en: 'Registration' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="📋"
            tone="orange"
            onClick={() => setActiveTab('registration')}
          />

          <HomeShortcutCard
            id="owner-broadcasts"
            title={pickText({ ar: 'البلاغات العامة', fr: 'Diffusions & Annonces', en: 'Broadcasts' }, language)}
            actionLabel={openActionLabel}
            icon="📢"
            tone="red"
            onClick={() => openCommunitySubTab('announcements')}
          />

          <HomeShortcutCard
            id="owner-food-menu"
            title={pickText({ ar: 'قائمة الطعام', fr: 'Menu de la cantine', en: 'Food Menu' }, language)}
            actionLabel={openActionLabel}
            icon="🍽️"
            tone="yellow"
            onClick={() => setActiveTab('foodMenu')}
          />

          <HomeShortcutCard
            id="owner-public-content"
            title={pickText(
              { ar: 'المحتوى العام للموقع', fr: 'Contenu public', en: 'Public content' },
              language,
            )}
            actionLabel={openActionLabel}
            icon="🌐"
            tone="blue"
            onClick={() => setActiveTab('publicSite')}
          />
        </HomeCardGrid>
      </HomeSection>

      {/* Group 2: Governance & Access — Owner-exclusive governance modules (Section 12.2) */}
      <HomeSection
        title={pickText(
          {
            ar: 'الحوكمة وإدارة الحسابات والصلاحيات',
            fr: 'Gouvernance, Approbations & Accès',
            en: 'Governance & Access',
          },
          language,
        )}
        subtitle={pickText(
          {
            ar: 'العمليات الحساسة (اعتماد الحسابات، تفويض المدير المساعد، وتعديل الأدوار) مرتبطة حصرياً بعقود الخادم (Supabase).',
            fr: 'Les mutations sensibles (approbations, délégations Manager, rôles) exigent une vérification serveur Supabase.',
            en: 'Privileged mutations (account approval, manager delegation, role changes) require verified Supabase backend contracts.',
          },
          language,
        )}
      >
        <HomeCardGrid ariaLabel="School Owner governance cards">
          <HomeShortcutCard
            id="owner-pending-approvals"
            title={pickText(
              {
                ar: 'طلبات الحسابات قيد المراجعة',
                fr: 'Approbations de comptes',
                en: 'Pending Account Approvals',
              },
              language,
            )}
            actionLabel={blockedBackendLabel}
            statusBadge={blockedBackendLabel}
            state="BLOCKED_BACKEND"
            icon="✅"
            tone="teal"
            onClick={() =>
              setGovernancePanel({
                state: 'BLOCKED_BACKEND',
                title: pickText(
                  { ar: 'اعتماد طلبات الحسابات (Pending Account Approvals)', fr: 'Approbation des comptes en attente', en: 'Pending Account Approvals' },
                  language,
                ),
                description: pickText(
                  {
                    ar: 'لا يتم حفظ أي موافقة وهمية في المتصفح. هذه الوحدة بانتظار عقد قاعدة البيانات (Supabase RPC) المعتمد لجدول طلبات الحسابات.',
                    fr: 'Aucune approbation locale fictive n’est stockée dans le navigateur. En attente du contrat RPC Supabase pour les approbations.',
                    en: 'No fake browser-side approvals are performed. This queue awaits the verified Supabase backend RPC contract for account approval persistence.',
                  },
                  language,
                ),
              })
            }
          />

          <HomeShortcutCard
            id="owner-user-directory"
            title={pickText(
              {
                ar: 'دليل الحسابات وحالتها',
                fr: 'Répertoire des comptes',
                en: 'User Directory & Account Status',
              },
              language,
            )}
            actionLabel={blockedBackendLabel}
            statusBadge={blockedBackendLabel}
            state="BLOCKED_BACKEND"
            icon="👥"
            tone="purple"
            onClick={() =>
              setGovernancePanel({
                state: 'BLOCKED_BACKEND',
                title: pickText(
                  { ar: 'دليل الحسابات وحالات التفعيل', fr: 'Répertoire des utilisateurs & statuts', en: 'User Directory & Account Status' },
                  language,
                ),
                description: pickText(
                  {
                    ar: 'عرض وتعديل حالات الحسابات (APPROVED / PENDING / REJECTED / REVOKED) يتطلب استعلاماً محمياً بسياسات RLS من الخادم.',
                    fr: 'La consultation et la modification des statuts de compte (APPROVED / PENDING / REJECTED / REVOKED) nécessitent le contrat RLS Supabase.',
                    en: 'Listing and mutating user account statuses (APPROVED / PENDING / REJECTED / REVOKED) requires the server-verified Supabase RLS contract.',
                  },
                  language,
                ),
              })
            }
          />

          <HomeShortcutCard
            id="owner-manager-delegation"
            title={pickText(
              {
                ar: 'تفويض المدير المساعد (Manager)',
                fr: 'Délégation Manager',
                en: 'Manager Delegation',
              },
              language,
            )}
            actionLabel={blockedBackendLabel}
            statusBadge={blockedBackendLabel}
            state="BLOCKED_BACKEND"
            icon="🛡️"
            tone="blue"
            onClick={() =>
              setGovernancePanel({
                state: 'BLOCKED_BACKEND',
                title: pickText(
                  { ar: 'تفويض صلاحيات المدير المساعد', fr: 'Délégation des permissions Manager', en: 'Manager Delegation & Capabilities' },
                  language,
                ),
                description: pickText(
                  {
                    ar: 'منح أو سحب صلاحيات المسير (MANAGER) يتم حصرياً عبر الخادم من طرف مالك المدرسة (APP_ADMIN).',
                    fr: 'L’attribution ou la révocation des capacités Manager est strictement contrôlée côté serveur par APP_ADMIN.',
                    en: 'Granting or revoking MANAGER capabilities is strictly enforced server-side by APP_ADMIN.',
                  },
                  language,
                ),
              })
            }
          />

          <HomeShortcutCard
            id="owner-role-governance"
            title={pickText(
              {
                ar: 'حوكمة الأدوار والصلاحيات',
                fr: 'Gouvernance des rôles',
                en: 'Role & Permission Governance',
              },
              language,
            )}
            actionLabel={blockedBackendLabel}
            statusBadge={blockedBackendLabel}
            state="BLOCKED_BACKEND"
            icon="👑"
            tone="orange"
            onClick={() =>
              setGovernancePanel({
                state: 'BLOCKED_BACKEND',
                title: pickText(
                  { ar: 'حوكمة الأدوار الـ 7', fr: 'Gouvernance des 7 rôles de compte', en: 'Role & Permission Governance' },
                  language,
                ),
                description: pickText(
                  {
                    ar: 'تغيير دور أي مستخدم في جدول user_role_assignments يتطلب دالة خادم موثقة ولا يُقبل من المتصفح مباشرة.',
                    fr: 'Toute modification dans user_role_assignments exige une fonction serveur vérifiée.',
                    en: 'Role assignment mutations in user_role_assignments require a verified server RPC and never trust client-supplied role writes.',
                  },
                  language,
                ),
              })
            }
          />

          <HomeShortcutCard
            id="owner-directory-oversight"
            title={pickText(
              {
                ar: 'إشراف الدليل والموقع العام',
                fr: 'Supervision Annuaires & Site',
                en: 'Directory & Public Site Oversight',
              },
              language,
            )}
            actionLabel={openActionLabel}
            icon="🏛️"
            tone="slate"
            onClick={() => openDirectorySubTab('teachers')}
          />

          <HomeShortcutCard
            id="owner-school-settings"
            title={pickText(
              { ar: 'إعدادات المدرسة', fr: 'Paramètres de l’école', en: 'School Settings' },
              language,
            )}
            actionLabel={comingSoonLabel}
            statusBadge={comingSoonLabel}
            state="COMING_SOON"
            icon="⚙️"
            tone="red"
            onClick={() =>
              setGovernancePanel({
                state: 'COMING_SOON',
                title: pickText(
                  { ar: 'إعدادات مدرسة كريستو', fr: 'Paramètres généraux KRISTOU', en: 'KRISTOU School Settings' },
                  language,
                ),
                description: pickText(
                  {
                    ar: 'إعدادات السنة الدراسية والسياسات العامة للمدرسة ستُتاح فور تفعيل جدول الإعدادات في الخادم.',
                    fr: 'Les paramètres d’année scolaire seront activés avec la table de configuration serveur.',
                    en: 'Academic year and school-wide configuration settings are marked Coming Soon pending backend persistence.',
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
