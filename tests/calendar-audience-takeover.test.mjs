import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React, { act } from 'react';
import { installNodeDomShim } from './helpers/nodeDomShim.mjs';

const dom = installNodeDomShim();
const { createRoot } = await import('react-dom/client');
const { renderToStaticMarkup } = await import('react-dom/server');

const {
  canCancelCalendarEventUi,
  canCreateCalendarEventUi,
  canCreateWholeSchoolCalendarUi,
  canManageCalendarUi,
  canModerateCommunityUi,
  getCalendarPermissionsUi,
} = await import('../src/components/homepages/homepageAccess.ts');

const {
  resolveCalendarAudiencePlan,
  validateCalendarCreateInput,
} = await import('../src/lib/calendar/calendarAudience.ts');

const {
  isWholeSchoolCalendarEvent,
  getVisibleCalendarTargetClassIds,
  calendarEventMatchesClassScope,
  calendarEventMatchesAuthorizedClasses,
} = await import('../src/lib/calendar/calendarModel.ts');

const require = createRequire(import.meta.url);
const tempDir = await mkdtemp(path.join(tmpdir(), 'kristou-cal-takeover-'));
after(() => rm(tempDir, { recursive: true, force: true }));

// Mutable per-test Supabase client hook injected into bundled components
globalThis.__CAL_TEST_SUPABASE__ = null;
globalThis.__CAL_TEST_CTX__ = null;

function createMockSupabase(initialEvents = [], initialResponses = [], opts = {}) {
  const events = initialEvents.map((e) => {
    const mode = e.audience_mode ?? (e.class_id ? 'SINGLE_CLASS' : 'WHOLE_SCHOOL');
    const targets = Array.isArray(e.target_class_ids)
      ? [...e.target_class_ids]
      : mode === 'WHOLE_SCHOOL'
      ? []
      : e.class_id
      ? [e.class_id]
      : [];
    return {
      ...e,
      audience_mode: mode,
      target_class_ids: targets,
    };
  });
  const responses = initialResponses.map((r) => ({ ...r }));
  const rpcCalls = [];
  const teacherAccounts = opts.teacherAccounts ?? [
    {
      id: 'teacher-1',
      username: 'nadia',
      fullName: 'Mme Nadia',
      email: null,
      phone: null,
      emailConfirmed: true,
      phoneConfirmed: false,
      requestedRole: 'TEACHER',
      accountStatus: 'APPROVED',
      activeRoles: ['TEACHER'],
      capabilities: [],
      governanceVersion: 1,
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'teacher-2',
      username: 'karim',
      fullName: 'M. Karim',
      email: null,
      phone: null,
      emailConfirmed: true,
      phoneConfirmed: false,
      requestedRole: 'TEACHER',
      accountStatus: 'APPROVED',
      activeRoles: ['TEACHER'],
      capabilities: [],
      governanceVersion: 1,
      createdAt: '2026-10-01T00:00:00Z',
    },
  ];
  const teacherClassesMap = opts.teacherClassesMap ?? {
    'teacher-1': ['class-1', 'class-2'],
    'teacher-2': ['class-1', 'class-2'],
  };
  let failNextSelect = false;
  let failNextUpsert = false;
  let failNextUpsertError = null;
  let directoryError = opts.directoryError ?? null;

  const client = {
    rpcCalls,
    events,
    responses,
    setFailNextSelect(val) {
      failNextSelect = val;
    },
    setFailNextUpsert(val, customError = null) {
      failNextUpsert = val;
      failNextUpsertError = customError;
    },
    setDirectoryError(err) {
      directoryError = err;
    },
    async rpc(fnName, params) {
      rpcCalls.push({ fnName, params });
      if (fnName === 'governance_list_account_directory') {
        if (directoryError) {
          return { data: null, error: directoryError };
        }
        return {
          data: {
            items: teacherAccounts,
            totalCount: teacherAccounts.length,
            limit: params.p_limit ?? 100,
            offset: params.p_offset ?? 0,
          },
          error: null,
        };
      }
      if (fnName === 'create_school_calendar_event') {
        if (failNextUpsert) {
          failNextUpsert = false;
          const err = failNextUpsertError ?? { code: '42501', message: 'insufficient_authority' };
          failNextUpsertError = null;
          return { data: null, error: err };
        }
        const mode = params.p_audience_mode ?? (params.p_class_id ? 'SINGLE_CLASS' : 'WHOLE_SCHOOL');
        let targetClassIds = [];
        if (mode === 'SINGLE_CLASS') {
          targetClassIds = params.p_class_id ? [params.p_class_id] : [];
        } else if (mode === 'TEACHER_CLASSES') {
          targetClassIds = [...(teacherClassesMap[params.p_teacher_user_id] ?? [])];
          if (targetClassIds.length === 0) {
            return { data: null, error: { code: 'P0001', message: 'calendar_no_eligible_classes' } };
          }
        } else if (mode === 'ALL_MY_CLASSES') {
          const actorId = globalThis.__CAL_TEST_CTX__?.currentUser?.id ?? 'teacher-1';
          const fallback = globalThis.__CAL_TEST_CTX__?.currentUser?.assignedClassIds ?? [];
          targetClassIds = [...(teacherClassesMap[actorId] ?? fallback)];
          if (targetClassIds.length === 0) {
            return { data: null, error: { code: 'P0001', message: 'calendar_no_eligible_classes' } };
          }
        }
        const baseRow = {
          id: `ev-${events.length + 1}`,
          audience_mode: mode,
          class_id: mode === 'SINGLE_CLASS' ? (params.p_class_id ?? null) : null,
          title: params.p_title,
          description: params.p_description ?? '',
          category: params.p_category ?? 'EVENT',
          start_date: params.p_start_date,
          end_date: params.p_end_date ?? params.p_start_date,
          is_all_day: params.p_is_all_day !== false,
          start_time: null,
          end_time: null,
          timezone: 'Africa/Tunis',
          is_public: mode === 'WHOLE_SCHOOL' ? Boolean(params.p_is_public) : false,
          status: 'SCHEDULED',
          cancellation_reason: null,
        };
        events.push({ ...baseRow, target_class_ids: targetClassIds });
        return { data: baseRow, error: null };
      }
      if (fnName === 'cancel_school_calendar_event') {
        const target = events.find((e) => e.id === params.p_event_id);
        if (!target) return { data: null, error: { code: 'P0002', message: 'not_found' } };
        target.status = 'CANCELLED';
        target.cancellation_reason = params.p_reason;
        return { data: { id: target.id, status: 'CANCELLED' }, error: null };
      }
      if (fnName === 'respond_to_calendar_event') {
        const target = events.find((e) => e.id === params.p_event_id);
        if (!target) return { data: null, error: { code: 'P0002', message: 'not_found' } };
        if (target.status === 'CANCELLED') {
          return { data: null, error: { code: 'P0001', message: 'calendar_event_cancelled' } };
        }
        const userId = globalThis.__CAL_TEST_CTX__?.currentUser?.id || 'u-1';
        const existing = responses.find(
          (r) => r.event_id === params.p_event_id && r.user_id === userId,
        );
        if (existing) existing.response = params.p_response;
        else responses.push({ event_id: params.p_event_id, user_id: userId, response: params.p_response });
        return { data: { event_id: params.p_event_id, response: params.p_response }, error: null };
      }
      return { data: null, error: { message: `Unknown RPC ${fnName}` } };
    },
    from(table) {
      if (table === 'school_calendar_event_feed') {
        let startLte = null;
        let endGte = null;
        let classScope = null;
        const q = {
          select: () => q,
          order: () => q,
          lte: (_col, val) => {
            startLte = val;
            return q;
          },
          gte: (_col, val) => {
            endGte = val;
            return q;
          },
          or: (expr) => {
            const m = expr.match(/target_class_ids\.cs\.\{([^}]+)\}/);
            if (m) classScope = m[1];
            return q;
          },
          range: async (start, end) => {
            if (failNextSelect) {
              failNextSelect = false;
              return { data: null, error: { message: 'Temporary fetch failure' } };
            }
            const filtered = events.filter((ev) => {
              if (startLte && ev.start_date > startLte) return false;
              const evEnd = ev.end_date || ev.start_date;
              if (endGte && evEnd < endGte) return false;
              if (classScope) {
                if (ev.audience_mode !== 'WHOLE_SCHOOL' && !ev.target_class_ids?.includes(classScope)) {
                  return false;
                }
              }
              return true;
            });
            return { data: filtered.slice(start, end + 1), error: null };
          },
        };
        return q;
      }
      if (table === 'school_calendar_responses') {
        let uid = null;
        let evIds = null;
        const rq = {
          select: () => rq,
          eq: (_col, val) => {
            uid = val;
            return rq;
          },
          in: async (_col, ids) => {
            evIds = ids;
            const rows = responses.filter(
              (r) => (!uid || r.user_id === uid) && (!evIds || evIds.includes(r.event_id)),
            );
            return { data: rows, error: null };
          },
        };
        return rq;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
  return client;
}

async function bundleWithMocks(relPath, outName) {
  const outfile = path.join(tempDir, outName);
  const supabaseTarget = path.resolve('src/lib/supabase.ts');
  await build({
    entryPoints: [new URL(relPath, import.meta.url).pathname],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    loader: { '.css': 'empty' },
    define: {
      __KRISTOU_SUPABASE_URL__: '"https://mock.supabase.co"',
      __KRISTOU_SUPABASE_PUBLISHABLE_KEY__: '"mock-key"',
    },
    plugins: [
      {
        name: 'context-and-supabase-shim',
        setup(builder) {
          builder.onResolve({ filter: /context\/AppContext$/ }, () => ({
            path: 'context',
            namespace: 'ctx-shim',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'ctx-shim' }, () => ({
            contents:
              'export const useApp = () => ({ ...globalThis.__CAL_TEST_CTX__, t: (key) => key });',
          }));
          builder.onResolve({ filter: /(^|[\\/])supabase(\.ts)?$/ }, () => ({
            path: 'supabase-shim',
            namespace: 'sb-shim',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'sb-shim' }, async () => {
            const fs = await import('node:fs');
            const orig = fs.readFileSync(supabaseTarget, 'utf8');
            const replaced = orig.replace(
              /export const supabase =[\s\S]*?;\n/,
              'export const supabase = new Proxy({}, { get(_t, prop) { const c = globalThis.__CAL_TEST_SUPABASE__; if (!c) return undefined; const v = c[prop]; return typeof v === "function" ? v.bind(c) : v; } });\n',
            );
            return { contents: replaced, loader: 'ts', resolveDir: path.dirname(supabaseTarget) };
          });
          builder.onResolve({ filter: /^[^./]/ }, (args) => ({
            path: require.resolve(args.path),
            external: true,
          }));
        },
      },
    ],
  });
  return require(outfile);
}

let SchoolCalendarPanel;
let ClassCommunityView;
let GlobalAnnouncementsCalendarView;
let bundledSchoolContent;

before(async () => {
  const [calPanelMod, commMod, globalMod, scMod] = await Promise.all([
    bundleWithMocks('../src/components/views/Shared/SchoolCalendarPanel.tsx', 'cal-panel.cjs'),
    bundleWithMocks('../src/components/views/ClassCommunityView.tsx', 'class-comm.cjs'),
    bundleWithMocks('../src/components/views/GlobalAnnouncementsCalendarView.tsx', 'global-ann.cjs'),
    bundleWithMocks('../src/lib/schoolContent.ts', 'school-content.cjs'),
  ]);
  SchoolCalendarPanel = calPanelMod.SchoolCalendarPanel;
  ClassCommunityView = commMod.ClassCommunityView;
  GlobalAnnouncementsCalendarView = globalMod.GlobalAnnouncementsCalendarView;
  bundledSchoolContent = scMod;
});

function makeUser(overrides = {}) {
  return {
    id: 'user-1',
    username: 'user1',
    fullName: 'User One',
    role: 'PARENT',
    accountStatus: 'APPROVED',
    capabilities: [],
    linkedChildrenIds: ['child-1'],
    assignedClassIds: ['class-1'],
    ...overrides,
  };
}

function makeCtx(overrides = {}) {
  return {
    currentUser: makeUser(),
    language: 'en',
    theme: 'light',
    childrenList: [{ id: 'child-1', fullName: 'Youssef', classId: 'class-1', className: 'CP-A' }],
    classesList: [
      { id: 'class-1', name: 'CP-A', level: 'CP', teacherId: 't-1', teacherName: 'Mme Nadia', academicYear: '2026-2027', studentCount: 15 },
      { id: 'class-2', name: 'CE1-B', level: 'CE1', teacherId: 't-1', teacherName: 'Mme Nadia', academicYear: '2026-2027', studentCount: 16 },
      { id: 'class-3', name: 'CE2-C', level: 'CE2', teacherId: 't-2', teacherName: 'M. Karim', academicYear: '2026-2027', studentCount: 18 },
    ],
    classRosters: [
      { id: 'class-1', name: 'CP-A', level: 'CP', academicYear: '2026-2027', homeroomTeacherName: 'Mme Nadia', activeStudentCount: 15, students: [] },
      { id: 'class-2', name: 'CE1-B', level: 'CE1', academicYear: '2026-2027', homeroomTeacherName: 'Mme Nadia', activeStudentCount: 16, students: [] },
      { id: 'class-3', name: 'CE2-C', level: 'CE2', academicYear: '2026-2027', homeroomTeacherName: 'M. Karim', activeStudentCount: 18, students: [] },
    ],
    parentNotes: [],
    notesStatus: 'READY',
    notesError: null,
    remainingParentNotesToday: 11,
    selectedChildId: 'child-1',
    setSelectedChildId() {},
    addParentNote: async () => ({ success: true }),
    replyParentNote: async () => ({ ok: true, status: 'READY' }),
    selectedClassId: 'class-1',
    setSelectedClassId() {},
    announcements: [],
    homeworkList: [],
    classDocuments: [],
    classGallery: [],
    classQuestions: [],
    communityStatus: 'READY',
    communityError: null,
    isLoadingClassCommunity: false,
    addClassQuestion: async () => ({ success: true }),
    replyClassQuestion: async () => ({ ok: true }),
    moderateClassQuestion: async () => ({ ok: true }),
    broadcasts: [],
    broadcastsStatus: 'READY',
    broadcastsError: null,
    calendarEvents: [],
    calendarStatus: 'READY',
    calendarError: null,
    isHydratingSchoolData: false,
    refreshSchoolData: async () => true,
    ...overrides,
  };
}

async function mountComponent(element) {
  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  let root;
  await act(async () => {
    root = createRoot(container);
    root.render(element);
  });
  // Flush microtasks for async useCalendarMonth mount load
  await act(async () => {
    await new Promise((r) => setTimeout(r, 15));
  });
  return {
    container,
    async rerender(nextEl) {
      await act(async () => {
        root.render(nextEl);
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 15));
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      if (container.parentNode) container.parentNode.removeChild(container);
    },
  };
}

test('1: Calendar permission separation across all 7 roles and Manager capabilities', () => {
  const owner = makeUser({ role: 'APP_ADMIN', assignedClassIds: [] });
  const office = makeUser({ role: 'ADMINISTRATIVE_PERSONNEL', assignedClassIds: [] });
  const calMgr = makeUser({ role: 'MANAGER', capabilities: ['CALENDAR_MANAGE'], assignedClassIds: [] });
  const fullMgr = makeUser({ role: 'MANAGER', capabilities: ['FULL_ACCESS'], assignedClassIds: [] });
  const commMgr = makeUser({ role: 'MANAGER', capabilities: ['COMMUNITY_MODERATE'], assignedClassIds: [] });
  const teacherAssigned = makeUser({ role: 'TEACHER', assignedClassIds: ['class-1', 'class-2'] });
  const teacherEmpty = makeUser({ role: 'TEACHER', assignedClassIds: [] });
  const parent = makeUser({ role: 'PARENT', assignedClassIds: ['class-1'] });
  const student = makeUser({ role: 'STUDENT', assignedClassIds: ['class-1'] });
  const staff = makeUser({ role: 'SCHOOL_STAFF', assignedClassIds: [] });
  const pendingOwner = makeUser({ role: 'APP_ADMIN', accountStatus: 'PENDING' });

  for (const mgr of [owner, office, calMgr, fullMgr]) {
    const p = getCalendarPermissionsUi(mgr, { classId: 'class-1' });
    assert.equal(p.canManageCalendar, true);
    assert.equal(p.canCreateWholeSchool, true);
    assert.equal(p.canCreate, true);
    assert.equal(p.canCancel, true);
  }

  // COMMUNITY_MODERATE manager can moderate community, NOT create/cancel calendar events
  assert.equal(canModerateCommunityUi(commMgr), true);
  const commCalP = getCalendarPermissionsUi(commMgr, { classId: 'class-1' });
  assert.equal(commCalP.canManageCalendar, false);
  assert.equal(commCalP.canCreate, false);
  assert.equal(commCalP.canCancel, false);

  // Assigned Teacher can create ONLY for assigned classes, NEVER whole-school, NEVER cancel
  assert.equal(canManageCalendarUi(teacherAssigned), false);
  assert.equal(canCreateWholeSchoolCalendarUi(teacherAssigned), false);
  assert.equal(canCancelCalendarEventUi(teacherAssigned), false);
  assert.equal(canCreateCalendarEventUi(teacherAssigned), true);
  assert.equal(canCreateCalendarEventUi(teacherAssigned, { targetClassId: 'class-1' }), true);
  assert.equal(canCreateCalendarEventUi(teacherAssigned, { targetClassId: 'class-3' }), false);
  assert.equal(canCreateCalendarEventUi(teacherAssigned, { targetClassId: null }), false);

  // 0-assignment Teacher cannot create or cancel
  const emptyP = getCalendarPermissionsUi(teacherEmpty, { classId: null, assignedClassIds: [] });
  assert.equal(emptyP.canCreate, false);
  assert.equal(emptyP.canCancel, false);
  assert.equal(emptyP.isTeacherWithoutAssignments, true);

  for (const denied of [null, pendingOwner, parent, student, staff]) {
    const p = getCalendarPermissionsUi(denied);
    assert.equal(p.canCreate, false);
    assert.equal(p.canCancel, false);
    assert.equal(p.canManageCalendar, false);
  }
});

test('2: Audience validation & adapter support 4 modes while blocking unauthorized escalation', async () => {
  const client = createMockSupabase();
  globalThis.__CAL_TEST_SUPABASE__ = client;

  const teacherPlan = resolveCalendarAudiencePlan({
    actorRole: 'TEACHER',
    canManageCalendar: false,
    assignedClasses: [
      { id: 'class-1', name: 'CP-A' },
      { id: 'class-2', name: 'CE1-B' },
    ],
    allClasses: [
      { id: 'class-1', name: 'CP-A' },
      { id: 'class-2', name: 'CE1-B' },
      { id: 'class-3', name: 'CE2-C' },
    ],
  });
  assert.deepEqual(
    teacherPlan.options.map((o) => ({ mode: o.mode, supportedByBackend: o.supportedByBackend })),
    [
      { mode: 'SINGLE_CLASS', supportedByBackend: true },
      { mode: 'ALL_MY_CLASSES', supportedByBackend: false },
    ],
  );
  assert.equal(teacherPlan.canSetPublic, false);
  assert.deepEqual(
    teacherPlan.selectableClasses.map((c) => c.id),
    ['class-1', 'class-2'],
  );

  // Zero-assignment teacher has options with no_assigned_classes / contract_pending
  const emptyTeacherPlan = resolveCalendarAudiencePlan({
    actorRole: 'TEACHER',
    canManageCalendar: false,
    assignedClasses: [],
  });
  assert.equal(emptyTeacherPlan.isTeacherWithoutAssignments, true);
  assert.deepEqual(
    emptyTeacherPlan.options.map((o) => ({
      unavailableReason: o.unavailableReason,
      contractPendingReason: o.contractPendingReason,
    })),
    [
      { unavailableReason: 'no_assigned_classes', contractPendingReason: undefined },
      { unavailableReason: undefined, contractPendingReason: 'multi_class_contract_pending' },
    ],
  );

  // Admin plan with teachers enables TEACHER_CLASSES; blocked picker disables it with reason
  const adminWithTeachers = resolveCalendarAudiencePlan({
    actorRole: 'APP_ADMIN',
    canManageCalendar: true,
    allClasses: [{ id: 'class-1', name: 'CP-A' }],
    teacherOptions: [{ id: 'teacher-1', fullName: 'Mme Nadia' }],
  });
  assert.equal(adminWithTeachers.options.find((o) => o.mode === 'TEACHER_CLASSES')?.supportedByBackend, false);
  assert.equal(adminWithTeachers.defaultTeacherUserId, 'teacher-1');

  const blockedPickerPlan = resolveCalendarAudiencePlan({
    actorRole: 'MANAGER',
    canManageCalendar: true,
    teacherPickerBlocked: true,
  });
  assert.equal(blockedPickerPlan.options.find((o) => o.mode === 'TEACHER_CLASSES')?.contractPendingReason, 'multi_class_contract_pending');
  assert.deepEqual(blockedPickerPlan.selectableTeachers, []);

  // Pending multi-class modes return BLOCKED_BACKEND with multi_class_contract_pending
  const pendingTeacherClasses = await bundledSchoolContent.upsertSchoolCalendarEvent({
    title: 'Pending Teacher Classes',
    description: '',
    category: 'EVENT',
    startDate: '2026-11-20',
    audienceMode: 'TEACHER_CLASSES',
    teacherUserId: 'teacher-2',
    actorRole: 'APP_ADMIN',
    canManageCalendar: true,
  });
  assert.equal(pendingTeacherClasses.status, 'BLOCKED_BACKEND');
  assert.equal(pendingTeacherClasses.errorCode, 'multi_class_contract_pending');

  const pendingAllMyClasses = await bundledSchoolContent.upsertSchoolCalendarEvent({
    title: 'Pending All My Classes',
    description: '',
    category: 'EVENT',
    startDate: '2026-11-20',
    audienceMode: 'ALL_MY_CLASSES',
    actorRole: 'TEACHER',
    canManageCalendar: false,
    allowedClassIds: ['class-1'],
  });
  assert.equal(pendingAllMyClasses.status, 'BLOCKED_BACKEND');
  assert.equal(pendingAllMyClasses.errorCode, 'multi_class_contract_pending');

  // Teacher trying school-wide, public, or unassigned class rejects BEFORE RPC
  const tWhole = await bundledSchoolContent.upsertSchoolCalendarEvent({
    title: 'Forbidden Global',
    description: '',
    category: 'EVENT',
    startDate: '2026-11-20',
    classId: null,
    audienceMode: 'WHOLE_SCHOOL',
    actorRole: 'TEACHER',
    canManageCalendar: false,
    allowedClassIds: ['class-1'],
  });
  assert.equal(tWhole.status, 'UNAUTHORIZED');
  assert.equal(tWhole.errorCode, 'teacher_cannot_create_school_wide');

  const tUnassigned = await bundledSchoolContent.upsertSchoolCalendarEvent({
    title: 'Forbidden Class 3',
    description: '',
    category: 'EXAM',
    startDate: '2026-11-20',
    classId: 'class-3',
    audienceMode: 'SINGLE_CLASS',
    actorRole: 'TEACHER',
    canManageCalendar: false,
    allowedClassIds: ['class-1'],
  });
  assert.equal(tUnassigned.status, 'UNAUTHORIZED');
  assert.equal(tUnassigned.errorCode, 'teacher_class_not_assigned');

  const tPublic = validateCalendarCreateInput({
    title: 'Forbidden Public',
    startDate: '2026-11-20',
    classId: 'class-1',
    isPublic: true,
    audienceMode: 'SINGLE_CLASS',
    actorRole: 'TEACHER',
    canManageCalendar: false,
    allowedClassIds: ['class-1'],
  });
  assert.equal(tPublic.valid, false);
  assert.equal(tPublic.errorCode, 'teacher_cannot_publish_public');

  assert.equal(client.rpcCalls.length, 0, 'No RPC calls must fire for validation/authorization rejects');
});

test('3: ClassCommunityView and GlobalAnnouncementsCalendarView honor decoupled calendar vs moderation rights', () => {
  const todayTunis = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
  const sampleEv = {
    id: 'ev-1',
    classId: 'class-1',
    title: 'Math Quiz',
    description: 'Chapter 3',
    category: 'TEST',
    date: todayTunis,
    endDate: todayTunis,
    isAllDay: true,
    isPublic: false,
    status: 'SCHEDULED',
  };

  // COMMUNITY_MODERATE-only manager in ClassCommunityView must NOT get Add Event or Cancel
  globalThis.__CAL_TEST_CTX__ = makeCtx({
    currentUser: makeUser({ role: 'MANAGER', capabilities: ['COMMUNITY_MODERATE'], assignedClassIds: [] }),
    calendarEvents: [sampleEv],
  });
  const commMgrHtml = renderToStaticMarkup(
    React.createElement(ClassCommunityView, { initialSubTab: 'calendar' }),
  );
  assert.ok(!commMgrHtml.includes('data-testid="calendar-add-event-btn"'));
  assert.ok(!commMgrHtml.includes('data-testid="calendar-cancel-event-btn"'));

  // CALENDAR_MANAGE manager in ClassCommunityView MUST get Add Event AND Cancel
  globalThis.__CAL_TEST_CTX__ = makeCtx({
    currentUser: makeUser({ role: 'MANAGER', capabilities: ['CALENDAR_MANAGE'], assignedClassIds: [] }),
    calendarEvents: [sampleEv],
  });
  const calMgrHtml = renderToStaticMarkup(
    React.createElement(ClassCommunityView, { initialSubTab: 'calendar' }),
  );
  assert.ok(calMgrHtml.includes('data-testid="calendar-add-event-btn"'));
  assert.ok(calMgrHtml.includes('data-testid="calendar-cancel-event-btn"'));

  // Teacher with 0 assignments sees honest unavailable notice and NO Add Event in BOTH views
  globalThis.__CAL_TEST_CTX__ = makeCtx({
    currentUser: makeUser({ role: 'TEACHER', assignedClassIds: [] }),
    calendarEvents: [sampleEv],
  });
  for (const el of [
    React.createElement(ClassCommunityView, { initialSubTab: 'calendar' }),
    React.createElement(GlobalAnnouncementsCalendarView, { initialSubTab: 'calendar' }),
  ]) {
    const html = renderToStaticMarkup(el);
    assert.ok(html.includes('data-testid="calendar-teacher-no-assignments"'));
    assert.ok(!html.includes('data-testid="calendar-add-event-btn"'));
    assert.ok(!html.includes('data-testid="calendar-cancel-event-btn"'));
  }

  // Teacher with assigned classes CAN add class events in GlobalAnnouncementsCalendarView, while ParentNotesPanel stays intact
  globalThis.__CAL_TEST_CTX__ = makeCtx({
    currentUser: makeUser({ role: 'TEACHER', assignedClassIds: ['class-1', 'class-2'] }),
    calendarEvents: [sampleEv],
  });
  const teacherGlobalHtml = renderToStaticMarkup(
    React.createElement(GlobalAnnouncementsCalendarView, { initialSubTab: 'calendar' }),
  );
  assert.ok(teacherGlobalHtml.includes('data-testid="calendar-add-event-btn"'));
  assert.ok(!teacherGlobalHtml.includes('data-testid="calendar-cancel-event-btn"'));
  assert.ok(teacherGlobalHtml.includes('data-testid="under-calendar-parent-notes"'));
});

test('4: Interactive Admin audience workflows (WHOLE_SCHOOL, SINGLE_CLASS, TEACHER_CLASSES, and Manager picker gating)', async () => {
  const todayTunis = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
  const client = createMockSupabase();
  globalThis.__CAL_TEST_SUPABASE__ = client;
  const adminUser = makeUser({ id: 'admin-1', role: 'APP_ADMIN', assignedClassIds: [] });
  globalThis.__CAL_TEST_CTX__ = makeCtx({ currentUser: adminUser });

  const mounted = await mountComponent(
    React.createElement(SchoolCalendarPanel, {
      events: [],
      backendStatus: 'READY',
      classId: null,
      canManage: true,
      canManageCalendar: true,
      canCreate: true,
      canCancel: true,
      canRespond: true,
      allClasses: [
        { id: 'class-1', name: 'CP-A', level: 'CP' },
        { id: 'class-2', name: 'CE1-B', level: 'CE1' },
      ],
      teacherOptions: [{ id: 'teacher-2', fullName: 'M. Karim', username: 'karim' }],
      onRefresh: async () => true,
    }),
  );

  // Open create form; APP_ADMIN automatically hydrated Teacher options via governance_list_account_directory
  await act(async () => {
    mounted.container.querySelector('[data-testid="calendar-add-event-btn"]').click();
  });

  const audienceSel = mounted.container.querySelector('[data-testid="calendar-audience-select"]');
  assert.ok(audienceSel);
  const optValues = [...audienceSel.querySelectorAll('option')].map((o) => o.value);
  assert.deepEqual(optValues, ['WHOLE_SCHOOL', 'SINGLE_CLASS', 'TEACHER_CLASSES']);

  // Select TEACHER_CLASSES -> Teacher picker renders M. Karim & Mme Nadia, submit disabled (supportedByBackend: false)
  await act(async () => {
    dom.setInputValue(audienceSel, 'TEACHER_CLASSES');
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });
  const teacherSel = mounted.container.querySelector('[data-testid="calendar-teacher-select"]');
  assert.ok(teacherSel, 'Authorized APP_ADMIN must render teacher picker');
  assert.equal(mounted.container.querySelector('[data-testid="calendar-is-public-checkbox"]'), null);
  assert.equal(mounted.container.querySelector('[data-testid="calendar-submit-event-btn"]').disabled, true);

  // Switch to WHOLE_SCHOOL, check isPublic, fill title & submit
  await act(async () => {
    dom.setInputValue(audienceSel, 'WHOLE_SCHOOL');
  });
  const pubCheckbox = mounted.container.querySelector('[data-testid="calendar-is-public-checkbox"]');
  assert.ok(pubCheckbox);
  await act(async () => {
    dom.setInputValue(mounted.container.querySelector('[data-testid="calendar-title-input"]'), 'School Fair');
    dom.setInputValue(mounted.container.querySelector('[data-testid="calendar-description-input"]'), 'Open to families');
    dom.setCheckbox(pubCheckbox, true);
  });
  await act(async () => {
    dom.submitForm(mounted.container.querySelector('[data-testid="calendar-create-form"]'));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });

  const createCalls = client.rpcCalls.filter((c) => c.fnName === 'create_school_calendar_event');
  assert.equal(createCalls.length, 1);
  assert.equal(createCalls[0].params.p_audience_mode, 'WHOLE_SCHOOL');
  assert.equal(createCalls[0].params.p_class_id, undefined);
  assert.equal(createCalls[0].params.p_teacher_user_id, undefined);
  assert.equal(createCalls[0].params.p_is_public, true);
  assert.ok(mounted.container.textContent.includes('School Fair'));
  assert.ok(mounted.container.querySelector('[data-testid="calendar-event-public-badge"]'));

  // Create SINGLE_CLASS event for CE1-B -> isPublic checkbox hidden & forced false
  await act(async () => {
    mounted.container.querySelector('[data-testid="calendar-add-event-btn"]').click();
  });
  await act(async () => {
    dom.setInputValue(mounted.container.querySelector('[data-testid="calendar-audience-select"]'), 'SINGLE_CLASS');
  });
  assert.equal(mounted.container.querySelector('[data-testid="calendar-is-public-checkbox"]'), null);
  await act(async () => {
    dom.setInputValue(mounted.container.querySelector('[data-testid="calendar-target-class-select"]'), 'class-2');
    dom.setInputValue(mounted.container.querySelector('[data-testid="calendar-title-input"]'), 'CE1-B Dictation');
  });
  await act(async () => {
    dom.submitForm(mounted.container.querySelector('[data-testid="calendar-create-form"]'));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });

  const createCalls3 = client.rpcCalls.filter((c) => c.fnName === 'create_school_calendar_event');
  assert.equal(createCalls3.length, 2);
  assert.equal(createCalls3[1].params.p_audience_mode, 'SINGLE_CLASS');
  assert.equal(createCalls3[1].params.p_class_id, 'class-2');
  assert.equal(createCalls3[1].params.p_teacher_user_id, undefined);
  assert.equal(createCalls3[1].params.p_is_public, false);
  assert.ok(mounted.container.textContent.includes('CE1-B Dictation'));
  assert.equal(mounted.container.querySelectorAll(`[data-testid^="calendar-event-card-"]`).length, 2);
  assert.equal(client.events[0].start_date, todayTunis);

  await mounted.unmount();

  // Delegated MANAGER with CALENDAR_MANAGE only (no ACCOUNT_APPROVAL_REVIEW):
  // fails closed locally with 0 governance_list_account_directory calls, TEACHER_CLASSES disabled, WHOLE_SCHOOL still works
  const mgrClient = createMockSupabase();
  globalThis.__CAL_TEST_SUPABASE__ = mgrClient;
  const calOnlyManager = makeUser({
    id: 'mgr-cal-only',
    role: 'MANAGER',
    capabilities: ['CALENDAR_MANAGE'],
    assignedClassIds: [],
  });
  globalThis.__CAL_TEST_CTX__ = makeCtx({ currentUser: calOnlyManager });

  const mgrMounted = await mountComponent(
    React.createElement(SchoolCalendarPanel, {
      events: [],
      backendStatus: 'READY',
      classId: null,
      allClasses: [{ id: 'class-1', name: 'CP-A', level: 'CP' }],
      onRefresh: async () => true,
    }),
  );

  assert.equal(
    mgrClient.rpcCalls.filter((c) => c.fnName === 'governance_list_account_directory').length,
    0,
    'CALENDAR_MANAGE-only Manager must not call governance_list_account_directory',
  );
  await act(async () => {
    mgrMounted.container.querySelector('[data-testid="calendar-add-event-btn"]').click();
  });
  await act(async () => {
    dom.setInputValue(mgrMounted.container.querySelector('[data-testid="calendar-audience-select"]'), 'TEACHER_CLASSES');
  });
  assert.ok(mgrMounted.container.querySelector('[data-testid="calendar-teacher-picker-unavailable"]'));
  assert.equal(mgrMounted.container.querySelector('[data-testid="calendar-submit-event-btn"]').disabled, true);
  await mgrMounted.unmount();

  // MANAGER with FULL_ACCESS whose directory RPC fails with manager_delegation_required also fails closed honestly
  const fullMgrClient = createMockSupabase([], [], {
    directoryError: { code: '42501', message: 'manager_delegation_required' },
  });
  globalThis.__CAL_TEST_SUPABASE__ = fullMgrClient;
  globalThis.__CAL_TEST_CTX__ = makeCtx({
    currentUser: makeUser({ id: 'mgr-full', role: 'MANAGER', capabilities: ['FULL_ACCESS'], assignedClassIds: [] }),
  });
  const fullMgrMounted = await mountComponent(
    React.createElement(SchoolCalendarPanel, {
      events: [],
      backendStatus: 'READY',
      classId: null,
      allClasses: [{ id: 'class-1', name: 'CP-A' }],
      onRefresh: async () => true,
    }),
  );
  await act(async () => {
    fullMgrMounted.container.querySelector('[data-testid="calendar-add-event-btn"]').click();
  });
  await act(async () => {
    dom.setInputValue(fullMgrMounted.container.querySelector('[data-testid="calendar-audience-select"]'), 'TEACHER_CLASSES');
  });
  assert.ok(fullMgrMounted.container.querySelector('[data-testid="calendar-teacher-picker-unavailable"]'));
  assert.equal(fullMgrMounted.container.querySelector('[data-testid="calendar-submit-event-btn"]').disabled, true);
  await fullMgrMounted.unmount();
});

test('5: Interactive Teacher SINGLE_CLASS & ALL_MY_CLASSES workflows, draft retention, and server errors', async () => {
  const client = createMockSupabase();
  globalThis.__CAL_TEST_SUPABASE__ = client;
  const teacher = makeUser({
    id: 'teacher-1',
    role: 'TEACHER',
    assignedClassIds: ['class-1', 'class-2'],
  });
  globalThis.__CAL_TEST_CTX__ = makeCtx({ currentUser: teacher });

  const mounted = await mountComponent(
    React.createElement(SchoolCalendarPanel, {
      events: [],
      backendStatus: 'READY',
      classId: null,
      canManage: false,
      canManageCalendar: false,
      canCreate: true,
      canCancel: false,
      canRespond: true,
      assignedClasses: [
        { id: 'class-1', name: 'CP-A', level: 'CP' },
        { id: 'class-2', name: 'CE1-B', level: 'CE1' },
      ],
      allClasses: [
        { id: 'class-1', name: 'CP-A', level: 'CP' },
        { id: 'class-2', name: 'CE1-B', level: 'CE1' },
        { id: 'class-3', name: 'CE2-C', level: 'CE2' },
      ],
      onRefresh: async () => true,
    }),
  );

  // Cancel button must NOT exist for Teacher
  assert.equal(mounted.container.querySelector('[data-testid="calendar-cancel-event-btn"]'), null);

  await act(async () => {
    mounted.container.querySelector('[data-testid="calendar-add-event-btn"]').click();
  });

  // Audience dropdown must NOT include WHOLE_SCHOOL or TEACHER_CLASSES
  const audOpts = [
    ...mounted.container.querySelectorAll('[data-testid="calendar-audience-select"] option'),
  ].map((o) => o.value);
  assert.deepEqual(audOpts, ['SINGLE_CLASS', 'ALL_MY_CLASSES']);
  assert.equal(mounted.container.querySelector('[data-testid="calendar-is-public-checkbox"]'), null);

  // Target class dropdown must ONLY include Teacher's assigned classes (never class-3)
  const classOpts = [
    ...mounted.container.querySelectorAll('[data-testid="calendar-target-class-select"] option'),
  ].map((o) => o.value);
  assert.deepEqual(classOpts, ['class-1', 'class-2']);

  // Select ALL_MY_CLASSES -> summary shows CP-A & CE1-B, submit DISABLED (supportedByBackend: false)
  await act(async () => {
    dom.setInputValue(mounted.container.querySelector('[data-testid="calendar-audience-select"]'), 'ALL_MY_CLASSES');
  });
  const summaryEl = mounted.container.querySelector('[data-testid="calendar-all-my-classes-summary"]');
  assert.ok(summaryEl);
  assert.ok(summaryEl.textContent.includes('CP-A'));
  assert.ok(summaryEl.textContent.includes('CE1-B'));
  assert.equal(mounted.container.querySelector('[data-testid="calendar-submit-event-btn"]').disabled, true);

  // Switch to SINGLE_CLASS, pick CE1-B, test failed RPC retains draft, then retry succeeds
  await act(async () => {
    dom.setInputValue(mounted.container.querySelector('[data-testid="calendar-audience-select"]'), 'SINGLE_CLASS');
    dom.setInputValue(mounted.container.querySelector('[data-testid="calendar-target-class-select"]'), 'class-2');
    dom.setInputValue(mounted.container.querySelector('[data-testid="calendar-title-input"]'), 'Science Lab');
  });

  client.setFailNextUpsert(true);
  await act(async () => {
    dom.submitForm(mounted.container.querySelector('[data-testid="calendar-create-form"]'));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 15));
  });

  // Draft preserved after error
  assert.ok(mounted.container.querySelector('[data-testid="calendar-feedback-error"]'));
  assert.equal(mounted.container.querySelector('[data-testid="calendar-title-input"]').value, 'Science Lab');

  // Resubmit succeeds cleanly
  await act(async () => {
    dom.submitForm(mounted.container.querySelector('[data-testid="calendar-create-form"]'));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });

  const lastRpc = client.rpcCalls.filter((c) => c.fnName === 'create_school_calendar_event').at(-1);
  assert.equal(lastRpc.params.p_audience_mode, 'SINGLE_CLASS');
  assert.equal(lastRpc.params.p_class_id, 'class-2');
  assert.equal(lastRpc.params.p_teacher_user_id, undefined);
  assert.equal(lastRpc.params.p_is_public, false);
  assert.ok(mounted.container.textContent.includes('Science Lab'));

  await mounted.unmount();
});

test('6: Cancellation preserves identity, reason, prior RSVP read-only, removes RSVP buttons, and transient reload error preserves same-scope cache', async () => {
  const todayTunis = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
  const client = createMockSupabase(
    [
      {
        id: 'ev-cancel-test',
        class_id: 'class-1',
        title: 'Museum Trip',
        description: 'Buses leave at 09:00',
        category: 'TRIP',
        start_date: todayTunis,
        end_date: todayTunis,
        is_all_day: true,
        timezone: 'Africa/Tunis',
        is_public: false,
        status: 'SCHEDULED',
        cancellation_reason: null,
      },
    ],
    [{ event_id: 'ev-cancel-test', user_id: 'admin-1', response: 'ATTENDING' }],
  );
  globalThis.__CAL_TEST_SUPABASE__ = client;
  const adminUser = makeUser({ id: 'admin-1', role: 'APP_ADMIN', assignedClassIds: [] });
  globalThis.__CAL_TEST_CTX__ = makeCtx({ currentUser: adminUser });

  const mounted = await mountComponent(
    React.createElement(SchoolCalendarPanel, {
      events: [],
      backendStatus: 'READY',
      classId: 'class-1',
      canManage: true,
      canManageCalendar: true,
      canCreate: true,
      canCancel: true,
      canRespond: true,
      allClasses: [{ id: 'class-1', name: 'CP-A', level: 'CP' }],
      onRefresh: async () => true,
    }),
  );

  // Confirm initial scheduled event + RSVP buttons present
  assert.ok(mounted.container.textContent.includes('Museum Trip'));
  assert.ok(mounted.container.textContent.includes('Attending'));

  // Fail next readback once during cancel -> event remains visible (same-scope cache) + refreshWarning shown!
  await act(async () => {
    mounted.container.querySelector('[data-testid="calendar-cancel-event-btn"]').click();
  });
  await act(async () => {
    dom.setInputValue(mounted.container.querySelector('[data-testid="calendar-cancel-reason-input"]'), 'Weather alert');
  });
  client.setFailNextSelect(true);
  await act(async () => {
    mounted.container.querySelector('[data-testid="calendar-confirm-cancel-btn"]').click();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });

  // Fail next readback once during cancel -> server-confirmed cancellation MUST already be CANCELLED & non-actionable, preserving reason + prior RSVP + refreshWarning!
  assert.ok(mounted.container.querySelector('[data-testid="calendar-refresh-warning"]'));
  assert.ok(mounted.container.textContent.includes('Museum Trip'), 'Same-scope event must remain visible on transient reload error');
  assert.ok(mounted.container.querySelector('[data-testid="calendar-event-cancelled-badge"]'), 'Confirmed cancellation must stay CANCELLED when refresh fails');
  assert.ok(mounted.container.querySelector('[data-testid="calendar-cancellation-reason"]').textContent.includes('Weather alert'));
  assert.ok(mounted.container.querySelector('[data-testid="calendar-prior-rsvp"]').textContent.includes('Prior response: Attending'));
  assert.equal(mounted.container.querySelector('[data-testid="calendar-cancel-event-btn"]'), null, 'Cancel button must remain gone after confirmed cancellation even on refresh failure');
  assert.ok(!mounted.container.textContent.includes('Acknowledge'), 'RSVP buttons must not reappear when refresh fails after confirmed cancel');

  // Click Retry Reload -> succeeds and renders server CANCELLED state, reason, safety notice, NO RSVP buttons, AND prior response read-only!
  await act(async () => {
    mounted.container.querySelector('[data-testid="calendar-retry-refresh-btn"]').click();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });

  assert.equal(mounted.container.querySelector('[data-testid="calendar-refresh-warning"]'), null);
  assert.ok(mounted.container.querySelector('[data-testid="calendar-event-cancelled-badge"]'));
  assert.ok(mounted.container.querySelector('[data-testid="calendar-cancellation-reason"]').textContent.includes('Weather alert'));
  assert.ok(mounted.container.querySelector('[data-testid="calendar-prior-rsvp"]').textContent.includes('Prior response: Attending'));
  assert.equal(mounted.container.querySelector('[data-testid="calendar-cancel-event-btn"]'), null);
  assert.ok(!mounted.container.textContent.includes('Acknowledge'));
  assert.ok(mounted.container.textContent.includes('does not record pupil absence, school closure, or pickup release'));

  await mounted.unmount();
});

test('7: Switching class/account drops stale in-flight month read and resets drafts cleanly across AR/FR/EN', async () => {
  const todayTunis = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
  let resolveOldRead;
  const oldLoader = () =>
    new Promise((resolve) => {
      resolveOldRead = resolve;
    });
  const newLoader = async () => ({
    ok: true,
    status: 'READY',
    data: [
      {
        id: 'ev-new-class',
        classId: 'class-2',
        title: 'CE1-B Exclusive Event',
        description: '',
        category: 'EVENT',
        date: todayTunis,
        endDate: todayTunis,
        isAllDay: true,
        isPublic: false,
        status: 'SCHEDULED',
      },
    ],
  });

  const teacher1 = makeUser({ id: 't-1', role: 'TEACHER', assignedClassIds: ['class-1', 'class-2'] });
  globalThis.__CAL_TEST_CTX__ = makeCtx({ currentUser: teacher1, language: 'fr' });

  const container = dom.document.createElement('div');
  dom.document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      React.createElement(SchoolCalendarPanel, {
        events: [],
        backendStatus: 'READY',
        classId: 'class-1',
        canManage: false,
        canManageCalendar: false,
        canCreate: true,
        canCancel: false,
        assignedClasses: [
          { id: 'class-1', name: 'CP-A' },
          { id: 'class-2', name: 'CE1-B' },
        ],
        onRefresh: async () => true,
        loadMonthEvents: oldLoader,
      }),
    );
  });

  // Open draft in old scope
  await act(async () => {
    container.querySelector('[data-testid="calendar-add-event-btn"]').click();
  });
  assert.ok(container.querySelector('[data-testid="calendar-create-form"]'));

  // Switch account & class while old read is STILL pending -> draft closes & new scope loads
  const teacher2 = makeUser({ id: 't-2', role: 'TEACHER', assignedClassIds: ['class-2'] });
  globalThis.__CAL_TEST_CTX__ = makeCtx({ currentUser: teacher2, language: 'ar' });

  await act(async () => {
    root.render(
      React.createElement(SchoolCalendarPanel, {
        events: [],
        backendStatus: 'READY',
        classId: 'class-2',
        canManage: false,
        canManageCalendar: false,
        canCreate: true,
        canCancel: false,
        assignedClasses: [{ id: 'class-2', name: 'CE1-B' }],
        onRefresh: async () => true,
        loadMonthEvents: newLoader,
      }),
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 15));
  });

  // Old read finally resolves late -> MUST be ignored and never overwrite CE1-B event!
  await act(async () => {
    resolveOldRead?.({
      ok: true,
      status: 'READY',
      data: [
        {
          id: 'ev-stale-leak',
          classId: 'class-1',
          title: 'LEAKED OLD SCOPE EVENT',
          description: '',
          category: 'EVENT',
          date: todayTunis,
          endDate: todayTunis,
          isAllDay: true,
          isPublic: false,
          status: 'SCHEDULED',
        },
      ],
    });
    await new Promise((r) => setTimeout(r, 15));
  });

  assert.equal(container.querySelector('[data-testid="calendar-create-form"]'), null, 'Draft must reset on scope switch');
  assert.ok(container.textContent.includes('CE1-B Exclusive Event'));
  assert.ok(!container.textContent.includes('LEAKED OLD SCOPE EVENT'));

  // Arabic localization sanity check for Add Event button
  assert.ok(container.querySelector('[data-testid="calendar-add-event-btn"]').textContent.includes('إضافة حدث'));

  await act(async () => {
    root.unmount();
  });
  container.parentNode?.removeChild(container);
});

test('8: Confirmed cancellation is never fabricated pre-server, and survives failed onRefresh and stale SCHEDULED responses', async () => {
  const todayTunis = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
  const scheduledEv = {
    id: 'ev-race-cancel',
    classId: null,
    title: 'Science Fair',
    description: 'Gym hall',
    category: 'EVENT',
    date: todayTunis,
    endDate: todayTunis,
    isAllDay: true,
    isPublic: true,
    status: 'SCHEDULED',
    myResponse: 'ATTENDING',
  };

  let resolveCancelRpc;
  let cancelMode = 'pending';
  const client = createMockSupabase();
  client.rpc = async (fnName, params) => {
    client.rpcCalls.push({ fnName, params });
    if (fnName === 'cancel_school_calendar_event') {
      if (cancelMode === 'pending') {
        return new Promise((resolve) => {
          resolveCancelRpc = resolve;
        });
      }
      if (cancelMode === 'fail') {
        return { data: null, error: { code: '42501', message: 'insufficient_authority' } };
      }
      return { data: { id: params.p_event_id, status: 'CANCELLED' }, error: null };
    }
    return { data: null, error: null };
  };
  globalThis.__CAL_TEST_SUPABASE__ = client;

  const adminUser = makeUser({ id: 'admin-race', role: 'APP_ADMIN', assignedClassIds: [] });
  globalThis.__CAL_TEST_CTX__ = makeCtx({ currentUser: adminUser });

  let monthResponseMode = 'ok-scheduled';
  let staleReadsCount = 0;
  const loadMonthEvents = async () => {
    if (monthResponseMode === 'error') {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'network_error',
        errorMessage: 'Transient read error',
      };
    }
    if (monthResponseMode === 'stale-scheduled') {
      staleReadsCount += 1;
      return { ok: true, status: 'READY', data: [{ ...scheduledEv }] };
    }
    return { ok: true, status: 'READY', data: [{ ...scheduledEv }] };
  };

  let refreshShouldFail = false;
  const mounted = await mountComponent(
    React.createElement(SchoolCalendarPanel, {
      events: [scheduledEv],
      backendStatus: 'READY',
      classId: null,
      canManage: true,
      canRespond: true,
      allClasses: [{ id: 'class-1', name: 'CP-A', level: 'CP' }],
      onRefresh: async () => !refreshShouldFail,
      loadMonthEvents,
    }),
  );

  // 8A: Failed cancel RPC keeps event actionable & SCHEDULED (never fabricated)
  cancelMode = 'fail';
  await act(async () => {
    mounted.container.querySelector('[data-testid="calendar-cancel-event-btn"]').click();
  });
  await act(async () => {
    dom.setInputValue(mounted.container.querySelector('[data-testid="calendar-cancel-reason-input"]'), 'Attempted cancel');
  });
  await act(async () => {
    mounted.container.querySelector('[data-testid="calendar-confirm-cancel-btn"]').click();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 15));
  });
  assert.ok(mounted.container.querySelector('[data-testid="calendar-feedback-error"]'));
  assert.equal(mounted.container.querySelector('[data-testid="calendar-event-cancelled-badge"]'), null);
  assert.ok(mounted.container.querySelector('[data-testid="calendar-cancel-event-btn"]'));

  // 8B: While cancel RPC is PENDING (before server confirms), event MUST NOT show CANCELLED
  cancelMode = 'pending';
  await act(async () => {
    dom.setInputValue(mounted.container.querySelector('[data-testid="calendar-cancel-reason-input"]'), 'Storm warning');
    mounted.container.querySelector('[data-testid="calendar-confirm-cancel-btn"]').click();
  });
  assert.equal(mounted.container.querySelector('[data-testid="calendar-event-cancelled-badge"]'), null);

  // Resolve server confirmation while subsequent refresh fails (onRefresh -> false & loadMonthEvents -> ERROR)
  monthResponseMode = 'error';
  refreshShouldFail = true;
  await act(async () => {
    resolveCancelRpc?.({ data: { id: 'ev-race-cancel', status: 'CANCELLED' }, error: null });
    await new Promise((r) => setTimeout(r, 20));
  });

  // Confirmed cancellation MUST persist non-actionable with reason, prior RSVP, and refresh warning
  assert.ok(mounted.container.querySelector('[data-testid="calendar-refresh-warning"]'));
  assert.ok(mounted.container.querySelector('[data-testid="calendar-event-cancelled-badge"]'));
  assert.ok(mounted.container.querySelector('[data-testid="calendar-cancellation-reason"]').textContent.includes('Storm warning'));
  assert.ok(mounted.container.querySelector('[data-testid="calendar-prior-rsvp"]').textContent.includes('Prior response: Attending'));
  assert.equal(mounted.container.querySelector('[data-testid="calendar-cancel-event-btn"]'), null);
  assert.ok(!mounted.container.textContent.includes('Acknowledge'));

  // 8C: Even if stale readback or stale hydratedEvents prop arrives with status=SCHEDULED, confirmed CANCELLED cannot revert
  monthResponseMode = 'stale-scheduled';
  refreshShouldFail = false;
  await mounted.rerender(
    React.createElement(SchoolCalendarPanel, {
      events: [{ ...scheduledEv, status: 'SCHEDULED' }],
      backendStatus: 'READY',
      classId: null,
      canManage: true,
      canRespond: true,
      allClasses: [{ id: 'class-1', name: 'CP-A', level: 'CP' }],
      onRefresh: async () => true,
      loadMonthEvents,
    }),
  );
  assert.ok(staleReadsCount >= 1);
  assert.ok(mounted.container.querySelector('[data-testid="calendar-event-cancelled-badge"]'));
  assert.equal(mounted.container.querySelector('[data-testid="calendar-cancel-event-btn"]'), null);
  assert.ok(!mounted.container.textContent.includes('Decline'));

  await mounted.unmount();
});

test('9: Assignment/access change within same account and month invalidates restricted cache, drops stale reads, and fails closed', async () => {
  const todayTunis = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
  const class1Ev = {
    id: 'ev-c1-secret',
    classId: 'class-1',
    title: 'Restricted Class-1 Meeting',
    description: '',
    category: 'MEETING',
    date: todayTunis,
    endDate: todayTunis,
    isAllDay: true,
    isPublic: false,
    status: 'SCHEDULED',
  };
  const schoolEv = {
    id: 'ev-school-open',
    classId: null,
    title: 'Public Campus Day',
    description: '',
    category: 'EVENT',
    date: todayTunis,
    endDate: todayTunis,
    isAllDay: true,
    isPublic: false,
    status: 'SCHEDULED',
  };

  let resolveRevokedRead;
  let readMode = 'initial';
  const loadMonthEvents = async () => {
    if (readMode === 'initial') {
      return { ok: true, status: 'READY', data: [class1Ev, schoolEv] };
    }
    if (readMode === 'pending-then-error') {
      return new Promise((resolve) => {
        resolveRevokedRead = resolve;
      });
    }
    if (readMode === 'unauth') {
      return { ok: false, status: 'UNAUTHORIZED', errorCode: '42501', errorMessage: 'Denied' };
    }
    return { ok: true, status: 'READY', data: [schoolEv] };
  };

  // Start as approved Teacher with class-1 & class-2 in the current month
  const teacherSameId = makeUser({
    id: 'teacher-same',
    role: 'TEACHER',
    assignedClassIds: ['class-1', 'class-2'],
  });
  globalThis.__CAL_TEST_CTX__ = makeCtx({ currentUser: teacherSameId });

  const mounted = await mountComponent(
    React.createElement(SchoolCalendarPanel, {
      events: [class1Ev, schoolEv],
      backendStatus: 'READY',
      classId: null,
      assignedClasses: [
        { id: 'class-1', name: 'CP-A' },
        { id: 'class-2', name: 'CE1-B' },
      ],
      onRefresh: async () => true,
      loadMonthEvents,
    }),
  );
  assert.ok(mounted.container.textContent.includes('Restricted Class-1 Meeting'));
  assert.ok(mounted.container.querySelector('[data-testid="calendar-add-event-btn"]'));

  // Open draft in old assignment scope
  await act(async () => {
    mounted.container.querySelector('[data-testid="calendar-add-event-btn"]').click();
  });
  assert.ok(mounted.container.querySelector('[data-testid="calendar-create-form"]'));

  // Same user ID, same month: revoke ALL class assignments while next read is pending -> ERROR!
  readMode = 'pending-then-error';
  const teacherRevoked = makeUser({
    id: 'teacher-same',
    role: 'TEACHER',
    assignedClassIds: [],
  });
  globalThis.__CAL_TEST_CTX__ = makeCtx({ currentUser: teacherRevoked });

  await mounted.rerender(
    React.createElement(SchoolCalendarPanel, {
      events: [class1Ev, schoolEv], // even stale parent hydratedEvents cannot leak class-1
      backendStatus: 'READY',
      classId: null,
      assignedClasses: [],
      onRefresh: async () => false,
      loadMonthEvents,
    }),
  );

  // Immediately upon assignment change (while pending), cached class-1 event & draft MUST vanish!
  assert.equal(mounted.container.querySelector('[data-testid="calendar-create-form"]'), null);
  assert.equal(mounted.container.querySelector('[data-testid="calendar-add-event-btn"]'), null);
  assert.ok(mounted.container.querySelector('[data-testid="calendar-teacher-no-assignments"]'));
  assert.ok(!mounted.container.textContent.includes('Restricted Class-1 Meeting'), 'Revoked class-1 cache must be invalidated immediately');

  // Resolve next read with ERROR -> still MUST NOT restore restricted cached class-1 event!
  await act(async () => {
    resolveRevokedRead?.({ ok: false, status: 'ERROR', errorCode: 'read_err', errorMessage: 'Load failed' });
    await new Promise((r) => setTimeout(r, 15));
  });
  assert.ok(mounted.container.querySelector('[data-testid="calendar-error-state"]'));
  assert.ok(!mounted.container.textContent.includes('Restricted Class-1 Meeting'), 'ERROR state after access change must never restore old restricted cache');

  // Same user ID becomes PENDING/SUSPENDED -> fail closed to UNAUTHORIZED immediately
  const suspendedUser = makeUser({ id: 'teacher-same', role: 'TEACHER', accountStatus: 'PENDING', assignedClassIds: ['class-1'] });
  globalThis.__CAL_TEST_CTX__ = makeCtx({ currentUser: suspendedUser });
  await mounted.rerender(
    React.createElement(SchoolCalendarPanel, {
      events: [class1Ev, schoolEv],
      backendStatus: 'READY',
      classId: 'class-1',
      onRefresh: async () => true,
      loadMonthEvents,
    }),
  );
  assert.ok(mounted.container.querySelector('[data-testid="calendar-unauthorized-state"]'));
  assert.ok(!mounted.container.textContent.includes('Restricted Class-1 Meeting'));
  assert.ok(!mounted.container.textContent.includes('Public Campus Day'));

  await mounted.unmount();
});

test('10: No canManage -> APP_ADMIN identity substitution; props cannot escalate unauthorized roles', () => {
  const todayTunis = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
  const sampleEv = {
    id: 'ev-role-check',
    classId: null,
    title: 'Campus Assembly',
    description: '',
    category: 'EVENT',
    date: todayTunis,
    endDate: todayTunis,
    isAllDay: true,
    isPublic: true,
    status: 'SCHEDULED',
  };

  for (const deniedActor of [
    makeUser({ role: 'PARENT', assignedClassIds: ['class-1'] }),
    makeUser({ role: 'STUDENT', assignedClassIds: ['class-1'] }),
    makeUser({ role: 'SCHOOL_STAFF', capabilities: ['CALENDAR_READ'] }),
    makeUser({ role: 'MANAGER', capabilities: ['COMMUNITY_MODERATE'] }),
    makeUser({ role: 'APP_ADMIN', accountStatus: 'PENDING' }),
  ]) {
    globalThis.__CAL_TEST_CTX__ = makeCtx({ currentUser: deniedActor });
    const html = renderToStaticMarkup(
      React.createElement(SchoolCalendarPanel, {
        events: [sampleEv],
        backendStatus: 'READY',
        canManage: true,
        canManageCalendar: true,
        canCreate: true,
        canCancel: true,
        onRefresh: async () => true,
      }),
    );
    assert.ok(!html.includes('data-testid="calendar-add-event-btn"'), `${deniedActor.role} (${deniedActor.accountStatus}) must not get Add Event from props`);
    assert.ok(!html.includes('data-testid="calendar-cancel-event-btn"'), `${deniedActor.role} (${deniedActor.accountStatus}) must not get Cancel from props`);
  }

  for (const authorizedActor of [
    makeUser({ role: 'APP_ADMIN', assignedClassIds: [] }),
    makeUser({ role: 'ADMINISTRATIVE_PERSONNEL', assignedClassIds: [] }),
    makeUser({ role: 'MANAGER', capabilities: ['CALENDAR_MANAGE'], assignedClassIds: [] }),
  ]) {
    globalThis.__CAL_TEST_CTX__ = makeCtx({ currentUser: authorizedActor });
    const html = renderToStaticMarkup(
      React.createElement(SchoolCalendarPanel, {
        events: [sampleEv],
        backendStatus: 'READY',
        canManage: true,
        onRefresh: async () => true,
      }),
    );
    assert.ok(html.includes('data-testid="calendar-add-event-btn"'), `${authorizedActor.role} must keep authentic Add Event right`);
    assert.ok(html.includes('data-testid="calendar-cancel-event-btn"'), `${authorizedActor.role} must keep authentic Cancel right`);
  }
});

test('11: User-facing AR/FR/EN calendar messages contain zero agent names, contract jargon, or SQL commentary', async () => {
  const forbiddenPatterns = [
    /codex/i,
    /\bcontract\b/i,
    /\bcontrat\b/i,
    /عقد/,
    /supabase/i,
    /school_calendar_events/i,
    /school_calendar_event_feed/i,
    /create_school_calendar_event/i,
    /governance_list_account_directory/i,
    /duplicate copy/i,
    /mock/i,
    /fake/i,
  ];

  // Validate calendar error copy
  for (const caseInput of [
    {
      title: 'Check Teacher Required',
      startDate: '2026-11-20',
      audienceMode: 'TEACHER_CLASSES',
      actorRole: 'APP_ADMIN',
      canManageCalendar: true,
    },
    {
      title: 'Check No Eligible',
      startDate: '2026-11-20',
      audienceMode: 'ALL_MY_CLASSES',
      actorRole: 'TEACHER',
      canManageCalendar: false,
      allowedClassIds: [],
    },
  ]) {
    const res = validateCalendarCreateInput(caseInput);
    assert.equal(res.valid, false);
    for (const pat of forbiddenPatterns) {
      assert.doesNotMatch(res.errorMessage, pat);
    }
  }

  // Render SchoolCalendarPanel across all 3 languages & blocked/error/unauthorized/form states
  for (const lang of ['ar', 'fr', 'en']) {
    // Blocked backend state: inspect SchoolCalendarPanel's own title (<h3 ...>) & description (<p ...>)
    globalThis.__CAL_TEST_CTX__ = makeCtx({
      currentUser: makeUser({ role: 'APP_ADMIN', assignedClassIds: [] }),
      language: lang,
    });
    const blockedHtml = renderToStaticMarkup(
      React.createElement(SchoolCalendarPanel, {
        events: [],
        backendStatus: 'BLOCKED_BACKEND',
        onRefresh: async () => true,
      }),
    );
    const titleMatch = blockedHtml.match(/<h3[^>]*>([^<]+)<\/h3>/);
    const descMatch = blockedHtml.match(/<p[^>]*class="text-sm[^"]*"[^>]*>([^<]+)<\/p>/);
    assert.ok(titleMatch && descMatch, `${lang} BLOCKED_BACKEND must render title and description`);
    for (const pat of forbiddenPatterns) {
      assert.doesNotMatch(titleMatch[1], pat, `${lang} BLOCKED_BACKEND title must not leak ${pat}`);
      assert.doesNotMatch(descMatch[1], pat, `${lang} BLOCKED_BACKEND description must not leak ${pat}`);
    }

    for (const errStatus of ['ERROR', 'UNAUTHORIZED']) {
      const errHtml = renderToStaticMarkup(
        React.createElement(SchoolCalendarPanel, {
          events: [],
          backendStatus: errStatus,
          onRefresh: async () => true,
        }),
      );
      const alertText = errHtml.replace(/<[^>]+>/g, ' ');
      for (const pat of forbiddenPatterns) {
        assert.doesNotMatch(alertText, pat, `${lang} ${errStatus} must not leak ${pat}`);
      }
    }

    // Mounted create form for Manager without directory access (blocked picker), Admin with empty teachers, and Teacher (ALL_MY_CLASSES)
    for (const roleCfg of [
      {
        user: makeUser({ role: 'MANAGER', capabilities: ['CALENDAR_MANAGE'], assignedClassIds: [] }),
        audience: 'TEACHER_CLASSES',
        teacherOptions: undefined,
      },
      {
        user: makeUser({ role: 'APP_ADMIN', assignedClassIds: [] }),
        audience: 'TEACHER_CLASSES',
        teacherOptions: [],
      },
      {
        user: makeUser({ role: 'TEACHER', assignedClassIds: ['class-1', 'class-2'] }),
        audience: 'ALL_MY_CLASSES',
        teacherOptions: undefined,
      },
    ]) {
      globalThis.__CAL_TEST_SUPABASE__ = null;
      globalThis.__CAL_TEST_CTX__ = makeCtx({ currentUser: roleCfg.user, language: lang });
      const mounted = await mountComponent(
        React.createElement(SchoolCalendarPanel, {
          events: [],
          backendStatus: 'READY',
          allClasses: [
            { id: 'class-1', name: 'CP-A' },
            { id: 'class-2', name: 'CE1-B' },
          ],
          teacherOptions: roleCfg.teacherOptions,
          onRefresh: async () => true,
          loadMonthEvents: async () => ({ ok: true, status: 'READY', data: [] }),
        }),
      );
      await act(async () => {
        mounted.container.querySelector('[data-testid="calendar-add-event-btn"]').click();
      });
      await act(async () => {
        dom.setInputValue(
          mounted.container.querySelector('[data-testid="calendar-audience-select"]'),
          roleCfg.audience,
        );
      });
      const text = mounted.container.textContent || '';
      for (const pat of forbiddenPatterns) {
        assert.doesNotMatch(text, pat, `${lang} ${roleCfg.audience} UI text must not leak ${pat}`);
      }
      await mounted.unmount();
    }
  }
});

test('12: Multi-class target_class_ids filtering, scope badges, ClassCommunityView class-2 delivery, and fail-closed anonymous filter', () => {
  const todayTunis = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());

  // Pure calendarModel helpers
  const multiEv = {
    id: 'ev-multi',
    audienceMode: 'TEACHER_CLASSES',
    classId: 'class-1',
    targetClassIds: ['class-1', 'class-2'],
    title: 'Shared Art Workshop',
    description: '',
    category: 'ACTIVITY',
    date: todayTunis,
    endDate: todayTunis,
    isAllDay: true,
    isPublic: false,
    status: 'SCHEDULED',
  };
  const hiddenTargetEv = {
    id: 'ev-hidden-targets',
    audienceMode: 'ALL_MY_CLASSES',
    classId: undefined,
    targetClassIds: [],
    title: 'Targeted Hidden Scope',
    description: '',
    category: 'EVENT',
    date: todayTunis,
    endDate: todayTunis,
    isAllDay: true,
    isPublic: false,
    status: 'SCHEDULED',
  };
  const class1OnlyNoClassId = {
    id: 'ev-c1-only',
    audienceMode: 'TEACHER_CLASSES',
    classId: undefined,
    targetClassIds: ['class-1'],
    title: 'Class 1 Only Seminar',
    description: '',
    category: 'MEETING',
    date: todayTunis,
    endDate: todayTunis,
    isAllDay: true,
    isPublic: false,
    status: 'SCHEDULED',
  };

  assert.equal(isWholeSchoolCalendarEvent(multiEv), false);
  assert.equal(isWholeSchoolCalendarEvent(hiddenTargetEv), false);
  assert.deepEqual(getVisibleCalendarTargetClassIds(multiEv), ['class-1', 'class-2']);
  assert.equal(calendarEventMatchesClassScope(multiEv, 'class-2'), true);
  assert.equal(calendarEventMatchesClassScope(class1OnlyNoClassId, 'class-2'), false);
  assert.equal(calendarEventMatchesAuthorizedClasses(multiEv, new Set(['class-2'])), true);
  assert.equal(calendarEventMatchesAuthorizedClasses(class1OnlyNoClassId, new Set(['class-2'])), false);

  // ClassCommunityView viewing class-2 must include ev-multi (targeting [class-1, class-2]) and exclude ev-c1-only
  globalThis.__CAL_TEST_CTX__ = makeCtx({
    currentUser: makeUser({ role: 'PARENT', assignedClassIds: ['class-1', 'class-2'] }),
    selectedClassId: 'class-2',
    calendarEvents: [multiEv, class1OnlyNoClassId],
  });
  const commClass2Html = renderToStaticMarkup(
    React.createElement(ClassCommunityView, { initialSubTab: 'calendar' }),
  );
  assert.ok(commClass2Html.includes('Shared Art Workshop'), 'Secondary target class-2 must see multi-class event');
  assert.ok(!commClass2Html.includes('Class 1 Only Seminar'), 'Non-target class-1 event without classId must not leak into class-2');

  // SchoolCalendarPanel scope badge renders visible class names for multi-class and never falls back to Whole school for targeted events
  globalThis.__CAL_TEST_CTX__ = makeCtx({
    currentUser: makeUser({ role: 'TEACHER', assignedClassIds: ['class-2'] }),
  });
  const teacherHtml = renderToStaticMarkup(
    React.createElement(SchoolCalendarPanel, {
      events: [multiEv, class1OnlyNoClassId, hiddenTargetEv],
      backendStatus: 'READY',
      classId: null,
      assignedClasses: [{ id: 'class-2', name: 'CE1-B' }],
      allClasses: [
        { id: 'class-1', name: 'CP-A' },
        { id: 'class-2', name: 'CE1-B' },
      ],
      onRefresh: async () => true,
    }),
  );
  assert.ok(teacherHtml.includes('Shared Art Workshop'));
  assert.ok(teacherHtml.includes('CP-A, CE1-B'));
  assert.ok(!teacherHtml.includes('Class 1 Only Seminar'));

  // Targeted event with 0 visible class IDs shown to Admin displays "Targeted class", NEVER "Whole school"
  globalThis.__CAL_TEST_CTX__ = makeCtx({
    currentUser: makeUser({ role: 'APP_ADMIN', assignedClassIds: [] }),
  });
  const adminTargetedEmptyHtml = renderToStaticMarkup(
    React.createElement(SchoolCalendarPanel, {
      events: [hiddenTargetEv],
      backendStatus: 'READY',
      classId: null,
      onRefresh: async () => true,
    }),
  );
  assert.ok(adminTargetedEmptyHtml.includes('Targeted class'));
  assert.ok(!adminTargetedEmptyHtml.includes('Whole school'));

  // Anonymous public visitor sees only WHOLE_SCHOOL + isPublic: true events
  globalThis.__CAL_TEST_CTX__ = makeCtx({ currentUser: null });
  const publicWhole = {
    id: 'ev-pub',
    audienceMode: 'WHOLE_SCHOOL',
    targetClassIds: [],
    title: 'Public Open Day',
    description: '',
    category: 'EVENT',
    date: todayTunis,
    endDate: todayTunis,
    isAllDay: true,
    isPublic: true,
    status: 'SCHEDULED',
  };
  const anonHtml = renderToStaticMarkup(
    React.createElement(SchoolCalendarPanel, {
      events: [publicWhole, class1OnlyNoClassId],
      backendStatus: 'READY',
      classId: null,
      onRefresh: async () => true,
    }),
  );
  assert.ok(anonHtml.includes('Public Open Day'));
  assert.ok(!anonHtml.includes('Class 1 Only Seminar'));
});
