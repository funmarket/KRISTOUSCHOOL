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

export async function listSchoolDirectory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ teachers: TeacherDirectoryMember[]; administration: AdminDirectoryMember[]; admins: AdminDirectoryMember[] }>> {
  const activeClient = client || supabase;
  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient
      .from('directory_entries')
      .select('id, entry_type, display_name, title, bio, tags, languages, photo_url, is_published, sort_order')
      .order('sort_order', { ascending: true });
    if (error) return { ok: false, ...classifySupabaseError(error) };

    const rows = Array.isArray(data) ? data : [];
    const teachers: TeacherDirectoryMember[] = [];
    const administration: AdminDirectoryMember[] = [];

    for (const r of rows as Record<string, unknown>[]) {
      const type = String(r.entry_type || 'TEACHER');
      if (type === 'TEACHER') {
        teachers.push({
          id: String(r.id),
          name: String(r.display_name || ''),
          title: String(r.title || ''),
          photoUrl: String(r.photo_url || '/assets/kristou-logo.png'),
          bio: String(r.bio || ''),
          classes: Array.isArray(r.tags) ? (r.tags as string[]) : [],
          languages: Array.isArray(r.languages) ? (r.languages as string[]) : [],
          isPublished: Boolean(r.is_published ?? true),
        });
      } else {
        administration.push({
          id: String(r.id),
          name: String(r.display_name || ''),
          title: String(r.title || ''),
          photoUrl: String(r.photo_url || '/assets/kristou-logo.png'),
          bio: String(r.bio || ''),
          responsibilities: Array.isArray(r.tags) ? (r.tags as string[]) : [],
          languages: Array.isArray(r.languages) ? (r.languages as string[]) : [],
          isPublished: Boolean(r.is_published ?? true),
        });
      }
    }

    return {
      ok: true,
      status: 'READY',
      data: { teachers, administration, admins: administration },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function listPublicDirectory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ teachers: TeacherDirectoryMember[]; administration: AdminDirectoryMember[]; admins: AdminDirectoryMember[] }>> {
  return listSchoolDirectory(client);
}

export async function upsertDirectoryEntry(
  input: {
    id?: string | null;
    entryType?: 'TEACHER' | 'ADMIN';
    displayName?: string;
    title?: string;
    bio?: string;
    tags?: string[];
    languages?: string[];
    photoUrl?: string;
    isPublished?: boolean;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ id: string }>> {
  const activeClient = client || supabase;
  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient.rpc('upsert_directory_entry', {
      p_id: input.id || null,
      p_entry_type: input.entryType || 'TEACHER',
      p_display_name: input.displayName || '',
      p_title: input.title || '',
      p_bio: input.bio || '',
      p_tags: input.tags || [],
      p_languages: input.languages || [],
      p_photo_url: input.photoUrl || '/assets/kristou-logo.png',
      p_is_published: input.isPublished ?? true,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return { ok: true, status: 'READY', data: { id: String(r.id || '') } };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}
