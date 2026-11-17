#!/usr/bin/env node
/**
 * KRISTOU SCHOOL — T4A Real PostgreSQL Two-Session Concurrency Test Runner
 *
 * Verifies canonical locking (L0 -> L1 -> L2 -> L3 -> L4 -> L5 -> L6 -> L7),
 * deadlock freedom, post-wait invariant enforcement, and append-only allocation
 * audit history across two independent PostgreSQL sessions:
 *   Scenario 1: Two concurrent attempts to allocate the same subject.
 *   Scenario 2: Allocation reactivation versus class-assignment revocation.
 *   Scenario 3: Allocation creation versus school subject offering disablement.
 *   Scenario 4: Concurrent activation/deactivation of an existing allocation.
 *
 * Requirements enforced:
 * - Two independent `psql` database sessions connected to a real PostgreSQL instance.
 * - Deterministic lock-wait coordination via `pg_stat_activity` / `pg_locks` (no arbitrary sleep timing).
 * - Explicit statement_timeout, lock_timeout, and process timeouts; fails on any timeout.
 * - Verifies persisted rows in `public.teacher_subject_allocations` and audit history in
 *   `public.teacher_subject_allocation_events` after both sessions complete.
 * - Fails clearly with non-zero exit code when PostgreSQL or `psql` is unavailable (never fakes a pass).
 *
 * Execution:
 *   T4A_DISPOSABLE_DB=1 DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
 *     node supabase/tests/t4a_two_session_concurrency_runner.mjs
 */

import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';

let DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
const SOURCE_DATABASE_URL = DATABASE_URL;
let isolatedDatabaseName = null;
const PROCESS_TIMEOUT_MS = Number(process.env.T4A_CONCURRENCY_TIMEOUT_MS || 15000);

function failBlocked(reason) {
  console.error(`BLOCKED: ${reason}`);
  console.error(
    'This runner requires a live PostgreSQL instance with T4A migrations applied and the `psql` client binary.'
  );
  process.exit(2);
}

function assertPrerequisites() {
  const target = new URL(DATABASE_URL);
  if (process.env.T4A_DISPOSABLE_DB !== '1' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || !/^t4a_[a-z0-9_]+$/.test(target.pathname.slice(1))) {
    failBlocked('Requires T4A_DISPOSABLE_DB=1 and a local explicitly named t4a_* disposable template database.');
  }
  const psqlCheck = spawnSync('which', ['psql'], { encoding: 'utf8' });
  if (psqlCheck.status !== 0) {
    failBlocked('`psql` binary is not installed in this environment.');
  }
  if (!DATABASE_URL) {
    failBlocked('DATABASE_URL (or SUPABASE_DB_URL) environment variable is not set.');
  }
  const ping = spawnSync(
    'psql',
    [DATABASE_URL, '--no-psqlrc', '-v', 'ON_ERROR_STOP=1', '-Atc', 'SELECT 1;'],
    { encoding: 'utf8', timeout: 5000 }
  );
  if (ping.error || ping.status !== 0) {
    failBlocked(
      `Cannot connect to PostgreSQL at DATABASE_URL (exit=${ping.status ?? 'ERR'}): ${(ping.stderr || ping.error?.message || '').trim()}`
    );
  }
}

function runOneShotSql(sql, label = 'one-shot-sql') {
  const res = spawnSync(
    'psql',
    [
      DATABASE_URL,
      '--no-psqlrc',
      '-v',
      'ON_ERROR_STOP=1',
      '-qAtc',
      `SET statement_timeout = '8s'; SET lock_timeout = '5s'; ${sql}`,
    ],
    { encoding: 'utf8', timeout: PROCESS_TIMEOUT_MS }
  );
  if (res.error) {
    throw new Error(`[${label}] Process error/timeout: ${res.error.message}`);
  }
  if (res.status !== 0) {
    throw new Error(`[${label}] SQL failed (exit=${res.status}): ${res.stderr.trim()}`);
  }
  return res.stdout.trim();
}

class PsqlSession {
  constructor(name) {
    this.name = name;
    this.proc = spawn(
      'bash',
      ['-c', 'exec psql "$@" 2>&1', 't4a-psql', DATABASE_URL, '--no-psqlrc', '-v', 'ON_ERROR_STOP=0', '-At', '-q'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    this.stdoutLines = [];
    this.stderrLines = [];
    this.waiters = [];
    this.closed = false;

    const rlOut = createInterface({ input: this.proc.stdout });
    rlOut.on('line', (line) => {
      if (/^(ERROR|FATAL|PANIC):/.test(line)) this.stderrLines.push(line);
      else this.stdoutLines.push(line);
      this.notifyWaiters();
    });

    const rlErr = createInterface({ input: this.proc.stderr });
    rlErr.on('line', (line) => {
      this.stderrLines.push(line);
      this.notifyWaiters();
    });

    this.proc.on('exit', () => {
      this.closed = true;
      this.notifyWaiters();
    });
  }

  notifyWaiters() {
    for (const w of [...this.waiters]) {
      w();
    }
  }

  async init() {
    const out = await this.exec(`
      SET statement_timeout = '8s';
      SET lock_timeout = '5s';
      SET idle_in_transaction_session_timeout = '10s';
      SELECT pg_backend_pid();
    `);
    this.backendPid = Number(out.lines[out.lines.length - 1]);
    if (!Number.isInteger(this.backendPid) || this.backendPid <= 0) {
      throw new Error(`[${this.name}] Failed to obtain pg_backend_pid(): ${JSON.stringify(out)}`);
    }
    return this.backendPid;
  }

  sendRaw(sql, marker) {
    const startOutLen = this.stdoutLines.length;
    const startErrLen = this.stderrLines.length;
    const payload = `${sql}\n\\echo ${marker}\n`;
    this.proc.stdin.write(payload);
    return { startOutLen, startErrLen, marker };
  }

  async waitForMarker({ startOutLen, startErrLen, marker }, timeoutMs = PROCESS_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `[${this.name}] Timed out after ${timeoutMs}ms waiting for marker ${marker}. stderr=${this.stderrLines.slice(startErrLen).join(' | ')}`
          )
        );
      }, timeoutMs);

      const check = () => {
        const recentOut = this.stdoutLines.slice(startOutLen);
        const idx = recentOut.indexOf(marker);
        if (idx !== -1) {
          cleanup();
          resolve({
            lines: recentOut.slice(0, idx),
            errors: this.stderrLines.slice(startErrLen),
          });
        } else if (this.closed) {
          cleanup();
          reject(
            new Error(
              `[${this.name}] Session closed unexpectedly before marker ${marker}. stderr=${this.stderrLines.slice(startErrLen).join(' | ')}`
            )
          );
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        const i = this.waiters.indexOf(check);
        if (i !== -1) this.waiters.splice(i, 1);
      };

      this.waiters.push(check);
      check();
    });
  }

  async exec(sql, timeoutMs = PROCESS_TIMEOUT_MS) {
    const marker = `__MARKER_${this.name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}__`;
    const handle = this.sendRaw(sql, marker);
    const result = await this.waitForMarker(handle, timeoutMs);
    if (result.errors.length) throw new Error(`[${this.name}] SQL failed: ${result.errors.join(' | ')}`);
    return result;
  }

  close() {
    if (!this.closed) {
      this.proc.stdin.end();
      this.proc.kill('SIGTERM');
    }
  }
}

async function waitForBackendLockWait(targetPid, blockerPid, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = runOneShotSql(
      `SELECT CASE WHEN EXISTS (
         SELECT 1
         FROM pg_stat_activity a
         JOIN pg_locks l ON l.pid = a.pid
         WHERE a.pid = ${Number(targetPid)}
           AND ${Number(blockerPid)} = ANY(pg_blocking_pids(a.pid))
           AND (a.wait_event_type = 'Lock' OR not l.granted)
       ) THEN 'WAITING' ELSE 'NOT_WAITING' END;`,
      'wait-observer'
    );
    if (state === 'WAITING') {
      return;
    }
  }
  throw new Error(
    `Timed out waiting for backend PID ${targetPid} to enter PostgreSQL lock wait state.`
  );
}

const ADMIN_ID = '00000000-0000-4000-9100-000000000702';
const TEACHER_ID = '00000000-0000-4000-9100-000000000705';
const CLASS_ID = '00000000-0000-4000-9100-000000000801';

const AUTH_ADMIN_SQL = `
  SELECT set_config('request.jwt.claim.sub', '${ADMIN_ID}', true);
  SELECT set_config('request.jwt.claims', '{"sub":"${ADMIN_ID}","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;
`;

function setupFixtures() {
  runOneShotSql(
    `
    INSERT INTO auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES
      ('${ADMIN_ID}'::uuid, 'authenticated', 'authenticated', 't4a-conc-admin@example.invalid', '', now(), '{}'::jsonb, '{"username":"t4a_conc_admin","full_name":"T4A Concurrency Admin","requested_role":"ADMINISTRATIVE_PERSONNEL"}'::jsonb, now(), now()),
      ('${TEACHER_ID}'::uuid, 'authenticated', 'authenticated', 't4a-conc-teacher@example.invalid', '', now(), '{}'::jsonb, '{"username":"t4a_conc_teacher","full_name":"T4A Concurrency Teacher","requested_role":"TEACHER"}'::jsonb, now(), now());

    UPDATE public.profiles SET account_status = 'APPROVED' WHERE id IN ('${ADMIN_ID}'::uuid, '${TEACHER_ID}'::uuid);

    DELETE FROM public.role_assignments WHERE user_id IN ('${ADMIN_ID}'::uuid, '${TEACHER_ID}'::uuid);
    INSERT INTO public.role_assignments (user_id, role, active) VALUES
      ('${ADMIN_ID}'::uuid, 'ADMINISTRATIVE_PERSONNEL', true),
      ('${TEACHER_ID}'::uuid, 'TEACHER', true);

    INSERT INTO public.school_classes (id, academic_year_id, level_code, name, capacity, created_by)
    SELECT '${CLASS_ID}'::uuid, id, 'CP', 'CP-T4A-CONCURRENCY', 24, '${ADMIN_ID}'::uuid
    FROM public.academic_years WHERE code = '2026-2027';

    INSERT INTO public.teacher_class_assignments (teacher_user_id, class_id, is_homeroom, active, assigned_by)
    VALUES ('${TEACHER_ID}'::uuid, '${CLASS_ID}'::uuid, true, true, '${ADMIN_ID}'::uuid);

    BEGIN;
      ${AUTH_ADMIN_SQL}
      SELECT public.upsert_subject_level_applicability('2026-2027', 'CP', 'ARABIC', 'APPLICABLE', 'SCHOOL_DECLARED');
      SELECT public.upsert_subject_level_applicability('2026-2027', 'CP', 'MATHEMATICS', 'APPLICABLE', 'SCHOOL_DECLARED');
      SELECT public.set_school_subject_offering('2026-2027', 'CP', 'ARABIC', true, 6, 'Concurrency test offering');
      SELECT public.set_school_subject_offering('2026-2027', 'CP', 'MATHEMATICS', true, 5, 'Concurrency test offering');
    COMMIT;
    `,
    'setup-fixtures'
  );
}

function createIsolatedDatabase() {
  const marker = runOneShotSql("SELECT coalesce(shobj_description(oid, 'pg_database'), '') FROM pg_database WHERE datname = current_database();", 'verify-disposable-marker');
  if (marker !== 'KRISTOU_T4A_DISPOSABLE_TEST_ONLY') throw new Error('Disposable template marker missing; no writes performed.');
  const template = new URL(SOURCE_DATABASE_URL).pathname.slice(1);
  const adminUrl = new URL(SOURCE_DATABASE_URL); adminUrl.pathname = '/postgres';
  DATABASE_URL = adminUrl.toString();
  isolatedDatabaseName = 't4a_run_' + randomUUID().replaceAll('-', '');
  const created = spawnSync('psql', [DATABASE_URL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE "${isolatedDatabaseName}" TEMPLATE "${template}";`], {encoding:'utf8', timeout:PROCESS_TIMEOUT_MS});
  if (created.error || created.status !== 0) { isolatedDatabaseName = null; throw new Error('Could not create isolated database: ' + (created.stderr || created.error?.message)); }
  const testUrl = new URL(SOURCE_DATABASE_URL); testUrl.pathname = '/' + isolatedDatabaseName;
  DATABASE_URL = testUrl.toString();
}

function cleanupFixtures() {
  if (!isolatedDatabaseName) return;
  const adminUrl = new URL(SOURCE_DATABASE_URL); adminUrl.pathname = '/postgres';
  DATABASE_URL = adminUrl.toString();
  // Only the random child database created by this run is dropped. The template is unchanged.
  const result = spawnSync('psql', [DATABASE_URL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', `DROP DATABASE "${isolatedDatabaseName}" WITH (FORCE);`], {encoding:'utf8', timeout:PROCESS_TIMEOUT_MS});
  if (result.error || result.status !== 0) throw new Error('Isolated database cleanup failed: ' + (result.stderr || result.error?.message));
  isolatedDatabaseName = null;
}

async function runScenario1DuplicateConcurrentAllocation(sessionA, sessionB) {
  console.log('Running Scenario 1: Two concurrent attempts to allocate the same subject...');

  await sessionA.exec(`
    BEGIN;
    ${AUTH_ADMIN_SQL}
    SELECT public.assign_teacher_subject_allocation('${TEACHER_ID}'::uuid, '${CLASS_ID}'::uuid, 'ARABIC', 'Session A initial');
  `);

  const markerB = `__S1_B_${Date.now()}__`;
  const handleB = sessionB.sendRaw(
    `
    BEGIN;
    ${AUTH_ADMIN_SQL}
    SELECT public.assign_teacher_subject_allocation('${TEACHER_ID}'::uuid, '${CLASS_ID}'::uuid, 'ARABIC', 'Session B concurrent');
    COMMIT;
    `,
    markerB
  );

  await waitForBackendLockWait(sessionB.backendPid, sessionA.backendPid);
  await sessionA.exec('COMMIT;');
  const outB = await sessionB.waitForMarker(handleB);
  if (outB.errors.length > 0) {
    throw new Error(`Scenario 1 Session B unexpected error: ${outB.errors.join(' | ')}`);
  }

  const parsedB = JSON.parse(outB.lines.find((l) => l.startsWith('{') && l.includes('idempotentReplay')) || '{}');
  if (parsedB.idempotentReplay !== true || parsedB.active !== true || parsedB.version !== 1) {
    throw new Error(`Scenario 1 expected Session B idempotentReplay=true, active=true, version=1; got ${JSON.stringify(parsedB)}`);
  }

  const state = JSON.parse(
    runOneShotSql(
      `SELECT jsonb_build_object(
         'allocCount', (SELECT count(*)::int FROM public.teacher_subject_allocations WHERE class_id = '${CLASS_ID}'::uuid AND subject_id = (SELECT id FROM public.academic_subjects WHERE code = 'ARABIC')),
         'eventCount', (SELECT count(*)::int FROM public.teacher_subject_allocation_events WHERE class_id = '${CLASS_ID}'::uuid AND subject_id = (SELECT id FROM public.academic_subjects WHERE code = 'ARABIC')),
         'eventTypes', (SELECT coalesce(jsonb_agg(operation_type ORDER BY resulting_version), '[]'::jsonb) FROM public.teacher_subject_allocation_events WHERE class_id = '${CLASS_ID}'::uuid AND subject_id = (SELECT id FROM public.academic_subjects WHERE code = 'ARABIC'))
       )::text;`,
      'scenario-1-verify'
    )
  );

  if (state.allocCount !== 1 || state.eventCount !== 1 || state.eventTypes[0] !== 'INITIAL_ALLOCATION') {
    throw new Error(`Scenario 1 postcondition failed: ${JSON.stringify(state)}`);
  }
  console.log('PASS Scenario 1:', JSON.stringify(state));
}

async function runScenario2ReactivationVsAssignmentRevocation(sessionA, sessionB) {
  console.log('Running Scenario 2: Reactivation versus class-assignment revocation...');

  const allocId = runOneShotSql(
    `
    BEGIN;
      ${AUTH_ADMIN_SQL}
      SELECT (public.set_teacher_subject_allocation_active(
        (SELECT id FROM public.teacher_subject_allocations WHERE class_id = '${CLASS_ID}'::uuid AND subject_id = (SELECT id FROM public.academic_subjects WHERE code = 'ARABIC')),
        false,
        'Prepare inactive for Scenario 2'
      ) ->> 'allocationId');
    COMMIT;
    `,
    'scenario-2-prep'
  )
    .split('\n')
    .filter((l) => /^[0-9a-f-]{36}$/i.test(l.trim())).at(-1);

  // Session A begins transaction and revokes class assignment (acquiring L2 -> L3 -> L4 -> L5 -> L6)
  await sessionA.exec(`
    BEGIN;
    ${AUTH_ADMIN_SQL}
    SELECT public.assign_teacher_to_class('${TEACHER_ID}'::uuid, '${CLASS_ID}'::uuid, true, false);
  `);

  // Session B concurrently attempts to reactivate the allocation; blocks on L3 (teacher_class_assignments FOR UPDATE)
  const markerB = `__S2_B_${Date.now()}__`;
  const handleB = sessionB.sendRaw(
    `
    BEGIN;
    ${AUTH_ADMIN_SQL}
    SELECT public.set_teacher_subject_allocation_active('${allocId}'::uuid, true, 'Concurrent reactivation');
    COMMIT;
    `,
    markerB
  );

  await waitForBackendLockWait(sessionB.backendPid, sessionA.backendPid);
  await sessionA.exec('COMMIT;');
  const outB = await sessionB.waitForMarker(handleB);
  await sessionB.exec('ROLLBACK;');

  const combinedErr = outB.errors.join(' ');
  if (!combinedErr.includes('class_assignment_inactive')) {
    throw new Error(`Scenario 2 expected Session B to fail with class_assignment_inactive after lock wait; got errors=${combinedErr}`);
  }

  const state = JSON.parse(
    runOneShotSql(
      `SELECT jsonb_build_object(
         'active', (SELECT active FROM public.teacher_subject_allocations WHERE id = '${allocId}'::uuid),
         'reason', (SELECT deactivation_reason FROM public.teacher_subject_allocations WHERE id = '${allocId}'::uuid),
         'eventCount', (SELECT count(*)::int FROM public.teacher_subject_allocation_events WHERE allocation_id = '${allocId}'::uuid)
       )::text;`,
      'scenario-2-verify'
    )
  );

  if (state.active !== false || state.eventCount !== 2) {
    throw new Error(`Scenario 2 postcondition failed: ${JSON.stringify(state)}`);
  }

  // Restore active class assignment for Scenario 3
  runOneShotSql(
    `BEGIN; ${AUTH_ADMIN_SQL} SELECT public.assign_teacher_to_class('${TEACHER_ID}'::uuid, '${CLASS_ID}'::uuid, true, true); COMMIT;`,
    'scenario-2-restore'
  );
  console.log('PASS Scenario 2:', JSON.stringify(state));
}

async function runScenario3AllocationVsOfferingDisablement(sessionA, sessionB) {
  console.log('Running Scenario 3: Allocation creation versus offering disablement...');

  // Session A begins transaction and disables MATHEMATICS offering (locking L2 -> L3 -> L4 -> L5)
  await sessionA.exec(`
    BEGIN;
    ${AUTH_ADMIN_SQL}
    SELECT public.set_school_subject_offering('2026-2027', 'CP', 'MATHEMATICS', false, 5, 'Disable Mathematics concurrently');
  `);

  // Session B concurrently attempts to allocate MATHEMATICS; blocks on L5 (school_subject_offerings FOR UPDATE)
  const markerB = `__S3_B_${Date.now()}__`;
  const handleB = sessionB.sendRaw(
    `
    BEGIN;
    ${AUTH_ADMIN_SQL}
    SELECT public.assign_teacher_subject_allocation('${TEACHER_ID}'::uuid, '${CLASS_ID}'::uuid, 'MATHEMATICS', 'Concurrent math allocation');
    COMMIT;
    `,
    markerB
  );

  await waitForBackendLockWait(sessionB.backendPid, sessionA.backendPid);
  await sessionA.exec('COMMIT;');
  const outB = await sessionB.waitForMarker(handleB);
  await sessionB.exec('ROLLBACK;');

  const combinedErr = outB.errors.join(' ');
  if (!combinedErr.includes('subject_offering_not_enabled')) {
    throw new Error(`Scenario 3 expected Session B to fail with subject_offering_not_enabled; got errors=${combinedErr}`);
  }

  const state = JSON.parse(
    runOneShotSql(
      `SELECT jsonb_build_object(
         'offeringEnabled', (SELECT is_enabled FROM public.school_subject_offerings WHERE level_code = 'CP' AND subject_id = (SELECT id FROM public.academic_subjects WHERE code = 'MATHEMATICS')),
         'mathAllocCount', (SELECT count(*)::int FROM public.teacher_subject_allocations WHERE class_id = '${CLASS_ID}'::uuid AND subject_id = (SELECT id FROM public.academic_subjects WHERE code = 'MATHEMATICS'))
       )::text;`,
      'scenario-3-verify'
    )
  );

  if (state.offeringEnabled !== false || state.mathAllocCount !== 0) {
    throw new Error(`Scenario 3 postcondition failed: ${JSON.stringify(state)}`);
  }
  console.log('PASS Scenario 3:', JSON.stringify(state));
}

async function runScenario4ConcurrentActivateDeactivate(sessionA, sessionB) {
  console.log('Running Scenario 4: Concurrent activation/deactivation of an existing allocation...');

  const allocId = runOneShotSql(
    `SELECT id::text FROM public.teacher_subject_allocations WHERE class_id = '${CLASS_ID}'::uuid AND subject_id = (SELECT id FROM public.academic_subjects WHERE code = 'ARABIC');`,
    'scenario-4-lookup'
  ).trim();

  // Session A reactivates ARABIC allocation and holds lock
  await sessionA.exec(`
    BEGIN;
    ${AUTH_ADMIN_SQL}
    SELECT public.set_teacher_subject_allocation_active('${allocId}'::uuid, true, 'Session A reactivate');
  `);

  // Session B concurrently deactivates ARABIC allocation; blocks on L3 -> L5 -> L6 in canonical order
  const markerB = `__S4_B_${Date.now()}__`;
  const handleB = sessionB.sendRaw(
    `
    BEGIN;
    ${AUTH_ADMIN_SQL}
    SELECT public.set_teacher_subject_allocation_active('${allocId}'::uuid, false, 'Session B deactivate after A');
    COMMIT;
    `,
    markerB
  );

  await waitForBackendLockWait(sessionB.backendPid, sessionA.backendPid);
  await sessionA.exec('COMMIT;');
  const outB = await sessionB.waitForMarker(handleB);
  if (outB.errors.length > 0) {
    throw new Error(`Scenario 4 Session B unexpected error: ${outB.errors.join(' | ')}`);
  }

  const state = JSON.parse(
    runOneShotSql(
      `SELECT jsonb_build_object(
         'active', (SELECT active FROM public.teacher_subject_allocations WHERE id = '${allocId}'::uuid),
         'version', (SELECT version FROM public.teacher_subject_allocations WHERE id = '${allocId}'::uuid),
         'reason', (SELECT deactivation_reason FROM public.teacher_subject_allocations WHERE id = '${allocId}'::uuid),
         'events', (SELECT jsonb_agg(jsonb_build_object('op', operation_type, 'v', resulting_version, 'active', resulting_active) ORDER BY resulting_version) FROM public.teacher_subject_allocation_events WHERE allocation_id = '${allocId}'::uuid)
       )::text;`,
      'scenario-4-verify'
    )
  );

  if (
    state.active !== false ||
    state.version !== 4 ||
    state.reason !== 'Session B deactivate after A' ||
    state.events.length !== 4
  ) {
    throw new Error(`Scenario 4 postcondition failed: ${JSON.stringify(state)}`);
  }
  console.log('PASS Scenario 4:', JSON.stringify(state));
}

async function main() {
  assertPrerequisites();
  createIsolatedDatabase();
  const sessionA = new PsqlSession('A');
  const sessionB = new PsqlSession('B');
  try {
    await sessionA.init();
    await sessionB.init();
    setupFixtures();
    await runScenario1DuplicateConcurrentAllocation(sessionA, sessionB);
    await runScenario2ReactivationVsAssignmentRevocation(sessionA, sessionB);
    await runScenario3AllocationVsOfferingDisablement(sessionA, sessionB);
    await runScenario4ConcurrentActivateDeactivate(sessionA, sessionB);
    console.log('ALL 4 TWO-SESSION POSTGRESQL CONCURRENCY SCENARIOS PASSED.');
  } finally {
    sessionA.close();
    sessionB.close();
    cleanupFixtures();
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
