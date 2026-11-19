import { supabase, classifySupabaseError } from '../supabase.ts';
import type { BackendOpResult, PublicContentEntry } from '../../types.ts';

function unavailableResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    errorCode: 'backend_unavailable',
    errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
  };
}

export async function listPublicContent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<Record<string, PublicContentEntry>>> {
  const activeClient = client || supabase;
  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient
      .from('school_public_content')
      .select('slug, title_ar, title_fr, title_en, body_ar, body_fr, body_en, is_published, updated_at')
      .order('slug', { ascending: true });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const map: Record<string, PublicContentEntry> = {};
    if (Array.isArray(data)) {
      for (const row of data as Record<string, unknown>[]) {
        const slug = String(row.slug || 'home');
        map[slug] = {
          slug,
          titleAr: String(row.title_ar || ''),
          titleFr: String(row.title_fr || ''),
          titleEn: String(row.title_en || ''),
          bodyAr: String(row.body_ar || ''),
          bodyFr: String(row.body_fr || ''),
          bodyEn: String(row.body_en || ''),
          isPublished: Boolean(row.is_published ?? true),
          updatedAt: row.updated_at ? String(row.updated_at) : undefined,
        };
      }
    }
    return { ok: true, status: 'READY', data: map };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function fetchPublicContent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<Record<string, PublicContentEntry>>> {
  return listPublicContent(client);
}
