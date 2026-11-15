import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CardAvailabilityState, HomePageKey } from '../../types';
import { HomePageHeader } from './shared/HomePageHeader';
import { HomeShortcutCard } from './shared/HomeShortcutCard';
import { HomeCardGrid } from './shared/HomeCardGrid';
import { HomeSection } from './shared/HomeSection';
import { EmptyFeatureState } from './shared/EmptyFeatureState';
import { HOMEPAGE_BADGE_LABELS, HOMEPAGE_COMMON_TEXT, pickText } from '../../i18n/homepages';
import {
  OwnerGovernanceSection,
  OwnerGovernanceWorkspace,
} from './OwnerGovernanceWorkspace';
import { fetchGovernanceActorScope } from '../../lib/accountGovernance';
import { isSupabaseConfigured } from '../../lib/supabase';

export interface OwnerHomePageProps {
  setActiveTab: (tab: string) => void;
  onNavigateToSubTab?: (tab: 'community' | 'directory' | 'announcements', subTab: string) => void;
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
  const [activeGovernanceSection, setActiveGovernanceSection] =
    useState<OwnerGovernanceSection | null>(null);
  const [governanceBackendStatus, setGovernanceBackendStatus] = useState<
    'LOADING' | 'READY' | 'ERROR' | 'BLOCKED_BACKEND'
  >(isSupabaseConfigured ? 'LOADING' : 'BLOCKED_BACKEND');
  const [governancePanel, setGovernancePanel] = useState<{
    title: string;
    description: string;
    state: CardAvailabilityState;
  } | null>(null);

  const [governanceRetrySeq, setGovernanceRetrySeq] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!isSupabaseConfigured) {
      setGovernanceBackendStatus('BLOCKED_BACKEND');
      return;
    }
    setGovernanceBackendStatus('LOADING');
    void fetchGovernanceActorScope().then((res) => {
      if (cancelled) return;
      if (res.ok && res.data) {
        setGovernanceBackendStatus('READY');
      } else if (res.errorCode === 'backend_unavailable') {
        setGovernanceBackendStatus('BLOCKED_BACKEND');
      } else {
        setGovernanceBackendStatus('ERROR');
      }
    }).catch(() => {
      if (!cancelled) setGovernanceBackendStatus('ERROR');
    });
    return () => {
      cancelled = true;
    };
  }, [governanceRetrySeq]);

  const openGovernanceSection = (section: OwnerGovernanceSection) => {
    setGovernancePanel(null);
    setActiveGovernanceSection(section);
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

  const governanceCardState: CardAvailabilityState =
    governanceBackendStatus === 'BLOCKED_BACKEND' ? 'BLOCKED_BACKEND' : 'AVAILABLE';
  const governanceCardActionLabel =
    governanceBackendStatus === 'BLOCKED_BACKEND' ? blockedBackendLabel : openActionLabel;
  const governanceCardBadge =
    governanceBackendStatus === 'READY'
      ? undefined
      : governanceBackendStatus === 'LOADING'
      ? pickText({ ar: 'جاري التحقق...', fr: 'Vérification...', en: 'Checking...' }, language)
      : governanceBackendStatus === 'ERROR'
      ? pickText({ ar: 'خطأ في التحميل', fr: 'Erreur serveur', en: 'Server Error' }, language)
      : blockedBackendLabel;

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

      {activeGovernanceSection && (
        <OwnerGovernanceWorkspace
          activeSection={activeGovernanceSection}
          onSelectSection={(sec) => setActiveGovernanceSection(sec)}
          onClose={() => setActiveGovernanceSection(null)}
          onScopeVerified={(available) =>
            setGovernanceBackendStatus(available ? 'READY' : 'BLOCKED_BACKEND')
          }
        />
      )}

      {governanceBackendStatus === 'ERROR' && (
        <div
          role="alert"
          data-testid="owner-governance-error-banner"
          className="mb-4 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-xs font-bold text-red-700 dark:text-red-300 flex flex-wrap items-center justify-between gap-2"
        >
          <span>
            {pickText(
              {
                ar: 'تعذر التحقق من جاهزية وحدة حوكمة الحسابات عبر الخادم.',
                fr: 'Impossible de vérifier la disponibilité du module de gouvernance.',
                en: 'Unable to verify Account Governance backend readiness from server.',
              },
              language,
            )}
          </span>
          <button
            type="button"
            onClick={() => setGovernanceRetrySeq((s) => s + 1)}
            className="rounded-xl bg-red-700 hover:bg-red-800 px-3 py-1.5 text-white text-xs font-bold"
          >
            {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' }, language)}
          </button>
        </div>
      )}

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
            onClick={() => openGovernanceSection('control-center')}
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
            onClick={() => setActiveTab('announcements')}
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
            actionLabel={governanceCardActionLabel}
            statusBadge={governanceCardBadge}
            state={governanceCardState}
            icon="✅"
            tone="teal"
            onClick={() => openGovernanceSection('pending-approvals')}
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
            actionLabel={governanceCardActionLabel}
            statusBadge={governanceCardBadge}
            state={governanceCardState}
            icon="👥"
            tone="purple"
            onClick={() => openGovernanceSection('user-directory')}
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
            actionLabel={governanceCardActionLabel}
            statusBadge={governanceCardBadge}
            state={governanceCardState}
            icon="🛡️"
            tone="blue"
            onClick={() => openGovernanceSection('manager-delegation')}
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
            actionLabel={governanceCardActionLabel}
            statusBadge={governanceCardBadge}
            state={governanceCardState}
            icon="👑"
            tone="orange"
            onClick={() => openGovernanceSection('role-governance')}
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
            onClick={() => {
              setActiveGovernanceSection(null);
              setGovernancePanel({
                state: 'COMING_SOON',
                title: pickText(
                  { ar: 'سياسات وإعدادات مدرسة كريستو', fr: 'Politiques & Paramètres KRISTOU', en: 'KRISTOU School Policy & Settings' },
                  language,
                ),
                description: pickText(
                  {
                    ar: 'السنة الدراسية المعتمدة: 2026–2027 • توقيت ملاحظات الأولياء: 08:00–18:00 (توقيت تونس) • الحد الأقصى: 11 ملاحظة يومياً. تعديل الإعدادات عبر الخادم قيد التفعيل (CFG-01).',
                    fr: 'Année scolaire : 2026–2027 • Horaires Notes Parents : 08h00–18h00 (Africa/Tunis) • Quota : 11/jour. L’édition persistante CFG-01 reste à venir.',
                    en: 'Active Academic Year: 2026–2027 • Parent Notes Window: 08:00–18:00 (Africa/Tunis) • Daily Quota: 11/day. Persistent CFG-01 settings editor is Coming Soon.',
                  },
                  language,
                ),
              });
            }}
          />
        </HomeCardGrid>
      </HomeSection>
    </div>
  );
};

