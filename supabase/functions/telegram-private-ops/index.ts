// @ts-ignore Deno npm specifier resolved by the Supabase Edge Runtime.
import postgres from 'npm:postgres@3.4.7';
import { validateInitData } from '../_shared/telegram-init-data.ts';

declare const Deno:
  | {
      env?: { get?(key: string): string | undefined };
      serve?(handler: (request: Request) => Promise<Response> | Response): void;
    }
  | undefined;

type GatewayCode =
  | 'method_not_allowed'
  | 'origin_not_allowed'
  | 'unsupported_media_type'
  | 'request_too_large'
  | 'invalid_request'
  | 'invalid_telegram_auth'
  | 'telegram_auth_expired'
  | 'telegram_identity_conflict'
  | 'telegram_not_linked'
  | 'account_not_approved'
  | 'insufficient_governance_authority'
  | 'manager_delegation_required'
  | 'owner_only_operation'
  | 'target_not_found'
  | 'backend_unavailable'
  | 'operation_failed';

class GatewayError extends Error {
  status: number;
  code: GatewayCode;

  constructor(code: GatewayCode, status: number) {
    super(code);
    this.name = 'GatewayError';
    this.code = code;
    this.status = status;
  }
}

type Query = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;
type Transaction = Query;
type Database = {
  begin<T>(callback: (transaction: Transaction) => Promise<T>): Promise<T>;
};

type GatewayOperation =
  | 'governance.actorScope'
  | 'governance.pendingAccounts'
  | 'governance.accountDirectory'
  | 'governance.accountDetail'
  | 'notifications.list'
  | 'notifications.markOne'
  | 'notifications.markAll'
  | 'preferences.load'
  | 'preferences.save'
  | 'pickup.board'
  | 'pickup.arrive'
  | 'pickup.receipt';

type RequestBody = {
  initData?: unknown;
  operation?: unknown;
  params?: unknown;
};

type GatewayDependencies = {
  sql?: Database;
  botToken?: string;
  allowedOrigins?: string[];
  supabaseUrl?: string;
  publishableKey?: string;
  fetcher?: typeof fetch;
  nowSeconds?: number;
};

const CANONICAL_ROLES = new Set([
  'APP_ADMIN', 'MANAGER', 'ADMINISTRATIVE_PERSONNEL', 'TEACHER', 'SCHOOL_STAFF', 'PARENT', 'STUDENT',
]);
const ACCOUNT_STATUSES = new Set(['APPROVED', 'PENDING', 'REJECTED', 'SUSPENDED', 'REVOKED']);
const LANGUAGES = new Set(['ar', 'fr', 'en', 'es', 'de', 'pt']);
const THEMES = new Set(['light', 'pitch-black']);
const SOUNDS = new Set(['Kristou Bell', 'Soft Chime', 'Classroom Bell', 'Gentle Pop', 'Silent']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_INIT_DATA_AGE_SECONDS = 300;
const ALLOWED_FUTURE_SKEW_SECONDS = 30;

let pooledSql: Database | null = null;

function env(key: string): string | undefined {
  if (typeof Deno !== 'undefined' && Deno?.env && typeof Deno.env.get === 'function') return Deno.env.get(key);
  return undefined;
}

function createDatabase(): Database {
  const connectionString = env('SUPABASE_DB_URL');
  if (!connectionString) throw new GatewayError('backend_unavailable', 503);
  if (!pooledSql) {
    // prepare:false supports Supabase transaction pooler URLs. SET LOCAL role and
    // identity claims remain contained by the explicit transaction below.
    pooledSql = postgres(connectionString, {
      max: 1,
      idle_timeout: 10,
      connect_timeout: 5,
      prepare: false,
    }) as unknown as Database;
  }
  return pooledSql;
}

function parsePublishableKey(): string | undefined {
  const legacyKey = env('SUPABASE_ANON_KEY');
  if (legacyKey) return legacyKey;
  const keySet = env('SUPABASE_PUBLISHABLE_KEYS');
  if (!keySet) return undefined;
  try {
    const parsed = JSON.parse(keySet) as Record<string, unknown>;
    const preferred = parsed.default;
    if (typeof preferred === 'string' && preferred) return preferred;
    const first = Object.values(parsed).find((value): value is string => typeof value === 'string' && Boolean(value));
    return first;
  } catch {
    return undefined;
  }
}

function getDependencies(overrides: GatewayDependencies): Required<Pick<GatewayDependencies, 'botToken' | 'allowedOrigins' | 'supabaseUrl' | 'fetcher'>> & GatewayDependencies {
  const configuredOrigins = overrides.allowedOrigins ?? (env('ALLOWED_ORIGINS') ?? env('ALLOWED_ORIGIN') ?? 'https://kristouschool.vercel.app,http://localhost:3000')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  return {
    ...overrides,
    botToken: overrides.botToken ?? env('TELEGRAM_BOT_TOKEN') ?? '',
    allowedOrigins: configuredOrigins,
    supabaseUrl: overrides.supabaseUrl ?? env('SUPABASE_URL') ?? '',
    publishableKey: overrides.publishableKey ?? parsePublishableKey(),
    fetcher: overrides.fetcher ?? fetch,
  };
}

function json(body: unknown, status: number, origin: string | null, allowed: string | null): Response {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
  });
  if (origin && allowed) headers.set('Access-Control-Allow-Origin', allowed);
  return new Response(JSON.stringify(body), { status, headers });
}

function parseBearer(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

function isAuthenticatedJwt(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
    return payload?.role === 'authenticated' && typeof payload?.sub === 'string';
  } catch {
    return false;
  }
}

async function verifyBrowserIdentity(
  request: Request,
  dependencies: ReturnType<typeof getDependencies>,
): Promise<string | null> {
  const token = parseBearer(request);
  if (!token || !isAuthenticatedJwt(token)) return null;
  if (!dependencies.supabaseUrl || !dependencies.publishableKey) {
    throw new GatewayError('backend_unavailable', 503);
  }
  let response: Response;
  try {
    response = await dependencies.fetcher(`${dependencies.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: dependencies.publishableKey },
    });
  } catch {
    throw new GatewayError('backend_unavailable', 503);
  }
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new GatewayError('backend_unavailable', 503);
  const user = await response.json().catch(() => null) as { id?: unknown } | null;
  return typeof user?.id === 'string' ? user.id : null;
}

function readParams(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GatewayError('invalid_request', 400);
  return value as Record<string, unknown>;
}

function integer(value: unknown, fallback: number, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new GatewayError('invalid_request', 400);
  }
  return value;
}

function optionalEnum(value: unknown, allowed: Set<string>): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !allowed.has(value)) throw new GatewayError('invalid_request', 400);
  return value;
}

function optionalSearch(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 160) throw new GatewayError('invalid_request', 400);
  return value.trim() || null;
}

function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new GatewayError('invalid_request', 400);
  return value;
}

function requireRow<T extends Record<string, unknown>>(rows: T[]): T {
  if (!rows.length) throw new GatewayError('target_not_found', 404);
  return rows[0];
}

async function withAuthenticatedTelegramActor<T>(
  sql: Database,
  telegramUserId: number,
  expectedUserId: string | null,
  callback: (transaction: Transaction, userId: string) => Promise<T>,
): Promise<T> {
  return sql.begin(async (transaction) => {
    // This narrowly scoped pre-auth query resolves only a signed Telegram ID to
    // its existing canonical account. No school-domain data is returned here.
    const identities = await transaction`
      select user_id::text as user_id
        from public.telegram_identities
       where telegram_user_id = ${telegramUserId}::bigint
       limit 2
    `;
    if (identities.length !== 1 || typeof identities[0].user_id !== 'string') {
      throw new GatewayError('telegram_not_linked', 403);
    }
    const userId = identities[0].user_id;
    if (expectedUserId && expectedUserId !== userId) throw new GatewayError('telegram_identity_conflict', 409);

    const authAccount = requireRow(await transaction`
      select coalesce(banned_until > now(), false) as is_banned
        from auth.users
       where id = ${userId}::uuid
       limit 1
    `);
    if (authAccount.is_banned === true) throw new GatewayError('account_not_approved', 403);

    await transaction`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await transaction`select set_config('request.jwt.claim.role', 'authenticated', true)`;
    await transaction`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated' })}, true)`;
    await transaction`set local role authenticated`;

    const profile = requireRow(await transaction`
      select id::text as id, account_status::text as account_status
        from public.profiles
       where id = auth.uid()
       limit 1
    `);
    if (profile.account_status !== 'APPROVED') throw new GatewayError('account_not_approved', 403);

    const roles = await transaction`
      select role::text as role
        from public.role_assignments
       where user_id = auth.uid() and active = true
    `;
    if (!roles.some((row) => typeof row.role === 'string' && CANONICAL_ROLES.has(row.role))) {
      throw new GatewayError('account_not_approved', 403);
    }

    return callback(transaction, userId);
  });
}

async function executeOperation(
  transaction: Transaction,
  userId: string,
  operation: GatewayOperation,
  params: Record<string, unknown>,
): Promise<unknown> {
  switch (operation) {
    case 'governance.actorScope':
      return requireRow(await transaction`select public.governance_get_actor_scope() as data`).data;
    case 'governance.pendingAccounts': {
      const limit = integer(params.limit, 25, 1, 100);
      const offset = integer(params.offset, 0, 0);
      const role = optionalEnum(params.requestedRole, CANONICAL_ROLES);
      const search = optionalSearch(params.search);
      return requireRow(await transaction`
        select public.governance_list_pending_accounts(
          ${limit}, ${offset}, ${role}::public.app_role, ${search}
        ) as data
      `).data;
    }
    case 'governance.accountDirectory': {
      const limit = integer(params.limit, 25, 1, 100);
      const offset = integer(params.offset, 0, 0);
      const status = optionalEnum(params.status, ACCOUNT_STATUSES);
      const role = optionalEnum(params.role, CANONICAL_ROLES);
      const search = optionalSearch(params.search);
      return requireRow(await transaction`
        select public.governance_list_account_directory(
          ${limit}, ${offset}, ${status}::public.account_approval_status,
          ${role}::public.app_role, ${search}
        ) as data
      `).data;
    }
    case 'governance.accountDetail': {
      const targetUserId = requireUuid(params.targetUserId);
      return requireRow(await transaction`
        select public.governance_get_account_detail(${targetUserId}::uuid) as data
      `).data;
    }
    case 'notifications.list':
      return transaction`
        select id::text as id, category, title, body, target_tab, target_ref_id,
               is_read, created_at
          from public.user_notifications
         where recipient_user_id = auth.uid()
         order by created_at desc
         limit 40
      `;
    case 'notifications.markOne': {
      const notificationId = requireUuid(params.notificationId);
      return requireRow(await transaction`
        select public.mark_user_notification_read(${notificationId}::uuid) as data
      `).data;
    }
    case 'notifications.markAll':
      return requireRow(await transaction`select public.mark_all_user_notifications_read() as data`).data;
    case 'preferences.load': {
      const requestedUserId = requireUuid(params.expectedUserId);
      if (requestedUserId !== userId) throw new GatewayError('telegram_identity_conflict', 409);
      const rows = await transaction`
        select language, theme, notification_sound, sound_muted, vibration_enabled
          from public.user_preferences
         where user_id = auth.uid()
         limit 1
      `;
      return rows[0] ?? null;
    }
    case 'preferences.save': {
      const language = optionalEnum(params.language, LANGUAGES);
      const theme = optionalEnum(params.theme, THEMES);
      const sound = optionalEnum(params.notificationSound, SOUNDS);
      if (params.soundMuted !== undefined && params.soundMuted !== null && typeof params.soundMuted !== 'boolean') {
        throw new GatewayError('invalid_request', 400);
      }
      if (params.vibrationEnabled !== undefined && params.vibrationEnabled !== null && typeof params.vibrationEnabled !== 'boolean') {
        throw new GatewayError('invalid_request', 400);
      }
      return requireRow(await transaction`
        select language, theme, notification_sound, sound_muted, vibration_enabled
          from public.upsert_my_preferences(
          ${language}, ${theme}, ${sound},
          ${params.soundMuted ?? null}, ${params.vibrationEnabled ?? null}
        )
      `);
    }
    case 'pickup.board': {
      const requestedClassId = params.classId === undefined || params.classId === null
        ? null
        : requireUuid(params.classId);
      const roleRows = await transaction`
        select role::text as role
          from public.role_assignments
         where user_id = auth.uid() and active = true
      `;
      const isParent = roleRows.some((row) => row.role === 'PARENT');
      if (isParent && requestedClassId) throw new GatewayError('invalid_request', 400);
      return isParent
        ? transaction`select * from public.get_pickup_parent_board()`
        : transaction`select * from public.get_pickup_staff_board(${requestedClassId}::uuid)`;
    }
    case 'pickup.arrive': {
      const cycleId = requireUuid(params.cycleId);
      const collectorId = requireUuid(params.collectorId);
      const requestId = requireUuid(params.requestId);
      const expectedVersion = integer(params.expectedVersion, -1, 1);
      if (expectedVersion < 1) throw new GatewayError('invalid_request', 400);
      return requireRow(await transaction`
        select public.parent_arrived(
          ${cycleId}::uuid, ${collectorId}::uuid, ${requestId}::uuid, ${expectedVersion}
        ) as data
      `).data;
    }
    case 'pickup.receipt': {
      const requestId = requireUuid(params.requestId);
      const cycleId = params.cycleId === undefined || params.cycleId === null
        ? null
        : requireUuid(params.cycleId);
      return requireRow(await transaction`
        select public.get_pickup_operation_receipt(${requestId}::uuid, ${cycleId}::uuid) as data
      `).data;
    }
    default:
      throw new GatewayError('invalid_request', 400);
  }
}

export async function handleTelegramPrivateOps(
  request: Request,
  overrides: GatewayDependencies = {},
): Promise<Response> {
  const dependencies = getDependencies(overrides);
  const origin = request.headers.get('origin');
  const allowedOrigin = origin && dependencies.allowedOrigins.includes(origin) ? origin : null;
  if (origin && !allowedOrigin) return json({ error: 'origin_not_allowed' }, 403, origin, null);
  if (request.method === 'OPTIONS') return new Response('ok', {
    status: 200,
    headers: {
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
      Vary: 'Origin',
    },
  });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin, allowedOrigin);
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return json({ error: 'unsupported_media_type' }, 415, origin, allowedOrigin);
  }

  try {
    const bodyText = await request.text();
    if (bodyText.length > 20_000) throw new GatewayError('request_too_large', 413);
    let body: RequestBody;
    try {
      body = JSON.parse(bodyText) as RequestBody;
    } catch {
      throw new GatewayError('invalid_request', 400);
    }
    if (typeof body.initData !== 'string' || !body.initData || typeof body.operation !== 'string') {
      throw new GatewayError('invalid_request', 400);
    }
    const params = readParams(body.params ?? {});
    const operation = body.operation as GatewayOperation;
    const knownOperations = new Set<GatewayOperation>([
      'governance.actorScope', 'governance.pendingAccounts', 'governance.accountDirectory',
      'governance.accountDetail', 'notifications.list', 'notifications.markOne',
      'notifications.markAll', 'preferences.load', 'preferences.save',
      'pickup.board', 'pickup.arrive', 'pickup.receipt',
    ]);
    if (!knownOperations.has(operation)) throw new GatewayError('invalid_request', 400);
    if (!dependencies.botToken) throw new GatewayError('backend_unavailable', 503);

    const nowSeconds = dependencies.nowSeconds ?? Math.floor(Date.now() / 1000);
    const validated = await validateInitData(body.initData, dependencies.botToken, nowSeconds);
    if (!validated) {
      const authDate = Number(new URLSearchParams(body.initData).get('auth_date'));
      const stale = Number.isSafeInteger(authDate) && authDate > 0 &&
        nowSeconds - authDate > MAX_INIT_DATA_AGE_SECONDS;
      throw new GatewayError(stale ? 'telegram_auth_expired' : 'invalid_telegram_auth', 401);
    }

    if (operation === 'preferences.save') {
      optionalEnum(params.language, LANGUAGES);
      optionalEnum(params.theme, THEMES);
      optionalEnum(params.notificationSound, SOUNDS);
      if (params.soundMuted !== undefined && params.soundMuted !== null && typeof params.soundMuted !== 'boolean') {
        throw new GatewayError('invalid_request', 400);
      }
      if (params.vibrationEnabled !== undefined && params.vibrationEnabled !== null && typeof params.vibrationEnabled !== 'boolean') {
        throw new GatewayError('invalid_request', 400);
      }
    }

    const browserUserId = await verifyBrowserIdentity(request, dependencies);
    const sql = overrides.sql ?? createDatabase();
    const expectedUserId = typeof params.expectedUserId === 'string' ? params.expectedUserId : null;
    const result = await withAuthenticatedTelegramActor(sql, validated.user.id, expectedUserId, async (transaction, userId) => {
      if (browserUserId && browserUserId !== userId) throw new GatewayError('telegram_identity_conflict', 409);
      return executeOperation(transaction, userId, operation, params);
    });
    return json(result, 200, origin, allowedOrigin);
  } catch (error) {
    if (error instanceof GatewayError) return json({ error: error.code }, error.status, origin, allowedOrigin);
    const message = typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';
    if (message.includes('insufficient_governance_authority')) {
      return json({ error: 'insufficient_governance_authority' }, 403, origin, allowedOrigin);
    }
    if (message.includes('manager_delegation_required')) {
      return json({ error: 'manager_delegation_required' }, 403, origin, allowedOrigin);
    }
    if (message.includes('owner_only_operation')) return json({ error: 'owner_only_operation' }, 403, origin, allowedOrigin);
    if (message.includes('target_not_found')) return json({ error: 'target_not_found' }, 404, origin, allowedOrigin);
    const pickupConflictCodes = new Set(['version_conflict', 'idempotency_conflict']);
    const pickupDeniedCodes = new Set([
      'pickup_parent_required', 'pickup_parent_child_link_required', 'collector_or_parent_not_authorized',
      'insufficient_pickup_scope', 'pickup_receipt_unavailable',
    ]);
    const pickupUnavailableCodes = new Set([
      'schedule_unavailable', 'outside_dismissal_window', 'attendance_absent', 'attendance_excused',
      'attendance_mark_missing', 'attendance_mark_unknown', 'attendance_entry_missing_or_conflicting',
      'register_missing', 'register_not_submitted', 'conflicting_registers',
      'conflicting_effective_memberships', 'responsible_teacher_unavailable',
    ]);
    if (pickupConflictCodes.has(message)) return json({ error: message }, 409, origin, allowedOrigin);
    if (pickupDeniedCodes.has(message)) return json({ error: message }, 403, origin, allowedOrigin);
    if (pickupUnavailableCodes.has(message)) return json({ error: message }, 422, origin, allowedOrigin);
    return json({ error: 'operation_failed' }, 500, origin, allowedOrigin);
  }
}

if (typeof Deno !== 'undefined' && typeof Deno?.serve === 'function') {
  Deno.serve((request) => handleTelegramPrivateOps(request));
}

