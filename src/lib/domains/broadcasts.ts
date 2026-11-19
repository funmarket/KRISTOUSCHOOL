import { supabase, classifySupabaseError } from '../supabase.ts';
import type { BackendOpResult, SchoolBroadcastItem, AccountRole } from '../../types.ts';

const CANONICAL_SCHOOL_LEVELS = [
  { code: 'CP' }, { code: 'CE1' }, { code: 'CE2' }, { code: 'CM1' }, { code: 'CM2' }, { code: '6EME' }
];
const CANONICAL_LEVEL_CODES = new Set(CANONICAL_SCHOOL_LEVELS.map((lvl) => lvl.code));

function unavailableResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    errorCode: 'backend_unavailable',
    errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
  };
}

export async function listSchoolBroadcasts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<SchoolBroadcastItem[]>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('school_broadcasts')
      .select(
        'id, title, body, priority, status, audience_scope, target_level_codes, target_class_ids, is_public, published_at, author_name, author_role, created_at',
      )
      .order('created_at', { ascending: false });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const mapped: SchoolBroadcastItem[] = Array.isArray(data)
      ? data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          title: String(row.title),
          body: String(row.body),
          priority: row.priority === 'URGENT' ? 'URGENT' : 'NORMAL',
          status: (String(row.status) as SchoolBroadcastItem['status']) || 'PUBLISHED',
          audienceScope:
            (String(row.audience_scope) as SchoolBroadcastItem['audienceScope']) || 'ALL_SCHOOL',
          targetLevelCodes: Array.isArray(row.target_level_codes)
            ? (row.target_level_codes as string[])
            : [],
          targetClassIds: Array.isArray(row.target_class_ids)
            ? (row.target_class_ids as string[])
            : [],
          isPublic: Boolean(row.is_public),
          authorName: String(row.author_name ?? 'Administration'),
          authorRole: String(row.author_role ?? 'Administration'),
          createdAt: String(row.published_at || row.created_at),
        }))
      : [];
    return { ok: true, status: 'READY', data: mapped };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function publishSchoolBroadcast(
  input: {
    title: string;
    body: string;
    priority?: 'NORMAL' | 'URGENT';
    audienceScope?: SchoolBroadcastItem['audienceScope'];
    isPublic?: boolean;
    targetClassIds?: string[];
    targetLevelCodes?: string[];
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<SchoolBroadcastItem>> {
  if (input.title.trim().length < 2 || input.body.trim().length < 2) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_broadcast_input',
      errorMessage: 'Title and message body are required.',
    };
  }

  const scope = input.audienceScope ?? 'ALL_SCHOOL';
  const requestedPublic = Boolean(input.isPublic);
  if (requestedPublic && scope !== 'PUBLIC_SITE') {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'targeted_broadcast_cannot_be_public',
      errorMessage: 'Targeted or internal-only broadcasts cannot be marked public.',
    };
  }

  const cleanLevels = Array.from(
    new Set(
      (input.targetLevelCodes ?? [])
        .map((code) => code.trim().toUpperCase())
        .filter((code) => code.length > 0),
    ),
  );
  if (scope === 'SELECTED_LEVELS') {
    if (cleanLevels.length === 0) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'target_levels_required',
        errorMessage: 'Select at least one school level.',
      };
    }
    if (cleanLevels.some((code) => !CANONICAL_LEVEL_CODES.has(code))) {
      return {
        ok: false,
        status: 'ERROR',
        errorCode: 'invalid_target_levels',
        errorMessage: 'One or more selected school levels are invalid.',
      };
    }
  }

  const cleanClasses = Array.from(
    new Set(
      (input.targetClassIds ?? [])
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  );
  if (scope === 'SELECTED_CLASSES' && cleanClasses.length === 0) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'target_classes_required',
      errorMessage: 'Select at least one active class.',
    };
  }

  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('publish_school_broadcast', {
      p_title: input.title.trim(),
      p_body: input.body.trim(),
      p_priority: input.priority ?? 'NORMAL',
      p_audience_scope: scope,
      p_is_public: scope === 'PUBLIC_SITE' ? true : false,
      p_target_class_ids: scope === 'SELECTED_CLASSES' ? cleanClasses : [],
      p_target_level_codes: scope === 'SELECTED_LEVELS' ? cleanLevels : [],
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: {
        id: String(row.id),
        title: String(row.title),
        body: String(row.body),
        priority: row.priority === 'URGENT' ? 'URGENT' : 'NORMAL',
        status: (String(row.status) as SchoolBroadcastItem['status']) || 'PUBLISHED',
        audienceScope:
          (String(row.audience_scope) as SchoolBroadcastItem['audienceScope']) || 'ALL_SCHOOL',
        targetLevelCodes: Array.isArray(row.target_level_codes)
          ? (row.target_level_codes as string[])
          : [],
        targetClassIds: Array.isArray(row.target_class_ids)
          ? (row.target_class_ids as string[])
          : [],
        isPublic: Boolean(row.is_public),
        authorName: String(row.author_name ?? 'Administration'),
        authorRole: String(row.author_role ?? 'Administration'),
        createdAt: String(row.published_at || row.created_at),
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}
