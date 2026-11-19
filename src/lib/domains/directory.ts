import { supabase, classifySupabaseError } from '../supabase.ts';

import type { BackendOpResult, TeacherDirectoryMember, AdminDirectoryMember } from '../../types.ts';

function unavailableResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    errorCode: 'backend_unavailable',
    errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
  };
}

export async function listPublicDirectory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<
  BackendOpResult<{
    teachers: TeacherDirectoryMember[];
    admins: AdminDirectoryMember[];
  }>
> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('directory_entries')
      .select('id, entry_type, display_name, title, photo_url, bio, tags, languages, is_published, sort_order')
      .order('sort_order', { ascending: true });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const teachers: TeacherDirectoryMember[] = [];
    const admins: AdminDirectoryMember[] = [];
    if (Array.isArray(data)) {
      for (const row of data as Record<string, unknown>[]) {
        const entryType = String(row.entry_type);
        if (entryType === 'TEACHER') {
          teachers.push({
            id: String(row.id),
            name: String(row.display_name),
            title: String(row.title),
            photoUrl: String(row.photo_url || '/assets/kristou-logo.png'),
            bio: String(row.bio ?? ''),
            classes: Array.isArray(row.tags) ? (row.tags as string[]) : [],
            languages: Array.isArray(row.languages) ? (row.languages as string[]) : [],
            isPublished: Boolean(row.is_published),
          });
        } else if (entryType === 'ADMIN') {
          admins.push({
            id: String(row.id),
            name: String(row.display_name),
            title: String(row.title),
            photoUrl: String(row.photo_url || '/assets/kristou-logo.png'),
            bio: String(row.bio ?? ''),
            responsibilities: Array.isArray(row.tags) ? (row.tags as string[]) : [],
            languages: Array.isArray(row.languages) ? (row.languages as string[]) : [],
            isPublished: Boolean(row.is_published),
          });
        }
      }
    }
    return { ok: true, status: 'READY', data: { teachers, admins } };
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
  if (input.displayName.trim().length < 2 || input.title.trim().length < 2) {
    return { ok: false, status: 'ERROR', errorCode: 'invalid_directory_input', errorMessage: 'Name and title are required.' };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('upsert_directory_entry', {
      p_id: input.id || null,
      p_entry_type: input.entryType,
      p_display_name: input.displayName.trim(),
      p_title: input.title.trim(),
      p_bio: input.bio.trim(),
      p_tags: input.tags,
      p_languages: input.languages ?? [],
      p_photo_url: input.photoUrl?.trim() || '/assets/kristou-logo.png',
      p_is_published: input.isPublished ?? true,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const row = (data ?? {}) as { id?: string };
    return { ok: true, status: 'READY', data: { id: String(row.id ?? '') } };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export const listSchoolDirectory = listPublicDirectory;

