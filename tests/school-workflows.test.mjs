import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

globalThis.__KRISTOU_SUPABASE_URL__ = '';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = '';

const {
  isWithinParentNotesTunisWindow,
  validateParentNoteSubmission,
  validateShortMessageContent,
  canParticipantMessage,
  getEventsForCalendarDate,
  fetchActiveFoodMenu,
  listSchoolBroadcasts,
  publishSchoolBroadcast,
  sendOperationalMessage,
  sendParentNote,
  postClassQuestion,
} = await import('../src/lib/schoolContent.ts');

const {
  submitEnrollmentApplication,
  createSchoolClass,
  fetchSchoolClassesWithRosters,
  submitPublicInquiry,
} = await import('../src/lib/schoolOperations.ts');

const {
  createInMemoryGovernanceTestHarness,
  listManagerGrants,
  setManagerCapability,
} = await import('../src/lib/accountGovernance.ts');

const {
  canAccessAppTab,
  resolveHomePage,
  canManageClassesUi,
  canReviewEnrollmentsUi,
} = await import('../src/components/homepages/homepageAccess.ts');

test('Parent Notes enforce 08:00–18:00 Africa/Tunis window and content bounds', () => {
  // Africa/Tunis is UTC+1 year-round
  const t0759 = new Date('2026-11-14T06:59:00Z'); // 07:59 Tunis -> blocked
  const t0800 = new Date('2026-11-14T07:00:00Z'); // 08:00 Tunis -> open
  const t1759 = new Date('2026-11-14T16:59:00Z'); // 17:59 Tunis -> open
  const t1800 = new Date('2026-11-14T17:00:00Z'); // 18:00 Tunis -> closed

  assert.equal(isWithinParentNotesTunisWindow(t0759), false);
  assert.equal(isWithinParentNotesTunisWindow(t0800), true);
  assert.equal(isWithinParentNotesTunisWindow(t1759), true);
  assert.equal(isWithinParentNotesTunisWindow(t1800), false);

  const blockedRes = validateParentNoteSubmission('Absence demain matin', t0759);
  assert.equal(blockedRes.valid, false);
  assert.equal(blockedRes.errorCode, 'parent_notes_outside_window');

  const closedRes = validateParentNoteSubmission('Absence demain matin', t1800);
  assert.equal(closedRes.valid, false);
  assert.equal(closedRes.errorCode, 'parent_notes_outside_window');

  const openRes = validateParentNoteSubmission('Absence demain matin', t0800);
  assert.equal(openRes.valid, true);

  const emptyRes = validateParentNoteSubmission('   ', t1759);
  assert.equal(emptyRes.valid, false);
  assert.equal(emptyRes.errorCode, 'invalid_note_content');
});

test('Short messaging enforces 1–200 char limit and strictly excludes STUDENT participants', () => {
  assert.equal(validateShortMessageContent('').valid, false);
  assert.equal(validateShortMessageContent('   ').valid, false);
  assert.equal(validateShortMessageContent('a'.repeat(201)).valid, false);

  const valid200 = validateShortMessageContent(`  ${'x'.repeat(200)}  `);
  assert.equal(valid200.valid, true);
  if (valid200.valid) {
    assert.equal(valid200.clean.length, 200);
  }

  assert.equal(canParticipantMessage('STUDENT', 'TEACHER'), false);
  assert.equal(canParticipantMessage('TEACHER', 'STUDENT'), false);
  assert.equal(canParticipantMessage('PARENT', 'PARENT'), false);
  assert.equal(canParticipantMessage('PARENT', 'SCHOOL_STAFF'), false);
  assert.equal(canParticipantMessage('SCHOOL_STAFF', 'PARENT'), false);
  assert.equal(canParticipantMessage('PARENT', 'TEACHER'), true);
  assert.equal(canParticipantMessage('PARENT', 'ADMINISTRATIVE_PERSONNEL'), true);
  assert.equal(canParticipantMessage('PARENT', 'MANAGER'), true);
  assert.equal(canParticipantMessage('SCHOOL_STAFF', 'TEACHER'), true);
  assert.equal(canParticipantMessage('SCHOOL_STAFF', 'ADMINISTRATIVE_PERSONNEL'), true);
});

test('GOV-02 Manager delegation harness enforces Owner-only and allowlisted capabilities', async () => {
  const now = '2026-11-14T10:00:00Z';
  const harness = createInMemoryGovernanceTestHarness([
    {
      id: 'owner-1',
      username: 'owner',
      fullName: 'School Owner',
      email: 'owner@kristou.tn',
      phone: null,
      emailConfirmed: true,
      phoneConfirmed: false,
      requestedRole: 'APP_ADMIN',
      accountStatus: 'APPROVED',
      activeRoles: ['APP_ADMIN'],
      capabilities: ['APP_ADMIN'],
      governanceVersion: 1,
      createdAt: now,
    },
    {
      id: 'mgr-1',
      username: 'manager1',
      fullName: 'Assistant Manager',
      email: 'mgr@kristou.tn',
      phone: null,
      emailConfirmed: true,
      phoneConfirmed: false,
      requestedRole: 'MANAGER',
      accountStatus: 'APPROVED',
      activeRoles: ['MANAGER'],
      capabilities: ['MANAGER'],
      governanceVersion: 1,
      createdAt: now,
    },
    {
      id: 'adm-1',
      username: 'admin1',
      fullName: 'Admin Staff',
      email: 'adm@kristou.tn',
      phone: null,
      emailConfirmed: true,
      phoneConfirmed: false,
      requestedRole: 'ADMINISTRATIVE_PERSONNEL',
      accountStatus: 'APPROVED',
      activeRoles: ['ADMINISTRATIVE_PERSONNEL'],
      capabilities: ['ADMINISTRATIVE_PERSONNEL'],
      governanceVersion: 1,
      createdAt: now,
    },
  ]);

  const ownerClient = harness.asActor('owner-1');
  const mgrClient = harness.asActor('mgr-1');
  const adminClient = harness.asActor('adm-1');

  // Non-owner cannot list or grant manager capabilities
  const deniedList = await listManagerGrants(mgrClient);
  assert.equal(deniedList.ok, false);
  assert.equal(deniedList.errorCode, 'owner_only_operation');

  const deniedGrant = await setManagerCapability(
    { managerUserId: 'mgr-1', capability: 'CLASSES_ROSTER_VIEW', active: true, reason: 'Unauthorized attempt' },
    adminClient,
  );
  assert.equal(deniedGrant.ok, false);
  assert.equal(deniedGrant.errorCode, 'owner_only_operation');

  // Unlisted privilege escalation capability rejected before RPC
  const badCap = await setManagerCapability(
    { managerUserId: 'mgr-1', capability: 'FULL_ACCESS', active: true, reason: 'Try escalation' },
    ownerClient,
  );
  assert.equal(badCap.ok, false);
  assert.equal(badCap.errorCode, 'invalid_capability');

  // Owner grants allowlisted capability cleanly
  const okGrant = await setManagerCapability(
    { managerUserId: 'mgr-1', capability: 'CLASSES_ROSTER_VIEW', active: true, reason: 'Approve class roster oversight' },
    ownerClient,
  );
  assert.equal(okGrant.ok, true);
  assert.equal(okGrant.data?.capability, 'CLASSES_ROSTER_VIEW');
  assert.equal(okGrant.data?.active, true);

  const listAfter = await listManagerGrants(ownerClient);
  assert.equal(listAfter.ok, true);
  assert.ok(listAfter.data?.grants.some((g) => g.managerUserId === 'mgr-1' && g.capability === 'CLASSES_ROSTER_VIEW'));

  // Owner revokes capability and emits structured audit entries
  const okRevoke = await setManagerCapability(
    { managerUserId: 'mgr-1', capability: 'CLASSES_ROSTER_VIEW', active: false, reason: 'End of oversight term' },
    ownerClient,
  );
  assert.equal(okRevoke.ok, true);
  assert.equal(okRevoke.data?.active, false);

  const logs = harness.getAuditLogs();
  const capLogs = logs.filter((l) => l.targetUserId === 'mgr-1');
  assert.equal(capLogs.length, 2);
  assert.equal(capLogs[0].action, 'GRANT_MANAGER_CAPABILITY');
  assert.equal(capLogs[0].capability, 'CLASSES_ROSTER_VIEW');
  assert.equal(capLogs[1].action, 'REVOKE_MANAGER_CAPABILITY');
  assert.equal(capLogs[1].capability, 'CLASSES_ROSTER_VIEW');
});

test('Role access fail-closed checks: missing accountStatus, SCHOOL_STAFF, and STUDENT boundaries', () => {
  const unverifiedStatus = resolveHomePage({
    user: { id: 'u-1', username: 'x', fullName: 'X', role: 'APP_ADMIN' },
  });
  assert.equal(unverifiedStatus.targetPage, 'APPLICATION_STATUS');

  const staff = {
    id: 'st-1',
    username: 'staff1',
    fullName: 'Staff One',
    role: 'SCHOOL_STAFF',
    accountStatus: 'APPROVED',
    capabilities: ['SCHOOL_STAFF'],
  };
  assert.equal(canAccessAppTab(staff, 'announcements'), true);
  assert.equal(canAccessAppTab(staff, 'messages'), true);
  assert.equal(canAccessAppTab(staff, 'community'), false);
  assert.equal(canAccessAppTab(staff, 'classes'), false);

  const student = {
    id: 'stu-1',
    username: 'stu1',
    fullName: 'Student One',
    role: 'STUDENT',
    accountStatus: 'APPROVED',
    capabilities: ['STUDENT'],
  };
  assert.equal(canAccessAppTab(student, 'announcements'), true);
  assert.equal(canAccessAppTab(student, 'community'), true);
  assert.equal(canAccessAppTab(student, 'messages'), false);
  assert.equal(canAccessAppTab(student, 'notes'), false);

  const mgr = {
    id: 'm-1',
    username: 'mgr1',
    fullName: 'Mgr',
    role: 'MANAGER',
    accountStatus: 'APPROVED',
    capabilities: ['CLASSES_MANAGE', 'ENROLLMENT_REVIEW'],
  };
  assert.equal(canManageClassesUi(mgr), true);
  assert.equal(canReviewEnrollmentsUi(mgr), true);
});

test('Calendar multi-day matching and fail-closed backend_unavailable / PGRST handling', async () => {
  const events = [
    {
      id: 'ev-1',
      title: 'Exam Week',
      description: 'Term 1',
      category: 'EXAM',
      date: '2026-11-16',
      endDate: '2026-11-18',
    },
    {
      id: 'ev-2',
      title: 'Parent Meeting',
      description: 'Single day',
      category: 'MEETING',
      date: '2026-11-20',
    },
  ];
  assert.equal(getEventsForCalendarDate(events, '2026-11-17').length, 1);
  assert.equal(getEventsForCalendarDate(events, '2026-11-19').length, 0);
  assert.equal(getEventsForCalendarDate(events, '2026-11-20').length, 1);

  // Null Supabase client must fail closed with BLOCKED_BACKEND
  const opsBlocked = await fetchSchoolClassesWithRosters(null);
  assert.equal(opsBlocked.ok, false);
  assert.equal(opsBlocked.status, 'BLOCKED_BACKEND');
  assert.equal(opsBlocked.errorCode, 'backend_unavailable');

  const menuBlocked = await fetchActiveFoodMenu(null);
  assert.equal(menuBlocked.ok, false);
  assert.equal(menuBlocked.status, 'BLOCKED_BACKEND');

  const bBlocked = await listSchoolBroadcasts(null);
  assert.equal(bBlocked.ok, false);
  assert.equal(bBlocked.status, 'BLOCKED_BACKEND');

  const qBlocked = await postClassQuestion('c-1', 'Devoir pour demain ?', null);
  assert.equal(qBlocked.ok, false);
  assert.equal(qBlocked.status, 'BLOCKED_BACKEND');

  const noteBlocked = await sendParentNote(
    'stu-1',
    'ABSENCE',
    'Absence pour rendez-vous médical',
    null,
    new Date('2026-11-14T10:00:00Z'),
  );
  assert.equal(noteBlocked.ok, false);
  assert.equal(noteBlocked.status, 'BLOCKED_BACKEND');

  // Simulated successful RPC client roundtrip
  const mockRpcClient = {
    rpc: async (fnName) => {
      if (fnName === 'submit_enrollment_application') {
        return {
          data: { id: 'app-1', referenceCode: 'KS-ADM-2026-0001', status: 'SUBMITTED', createdAt: '2026-11-14T12:00:00Z' },
          error: null,
        };
      }
      if (fnName === 'create_school_class') {
        return { data: { id: 'cls-1', name: 'CP-A', levelCode: 'CP' }, error: null };
      }
      if (fnName === 'submit_public_inquiry') {
        return { data: { id: 'inq-1', status: 'NEW', createdAt: '2026-11-14T12:00:00Z' }, error: null };
      }
      return { data: null, error: { code: 'PGRST202', message: 'missing' } };
    },
  };

  const enrRes = await submitEnrollmentApplication(
    {
      studentFullName: 'Yasmine Ben Salah',
      birthDate: '2019-05-12',
      desiredLevelCode: 'CP',
      parentFullName: 'Karim Ben Salah',
      phone: '+216 98 000 000',
    },
    mockRpcClient,
  );
  assert.equal(enrRes.ok, true);
  assert.equal(enrRes.data?.referenceCode, 'KS-ADM-2026-0001');

  const clsRes = await createSchoolClass(
    { academicYearCode: '2026-2027', levelCode: 'CP', name: 'CP-A' },
    mockRpcClient,
  );
  assert.equal(clsRes.ok, true);
  assert.equal(clsRes.data?.id, 'cls-1');

  const inqRes = await submitPublicInquiry(
    { senderName: 'Parent', subject: 'Visite', message: 'Bonjour, horaires des visites ?' },
    mockRpcClient,
  );
  assert.equal(inqRes.ok, true);
  assert.equal(inqRes.data?.id, 'inq-1');
});

test('UI source invariants: Registration fail-closed, ClassCommunity verified assets, Pickup lock, Owner routing', () => {
  const regSrc = fs.readFileSync(new URL('../src/components/views/RegistrationView.tsx', import.meta.url), 'utf8');
  assert.match(regSrc, /submitEnrollmentApplication/);
  assert.match(regSrc, /if \(!res\.ok \|\| !res\.data\)/);
  assert.match(regSrc, /BLOCKED_BACKEND/);

  const commSrc = fs.readFileSync(new URL('../src/components/views/ClassCommunityView.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(commSrc, /kristou-2026-0[1-3]\.jpg/);
  assert.match(commSrc, /SchoolCalendarPanel/);

  const ownerSrc = fs.readFileSync(new URL('../src/components/homepages/OwnerHomePage.tsx', import.meta.url), 'utf8');
  const requiredOwnerIds = [
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
  ];
  for (const id of requiredOwnerIds) {
    assert.ok(ownerSrc.includes(`id="${id}"`), `Expected OwnerHomePage card ${id}`);
  }
  assert.match(ownerSrc, /openGovernanceSection\('manager-delegation'\)/);
  assert.match(ownerSrc, /setActiveTab\('announcements'\)/);
});

test('Regression: Defects B, C, F contracts, targeted level broadcasts, and SQL fix markers', async () => {
  // Defect C: CLASSES_ROSTER_VIEW grants read-only tab view, NEVER class creation/management
  const readOnlyRosterMgr = {
    id: 'm-ro',
    username: 'mgr_ro',
    fullName: 'Manager Roster View',
    role: 'MANAGER',
    accountStatus: 'APPROVED',
    capabilities: ['CLASSES_ROSTER_VIEW'],
  };
  assert.equal(canAccessAppTab(readOnlyRosterMgr, 'classes'), true);
  assert.equal(canManageClassesUi(readOnlyRosterMgr), false);

  // Defect F: SELECTED_LEVELS and non-public targeted broadcast client validation + RPC contract
  let capturedRpcArgs = null;
  const mockBroadcastClient = {
    rpc: async (fnName, args) => {
      if (fnName === 'publish_school_broadcast') {
        capturedRpcArgs = args;
        return {
          data: {
            id: 'bc-1',
            title: args.p_title,
            body: args.p_body,
            priority: args.p_priority,
            status: 'PUBLISHED',
            audience_scope: args.p_audience_scope,
            target_level_codes: args.p_target_level_codes,
            target_class_ids: args.p_target_class_ids,
            is_public: args.p_is_public,
            published_at: '2026-11-14T14:00:00Z',
            author_name: 'Office Admin',
            author_role: 'Administration',
            created_at: '2026-11-14T14:00:00Z',
          },
          error: null,
        };
      }
      if (fnName === 'send_operational_message') {
        return { data: { threadId: 'th-1' }, error: null };
      }
      return { data: null, error: { code: 'PGRST202', message: 'missing' } };
    },
    from: () => ({
      select: () => ({
        order: async () => ({
          data: [
            {
              id: 'bc-1',
              title: 'CP & CM1 Reminder',
              body: 'Bring notebooks',
              priority: 'NORMAL',
              status: 'PUBLISHED',
              audience_scope: 'SELECTED_LEVELS',
              target_level_codes: ['CP', 'CM1'],
              target_class_ids: [],
              is_public: false,
              published_at: '2026-11-14T14:00:00Z',
              author_name: 'Office Admin',
              author_role: 'Administration',
              created_at: '2026-11-14T14:00:00Z',
            },
          ],
          error: null,
        }),
      }),
    }),
  };

  const emptyLevelsRes = await publishSchoolBroadcast(
    { title: 'Notice', body: 'Hello levels', audienceScope: 'SELECTED_LEVELS', targetLevelCodes: [] },
    mockBroadcastClient,
  );
  assert.equal(emptyLevelsRes.ok, false);
  assert.equal(emptyLevelsRes.errorCode, 'target_levels_required');

  const invalidLevelsRes = await publishSchoolBroadcast(
    { title: 'Notice', body: 'Hello levels', audienceScope: 'SELECTED_LEVELS', targetLevelCodes: ['LYCEE'] },
    mockBroadcastClient,
  );
  assert.equal(invalidLevelsRes.ok, false);
  assert.equal(invalidLevelsRes.errorCode, 'invalid_target_levels');

  const publicTargetedRes = await publishSchoolBroadcast(
    {
      title: 'Notice',
      body: 'Cannot be public',
      audienceScope: 'SELECTED_LEVELS',
      targetLevelCodes: ['CP'],
      isPublic: true,
    },
    mockBroadcastClient,
  );
  assert.equal(publicTargetedRes.ok, false);
  assert.equal(publicTargetedRes.errorCode, 'targeted_broadcast_cannot_be_public');

  const okLevelBroadcast = await publishSchoolBroadcast(
    {
      title: 'CP & CM1 Notice',
      body: 'Art supplies tomorrow',
      audienceScope: 'SELECTED_LEVELS',
      targetLevelCodes: ['cp', 'CM1', 'CP'],
      isPublic: false,
    },
    mockBroadcastClient,
  );
  assert.equal(okLevelBroadcast.ok, true);
  assert.deepEqual(capturedRpcArgs?.p_target_level_codes, ['CP', 'CM1']);
  assert.equal(capturedRpcArgs?.p_is_public, false);
  assert.deepEqual(okLevelBroadcast.data?.targetLevelCodes, ['CP', 'CM1']);

  const listed = await listSchoolBroadcasts(mockBroadcastClient);
  assert.equal(listed.ok, true);
  assert.deepEqual(listed.data?.[0]?.targetLevelCodes, ['CP', 'CM1']);

  // Defect B: sendOperationalMessage RPC wiring & UI announcements view support
  const msgRes = await sendOperationalMessage('teacher-1', 'Subject', '  Short message  ', mockBroadcastClient);
  assert.equal(msgRes.ok, true);
  assert.equal(msgRes.data?.threadId, 'th-1');

  const annViewSrc = fs.readFileSync(
    new URL('../src/components/views/GlobalAnnouncementsCalendarView.tsx', import.meta.url),
    'utf8',
  );
  assert.match(annViewSrc, /SELECTED_LEVELS/);
  assert.match(annViewSrc, /SELECTED_CLASSES/);
  assert.match(annViewSrc, /CANONICAL_SCHOOL_LEVELS/);

  // Static SQL migration regression assertions (Defects A-F)
  const mig11 = fs.readFileSync(
    new URL('../supabase/migrations/20261115005910_people_family_academics_enrollment.sql', import.meta.url),
    'utf8',
  );
  const mig12 = fs.readFileSync(
    new URL('../supabase/migrations/20261114120000_broadcasts_calendar_class_community.sql', import.meta.url),
    'utf8',
  );
  const mig13 = fs.readFileSync(
    new URL('../supabase/migrations/20261114130000_parent_notes_and_messaging.sql', import.meta.url),
    'utf8',
  );

  // Defect C & D markers
  const createClassBlock = mig11.slice(
    mig11.indexOf('create or replace function public.create_school_class'),
    mig11.indexOf('revoke all on function public.create_school_class'),
  );
  assert.doesNotMatch(createClassBlock, /CLASSES_ROSTER_VIEW/);
  const scmBlock = mig11.slice(
    mig11.indexOf('create policy scm_scoped_select'),
    mig11.indexOf('drop policy if exists tca_scoped_select'),
  );
  assert.doesNotMatch(scmBlock, /can_access_class/);
  assert.match(mig11, /public\.is_linked_student_self/);

  // Defect E & F markers
  assert.match(mig12, /audience_scope = 'SELECTED_LEVELS'/);
  assert.match(mig12, /school_broadcasts_public_scope_chk/);
  assert.match(mig12, /p_target_level_codes text\[\]/);
  const modBlock = mig12.slice(
    mig12.indexOf('create or replace function public.moderate_class_question'),
    mig12.indexOf('revoke all on function public.moderate_class_question'),
  );
  assert.match(modBlock, /is_approved_school_member\(\)/);
  assert.match(modBlock, /for update/);
  assert.match(modBlock, /for share/);

  // Defect A & B markers
  assert.match(mig13, /public\.can_access_message_thread/);
  assert.match(mig13, /public\.can_users_direct_message/);
  const tpPolicy = mig13.slice(
    mig13.indexOf('create policy thread_participants_select'),
    mig13.indexOf('drop policy if exists thread_messages_select'),
  );
  assert.doesNotMatch(tpPolicy, /from public\.thread_participants tp2/);
  assert.match(mig13, /revoke all on function public\.can_users_direct_message\(uuid, uuid\) from public, anon, authenticated/);

  // Finding G & H static SQL source guards only (do NOT establish live PostgreSQL execution)
  const mig10 = fs.readFileSync(
    new URL('../supabase/migrations/20261114100000_gov02_manager_delegation_and_preferences.sql', import.meta.url),
    'utf8',
  );
  const mig14 = fs.readFileSync(
    new URL('../supabase/migrations/20261114140000_directory_food_menu_public_content.sql', import.meta.url),
    'utf8',
  );
  assert.match(mig10, /account_governance_audit_logs_action_check/);
  assert.match(mig10, /account_governance_audit_logs_capability_chk/);
  assert.match(mig10, /'GRANT_MANAGER_CAPABILITY'/);
  assert.match(mig10, /'REVOKE_MANAGER_CAPABILITY'/);
  for (const anonPolicyHeader of [
    'create policy directory_public_select on public.directory_entries for select to anon',
    'create policy food_menu_weeks_public_select on public.food_menu_weeks for select to anon',
    'create policy food_menu_days_public_select on public.food_menu_days for select to anon',
    'create policy public_content_public_select on public.school_public_content for select to anon',
  ]) {
    assert.ok(mig14.includes(anonPolicyHeader), `Expected separated anon policy: ${anonPolicyHeader}`);
  }
  const anonPoliciesBlock = mig14.slice(
    mig14.indexOf('drop policy if exists directory_public_select'),
    mig14.indexOf('-- Editor RPCs'),
  );
  for (const anonPolicy of anonPoliciesBlock.split('for select to authenticated').filter((_, idx) => idx === 0)) {
    assert.ok(anonPolicy.length > 0);
  }
  // Every "for select to anon" statement block before the next "create policy" must NOT call privileged helpers
  const anonChunks = anonPoliciesBlock.split('create policy ').filter((c) => c.includes('for select to anon\n'));
  assert.equal(anonChunks.length, 4);
  for (const chunk of anonChunks) {
    assert.doesNotMatch(chunk, /is_approved_school_member|current_user_has_role|current_user_has_capability/);
  }
});
