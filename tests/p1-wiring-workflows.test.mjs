import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

globalThis.__KRISTOU_SUPABASE_URL__ = 'https://example.supabase.co';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = 'test-publishable-key';

const {
  fetchPublicContent,
  listSchoolCalendarEvents,
  listClassCommunityContent,
  listMessageThreads,
  respondToCalendarEvent,
  loadMyPreferences,
  saveMyPreferences,
  markNotificationReadOnServer,
} = await import('../src/lib/schoolContent.ts');

const {
  createAndEnrollStudent,
  assignTeacherToClass,
} = await import('../src/lib/schoolOperations.ts');

const require = createRequire(import.meta.url);
const tempDir = await mkdtemp(path.join(tmpdir(), 'kristou-p1-wiring-'));
after(() => rm(tempDir, { recursive: true, force: true }));

const publicBundle = path.join(tempDir, 'public-home-p1.cjs');
await build({
  entryPoints: [new URL('../src/components/homepages/PublicHomePage.tsx', import.meta.url).pathname],
  outfile: publicBundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  loader: { '.css': 'empty' },
  define: { __KRISTOU_SUPABASE_URL__: '""', __KRISTOU_SUPABASE_PUBLISHABLE_KEY__: '""' },
  plugins: [
    {
      name: 'context-and-external-deps',
      setup(builder) {
        builder.onResolve({ filter: /context\/AppContext$/ }, () => ({
          path: 'context',
          namespace: 'fixture',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
          contents:
            'export const useApp = () => ({...globalThis.__P1_PUBLIC_CTX__, t: (key) => key});',
        }));
        builder.onResolve({ filter: /^[^./]/ }, (args) => ({
          path: require.resolve(args.path),
          external: true,
        }));
      },
    },
  ],
});
const { PublicHomePage } = require(publicBundle);

test('fetchPublicContent maps published entries, fails closed on null client, and surfaces DB errors', async () => {
  const nullRes = await fetchPublicContent(null);
  assert.equal(nullRes.ok, false);
  assert.equal(nullRes.status, 'BLOCKED_BACKEND');
  assert.equal(nullRes.errorCode, 'backend_unavailable');

  const okClient = {
    from: (table) => {
      assert.equal(table, 'school_public_content');
      return {
        select: () => ({
          eq: async (col, val) => {
            assert.equal(col, 'is_published');
            assert.equal(val, true);
            return {
              data: [
                {
                  slug: 'hero',
                  title_ar: 'مدرسة كريستو',
                  title_fr: 'École Kristou',
                  title_en: 'Kristou School',
                  body_ar: 'وصف حي',
                  body_fr: 'Description en direct',
                  body_en: 'Live published hero copy',
                  is_published: true,
                  updated_at: '2026-11-15T10:00:00Z',
                },
              ],
              error: null,
            };
          },
        }),
      };
    },
  };
  const okRes = await fetchPublicContent(okClient);
  assert.equal(okRes.ok, true);
  assert.equal(okRes.status, 'READY');
  assert.equal(okRes.data?.hero?.bodyEn, 'Live published hero copy');

  const errClient = {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: null, error: { code: '42501', message: 'permission denied' } }),
      }),
    }),
  };
  const errRes = await fetchPublicContent(errClient);
  assert.equal(errRes.ok, false);
  assert.equal(errRes.status, 'UNAUTHORIZED');
});

test('PublicHomePage omits demoPreview when live data is READY and shows demoPreview when fallback is active', () => {
  globalThis.__P1_PUBLIC_CTX__ = {
    language: 'en',
    currentUser: null,
    broadcastsStatus: 'READY',
    foodMenuStatus: 'READY',
    announcements: [
      {
        id: 'pub-1',
        title: 'Live Open House',
        body: 'Welcome families',
        priority: 'NORMAL',
        status: 'PUBLISHED',
        audienceScope: 'PUBLIC_SITE',
        isPublic: true,
        isDemoPreview: false,
        authorName: 'Director',
        authorRole: 'Administration',
        createdAt: '2026-11-15',
      },
    ],
    foodMenu: {
      id: 'menu-live',
      weekRange: '16-20 Nov 2026',
      providerName: 'La Toque Gourmande',
      items: [{ day: 'Monday', starter: 'Soup', main: 'Couscous', side: 'Salad', dessert: 'Fruit' }],
      isDemoPreview: false,
    },
    publicContent: {
      hero: {
        slug: 'hero',
        titleAr: 'مدرسة كريستو',
        titleFr: 'Kristou School',
        titleEn: 'Kristou School',
        bodyAr: 'مرحباً',
        bodyFr: 'Bienvenue',
        bodyEn: 'Custom live hero description from DB',
        isPublished: true,
      },
    },
  };

  const liveHtml = renderToStaticMarkup(
    React.createElement(PublicHomePage, { setActiveTab() {}, onOpenAuth() {} }),
  );
  assert.ok(liveHtml.includes('Live Open House'));
  assert.ok(liveHtml.includes('Custom live hero description from DB'));
  assert.ok(!liveHtml.includes('demoPreview'), 'Live READY data must not show demoPreview');

  globalThis.__P1_PUBLIC_CTX__ = {
    language: 'en',
    currentUser: null,
    broadcastsStatus: 'BLOCKED_BACKEND',
    foodMenuStatus: 'BLOCKED_BACKEND',
    announcements: [
      {
        id: 'demo-1',
        title: 'Demo Broadcast',
        body: 'Demo body',
        priority: 'NORMAL',
        isDemoPreview: true,
        authorName: 'Office',
        authorRole: 'Administration',
        createdAt: '2026-11-15',
      },
    ],
    foodMenu: {
      id: 'menu-demo',
      weekRange: 'Preview Week',
      providerName: 'La Toque Gourmande',
      items: [],
      isDemoPreview: true,
    },
  };

  const demoHtml = renderToStaticMarkup(
    React.createElement(PublicHomePage, { setActiveTab() {}, onOpenAuth() {} }),
  );
  assert.ok(demoHtml.includes('demoPreview'), 'Demo fallback must display demoPreview label');
});

test('schoolContent nested queries propagate Supabase errors instead of ignoring them', async () => {
  // 1. listSchoolCalendarEvents failing on school_calendar_responses
  const calErrClient = {
    from: (table) => {
      if (table === 'school_calendar_events') {
        return {
          select: () => ({
            order: async () => ({
              data: [
                {
                  id: 'ev-1',
                  title: 'Event 1',
                  category: 'EVENT',
                  start_date: '2026-11-20',
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: async () => ({
            data: null,
            error: { code: '500', message: 'responses query failed' },
          }),
        }),
      };
    },
  };
  const calRes = await listSchoolCalendarEvents('user-1', calErrClient);
  assert.equal(calRes.ok, false);
  assert.equal(calRes.status, 'ERROR');

  // 2. listClassCommunityContent failing on class_documents and class_question_replies
  const makeCommunityClient = (failTable) => ({
    from: (table) => {
      const result =
        table === failTable
          ? { data: null, error: { code: '500', message: `${table} failed` } }
          : table === 'class_questions'
          ? { data: [{ id: 'q-1', class_id: 'c-1', author_user_id: 'u-1', author_name: 'Student', content: 'Hi?' }], error: null }
          : { data: [], error: null };
      const chain = {
        eq: () => chain,
        or: () => chain,
        in: () => chain,
        order: async () => result,
      };
      return { select: () => chain };
    },
  });

  const docFail = await listClassCommunityContent(null, makeCommunityClient('class_documents'));
  assert.equal(docFail.ok, false);
  assert.equal(docFail.status, 'ERROR');

  const galFail = await listClassCommunityContent(null, makeCommunityClient('class_gallery_items'));
  assert.equal(galFail.ok, false);
  assert.equal(galFail.status, 'ERROR');

  const repFail = await listClassCommunityContent(null, makeCommunityClient('class_question_replies'));
  assert.equal(repFail.ok, false);
  assert.equal(repFail.status, 'ERROR');

  // 3. listMessageThreads failing on thread_participants or thread_messages
  const makeThreadsClient = (failTable) => ({
    from: (table) => {
      if (table === 'message_threads') {
        return {
          select: () => ({
            order: async () => ({
              data: [{ id: 'th-1', subject: 'Hi', last_message_preview: 'Hello', updated_at: '2026-11-15' }],
              error: null,
            }),
          }),
        };
      }
      const errRes =
        table === failTable
          ? { data: null, error: { code: '500', message: `${table} error` } }
          : { data: [], error: null };
      const subChain = {
        in: () => subChain,
        order: async () => errRes,
        then: (resolve, reject) => Promise.resolve(errRes).then(resolve, reject),
      };
      return { select: () => subChain };
    },
  });

  const partFail = await listMessageThreads('u-1', makeThreadsClient('thread_participants'));
  assert.equal(partFail.ok, false);
  assert.equal(partFail.status, 'ERROR');

  const msgFail = await listMessageThreads('u-1', makeThreadsClient('thread_messages'));
  assert.equal(msgFail.ok, false);
  assert.equal(msgFail.status, 'ERROR');
});

test('createAndEnrollStudent & assignTeacherToClass pass linking UUIDs and unassign flag to RPCs', async () => {
  const calls = [];
  const rpcClient = {
    rpc: async (fnName, args) => {
      calls.push({ fnName, args });
      if (fnName === 'create_and_enroll_student') {
        return {
          data: {
            studentId: 'stu-99',
            studentCode: args.p_student_code,
            classId: args.p_class_id,
          },
          error: null,
        };
      }
      if (fnName === 'assign_teacher_to_class') {
        return {
          data: {
            teacherUserId: args.p_teacher_user_id,
            classId: args.p_class_id,
            active: args.p_active,
          },
          error: null,
        };
      }
      return { data: null, error: { code: 'PGRST202', message: 'missing' } };
    },
  };

  const enrollRes = await createAndEnrollStudent(
    {
      studentCode: 'ks-2026-042',
      fullName: 'Sami Trabelsi',
      birthDate: '2018-04-10',
      classId: 'cls-1',
      parentUserId: 'parent-uuid-1',
      linkedProfileId: 'student-uuid-1',
      relationshipLabel: 'Mother',
    },
    rpcClient,
  );
  assert.equal(enrollRes.ok, true);
  assert.equal(calls[0].fnName, 'create_and_enroll_student');
  assert.equal(calls[0].args.p_parent_user_id, 'parent-uuid-1');
  assert.equal(calls[0].args.p_linked_profile_id, 'student-uuid-1');
  assert.equal(calls[0].args.p_student_code, 'KS-2026-042');

  const unassignRes = await assignTeacherToClass(
    {
      teacherUserId: 'teacher-uuid-1',
      classId: 'cls-1',
      isHomeroom: false,
      active: false,
    },
    rpcClient,
  );
  assert.equal(unassignRes.ok, true);
  assert.equal(unassignRes.data?.active, false);
  assert.equal(calls[1].fnName, 'assign_teacher_to_class');
  assert.equal(calls[1].args.p_active, false);
});

test('Calendar RSVP roundtrip & SchoolCalendarPanel exposes all three RSVP responses', async () => {
  const calendarSrc = fs.readFileSync(
    new URL('../src/components/views/Shared/SchoolCalendarPanel.tsx', import.meta.url),
    'utf8',
  );
  assert.match(calendarSrc, /handleRsvp\(ev\.id, 'ATTENDING'\)/);
  assert.match(calendarSrc, /handleRsvp\(ev\.id, 'ACKNOWLEDGED'\)/);
  assert.match(calendarSrc, /handleRsvp\(ev\.id, 'DECLINED'\)/);

  const client = {
    rpc: async (fnName, args) => {
      assert.equal(fnName, 'respond_to_calendar_event');
      return { data: { event_id: args.p_event_id, response: args.p_response }, error: null };
    },
  };
  for (const choice of ['ATTENDING', 'ACKNOWLEDGED', 'DECLINED']) {
    const res = await respondToCalendarEvent('ev-123', choice, client);
    assert.equal(res.ok, true);
    assert.equal(res.data?.response, choice);
  }
});

test('Preferences roundtrip preserves soundMuted/vibrationEnabled and notification read failures propagate', async () => {
  let savedRow = null;
  const prefClient = {
    rpc: async (fnName, args) => {
      assert.equal(fnName, 'upsert_my_preferences');
      savedRow = {
        language: args.p_language ?? 'en',
        theme: args.p_theme ?? 'dark',
        notification_sound: args.p_notification_sound ?? 'Chime',
        sound_muted: args.p_sound_muted ?? false,
        vibration_enabled: args.p_vibration_enabled ?? true,
      };
      return { data: savedRow, error: null };
    },
    from: (table) => {
      assert.equal(table, 'user_preferences');
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: savedRow, error: null }),
          }),
        }),
      };
    },
  };

  const saveRes = await saveMyPreferences(
    { language: 'ar', theme: 'dark', soundMuted: true, vibrationEnabled: false },
    prefClient,
  );
  assert.equal(saveRes.ok, true);
  assert.equal(saveRes.data?.soundMuted, true);
  assert.equal(saveRes.data?.vibrationEnabled, false);

  const loadRes = await loadMyPreferences('user-1', prefClient);
  assert.equal(loadRes.ok, true);
  assert.equal(loadRes.data?.soundMuted, true);
  assert.equal(loadRes.data?.vibrationEnabled, false);

  const failNotifClient = {
    rpc: async () => ({ data: null, error: { code: '42501', message: 'not allowed' } }),
  };
  const notifRes = await markNotificationReadOnServer('notif-1', failNotifClient);
  assert.equal(notifRes.ok, false);
  assert.equal(notifRes.status, 'UNAUTHORIZED');
});
