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
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('list_school_directory');
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const payload = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const teachers: TeacherDirectoryMember[] = Array.isArray(payload.teachers)
      ? (payload.teachers as TeacherDirectoryMember[])
      : [];
    const administration: AdminDirectoryMember[] = Array.isArray(payload.administration)
      ? (payload.administration as AdminDirectoryMember[])
      : (Array.isArray(payload.admins) ? (payload.admins as AdminDirectoryMember[]) : []);
    return { ok: true, status: 'READY', data: { teachers, administration, admins: administration } };
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ id: string }>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('upsert_directory_entry', input);
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return { ok: true, status: 'READY', data: { id: String(r.id || '') } };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}
