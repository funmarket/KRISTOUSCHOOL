import React from 'react';
import { pickText } from '../../../i18n/homepages';
import type { GovernanceActorScope } from '../../../lib/accountGovernance';
import type { Language } from '../../../types';
import type { OwnerGovernanceSection } from '../OwnerGovernanceWorkspace';

export interface GovernanceControlCenterSectionProps {
  scope: GovernanceActorScope;
  operationalCounts: {
    activeClasses?: number | null;
    activeStudents?: number | null;
    pendingAdmissions?: number | null;
    openInquiries?: number | null;
  };
  language: Language;
  onSelectSection: (section: OwnerGovernanceSection) => void;
}

export const GovernanceControlCenterSection: React.FC<GovernanceControlCenterSectionProps> = ({
  scope,
  operationalCounts,
  language,
  onSelectSection,
}) => {
  return (
    <div className="mt-5 space-y-5" data-testid="gov-section-control-center">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
          <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
            {pickText({ ar: 'بانتظار المراجعة', fr: 'En attente', en: 'Pending Review', es: 'Pendientes de revisión', de: 'Prüfung ausstehend', pt: 'A aguardar revisão' }, language)}
          </div>
          <div className="mt-1 text-2xl font-black">{scope.pendingCount}</div>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
          <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
            {pickText({ ar: 'حسابات معتمدة', fr: 'Approuvés', en: 'Approved Accounts', es: 'Cuentas aprobadas', de: 'Genehmigte Konten', pt: 'Contas aprovadas' }, language)}
          </div>
          <div className="mt-1 text-2xl font-black">{scope.approvedCount}</div>
        </div>
        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-3.5">
          <div className="text-xs font-bold text-orange-800 dark:text-orange-300">
            {pickText({ ar: 'حسابات معلّقة', fr: 'Suspendus', en: 'Suspended', es: 'Suspendidas', de: 'Gesperrt', pt: 'Suspensas' }, language)}
          </div>
          <div className="mt-1 text-2xl font-black">{scope.suspendedCount}</div>
        </div>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5">
          <div className="text-xs font-bold text-rose-800 dark:text-rose-300">
            {pickText({ ar: 'حسابات ملغاة', fr: 'Révoqués', en: 'Revoked', es: 'Revocadas', de: 'Widerrufen', pt: 'Revogadas' }, language)}
          </div>
          <div className="mt-1 text-2xl font-black">{scope.revokedCount}</div>
        </div>
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3.5">
          <div className="text-xs font-bold text-sky-800 dark:text-sky-300">
            {pickText({ ar: 'مُلّاك نشطون (APP_ADMIN)', fr: 'Propriétaires actifs', en: 'Active School Owners', es: 'Propietarios activos', de: 'Aktive Schulinhaber', pt: 'Proprietários ativos' }, language)}
          </div>
          <div className="mt-1 text-2xl font-black">{scope.activeOwnerCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-3">
          <div className="text-[11px] font-bold text-slate-500">
            {pickText({ ar: 'الأقسام النشطة', fr: 'Classes actives', en: 'Active Classes', es: 'Clases activas', de: 'Aktive Klassen', pt: 'Turmas ativas' }, language)}
          </div>
          <div className="mt-1 text-lg font-black">{operationalCounts.activeClasses ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-3">
          <div className="text-[11px] font-bold text-slate-500">
            {pickText({ ar: 'التلاميذ المسجلون', fr: 'Élèves actifs', en: 'Active Students', es: 'Estudiantes activos', de: 'Aktive Schüler', pt: 'Alunos ativos' }, language)}
          </div>
          <div className="mt-1 text-lg font-black">{operationalCounts.activeStudents ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-3">
          <div className="text-[11px] font-bold text-slate-500">
            {pickText({ ar: 'طلبات التسجيل المعلقة', fr: 'Admissions en attente', en: 'Pending Admissions', es: 'Admisiones pendientes', de: 'Offene Aufnahmen', pt: 'Admissões pendentes' }, language)}
          </div>
          <div className="mt-1 text-lg font-black">{operationalCounts.pendingAdmissions ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-3">
          <div className="text-[11px] font-bold text-slate-500">
            {pickText({ ar: 'استفسارات مفتوحة', fr: 'Demandes ouvertes', en: 'Open Inquiries', es: 'Consultas abiertas', de: 'Offene Anfragen', pt: 'Pedidos em aberto' }, language)}
          </div>
          <div className="mt-1 text-lg font-black">{operationalCounts.openInquiries ?? 0}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 space-y-2 text-xs sm:text-sm">
        <div className="font-extrabold">
          {pickText(
            {
              ar: 'نطاق صلاحياتك الموثق من الخادم:',
              fr: 'Portée d’autorité vérifiée par le serveur :',
              en: 'Your Server-Verified Governance Authority Scope:',
              es: 'Alcance de tu autoridad de gobernanza verificada por el servidor:',
              de: 'Ihr serverseitig geprüfter Governance-Berechtigungsumfang:',
              pt: 'Âmbito da sua autoridade de governação verificado pelo servidor:',
            },
            language,
          )}
        </div>
        <p className="text-slate-600 dark:text-zinc-400">
          {pickText(
            {
              ar: `الدور الفعّال: ${scope.actorRole} • مراجعة الحسابات العادية: ${scope.canReviewOrdinaryAccounts ? 'نعم' : 'لا'} • تعيين الأدوار القيادية (APP_ADMIN / MANAGER): ${scope.canAppointPrivilegedRoles ? 'نعم (مالك المدرسة حصرياً)' : 'لا'}`,
              fr: `Rôle actif : ${scope.actorRole} • Revue des comptes ordinaires : ${scope.canReviewOrdinaryAccounts ? 'Oui' : 'Non'} • Nomination APP_ADMIN / MANAGER : ${scope.canAppointPrivilegedRoles ? 'Oui (Propriétaire uniquement)' : 'Non'}`,
              en: `Active Role: ${scope.actorRole} • Ordinary Account Review: ${scope.canReviewOrdinaryAccounts ? 'Yes' : 'No'} • Privileged Role Appointment (APP_ADMIN / MANAGER): ${scope.canAppointPrivilegedRoles ? 'Yes (Owner Exclusive)' : 'No'}`,
              es: `Rol activo: ${scope.actorRole} • Revisión de cuentas ordinarias: ${scope.canReviewOrdinaryAccounts ? 'Sí' : 'No'} • Designación de roles privilegiados (APP_ADMIN / MANAGER): ${scope.canAppointPrivilegedRoles ? 'Sí (solo Propietario)' : 'No'}`,
              de: `Aktive Rolle: ${scope.actorRole} • Prüfung regulärer Konten: ${scope.canReviewOrdinaryAccounts ? 'Ja' : 'Nein'} • Ernennung privilegierter Rollen (APP_ADMIN / MANAGER): ${scope.canAppointPrivilegedRoles ? 'Ja (nur Inhaber)' : 'Nein'}`,
              pt: `Função ativa: ${scope.actorRole} • Revisão de contas comuns: ${scope.canReviewOrdinaryAccounts ? 'Sim' : 'Não'} • Nomeação de funções privilegiadas (APP_ADMIN / MANAGER): ${scope.canAppointPrivilegedRoles ? 'Sim (exclusivo do Proprietário)' : 'Não'}`,
            },
            language,
          )}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => onSelectSection('pending-approvals')}
            className="rounded-xl bg-[#0D8AE8] px-3.5 py-2 text-xs font-extrabold text-white hover:bg-[#0B76C7]"
          >
            {pickText(
              {
                ar: `مراجعة الطلبات المعلقة (${scope.pendingCount})`,
                fr: `Examiner les demandes en attente (${scope.pendingCount})`,
                en: `Review Pending Approvals (${scope.pendingCount})`,
                es: `Revisar aprobaciones pendientes (${scope.pendingCount})`,
                de: `Ausstehende Genehmigungen prüfen (${scope.pendingCount})`,
                pt: `Rever aprovações pendentes (${scope.pendingCount})`,
              },
              language,
            )}
          </button>
          <button
            type="button"
            onClick={() => onSelectSection('user-directory')}
            className="rounded-xl border border-slate-300 dark:border-zinc-700 px-3.5 py-2 text-xs font-extrabold hover:bg-slate-100 dark:hover:bg-zinc-900"
          >
            {pickText(
              {
                ar: 'فتح دليل الحسابات وحالات التفعيل',
                fr: 'Ouvrir le répertoire des comptes',
                en: 'Open User Directory & Status',
                es: 'Abrir directorio y estados de cuentas',
                de: 'Benutzerverzeichnis & Status öffnen',
                pt: 'Abrir diretório e estados de contas',
              },
              language,
            )}
          </button>
          {scope.canAppointPrivilegedRoles && (
            <button
              type="button"
              onClick={() => onSelectSection('role-governance')}
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-extrabold text-amber-800 dark:text-amber-200"
            >
              {pickText(
                {
                  ar: 'تعيين أو سحب دور قيادي (MANAGER / APP_ADMIN)',
                  fr: 'Nommer ou révoquer MANAGER / APP_ADMIN',
                  en: 'Appoint or Revoke MANAGER / APP_ADMIN',
                  es: 'Designar o revocar MANAGER / APP_ADMIN',
                  de: 'MANAGER / APP_ADMIN ernennen oder entziehen',
                  pt: 'Nomear ou revogar MANAGER / APP_ADMIN',
                },
                language,
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
