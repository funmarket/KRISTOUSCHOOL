import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { pickText } from '../../../i18n/homepages';
import {
  appointPrivilegedRole,
  fetchGovernanceActorScope,
  getAccountGovernanceDetail,
  listAccountDirectory,
  listManagerGrants,
  listPendingAccounts,
  ORDINARY_ROLES,
  reviewAccountLifecycle,
  setManagerCapability,
  type GovernanceAccountDetail,
  type GovernanceAccountRecord,
  type GovernanceActorScope,
  type GovernanceErrorCode,
  type GovernanceLifecycleDecision,
  type ManagerGrantRecord,
  type ManagerSummary,
  type PrivilegedRole,
} from '../../../lib/accountGovernance';
import type { AccountApprovalStatus, AccountRole } from '../../../types';
import type { OwnerGovernanceSection } from '../OwnerGovernanceWorkspace';
import { ALL_GOVERNANCE_SECTION_TABS, ERROR_MESSAGES } from './governanceDisplayConfig';

export interface UseOwnerGovernanceControllerParams {
  activeSection: OwnerGovernanceSection;
  onScopeVerified?: (available: boolean, scope: GovernanceActorScope | null) => void;
  ordinaryReviewOnly?: boolean;
  services?: {
    listPendingAccounts: typeof listPendingAccounts;
    listAccountDirectory: typeof listAccountDirectory;
    reviewAccountLifecycle: typeof reviewAccountLifecycle;
    appointPrivilegedRole: typeof appointPrivilegedRole;
  };
}

export function useOwnerGovernanceController({
  activeSection,
  onScopeVerified,
  ordinaryReviewOnly = false,
}: UseOwnerGovernanceControllerParams) {
  const { language, theme, operationalCounts } = useApp();

  const [loadingScope, setLoadingScope] = useState<boolean>(true);
  const [scope, setScope] = useState<GovernanceActorScope | null>(null);
  const [scopeError, setScopeError] = useState<GovernanceErrorCode | null>(null);

  const [pendingItems, setPendingItems] = useState<GovernanceAccountRecord[]>([]);
  const [pendingTotal, setPendingTotal] = useState<number>(0);
  const [pendingSearch, setPendingSearch] = useState<string>('');
  const [pendingRoleFilter, setPendingRoleFilter] = useState<AccountRole | 'ALL'>('ALL');
  const [pendingPage, setPendingPage] = useState<number>(1);
  const [loadingPending, setLoadingPending] = useState<boolean>(false);

  const [directoryItems, setDirectoryItems] = useState<GovernanceAccountRecord[]>([]);
  const [directoryTotal, setDirectoryTotal] = useState<number>(0);
  const [directorySearch, setDirectorySearch] = useState<string>('');
  const [directoryStatusFilter, setDirectoryStatusFilter] = useState<AccountApprovalStatus | 'ALL'>('ALL');
  const [directoryRoleFilter, setDirectoryRoleFilter] = useState<AccountRole | 'ALL'>('ALL');
  const [directoryPage, setDirectoryPage] = useState<number>(1);
  const [loadingDirectory, setLoadingDirectory] = useState<boolean>(false);

  const [managersList, setManagersList] = useState<ManagerSummary[]>([]);
  const [managerGrants, setManagerGrants] = useState<ManagerGrantRecord[]>([]);
  const [loadingDelegation, setLoadingDelegation] = useState<boolean>(false);
  const [delegationReason, setDelegationReason] = useState<string>('');
  const [submittingCapKey, setSubmittingCapKey] = useState<string | null>(null);

  const [selectedRolesByTarget, setSelectedRolesByTarget] = useState<Record<string, AccountRole>>({});
  const [reasonsByTarget, setReasonsByTarget] = useState<Record<string, string>>({});
  const [submittingTargetId, setSubmittingTargetId] = useState<string | null>(null);

  const [selectedDetail, setSelectedDetail] = useState<GovernanceAccountDetail | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  const [appointTargetId, setAppointTargetId] = useState<string>('');
  const [appointExpectedVersion, setAppointExpectedVersion] = useState<number>(1);
  const [appointRole, setAppointRole] = useState<PrivilegedRole>('MANAGER');
  const [appointAction, setAppointAction] = useState<'GRANT' | 'REVOKE'>('GRANT');
  const [appointReason, setAppointReason] = useState<string>('');
  const [appointConfirmed, setAppointConfirmed] = useState<boolean>(false);
  const [submittingAppoint, setSubmittingAppoint] = useState<boolean>(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const setErrorFeedbackFromCode = useCallback(
    (errorCode?: GovernanceErrorCode) => {
      const code: GovernanceErrorCode = errorCode ?? 'governance_operation_failed';
      setFeedback({
        type: 'error',
        message: pickText(ERROR_MESSAGES[code] || ERROR_MESSAGES.governance_operation_failed, language),
      });
    },
    [language],
  );

  const loadScope = useCallback(async () => {
    setLoadingScope(true);
    setScopeError(null);
    const result = await fetchGovernanceActorScope();
    if (!result.ok || !result.data) {
      const code: GovernanceErrorCode = result.errorCode ?? 'governance_operation_failed';
      setScope(null);
      setScopeError(code);
      onScopeVerified?.(false, null);
      setLoadingScope(false);
      return;
    }
    setScope(result.data);
    setScopeError(null);
    onScopeVerified?.(true, result.data);
    setLoadingScope(false);
  }, [onScopeVerified]);

  const loadPending = useCallback(async () => {
    setLoadingPending(true);
    const limit = 10;
    const offset = (pendingPage - 1) * limit;
    const result = await listPendingAccounts({
      search: pendingSearch,
      requestedRole: pendingRoleFilter,
      limit,
      offset,
    });
    if (result.ok && result.data) {
      setPendingItems(result.data.items);
      setPendingTotal(result.data.totalCount);
    } else if (result.errorCode === 'backend_unavailable') {
      setScopeError('backend_unavailable');
    } else {
      setErrorFeedbackFromCode(result.errorCode);
    }
    setLoadingPending(false);
  }, [pendingSearch, pendingRoleFilter, pendingPage, setErrorFeedbackFromCode]);

  const loadDirectory = useCallback(async () => {
    setLoadingDirectory(true);
    const limit = 12;
    const offset = (directoryPage - 1) * limit;
    const result = await listAccountDirectory({
      search: directorySearch,
      status: directoryStatusFilter,
      role: directoryRoleFilter,
      limit,
      offset,
    });
    if (result.ok && result.data) {
      setDirectoryItems(result.data.items);
      setDirectoryTotal(result.data.totalCount);
    } else if (result.errorCode === 'backend_unavailable') {
      setScopeError('backend_unavailable');
    } else {
      setErrorFeedbackFromCode(result.errorCode);
    }
    setLoadingDirectory(false);
  }, [directorySearch, directoryStatusFilter, directoryRoleFilter, directoryPage, setErrorFeedbackFromCode]);

  const loadManagerDelegation = useCallback(async () => {
    if (ordinaryReviewOnly) return;
    setLoadingDelegation(true);
    const result = await listManagerGrants();
    if (result.ok && result.data) {
      setManagersList(result.data.managers);
      setManagerGrants(result.data.grants);
    } else if (result.errorCode === 'backend_unavailable') {
      setScopeError('backend_unavailable');
    } else {
      setErrorFeedbackFromCode(result.errorCode);
    }
    setLoadingDelegation(false);
  }, [ordinaryReviewOnly, setErrorFeedbackFromCode]);

  useEffect(() => {
    void loadScope();
  }, [loadScope]);

  useEffect(() => {
    if (!scope || scopeError) return;
    if (activeSection === 'pending-approvals' || activeSection === 'control-center') {
      void loadPending();
    }
    if (activeSection === 'user-directory' || activeSection === 'role-governance') {
      void loadDirectory();
    }
    if (activeSection === 'manager-delegation' && !ordinaryReviewOnly) {
      void loadManagerDelegation();
    }
  }, [activeSection, scope, scopeError, ordinaryReviewOnly, loadPending, loadDirectory, loadManagerDelegation]);

  const handleReviewDecision = async (
    account: GovernanceAccountRecord,
    decision: GovernanceLifecycleDecision,
  ) => {
    setFeedback(null);
    const reason = (reasonsByTarget[account.id] || '').trim();
    const assignedRole =
      selectedRolesByTarget[account.id] || account.activeRoles[0] || account.requestedRole;

    setSubmittingTargetId(account.id);
    const result = await reviewAccountLifecycle({
      targetUserId: account.id,
      decision,
      assignedRole,
      reason,
      expectedVersion: account.governanceVersion,
    });
    setSubmittingTargetId(null);

    if (!result.ok) {
      setErrorFeedbackFromCode(result.errorCode);
      return;
    }

    setFeedback({
      type: 'success',
      message: pickText(
        {
          ar: `تم تحديث حالة الحساب (${account.fullName}) إلى ${result.data?.accountStatus} وتوثيق العملية في سجل التدقيق.`,
          fr: `Statut du compte (${account.fullName}) mis à jour vers ${result.data?.accountStatus} avec trace d’audit.`,
          en: `Updated ${account.fullName} to ${result.data?.accountStatus} and recorded immutable audit log.`,
        },
        language,
      ),
    });

    setReasonsByTarget((prev) => ({ ...prev, [account.id]: '' }));
    await Promise.all([loadScope(), loadPending(), loadDirectory()]);
    if (selectedDetail?.account.id === account.id) {
      const detailRes = await getAccountGovernanceDetail(account.id);
      if (detailRes.ok && detailRes.data) setSelectedDetail(detailRes.data);
    }
  };

  const handleInspectAccountDetail = async (userId: string) => {
    setLoadingDetailId(userId);
    const result = await getAccountGovernanceDetail(userId);
    setLoadingDetailId(null);
    if (result.ok && result.data) {
      setSelectedDetail(result.data);
    } else {
      setErrorFeedbackFromCode(result.errorCode);
    }
  };

  const handlePrivilegedAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmittingAppoint(true);

    const result = await appointPrivilegedRole({
      targetUserId: appointTargetId.trim(),
      role: appointRole,
      action: appointAction,
      reason: appointReason.trim(),
      expectedVersion: appointExpectedVersion,
      confirmed: appointConfirmed,
    });
    setSubmittingAppoint(false);

    if (!result.ok) {
      setErrorFeedbackFromCode(result.errorCode);
      return;
    }

    setFeedback({
      type: 'success',
      message: pickText(
        {
          ar: `تم تنفيذ عملية الدور القيادي (${appointAction} ${appointRole}) وتوثيقها في سجل التدقيق.`,
          fr: `Opération sur rôle privilégié (${appointAction} ${appointRole}) enregistrée dans le journal d’audit.`,
          en: `Privileged role operation (${appointAction} ${appointRole}) committed and recorded in the audit log.`,
        },
        language,
      ),
    });
    setAppointReason('');
    setAppointConfirmed(false);
    await Promise.all([loadScope(), loadDirectory()]);
  };

  const handleToggleManagerCapability = async (
    managerUserId: string,
    capability: string,
    nextActive: boolean,
  ) => {
    setFeedback(null);
    const reason = delegationReason.trim();
    if (reason.length < 3 || reason.length > 500) {
      setErrorFeedbackFromCode('reason_required');
      return;
    }

    const capKey = `${managerUserId}:${capability}`;
    setSubmittingCapKey(capKey);
    const result = await setManagerCapability({
      managerUserId,
      capability,
      active: nextActive,
      reason,
    });
    setSubmittingCapKey(null);

    if (!result.ok) {
      setErrorFeedbackFromCode(result.errorCode);
      return;
    }

    setFeedback({
      type: 'success',
      message: pickText(
        {
          ar: `تم ${nextActive ? 'تفعيل' : 'سحب'} صلاحية ${capability} وتوثيق القرار في سجل التدقيق.`,
          fr: `Capacité ${capability} ${nextActive ? 'activée' : 'révoquée'} avec trace d’audit.`,
          en: `${nextActive ? 'Granted' : 'Revoked'} capability ${capability} and recorded immutable audit log.`,
        },
        language,
      ),
    });
    await Promise.all([loadManagerDelegation(), loadScope()]);
  };

  const sectionTabs = ordinaryReviewOnly
    ? ALL_GOVERNANCE_SECTION_TABS.filter(
        (tab) => tab.key !== 'manager-delegation' && tab.key !== 'role-governance',
      )
    : ALL_GOVERNANCE_SECTION_TABS;

  const assignableRoles: readonly AccountRole[] = scope?.assignableRoles?.length
    ? scope.assignableRoles
    : ORDINARY_ROLES;

  return {
    language, theme, operationalCounts,
    loadingScope, scope, scopeError, sectionTabs, assignableRoles,
    pendingItems, pendingTotal, pendingSearch, setPendingSearch,
    pendingRoleFilter, setPendingRoleFilter, pendingPage, setPendingPage, loadingPending,
    directoryItems, directoryTotal, directorySearch, setDirectorySearch,
    directoryStatusFilter, setDirectoryStatusFilter, directoryRoleFilter, setDirectoryRoleFilter,
    directoryPage, setDirectoryPage, loadingDirectory,
    managersList, managerGrants, loadingDelegation,
    delegationReason, setDelegationReason, submittingCapKey,
    selectedRolesByTarget, setSelectedRolesByTarget,
    reasonsByTarget, setReasonsByTarget, submittingTargetId,
    selectedDetail, setSelectedDetail, loadingDetailId,
    appointTargetId, setAppointTargetId, appointExpectedVersion, setAppointExpectedVersion,
    appointRole, setAppointRole, appointAction, setAppointAction,
    appointReason, setAppointReason, appointConfirmed, setAppointConfirmed, submittingAppoint,
    feedback, loadScope, loadPending, loadDirectory, loadManagerDelegation,
    handleReviewDecision, handleInspectAccountDetail,
    handlePrivilegedAppointmentSubmit, handleToggleManagerCapability,
  };
}
