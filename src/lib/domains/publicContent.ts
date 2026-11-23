import { supabase, classifySupabaseError } from '../supabase.ts';
import type { BackendOpResult } from '../../types.ts';

export interface PublicContentEntry {
  slug: string;
  titleAr: string;
  titleFr: string;
  titleEn: string;
  bodyAr: string;
  bodyFr: string;
  bodyEn: string;
  isPublished: boolean;
  updatedAt?: string;
}

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
    errorMessage: 'The server returned an invalid public content response.',
  };
}

function parsePublishedContentRow(row: Record<string, unknown>): PublicContentEntry | null {
  if (
    typeof row.title_ar !== 'string' ||
    typeof row.title_fr !== 'string' ||
    typeof row.title_en !== 'string' ||
    typeof row.body_ar !== 'string' ||
    typeof row.body_fr !== 'string' ||
    typeof row.body_en !== 'string' ||
    typeof row.updated_at !== 'string' ||
    !row.updated_at.trim()
  ) {
    return null;
  }

  const slug = typeof row.slug === 'string' ? row.slug.trim() : '';
  if (!slug) return null;

  return {
    slug,
    titleAr: row.title_ar,
    titleFr: row.title_fr,
    titleEn: row.title_en,
    bodyAr: row.body_ar,
    bodyFr: row.body_fr,
    bodyEn: row.body_en,
    isPublished: true,
    updatedAt: row.updated_at,
  };
}

export async function fetchPublicContent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<Record<string, PublicContentEntry>>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('school_public_content')
      .select('slug, title_ar, title_fr, title_en, body_ar, body_fr, body_en, is_published, updated_at')
      .eq('is_published', true);
    if (error) return { ok: false, ...classifySupabaseError(error) };
    if (!Array.isArray(data)) return invalidResponseResult();

    const entries: Record<string, PublicContentEntry> = {};
    for (const rawRow of data) {
      if (!rawRow || typeof rawRow !== 'object') return invalidResponseResult();
      const row = rawRow as Record<string, unknown>;
      if (row.is_published !== true) continue;

      const slug = typeof row.slug === 'string' ? row.slug.trim() : '';
      if (!slug) continue;

      const entry = parsePublishedContentRow(row);
      if (!entry) return invalidResponseResult();
      entries[entry.slug] = entry;
    }

    return { ok: true, status: 'READY', data: entries };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export const listPublicContent = fetchPublicContent;
