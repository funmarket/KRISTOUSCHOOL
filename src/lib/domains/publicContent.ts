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
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('public_content_entries')
      .select('slug, title_ar, title_fr, title_en, body_ar, body_fr, body_en, is_published, updated_at')
      .order('slug', { ascending: true });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const map: Record<string, PublicContentEntry> = {};
    if (Array.isArray(data)) {
      for (const row of data as Record<string, unknown>[]) {
        const slug = String(row.slug || 'home');
        map[slug] = {
          slug,
          titleAr: String(row.title_ar || row.title || ''),
          titleFr: String(row.title_fr || row.title || ''),
          titleEn: String(row.title_en || row.title || ''),
          bodyAr: String(row.body_ar || row.content_body || ''),
          bodyFr: String(row.body_fr || row.content_body || ''),
          bodyEn: String(row.body_en || row.content_body || ''),
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
