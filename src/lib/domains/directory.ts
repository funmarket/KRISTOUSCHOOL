import { supabase, classifySupabaseError } from '../supabase.ts';
import type { BackendOpResult } from '../../types.ts';

export interface TeacherDirectoryMember {
  id: string;
  name: string;
  title: string;
  photoUrl: string;
  bio: string;
  classes: string[];
  languages: string[];
  isPublished?: boolean;
}

export interface AdminDirectoryMember {
  id: string;
  name: string;
  title: string;
  photoUrl: string;
  bio: string;
  responsibilities: string[];
  languages?: string[];
  isPublished?: boolean;
}

type DirectoryData = {
  teachers: TeacherDirectoryMember[];
  admins: AdminDirectoryMember[];
};

const DIRECTORY_SELECT =
  'id, entry_type, display_name, title, photo_url, bio, tags, languages, is_published, sort_order';

function unavailableResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    errorCode: 'backend_unavailable',
    errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
  };
}

function invalidResponseResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'ERROR',
    errorCode: 'operation_failed',
    errorMessage: 'The server returned an invalid directory response.',
  };
}

function mapDirectoryRows(rows: unknown[], requirePublished: boolean): DirectoryData {
  const teachers: TeacherDirectoryMember[] = [];
  const admins: AdminDirectoryMember[] = [];

  for (const rawRow of rows) {
    if (!rawRow || typeof rawRow !== 'object') continue;
    const row = rawRow as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    if (!id) continue;
    if (requirePublished && row.is_published !== true) continue;

    const entryType = String(row.entry_type);
    if (entryType === 'TEACHER') {
      teachers.push({
        id,
        name: String(row.display_name),
        title: String(row.title),
        photoUrl: String(row.photo_url || '/assets/kristou-logo.png'),
        bio: String(row.bio ?? ''),
        classes: Array.isArray(row.tags) ? (row.tags as string[]) : [],
        languages: Array.isArray(row.languages) ? (row.languages as string[]) : [],
        isPublished: row.is_published === true,
      });
    } else if (entryType === 'ADMIN') {
      admins.push({
        id,
        name: String(row.display_name),
        title: String(row.title),
        photoUrl: String(row.photo_url || '/assets/kristou-logo.png'),
        bio: String(row.bio ?? ''),
        responsibilities: Array.isArray(row.tags) ? (row.tags as string[]) : [],
        languages: Array.isArray(row.languages) ? (row.languages as string[]) : [],
        isPublished: row.is_published === true,
      });
    }
  }

  return { teachers, admins };
}

export async function listPublicDirectory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<DirectoryData>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('directory_entries')
      .select(DIRECTORY_SELECT)
      .eq('is_published', true)
      .order('sort_order', { ascending: true });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    if (!Array.isArray(data)) return invalidResponseResult();
    return { ok: true, status: 'READY', data: mapDirectoryRows(data, true) };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function listSchoolDirectory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<DirectoryData>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('directory_entries')
      .select(DIRECTORY_SELECT)
      .order('sort_order', { ascending: true });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    if (!Array.isArray(data)) return invalidResponseResult();
    return { ok: true, status: 'READY', data: mapDirectoryRows(data, false) };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function upsertDirectoryEntry(
  input: {
    id?: string | null;
    entryType: 'TEACHER' | 'ADMIN';
    displayName: string;
    title: string;
    bio: string;
    tags: string[];
    languages?: string[];
    photoUrl?: string;
    isPublished?: boolean;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ id: string }>> {
  const displayName = input.displayName.trim();
  const title = input.title.trim();
  const validEntryType = input.entryType === 'TEACHER' || input.entryType === 'ADMIN';
  const validId = input.id == null || input.id.trim().length > 0;
  if (
    !validEntryType ||
    !validId ||
    displayName.length < 2 ||
    displayName.length > 120 ||
    title.length < 2 ||
    title.length > 160
  ) {
    return {
      ok: false,
      status: 'ERROR',
      errorCode: 'invalid_directory_input',
      errorMessage: 'Directory entry type, name, title, and optional ID must be valid.',
    };
  }
  if (!client) return unavailableResult();

  try {
    const { data, error } = await client.rpc('upsert_directory_entry', {
      p_id: input.id || null,
      p_entry_type: input.entryType,
      p_display_name: displayName,
      p_title: title,
      p_bio: input.bio.trim(),
      p_tags: input.tags,
      p_languages: input.languages ?? [],
      p_photo_url: input.photoUrl?.trim() || '/assets/kristou-logo.png',
      p_is_published: input.isPublished ?? true,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };

    const row = (data ?? {}) as { id?: unknown };
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    if (!id) return invalidResponseResult();

    return { ok: true, status: 'READY', data: { id } };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}
