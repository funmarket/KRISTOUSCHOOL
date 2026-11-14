import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

globalThis.__KRISTOU_SUPABASE_URL__ = '';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = '';

const SEVEN_ROLES = [
  'APP_ADMIN',
  'MANAGER',
  'ADMINISTRATIVE_PERSONNEL',
  'TEACHER',
  'SCHOOL_STAFF',
  'PARENT',
  'STUDENT',
];

const ORDINARY_ROLES = [
  'ADMINISTRATIVE_PERSONNEL',
  'TEACHER',
  'SCHOOL_STAFF',
  'PARENT',
  'STUDENT',
];

test('GOV-01A.1 — SUSPENDED status is reconciled in src/types.ts, homepageAccess.ts, ApplicationStatusScreen.tsx, and src/lib/auth.ts', async () => {
  const typesSource = fs.readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8');
  assert.match(
    typesSource,
    /export type AccountApprovalStatus\s*=\s*'APPROVED'\s*\|\s*'PENDING'\s*\|\s*'REJECTED'\s*\|\s*'SUSPENDED'\s*\|\s*'REVOKED'/,
    'Expected AccountApprovalStatus in src/types.ts to include SUSPENDED',
  );

  const accessModule = await import('../src/components/homepages/homepageAccess.ts');

  for (const role of SEVEN_ROLES) {
    const suspendedUser = {
      id: `u-susp-${role.toLowerCase()}`,
      username: `susp_${role.toLowerCase()}`,
      fullName: `Suspended ${role}`,
      role,
      accountStatus: 'SUSPENDED',
      requestedRole: role,
      capabilities: [role],
    };

    const defaultDecision = accessModule.resolveHomePage({ user: suspendedUser });
    assert.equal(
      defaultDecision.targetPage,
      'APPLICATION_STATUS',
      `Suspended ${role} must resolve to APPLICATION_STATUS`,
    );
    assert.equal(defaultDecision.allowed, true);

    const privateAttempt = accessModule.resolveHomePage({
      user: suspendedUser,
      requestedPage: accessModule.ROLE_TO_HOMEPAGE[role],
    });
    assert.equal(privateAttempt.targetPage, 'APPLICATION_STATUS');
    assert.equal(privateAttempt.allowed, false);
    assert.equal(privateAttempt.deniedReason, 'account_status_suspended');

    const publicAttempt = accessModule.resolveHomePage({
      user: suspendedUser,
      requestedPage: 'PUBLIC_HOME',
    });
    assert.equal(publicAttempt.targetPage, 'PUBLIC_HOME');
    assert.equal(publicAttempt.allowed, true);

    // Denied all private tabs
    for (const privateTab of ['classes', 'community', 'notes', 'pickup']) {
      assert.equal(
        accessModule.canAccessAppTab(suspendedUser, privateTab),
        false,
        `Suspended ${role} must be denied access to private tab ${privateTab}`,
      );
    }

    // Zero oversight targets when suspended
    assert.deepEqual(accessModule.getDelegatedOversightTargets(suspendedUser), []);
  }

  // ApplicationStatusScreen includes trilingual SUSPENDED copy
  const appStatusSource = fs.readFileSync(
    new URL('../src/components/homepages/ApplicationStatusScreen.tsx', import.meta.url),
    'utf8',
  );
  assert.match(appStatusSource, /SUSPENDED:/, 'Expected SUSPENDED status copy in ApplicationStatusScreen.tsx');

  // loadCanonicalUser rejects SUSPENDED / PENDING accounts even if role_assignments has an active row
  const authModule = await import('../src/lib/auth.ts');
  for (const blockedStatus of ['PENDING', 'REJECTED', 'SUSPENDED', 'REVOKED']) {
    const mockClientWithStatus = {
      from: (table) => ({
        select: () => ({
          eq: () => {
            if (table === 'profiles') {
              return {
                single: async () => ({
                  data: {
                    id: 'u-status-1',
                    username: 'status_user',
                    full_name: 'Status User',
                    email: 'status@example.com',
                    avatar_url: null,
                    account_status: blockedStatus,
                  },
                  error: null,
                }),
              };
            }
            if (table === 'role_assignments') {
              return {
                eq: async () => ({
                  data: [{ role: 'PARENT' }],
                  error: null,
                }),
              };
            }
            if (table === 'telegram_identities') {
              return {
                maybeSingle: async () => ({ data: null, error: null }),
              };
            }
            throw new Error(`Unexpected table ${table}`);
          },
        }),
      }),
    };

    await assert.rejects(
      () => authModule.loadCanonicalUser({ id: 'u-status-1', email: 'status@example.com' }, mockClientWithStatus),
      /account_not_approved/,
      `Expected loadCanonicalUser to fail closed when account_status is ${blockedStatus}`,
    );
  }
});

test('GOV-01B & GOV-01C — Comprehensive 7-role allow/deny matrix, self-governance denial, privileged role protection, last-Owner guard, concurrency, and audit trail', async () => {
  const govUrl = new URL('../src/lib/accountGovernance.ts', import.meta.url);
  assert.equal(fs.existsSync(govUrl), true, 'Expected src/lib/accountGovernance.ts to exist');
  const gov = await import(govUrl.href);

  const createFixtureHarness = () =>
    gov.createInMemoryGovernanceTestHarness([
      {
        id: 'owner-1',
        username: 'owner_one',
        fullName: 'Primary School Owner',
        email: 'owner1@kristou.example',
        phone: '+21620111222',
        emailConfirmed: true,
        phoneConfirmed: true,
        requestedRole: 'APP_ADMIN',
        accountStatus: 'APPROVED',
        activeRoles: ['APP_ADMIN'],
        capabilities: [],
        governanceVersion: 1,
        createdAt: '2026-11-01T08:00:00.000Z',
      },
      {
        id: 'owner-2',
        username: 'owner_two',
        fullName: 'Secondary School Owner',
        email: 'owner2@kristou.example',
        phone: null,
        emailConfirmed: true,
        phoneConfirmed: false,
        requestedRole: 'APP_ADMIN',
        accountStatus: 'APPROVED',
        activeRoles: ['APP_ADMIN'],
        capabilities: [],
        governanceVersion: 1,
        createdAt: '2026-11-01T09:00:00.000Z',
      },
      {
        id: 'manager-plain',
        username: 'manager_plain',
        fullName: 'Manager Without Approval Grant',
        email: 'mgr_plain@kristou.example',
        phone: null,
        emailConfirmed: true,
        phoneConfirmed: false,
        requestedRole: 'MANAGER',
        accountStatus: 'APPROVED',
        activeRoles: ['MANAGER'],
        capabilities: ['CAN_MANAGE_FOOD_MENU'],
        governanceVersion: 1,
        createdAt: '2026-11-02T08:00:00.000Z',
      },
      {
        id: 'manager-delegated',
        username: 'manager_delegated',
        fullName: 'Manager With Approval Grant',
        email: 'mgr_del@kristou.example',
        phone: null,
        emailConfirmed: true,
        phoneConfirmed: false,
        requestedRole: 'MANAGER',
        accountStatus: 'APPROVED',
        activeRoles: ['MANAGER'],
        capabilities: ['ACCOUNT_APPROVAL_REVIEW'],
        governanceVersion: 1,
        createdAt: '2026-11-02T09:00:00.000Z',
      },
      {
        id: 'admin-1',
        username: 'admin_office_one',
        fullName: 'Admin Personnel One',
        email: 'admin1@kristou.example',
        phone: null,
        emailConfirmed: true,
        phoneConfirmed: false,
        requestedRole: 'ADMINISTRATIVE_PERSONNEL',
        accountStatus: 'APPROVED',
        activeRoles: ['ADMINISTRATIVE_PERSONNEL'],
        capabilities: [],
        staffId: 'ADM-001',
        governanceVersion: 1,
        createdAt: '2026-11-03T08:00:00.000Z',
      },
      {
        id: 'admin-2',
        username: 'admin_office_two',
        fullName: 'Admin Personnel Two',
        email: 'admin2@kristou.example',
        phone: null,
        emailConfirmed: true,
        phoneConfirmed: false,
        requestedRole: 'ADMINISTRATIVE_PERSONNEL',
        accountStatus: 'APPROVED',
        activeRoles: ['ADMINISTRATIVE_PERSONNEL'],
        capabilities: [],
        staffId: 'ADM-002',
        governanceVersion: 1,
        createdAt: '2026-11-03T09:00:00.000Z',
      },
      {
        id: 'teacher-1',
        username: 'teacher_one',
        fullName: 'Approved Teacher',
        email: 'teacher1@kristou.example',
        phone: null,
        emailConfirmed: true,
        phoneConfirmed: false,
        requestedRole: 'TEACHER',
        accountStatus: 'APPROVED',
        activeRoles: ['TEACHER'],
        capabilities: [],
        staffId: 'TCH-001',
        governanceVersion: 1,
        createdAt: '2026-11-04T08:00:00.000Z',
      },
      {
        id: 'staff-1',
        username: 'staff_one',
        fullName: 'Approved School Staff',
        email: 'staff1@kristou.example',
        phone: null,
        emailConfirmed: true,
        phoneConfirmed: false,
        requestedRole: 'SCHOOL_STAFF',
        accountStatus: 'APPROVED',
        activeRoles: ['SCHOOL_STAFF'],
        capabilities: [],
        staffId: 'STF-001',
        governanceVersion: 1,
        createdAt: '2026-11-04T09:00:00.000Z',
      },
      {
        id: 'parent-1',
        username: 'parent_one',
        fullName: 'Approved Parent',
        email: 'parent1@kristou.example',
        phone: '+21622333444',
        emailConfirmed: true,
        phoneConfirmed: true,
        requestedRole: 'PARENT',
        accountStatus: 'APPROVED',
        activeRoles: ['PARENT'],
        capabilities: [],
        governanceVersion: 1,
        createdAt: '2026-11-04T10:00:00.000Z',
      },
      {
        id: 'student-1',
        username: 'student_one',
        fullName: 'Approved Student',
        email: 'student1@kristou.example',
        phone: null,
        emailConfirmed: true,
        phoneConfirmed: false,
        requestedRole: 'STUDENT',
        accountStatus: 'APPROVED',
        activeRoles: ['STUDENT'],
        capabilities: [],
        admissionId: 'STU-001',
        governanceVersion: 1,
        createdAt: '2026-11-04T11:00:00.000Z',
      },
      {
        id: 'pending-parent',
        username: 'applicant_parent',
        fullName: 'Pending Parent Applicant',
        email: 'pending_parent@kristou.example',
        phone: '+21655666777',
        emailConfirmed: true,
        phoneConfirmed: false,
        requestedRole: 'PARENT',
        accountStatus: 'PENDING',
        activeRoles: [],
        capabilities: [],
        governanceVersion: 1,
        createdAt: '2026-11-10T08:00:00.000Z',
      },
      {
        id: 'pending-teacher',
        username: 'applicant_teacher',
        fullName: 'Pending Teacher Applicant',
        email: 'pending_teacher@kristou.example',
        phone: null,
        emailConfirmed: true,
        phoneConfirmed: false,
        requestedRole: 'TEACHER',
        accountStatus: 'PENDING',
        activeRoles: [],
        capabilities: [],
        staffId: 'TCH-099',
        governanceVersion: 1,
        createdAt: '2026-11-10T09:00:00.000Z',
      },
      {
        id: 'pending-admin',
        username: 'applicant_admin',
        fullName: 'Pending Admin Personnel Applicant',
        email: 'pending_admin@kristou.example',
        phone: null,
        emailConfirmed: true,
        phoneConfirmed: false,
        requestedRole: 'ADMINISTRATIVE_PERSONNEL',
        accountStatus: 'PENDING',
        activeRoles: [],
        capabilities: [],
        staffId: 'ADM-099',
        governanceVersion: 1,
        createdAt: '2026-11-10T10:00:00.000Z',
      },
      {
        id: 'pending-manager-req',
        username: 'applicant_manager',
        fullName: 'Pending Manager Applicant',
        email: 'pending_mgr@kristou.example',
        phone: null,
        emailConfirmed: true,
        phoneConfirmed: false,
        requestedRole: 'MANAGER',
        accountStatus: 'PENDING',
        activeRoles: [],
        capabilities: [],
        governanceVersion: 1,
        createdAt: '2026-11-10T11:00:00.000Z',
      },
      {
        id: 'pending-owner-req',
        username: 'applicant_owner',
        fullName: 'Pending Owner Applicant',
        email: 'pending_owner@kristou.example',
        phone: null,
        emailConfirmed: true,
        phoneConfirmed: false,
        requestedRole: 'APP_ADMIN',
        accountStatus: 'PENDING',
        activeRoles: [],
        capabilities: [],
        governanceVersion: 1,
        createdAt: '2026-11-10T12:00:00.000Z',
      },
      {
        id: 'pending-unconfirmed',
        username: 'applicant_unconfirmed',
        fullName: 'Unconfirmed Contact Applicant',
        email: 'unconfirmed@kristou.example',
        phone: null,
        emailConfirmed: false,
        phoneConfirmed: false,
        requestedRole: 'PARENT',
        accountStatus: 'PENDING',
        activeRoles: [],
        capabilities: [],
        governanceVersion: 1,
        createdAt: '2026-11-10T13:00:00.000Z',
      },
    ]);

  const harness = createFixtureHarness();

  // 1. Anonymous caller is denied on all governance operations
  const anonClient = harness.asActor(null);
  const anonScope = await gov.fetchGovernanceActorScope(anonClient);
  assert.equal(anonScope.ok, false);
  assert.equal(anonScope.errorCode, 'actor_unauthenticated');

  const anonList = await gov.listPendingAccounts({}, anonClient);
  assert.equal(anonList.ok, false);
  assert.equal(anonList.errorCode, 'actor_unauthenticated');

  const anonApprove = await gov.reviewAccountLifecycle(
    {
      targetUserId: 'pending-parent',
      decision: 'APPROVE',
      reason: 'Attempt by anonymous caller',
      expectedVersion: 1,
    },
    anonClient,
  );
  assert.equal(anonApprove.ok, false);
  assert.equal(anonApprove.errorCode, 'actor_unauthenticated');

  // 2. Non-approved actors (PENDING, REJECTED, SUSPENDED, REVOKED) are denied even if requesting APP_ADMIN
  for (const pendingId of ['pending-parent', 'pending-owner-req']) {
    const unapprovedClient = harness.asActor(pendingId);
    const res = await gov.reviewAccountLifecycle(
      {
        targetUserId: 'pending-teacher',
        decision: 'APPROVE',
        reason: 'Attempt by unapproved applicant',
        expectedVersion: 1,
      },
      unapprovedClient,
    );
    assert.equal(res.ok, false);
    assert.equal(res.errorCode, 'actor_not_approved');
  }

  // 3. Approved TEACHER, SCHOOL_STAFF, PARENT, STUDENT are denied all governance reads and writes
  for (const actorId of ['teacher-1', 'staff-1', 'parent-1', 'student-1']) {
    const client = harness.asActor(actorId);
    const listRes = await gov.listPendingAccounts({}, client);
    assert.equal(listRes.ok, false);
    assert.equal(listRes.errorCode, 'insufficient_governance_authority');

    const dirRes = await gov.listAccountDirectory({}, client);
    assert.equal(dirRes.ok, false);
    assert.equal(dirRes.errorCode, 'insufficient_governance_authority');

    const reviewRes = await gov.reviewAccountLifecycle(
      {
        targetUserId: 'pending-parent',
        decision: 'APPROVE',
        reason: 'Attempt by non-governance role',
        expectedVersion: 1,
      },
      client,
    );
    assert.equal(reviewRes.ok, false);
    assert.equal(reviewRes.errorCode, 'insufficient_governance_authority');

    const appointRes = await gov.appointPrivilegedRole(
      {
        targetUserId: 'teacher-1',
        role: 'MANAGER',
        action: 'GRANT',
        reason: 'Attempt to self-promote',
        expectedVersion: 1,
        confirmed: true,
      },
      client,
    );
    assert.equal(appointRes.ok, false);
    assert.equal(appointRes.errorCode, 'owner_only_operation');
  }

  // 4. MANAGER without explicit ACCOUNT_APPROVAL_REVIEW delegation is denied governance reads & writes
  const plainMgrClient = harness.asActor('manager-plain');
  const plainMgrList = await gov.listPendingAccounts({}, plainMgrClient);
  assert.equal(plainMgrList.ok, false);
  assert.equal(plainMgrList.errorCode, 'manager_delegation_required');

  const plainMgrReview = await gov.reviewAccountLifecycle(
    {
      targetUserId: 'pending-parent',
      decision: 'APPROVE',
      reason: 'Manager without grant attempt',
      expectedVersion: 1,
    },
    plainMgrClient,
  );
  assert.equal(plainMgrReview.ok, false);
  assert.equal(plainMgrReview.errorCode, 'manager_delegation_required');

  // 5. ADMINISTRATIVE_PERSONNEL automatic ordinary governance:
  //    - Can list pending accounts & read directory
  //    - Cannot govern self (self_governance_denied)
  //    - Cannot approve/suspend/revoke/reactivate/appoint APP_ADMIN or MANAGER (privileged_target_requires_owner / owner_only_operation)
  //    - Can approve, suspend, revoke, and reactivate other ordinary accounts (including another ADMINISTRATIVE_PERSONNEL)
  const admin1Client = harness.asActor('admin-1');
  const adminScope = await gov.fetchGovernanceActorScope(admin1Client);
  assert.equal(adminScope.ok, true);
  assert.equal(adminScope.data.canReviewOrdinaryAccounts, true);
  assert.equal(adminScope.data.canAppointPrivilegedRoles, false);
  assert.deepEqual(new Set(adminScope.data.assignableRoles), new Set(ORDINARY_ROLES));

  // Admin 1 self-governance denial
  for (const selfDecision of ['SUSPEND', 'REVOKE', 'APPROVE', 'REACTIVATE']) {
    const selfRes = await gov.reviewAccountLifecycle(
      {
        targetUserId: 'admin-1',
        decision: selfDecision,
        reason: 'Attempting self action',
        expectedVersion: 1,
      },
      admin1Client,
    );
    assert.equal(selfRes.ok, false, `Admin must be denied ${selfDecision} on self`);
    assert.equal(selfRes.errorCode, 'self_governance_denied');
  }

  // Admin 1 privileged target denial (cannot act on existing Owner/Manager or pending applicant requesting Owner/Manager, or assign Owner/Manager)
  for (const privTargetId of ['owner-1', 'manager-plain', 'pending-manager-req', 'pending-owner-req']) {
    const privRes = await gov.reviewAccountLifecycle(
      {
        targetUserId: privTargetId,
        decision: privTargetId.startsWith('pending-') ? 'APPROVE' : 'SUSPEND',
        reason: 'Admin attempting action on privileged account',
        expectedVersion: 1,
      },
      admin1Client,
    );
    assert.equal(privRes.ok, false, `Admin must be denied governance on ${privTargetId}`);
    assert.equal(privRes.errorCode, 'privileged_target_requires_owner');
  }

  // Admin 1 cannot assign MANAGER role to an ordinary pending applicant
  const adminEscalateAttempt = await gov.reviewAccountLifecycle(
    {
      targetUserId: 'pending-parent',
      decision: 'APPROVE',
      assignedRole: 'MANAGER',
      reason: 'Admin trying to assign MANAGER',
      expectedVersion: 1,
    },
    admin1Client,
  );
  assert.equal(adminEscalateAttempt.ok, false);
  assert.equal(adminEscalateAttempt.errorCode, 'privileged_target_requires_owner');

  // Admin 1 cannot call appointPrivilegedRole
  const adminAppointAttempt = await gov.appointPrivilegedRole(
    {
      targetUserId: 'admin-2',
      role: 'MANAGER',
      action: 'GRANT',
      reason: 'Admin trying to appoint Manager',
      expectedVersion: 1,
      confirmed: true,
    },
    admin1Client,
  );
  assert.equal(adminAppointAttempt.ok, false);
  assert.equal(adminAppointAttempt.errorCode, 'owner_only_operation');

  // Admin 1 CAN approve another pending ADMINISTRATIVE_PERSONNEL ('pending-admin')
  const approveOtherAdmin = await gov.reviewAccountLifecycle(
    {
      targetUserId: 'pending-admin',
      decision: 'APPROVE',
      reason: 'Verified administrative office employment contract',
      expectedVersion: 1,
    },
    admin1Client,
  );
  assert.equal(approveOtherAdmin.ok, true);
  assert.equal(approveOtherAdmin.data.accountStatus, 'APPROVED');
  assert.deepEqual(approveOtherAdmin.data.activeRoles, ['ADMINISTRATIVE_PERSONNEL']);
  assert.equal(approveOtherAdmin.data.governanceVersion, 2);
  assert.ok(approveOtherAdmin.data.auditLogId);

  // Admin 1 CAN suspend and reactivate another approved ADMINISTRATIVE_PERSONNEL ('admin-2')
  const suspendAdmin2 = await gov.reviewAccountLifecycle(
    {
      targetUserId: 'admin-2',
      decision: 'SUSPEND',
      reason: 'Temporary administrative leave',
      expectedVersion: 1,
    },
    admin1Client,
  );
  assert.equal(suspendAdmin2.ok, true);
  assert.equal(suspendAdmin2.data.accountStatus, 'SUSPENDED');
  assert.deepEqual(suspendAdmin2.data.activeRoles, []);

  // While admin-2 is SUSPENDED, admin-2 cannot perform any governance actions!
  const suspendedAdmin2Client = harness.asActor('admin-2');
  const suspendedAdminAttempt = await gov.listPendingAccounts({}, suspendedAdmin2Client);
  assert.equal(suspendedAdminAttempt.ok, false);
  assert.equal(suspendedAdminAttempt.errorCode, 'actor_not_approved');

  // Admin 1 reactivates admin-2
  const reactivateAdmin2 = await gov.reviewAccountLifecycle(
    {
      targetUserId: 'admin-2',
      decision: 'REACTIVATE',
      reason: 'Returned from administrative leave',
      expectedVersion: 2,
    },
    admin1Client,
  );
  assert.equal(reactivateAdmin2.ok, true);
  assert.equal(reactivateAdmin2.data.accountStatus, 'APPROVED');
  assert.deepEqual(reactivateAdmin2.data.activeRoles, ['ADMINISTRATIVE_PERSONNEL']);

  // 6. Delegated MANAGER ('manager-delegated' with ACCOUNT_APPROVAL_REVIEW) can approve ordinary accounts,
  //    but cannot govern self or privileged accounts
  const delMgrClient = harness.asActor('manager-delegated');
  const delMgrApproveParent = await gov.reviewAccountLifecycle(
    {
      targetUserId: 'pending-parent',
      decision: 'APPROVE',
      reason: 'Verified parent guardian enrollment link',
      expectedVersion: 1,
    },
    delMgrClient,
  );
  assert.equal(delMgrApproveParent.ok, true);
  assert.equal(delMgrApproveParent.data.accountStatus, 'APPROVED');
  assert.deepEqual(delMgrApproveParent.data.activeRoles, ['PARENT']);

  const delMgrPrivilegedAttempt = await gov.reviewAccountLifecycle(
    {
      targetUserId: 'pending-manager-req',
      decision: 'APPROVE',
      reason: 'Delegated manager trying to approve another manager',
      expectedVersion: 1,
    },
    delMgrClient,
  );
  assert.equal(delMgrPrivilegedAttempt.ok, false);
  assert.equal(delMgrPrivilegedAttempt.errorCode, 'privileged_target_requires_owner');

  // 7. Contact confirmation enforcement: cannot approve an account with unconfirmed email & phone
  const owner1Client = harness.asActor('owner-1');
  const unconfirmedApprove = await gov.reviewAccountLifecycle(
    {
      targetUserId: 'pending-unconfirmed',
      decision: 'APPROVE',
      reason: 'Attempt to approve before email/phone confirmation',
      expectedVersion: 1,
    },
    owner1Client,
  );
  assert.equal(unconfirmedApprove.ok, false);
  assert.equal(unconfirmedApprove.errorCode, 'contact_not_confirmed');

  // 8. Optimistic concurrency & idempotency:
  //    - Approving 'pending-teacher' with expectedVersion: 1 succeeds and increments version to 2
  //    - Re-submitting with stale expectedVersion: 1 (and different idempotency key) fails with version_conflict
  //    - Re-submitting with the SAME idempotencyKey returns the original committed result without duplicate audit rows
  const approveTeacher1 = await gov.reviewAccountLifecycle(
    {
      targetUserId: 'pending-teacher',
      decision: 'APPROVE',
      reason: 'Verified teacher contract TCH-099',
      expectedVersion: 1,
      idempotencyKey: 'idem-teacher-approve-001',
    },
    owner1Client,
  );
  assert.equal(approveTeacher1.ok, true);
  assert.equal(approveTeacher1.data.accountStatus, 'APPROVED');
  assert.equal(approveTeacher1.data.governanceVersion, 2);

  const auditCountAfterFirst = harness.getAuditLogs().length;
  const idempotentReplay = await gov.reviewAccountLifecycle(
    {
      targetUserId: 'pending-teacher',
      decision: 'APPROVE',
      reason: 'Verified teacher contract TCH-099',
      expectedVersion: 1,
      idempotencyKey: 'idem-teacher-approve-001',
    },
    owner1Client,
  );
  assert.equal(idempotentReplay.ok, true);
  assert.equal(idempotentReplay.data.auditLogId, approveTeacher1.data.auditLogId);
  assert.equal(harness.getAuditLogs().length, auditCountAfterFirst, 'Idempotent replay must not duplicate audit log rows');

  const staleConcurrentAttempt = await gov.reviewAccountLifecycle(
    {
      targetUserId: 'pending-teacher',
      decision: 'REJECT',
      reason: 'Concurrent reviewer with stale version',
      expectedVersion: 1,
    },
    admin1Client,
  );
  assert.equal(staleConcurrentAttempt.ok, false);
  assert.equal(staleConcurrentAttempt.errorCode, 'version_conflict');

  // 9. Owner-only privileged appointment & Last-Owner Protection:
  //    - Requires confirmed: true
  //    - Owner 1 can appoint verified 'pending-manager-req' to MANAGER
  //    - Owner 1 can revoke APP_ADMIN from 'owner-2' (since 2 active owners exist)
  //    - Owner 1 CANNOT revoke APP_ADMIN or suspend/revoke 'owner-1' when 'owner-1' is the LAST active Owner!
  const unconfirmedFlagAttempt = await gov.appointPrivilegedRole(
    {
      targetUserId: 'pending-manager-req',
      role: 'MANAGER',
      action: 'GRANT',
      reason: 'Appointing new school manager',
      expectedVersion: 1,
      confirmed: false,
    },
    owner1Client,
  );
  assert.equal(unconfirmedFlagAttempt.ok, false);
  assert.equal(unconfirmedFlagAttempt.errorCode, 'explicit_confirmation_required');

  const appointManagerRes = await gov.appointPrivilegedRole(
    {
      targetUserId: 'pending-manager-req',
      role: 'MANAGER',
      action: 'GRANT',
      reason: 'Appointed by School Owner after identity verification',
      expectedVersion: 1,
      confirmed: true,
    },
    owner1Client,
  );
  assert.equal(appointManagerRes.ok, true);
  assert.equal(appointManagerRes.data.accountStatus, 'APPROVED');
  assert.deepEqual(appointManagerRes.data.activeRoles, ['MANAGER']);

  // Remove APP_ADMIN from owner-2 (succeeds because owner-1 remains active)
  const removeOwner2 = await gov.appointPrivilegedRole(
    {
      targetUserId: 'owner-2',
      role: 'APP_ADMIN',
      action: 'REVOKE',
      reason: 'Concluding secondary owner tenure',
      expectedVersion: 1,
      confirmed: true,
    },
    owner1Client,
  );
  assert.equal(removeOwner2.ok, true);
  assert.deepEqual(removeOwner2.data.activeRoles, []);

  // Now owner-1 is the ONLY active APP_ADMIN — removing APP_ADMIN or suspending/revoking owner-1 must fail with last_owner_protection!
  const removeLastOwner = await gov.appointPrivilegedRole(
    {
      targetUserId: 'owner-1',
      role: 'APP_ADMIN',
      action: 'REVOKE',
      reason: 'Attempting to remove the last active owner',
      expectedVersion: 1,
      confirmed: true,
    },
    owner1Client,
  );
  assert.equal(removeLastOwner.ok, false);
  assert.equal(removeLastOwner.errorCode, 'last_owner_protection');

  const suspendLastOwner = await gov.reviewAccountLifecycle(
    {
      targetUserId: 'owner-1',
      decision: 'SUSPEND',
      reason: 'Attempting to suspend the last active owner',
      expectedVersion: 1,
    },
    owner1Client,
  );
  assert.equal(suspendLastOwner.ok, false);
  assert.equal(suspendLastOwner.errorCode, 'last_owner_protection');

  // 10. Audit trail completeness check
  const logs = harness.getAuditLogs();
  assert.ok(logs.length >= 6, `Expected at least 6 audit log entries, got ${logs.length}`);
  for (const entry of logs) {
    assert.ok(entry.id, 'Audit entry must have id');
    assert.ok(entry.actorUserId, 'Audit entry must record actorUserId');
    assert.ok(SEVEN_ROLES.includes(entry.actorRole), `Invalid actorRole ${entry.actorRole}`);
    assert.ok(entry.targetUserId, 'Audit entry must record targetUserId');
    assert.ok(entry.action, 'Audit entry must record action');
    assert.ok(entry.previousStatus, 'Audit entry must record previousStatus');
    assert.ok(entry.resultingStatus, 'Audit entry must record resultingStatus');
    assert.ok(Array.isArray(entry.previousRoles), 'Audit entry must record previousRoles');
    assert.ok(Array.isArray(entry.resultingRoles), 'Audit entry must record resultingRoles');
    assert.ok(entry.reason && entry.reason.length >= 3, 'Audit entry must record reason');
    assert.ok(entry.createdAt, 'Audit entry must record timestamp');
  }
});

test('GOV-01 Section 7 — Honest non-availability when backend contract is not deployed (zero mock approvals or fake rows)', async () => {
  const gov = await import('../src/lib/accountGovernance.ts');

  // 1. When Supabase is not configured (null client), all governance calls fail closed with backend_unavailable
  const unconfiguredScope = await gov.fetchGovernanceActorScope(null);
  assert.equal(unconfiguredScope.ok, false);
  assert.equal(unconfiguredScope.errorCode, 'backend_unavailable');

  // 2. When Supabase client returns PGRST202 (RPC function not found in schema cache because migration is not deployed)
  const undeployedRpcClient = {
    rpc: async (fnName) => ({
      data: null,
      error: {
        code: 'PGRST202',
        message: `Could not find the function public.${fnName} in the schema cache`,
      },
    }),
  };

  const scopeRes = await gov.fetchGovernanceActorScope(undeployedRpcClient);
  assert.equal(scopeRes.ok, false);
  assert.equal(scopeRes.errorCode, 'backend_unavailable');

  const pendingRes = await gov.listPendingAccounts({}, undeployedRpcClient);
  assert.equal(pendingRes.ok, false);
  assert.equal(pendingRes.errorCode, 'backend_unavailable');

  const dirRes = await gov.listAccountDirectory({}, undeployedRpcClient);
  assert.equal(dirRes.ok, false);
  assert.equal(dirRes.errorCode, 'backend_unavailable');

  const reviewRes = await gov.reviewAccountLifecycle(
    {
      targetUserId: '00000000-0000-4000-8000-000000000001',
      decision: 'APPROVE',
      reason: 'Testing undeployed RPC',
      expectedVersion: 1,
    },
    undeployedRpcClient,
  );
  assert.equal(reviewRes.ok, false);
  assert.equal(reviewRes.errorCode, 'backend_unavailable');

  const appointRes = await gov.appointPrivilegedRole(
    {
      targetUserId: '00000000-0000-4000-8000-000000000001',
      role: 'MANAGER',
      action: 'GRANT',
      reason: 'Testing undeployed RPC',
      expectedVersion: 1,
      confirmed: true,
    },
    undeployedRpcClient,
  );
  assert.equal(appointRes.ok, false);
  assert.equal(appointRes.errorCode, 'backend_unavailable');
});

test('GOV-01 Section 2 & Section 5 — OwnerHomePage wiring, visual preservation, and SQL migration/pgTAP artifacts', () => {
  const ownerHomeSource = fs.readFileSync(
    new URL('../src/components/homepages/OwnerHomePage.tsx', import.meta.url),
    'utf8',
  );

  // Visual structure & card IDs preserved
  for (const cardId of [
    'owner-control-center',
    'owner-pickup',
    'owner-classes',
    'owner-registration',
    'owner-broadcasts',
    'owner-food-menu',
    'owner-public-content',
    'owner-pending-approvals',
    'owner-user-directory',
    'owner-manager-delegation',
    'owner-role-governance',
    'owner-directory-oversight',
    'owner-school-settings',
  ]) {
    assert.match(ownerHomeSource, new RegExp(`id="${cardId}"`), `Expected OwnerHomePage to preserve card id="${cardId}"`);
  }

  // Wires OwnerGovernanceWorkspace for control-center, pending-approvals, user-directory, and role-governance
  assert.match(ownerHomeSource, /OwnerGovernanceWorkspace/, 'Expected OwnerHomePage to wire OwnerGovernanceWorkspace');

  const workspacePath = new URL('../src/components/homepages/OwnerGovernanceWorkspace.tsx', import.meta.url);
  assert.equal(fs.existsSync(workspacePath), true, 'Expected src/components/homepages/OwnerGovernanceWorkspace.tsx to exist');
  const workspaceSource = fs.readFileSync(workspacePath, 'utf8');
  assert.doesNotMatch(workspaceSource, /MOCK_USERS|MOCK_CHILDREN/, 'OwnerGovernanceWorkspace must never use mock users');
  assert.match(workspaceSource, /listPendingAccounts/, 'OwnerGovernanceWorkspace must wire listPendingAccounts');
  assert.match(workspaceSource, /listAccountDirectory/, 'OwnerGovernanceWorkspace must wire listAccountDirectory');
  assert.match(workspaceSource, /reviewAccountLifecycle/, 'OwnerGovernanceWorkspace must wire reviewAccountLifecycle');
  assert.match(workspaceSource, /appointPrivilegedRole/, 'OwnerGovernanceWorkspace must wire appointPrivilegedRole');

  // Verify SQL migration and pgTAP security test files exist and preserve the 7-role model
  const migrationPath = new URL(
    '../supabase/migrations/20261113150000_account_governance_foundation.sql',
    import.meta.url,
  );
  assert.equal(fs.existsSync(migrationPath), true, 'Expected account governance migration file to exist');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  assert.match(migrationSql, /canonical_account_roles/, 'Migration must document the canonical_account_roles dependency');
  assert.match(migrationSql, /create type public\.account_approval_status as enum/i);
  assert.match(migrationSql, /'SUSPENDED'/);
  assert.match(migrationSql, /create table if not exists public\.account_governance_audit_logs/i);
  assert.match(migrationSql, /governance_review_account/i);
  assert.match(migrationSql, /governance_appoint_privileged_role/i);
  assert.match(migrationSql, /last_owner_protection/i);
  assert.match(migrationSql, /self_governance_denied/i);

  const pgtapPath = new URL(
    '../supabase/tests/account_governance_security.test.sql',
    import.meta.url,
  );
  assert.equal(fs.existsSync(pgtapPath), true, 'Expected pgTAP security test file to exist');
});

test('GOV-01-SAFETY-FIX-01 (Defect 1) — loadCanonicalUser selects profiles.account_status, maps accountStatus: APPROVED, and fails closed on missing or unrecognized status', async () => {
  const authModule = await import('../src/lib/auth.ts');

  let capturedProfileSelect = '';
  const createProfileMockClient = (profileRow, assignedRoles = ['PARENT']) => ({
    from: (table) => ({
      select: (columns) => {
        if (table === 'profiles') {
          capturedProfileSelect = String(columns);
        }
        return {
          eq: () => {
            if (table === 'profiles') {
              return {
                single: async () => ({
                  data: profileRow,
                  error: null,
                }),
              };
            }
            if (table === 'role_assignments') {
              return {
                eq: async () => ({
                  data: assignedRoles.map((role) => ({ role })),
                  error: null,
                }),
              };
            }
            if (table === 'telegram_identities') {
              return {
                maybeSingle: async () => ({ data: null, error: null }),
              };
            }
            throw new Error(`Unexpected table ${table}`);
          },
        };
      },
    }),
  });

  // 1. Positive case: profile with account_status = 'APPROVED' selects account_status and maps accountStatus: 'APPROVED'
  const approvedUser = await authModule.loadCanonicalUser(
    { id: 'u-ok-1', email: 'ok@kristou.example' },
    createProfileMockClient({
      id: 'u-ok-1',
      username: 'ok_parent',
      full_name: 'Approved Parent',
      email: 'ok@kristou.example',
      avatar_url: null,
      account_status: 'APPROVED',
      requested_role: 'PARENT',
    }),
  );
  assert.match(
    capturedProfileSelect,
    /\baccount_status\b/,
    'loadCanonicalUser must explicitly select account_status from profiles',
  );
  assert.equal(approvedUser.accountStatus, 'APPROVED', 'loadCanonicalUser must map accountStatus: APPROVED onto User');
  assert.equal(approvedUser.role, 'PARENT');

  // 2. Negative cases: missing (undefined, null, empty) or unrecognized ('ACTIVE', 'UNKNOWN') account_status must NEVER silently become APPROVED
  for (const invalidStatus of [undefined, null, '', 'ACTIVE', 'UNKNOWN', 'PENDING_REVIEW']) {
    await assert.rejects(
      () =>
        authModule.loadCanonicalUser(
          { id: 'u-bad-status', email: 'bad@kristou.example' },
          createProfileMockClient(
            {
              id: 'u-bad-status',
              username: 'bad_status_user',
              full_name: 'Bad Status User',
              email: 'bad@kristou.example',
              avatar_url: null,
              account_status: invalidStatus,
            },
            ['APP_ADMIN'],
          ),
        ),
      /account_not_approved/,
      `Expected loadCanonicalUser to reject account_status=${String(invalidStatus)} with account_not_approved`,
    );
  }
});



test('GOV-01-SAFETY-FIX-01 (Defect 3) — governance_review_account blocks APPROVE/REACTIVATE into APP_ADMIN or MANAGER even when caller is APP_ADMIN (requires governance_appoint_privileged_role with explicit confirmation)', async () => {
  const gov = await import('../src/lib/accountGovernance.ts');

  const harness = gov.createInMemoryGovernanceTestHarness([
    {
      id: 'owner-1',
      username: 'owner_one',
      fullName: 'Primary School Owner',
      email: 'owner1@kristou.example',
      phone: null,
      emailConfirmed: true,
      phoneConfirmed: false,
      requestedRole: 'APP_ADMIN',
      accountStatus: 'APPROVED',
      activeRoles: ['APP_ADMIN'],
      capabilities: [],
      governanceVersion: 1,
      createdAt: '2026-11-01T08:00:00.000Z',
    },
    {
      id: 'pending-mgr',
      username: 'pending_mgr',
      fullName: 'Pending Manager Applicant',
      email: 'pmgr@kristou.example',
      phone: null,
      emailConfirmed: true,
      phoneConfirmed: false,
      requestedRole: 'MANAGER',
      accountStatus: 'PENDING',
      activeRoles: [],
      capabilities: [],
      governanceVersion: 1,
      createdAt: '2026-11-10T08:00:00.000Z',
    },
    {
      id: 'pending-owner',
      username: 'pending_owner',
      fullName: 'Pending Owner Applicant',
      email: 'powner@kristou.example',
      phone: null,
      emailConfirmed: true,
      phoneConfirmed: false,
      requestedRole: 'APP_ADMIN',
      accountStatus: 'PENDING',
      activeRoles: [],
      capabilities: [],
      governanceVersion: 1,
      createdAt: '2026-11-10T09:00:00.000Z',
    },
    {
      id: 'pending-teacher',
      username: 'pending_teacher',
      fullName: 'Pending Teacher Applicant',
      email: 'pteacher@kristou.example',
      phone: null,
      emailConfirmed: true,
      phoneConfirmed: false,
      requestedRole: 'TEACHER',
      accountStatus: 'PENDING',
      activeRoles: [],
      capabilities: [],
      governanceVersion: 1,
      createdAt: '2026-11-10T10:00:00.000Z',
    },
    {
      id: 'suspended-mgr',
      username: 'suspended_mgr',
      fullName: 'Suspended Manager',
      email: 'smgr@kristou.example',
      phone: null,
      emailConfirmed: true,
      phoneConfirmed: false,
      requestedRole: 'MANAGER',
      accountStatus: 'SUSPENDED',
      activeRoles: [],
      capabilities: [],
      governanceVersion: 2,
      createdAt: '2026-11-02T08:00:00.000Z',
    },
  ]);

  const ownerClient = harness.asActor('owner-1');

  // 1. Owner scope assignableRoles for general review must only contain the 5 ordinary roles
  const ownerScope = await gov.fetchGovernanceActorScope(ownerClient);
  assert.equal(ownerScope.ok, true);
  assert.deepEqual(
    new Set(ownerScope.data.assignableRoles),
    new Set(ORDINARY_ROLES),
    'assignableRoles for general account review must only include ordinary roles, never APP_ADMIN or MANAGER',
  );

  // 2. APP_ADMIN calling reviewAccountLifecycle(APPROVE) on pending MANAGER without downgrading role is rejected with explicit_confirmation_required
  const ownerApproveMgrViaReview = await gov.reviewAccountLifecycle(
    {
      targetUserId: 'pending-mgr',
      decision: 'APPROVE',
      reason: 'Owner trying to approve MANAGER via general review without confirmation',
      expectedVersion: 1,
    },
    ownerClient,
  );
  assert.equal(ownerApproveMgrViaReview.ok, false);
  assert.equal(ownerApproveMgrViaReview.errorCode, 'explicit_confirmation_required');

  // 3. APP_ADMIN calling reviewAccountLifecycle(APPROVE) on pending APP_ADMIN is rejected with explicit_confirmation_required
  const ownerApproveOwnerViaReview = await gov.reviewAccountLifecycle(
    {
      targetUserId: 'pending-owner',
      decision: 'APPROVE',
      reason: 'Owner trying to approve APP_ADMIN via general review without confirmation',
      expectedVersion: 1,
    },
    ownerClient,
  );
  assert.equal(ownerApproveOwnerViaReview.ok, false);
  assert.equal(ownerApproveOwnerViaReview.errorCode, 'explicit_confirmation_required');

  // 4. APP_ADMIN calling reviewAccountLifecycle(APPROVE) on ordinary pending-teacher but passing assignedRole: 'MANAGER' or 'APP_ADMIN' is rejected
  for (const privRole of ['MANAGER', 'APP_ADMIN']) {
    const ownerEscalateViaReview = await gov.reviewAccountLifecycle(
      {
        targetUserId: 'pending-teacher',
        decision: 'APPROVE',
        assignedRole: privRole,
        reason: `Owner trying to assign ${privRole} via general review`,
        expectedVersion: 1,
      },
      ownerClient,
    );
    assert.equal(ownerEscalateViaReview.ok, false);
    assert.equal(ownerEscalateViaReview.errorCode, 'explicit_confirmation_required');
  }

  // 5. APP_ADMIN calling reviewAccountLifecycle(REACTIVATE) on suspended MANAGER without downgrading to an ordinary role is rejected
  const ownerReactivateMgrViaReview = await gov.reviewAccountLifecycle(
    {
      targetUserId: 'suspended-mgr',
      decision: 'REACTIVATE',
      reason: 'Owner trying to reactivate MANAGER via general review without confirmation',
      expectedVersion: 2,
    },
    ownerClient,
  );
  assert.equal(ownerReactivateMgrViaReview.ok, false);
  assert.equal(ownerReactivateMgrViaReview.errorCode, 'explicit_confirmation_required');

  // 6. APP_ADMIN CAN approve pending-mgr into an ordinary role (e.g. TEACHER) via reviewAccountLifecycle, OR appoint as MANAGER via appointPrivilegedRole(confirmed: true)
  const appointSuspendedMgr = await gov.appointPrivilegedRole(
    {
      targetUserId: 'suspended-mgr',
      role: 'MANAGER',
      action: 'GRANT',
      reason: 'Reinstating Manager via explicit Owner appointment',
      expectedVersion: 2,
      confirmed: true,
    },
    ownerClient,
  );
  assert.equal(appointSuspendedMgr.ok, true);
  assert.equal(appointSuspendedMgr.data.accountStatus, 'APPROVED');
  assert.deepEqual(appointSuspendedMgr.data.activeRoles, ['MANAGER']);
});

test('GOV-01-SAFETY-FIX-01 (Defect 4) — In-memory last-Owner scheduling and SQL lock-order source guard', async () => {
  const gov = await import('../src/lib/accountGovernance.ts');

  const harness = gov.createInMemoryGovernanceTestHarness([
    {
      id: 'owner-a',
      username: 'owner_a',
      fullName: 'Owner Alpha',
      email: 'ownera@kristou.example',
      phone: null,
      emailConfirmed: true,
      phoneConfirmed: false,
      requestedRole: 'APP_ADMIN',
      accountStatus: 'APPROVED',
      activeRoles: ['APP_ADMIN'],
      capabilities: [],
      governanceVersion: 1,
      createdAt: '2026-11-01T08:00:00.000Z',
    },
    {
      id: 'owner-b',
      username: 'owner_b',
      fullName: 'Owner Beta',
      email: 'ownerb@kristou.example',
      phone: null,
      emailConfirmed: true,
      phoneConfirmed: false,
      requestedRole: 'APP_ADMIN',
      accountStatus: 'APPROVED',
      activeRoles: ['APP_ADMIN'],
      capabilities: [],
      governanceVersion: 1,
      createdAt: '2026-11-01T09:00:00.000Z',
    },
  ]);

  const ownerAClient = harness.asActor('owner-a');
  const ownerBClient = harness.asActor('owner-b');

  // 1. Concurrent transactions attempting to suspend owner-a and revoke APP_ADMIN from owner-b simultaneously:
  //    Exactly ONE succeeds and the second MUST fail with last_owner_protection so activeOwnerCount never drops to 0!
  const [resA, resB] = await Promise.all([
    gov.reviewAccountLifecycle(
      {
        targetUserId: 'owner-a',
        decision: 'SUSPEND',
        reason: 'Concurrent owner-a suspension',
        expectedVersion: 1,
      },
      ownerBClient,
    ),
    gov.appointPrivilegedRole(
      {
        targetUserId: 'owner-b',
        role: 'APP_ADMIN',
        action: 'REVOKE',
        reason: 'Concurrent owner-b revocation',
        expectedVersion: 1,
        confirmed: true,
      },
      ownerAClient,
    ),
  ]);

  const successes = [resA, resB].filter((r) => r.ok);
  const failures = [resA, resB].filter((r) => !r.ok);
  assert.equal(successes.length, 1, 'Exactly one concurrent Owner-removal operation may succeed');
  assert.equal(failures.length, 1, 'The second concurrent Owner-removal operation must be rejected');
  assert.equal(failures[0].errorCode, 'last_owner_protection');

  // 2. Also verify that GRANTING 'MANAGER' to the last active APP_ADMIN (which would replace APP_ADMIN with MANAGER) is blocked by last_owner_protection!
  const remainingOwnerId = harness.getAccount('owner-a').accountStatus === 'APPROVED' ? 'owner-a' : 'owner-b';
  const remainingOwnerClient = harness.asActor(remainingOwnerId);
  const remainingVersion = harness.getAccount(remainingOwnerId).governanceVersion;

  const downgradeLastOwnerAttempt = await gov.appointPrivilegedRole(
    {
      targetUserId: remainingOwnerId,
      role: 'MANAGER',
      action: 'GRANT',
      reason: 'Attempting to replace last active APP_ADMIN with MANAGER',
      expectedVersion: remainingVersion,
      confirmed: true,
    },
    remainingOwnerClient,
  );
  assert.equal(downgradeLastOwnerAttempt.ok, false);
  assert.equal(downgradeLastOwnerAttempt.errorCode, 'last_owner_protection');

  // 3. Source guard only: shared lock precedes authorization and target row locks.
  // This does not establish concurrent PostgreSQL behavior.
  const migrationSql = fs.readFileSync(
    new URL('../supabase/migrations/20261113150000_account_governance_foundation.sql', import.meta.url),
    'utf8',
  );
  for (const name of ['review_account', 'appoint_privileged_role']) {
    const body = migrationSql.split(`create or replace function public.governance_${name}(`)[1]?.split('$$;')[0];
    assert.ok(body, `${name} must exist`);
    const lock = body.indexOf("perform pg_advisory_xact_lock(");
    const authorize = body.indexOf('v_caller_role := public.governance_resolve_caller_role(');
    const rowLock = body.toLowerCase().indexOf('for update;');
    assert.ok(lock >= 0 && lock < authorize && lock < rowLock,
      `${name}: acquire shared lock before authorization and target row locks`);
    assert.match(body, /governance_requires_read_committed/);
  }
  const helper = migrationSql.split('create or replace function public.governance_resolve_caller_role(')[1]?.split('$$;')[0];
  assert.match(helper, /language plpgsql\s+volatile/i,
    'Authorization must read a fresh snapshot after a governance lock wait');
});
