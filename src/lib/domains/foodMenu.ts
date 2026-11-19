import { supabase, classifySupabaseError } from '../supabase.ts';
import type { BackendOpResult, FoodMenuWeek } from '../../types.ts';

function unavailableResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    errorCode: 'backend_unavailable',
    errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
  };
}

export async function listFoodMenus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<FoodMenuWeek[]>> {
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client
      .from('school_food_menus')
      .select('id, week_range, published, status, provider_name, is_current, menu_data, created_at')
      .order('created_at', { ascending: false });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const mapped: FoodMenuWeek[] = Array.isArray(data)
      ? data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          weekRange: String(row.week_range || row.week_label || ''),
          published: Boolean(row.published ?? true),
          status: (String(row.status || 'PUBLISHED') as FoodMenuWeek['status']),
          providerName: String(row.provider_name || 'La Toque Gourmande'),
          isDemoPreview: Boolean(row.is_current),
          items: Array.isArray(row.menu_data) ? (row.menu_data as FoodMenuWeek['items']) : [],
        }))
      : [];
    return { ok: true, status: 'READY', data: mapped };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function fetchActiveFoodMenu(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<FoodMenuWeek | null>> {
  const res = await listFoodMenus(client);
  if (!res.ok) return { ok: false, status: res.status, errorCode: res.errorCode, errorMessage: res.errorMessage };
  const current = (res.data ?? []).find((m) => m.isDemoPreview || m.published) || (res.data ?? [])[0] || null;
  return { ok: true, status: 'READY', data: current };
}

export async function saveFoodMenuWeek(
  rangeOrInput: string | { weekRange: string; items: any[]; published?: boolean },
  itemsOrClient?: any[] | any,
  maybeClient?: any,
): Promise<BackendOpResult<FoodMenuWeek>> {
  const input = typeof rangeOrInput === 'object' && rangeOrInput !== null
    ? rangeOrInput
    : { weekRange: String(rangeOrInput || ''), items: Array.isArray(itemsOrClient) ? itemsOrClient : [], published: true };
  const client = typeof rangeOrInput === 'object' && rangeOrInput !== null ? itemsOrClient : maybeClient;
  const activeClient = client || supabase;

  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient.rpc('save_food_menu_week', {
      p_week_range: input.weekRange,
      p_menu_data: input.items,
      p_published: input.published ?? true,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: {
        id: String(r.id || ''),
        weekRange: String(r.week_range || input.weekRange),
        published: Boolean(r.published ?? input.published ?? true),
        items: Array.isArray(r.menu_data) ? (r.menu_data as FoodMenuWeek['items']) : input.items,
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}
