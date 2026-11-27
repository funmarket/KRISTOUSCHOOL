import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function countSplitLines(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8').split('\n').length;
}

test('ARCH-02 & ARCH-06 Gate 1: AppContext.tsx <= 1,050 lines and src/types.ts <= 300 lines', () => {
  const appCtxLines = countSplitLines('src/context/AppContext.tsx');
  assert.ok(
    appCtxLines <= 1050,
    `Expected src/context/AppContext.tsx <= 1,050 lines, got ${appCtxLines}`,
  );

  const typesLines = countSplitLines('src/types.ts');
  assert.ok(
    typesLines <= 300,
    `Expected src/types.ts <= 300 lines, got ${typesLines}`,
  );
});

test('ARCH-06 Gate 2: schoolContent.ts and schoolOperations.ts are 100% pure re-export barrels with 0 inline functions or queries', () => {
  for (const barrel of ['src/lib/schoolContent.ts', 'src/lib/schoolOperations.ts']) {
    const src = fs.readFileSync(path.join(ROOT, barrel), 'utf8');
    assert.doesNotMatch(
      src,
      /\bfunction\b/,
      `${barrel} must not contain inline function declarations`,
    );
    assert.doesNotMatch(
      src,
      /=>/,
      `${barrel} must not contain inline arrow functions`,
    );
    assert.doesNotMatch(
      src,
      /\.(from|rpc)\s*\(/,
      `${barrel} must not contain direct .from() or .rpc() calls`,
    );
  }
});

test('ARCH-06 Gate 3: All 14 domain modules preserve exact RPC and table contracts while owning their domain types', async () => {
  const expectedInventory = {
    'academics.ts': {
      rpcs: [
        'get_my_school_context',
        'list_school_classes_with_rosters',
        'create_school_class',
        'create_and_enroll_student',
        'assign_teacher_to_class',
        'list_academic_years',
      ],
      tables: [],
    },
    'broadcasts.ts': {
      rpcs: ['publish_school_broadcast'],
      tables: ['school_broadcasts'],
    },
    'calendarMutations.ts': {
      rpcs: [
        'create_school_calendar_event',
        'cancel_school_calendar_event',
        'respond_to_calendar_event',
      ],
      tables: [],
    },
    'classCommunity.ts': {
      rpcs: [
        'create_class_announcement',
        'create_class_homework',
        'post_class_question',
        'reply_class_question',
        'moderate_class_question',
      ],
      tables: [
        'class_announcements',
        'class_homework_items',
        'class_questions',
        'class_documents',
        'class_gallery_items',
        'class_question_replies',
      ],
    },
    'directory.ts': {
      rpcs: ['upsert_directory_entry'],
      tables: ['directory_entries'],
    },
    'enrollment.ts': {
      rpcs: ['submit_enrollment_application', 'complete_enrollment_admission', 'review_enrollment_application'],
      tables: ['enrollment_applications'],
    },
    'foodMenu.ts': {
      rpcs: ['save_food_menu_week'],
      tables: ['food_menu_weeks', 'food_menu_days'],
    },
    'messaging.ts': {
      rpcs: [
        'list_approved_message_recipients',
        'send_operational_message',
        'reply_operational_thread',
      ],
      tables: ['message_threads', 'thread_participants', 'thread_messages'],
    },
    'notifications.ts': {
      rpcs: ['mark_user_notification_read', 'mark_all_user_notifications_read'],
      tables: ['user_notifications'],
    },
    'parentNotes.ts': {
      rpcs: ['send_parent_note', 'reply_parent_note'],
      tables: ['parent_notes'],
    },
    'people.ts': {
      rpcs: ['list_school_students', 'get_school_student_identity'],
      tables: [],
    },
    'preferences.ts': {
      rpcs: ['upsert_my_preferences'],
      tables: ['user_preferences'],
    },
    'publicContent.ts': {
      rpcs: [],
      tables: ['school_public_content'],
    },
    'publicInquiry.ts': {
      rpcs: ['submit_public_inquiry', 'respond_public_inquiry'],
      tables: ['public_school_inquiries'],
    },
  };

  for (const [domainFile, expected] of Object.entries(expectedInventory)) {
    const txt = fs.readFileSync(path.join(ROOT, 'src/lib/domains', domainFile), 'utf8');
    const rpcs = [...new Set([...txt.matchAll(/\.rpc\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))];
    const tables = [...new Set([...txt.matchAll(/\.from\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))];
    assert.deepEqual(rpcs, expected.rpcs, `RPC mismatch in ${domainFile}`);
    assert.deepEqual(tables, expected.tables, `Table mismatch in ${domainFile}`);
  }

  const { isSafeExternalOrAssetUrl } = await import('../src/lib/schoolContent.ts');
  const { isSafeExternalOrAssetUrl: fromDomain } = await import('../src/lib/domains/classCommunity.ts');
  assert.equal(isSafeExternalOrAssetUrl, fromDomain);
  assert.equal(isSafeExternalOrAssetUrl('https://cdn.kristou.tn/doc.pdf'), true);
  assert.equal(isSafeExternalOrAssetUrl('javascript:alert(1)'), false);
});
