import React from 'react';
import { HOMEPAGE_BADGE_LABELS, pickText } from '../../../i18n/homepages';
import type { CardAvailabilityState, HomePageKey, Language } from '../../../types';
import type { OwnerGovernanceSection } from '../OwnerGovernanceWorkspace';
import { EmptyFeatureState } from '../shared/EmptyFeatureState';

const INSPECTABLE_WORKSPACES: HomePageKey[] = [
  'PUBLIC_HOME',
  'PARENT_HOME',
  'STUDENT_HOME',
  'TEACHER_HOME',
  'SCHOOL_STAFF_HOME',
  'ADMINISTRATIVE_PERSONNEL_HOME',
  'MANAGER_HOME',
];

export const OwnerOversightSelector: React.FC<{
  language: Language;
  onInspectRoleHome: (homeKey: HomePageKey | null) => void;
}> = ({ language, onInspectRoleHome }) => (
  <div className="mt-2">
    <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">
      {pickText(
        {
          ar: 'معاينة فضاءات الأدوار (إشراف المالك دون انتحال هوية):',
          fr: 'Inspecter un espace de rôle (supervision sans changement d’identité) :',
          en: 'View role workspace (non-impersonating Owner oversight):',
          es: 'Ver espacio de rol (supervisión del Propietario sin suplantación):',
          de: 'Rollenbereich ansehen (Inhaber-Aufsicht ohne Identitätswechsel):',
          pt: 'Ver espaço de função (supervisão do Proprietário sem personificação):',
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
);

interface OwnerGovernanceSurfacePanelProps {
  language: Language;
  governanceSurfaceRef: React.RefObject<HTMLDivElement | null>;
  activeGovernanceSection: OwnerGovernanceSection | null;
  governancePanel: {
    title: string;
    description: string;
    state: CardAvailabilityState;
  } | null;
  governanceBackendStatus: 'LOADING' | 'READY' | 'ERROR' | 'BLOCKED_BACKEND';
  onClosePanel: () => void;
  onRetryReadiness: () => void;
  children?: React.ReactNode;
}

export const OwnerGovernanceSurfacePanel: React.FC<OwnerGovernanceSurfacePanelProps> = ({
  language,
  governanceSurfaceRef,
  activeGovernanceSection,
  governancePanel,
  governanceBackendStatus,
  onClosePanel,
  onRetryReadiness,
  children,
}) => (
  <>
    {(activeGovernanceSection || governancePanel) && (
      <div
        ref={governanceSurfaceRef}
        tabIndex={-1}
        role="region"
        aria-label={pickText({ ar: 'مساحة إدارة المدرسة', fr: 'Espace de gestion scolaire', en: 'School management workspace', es: 'Espacio de gestión escolar', de: 'Schulverwaltungsbereich', pt: 'Espaço de gestão escolar' }, language)}
        className="scroll-mt-28 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-3xl"
        data-testid="owner-governance-surface"
      >
        {children}

        {governancePanel && (
          <EmptyFeatureState
            state={governancePanel.state}
            title={governancePanel.title}
            description={governancePanel.description}
            onClose={onClosePanel}
          />
        )}
      </div>
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
              es: 'No se pudo verificar la disponibilidad del módulo de gobernanza en el servidor.',
              de: 'Server-Verfügbarkeit der Kontoverwaltung konnte nicht geprüft werden.',
              pt: 'Não foi possível verificar a disponibilidade do módulo de governação no servidor.',
            },
            language,
          )}
        </span>
        <button
          type="button"
          onClick={onRetryReadiness}
          className="rounded-xl bg-red-700 hover:bg-red-800 px-3 py-1.5 text-white text-xs font-bold"
        >
          {pickText({ ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry', es: 'Reintentar', de: 'Erneut versuchen', pt: 'Tentar novamente' }, language)}
        </button>
      </div>
    )}
  </>
);
