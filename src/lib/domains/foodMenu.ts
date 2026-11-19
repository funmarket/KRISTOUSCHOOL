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
    const { data: weekRows, error: weekErr } = await client
      .from('food_menu_weeks')
      .select('id, week_range, status, provider_name, created_at')
      .order('created_at', { ascending: false });
    if (weekErr) return { ok: false, ...classifySupabaseError(weekErr) };

    const weeks = Array.isArray(weekRows) ? weekRows : [];
    const weekIds = weeks.map((w: Record<string, unknown>) => String(w.id));
    const daysMap = new Map<string, any[]>();

    if (weekIds.length > 0) {
      const { data: dayRows, error: dayErr } = await client
        .from('food_menu_days')
        .select('*')
        .in('menu_week_id', weekIds)
        .order('day_order', { ascending: true });
      if (!dayErr && Array.isArray(dayRows)) {
        for (const d of dayRows as Record<string, unknown>[]) {
          const wid = String(d.menu_week_id);
          const list = daysMap.get(wid) ?? [];
          list.push({
            day: String(d.day_label || `Day ${d.day_order}`),
            starter: String(d.starter || ''),
            main: String(d.main_dish || ''),
            side: String(d.side_dish || ''),
            dessert: String(d.dessert || ''),
            notes: d.notes ? String(d.notes) : undefined,
          });
          daysMap.set(wid, list);
        }
      }
    }

    const mapped: FoodMenuWeek[] = weeks.map((w: Record<string, unknown>) => {
      const wid = String(w.id);
      const st = String(w.status || 'PUBLISHED');
      return {
        id: wid,
        weekRange: String(w.week_range || ''),
        published: st === 'PUBLISHED',
        status: (st as FoodMenuWeek['status']),
        providerName: String(w.provider_name || 'La Toque Gourmande'),
        isDemoPreview: st === 'PUBLISHED',
        items: daysMap.get(wid) ?? [],
      };
    });

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
  const current = (res.data ?? []).find((m) => m.published) || (res.data ?? [])[0] || null;
  return { ok: true, status: 'READY', data: current };
}

export async function saveFoodMenuWeek(
  weekRangeOrInput: string | { weekRange: string; days?: any[]; items?: any[]; publish?: boolean },
  daysOrClient?: any[] | any,
  publishOrClient?: boolean | any,
  maybeClient?: any,
): Promise<BackendOpResult<FoodMenuWeek>> {
  const weekRange = typeof weekRangeOrInput === 'object' && weekRangeOrInput !== null
    ? String(weekRangeOrInput.weekRange || '')
    : String(weekRangeOrInput || '');
  const days = typeof weekRangeOrInput === 'object' && weekRangeOrInput !== null
    ? (weekRangeOrInput.days || weekRangeOrInput.items || [])
    : (Array.isArray(daysOrClient) ? daysOrClient : []);
  const publish = typeof weekRangeOrInput === 'object' && weekRangeOrInput !== null
    ? (weekRangeOrInput.publish ?? true)
    : (typeof publishOrClient === 'boolean' ? publishOrClient : true);
  const client = typeof weekRangeOrInput === 'object' && weekRangeOrInput !== null ? daysOrClient : maybeClient;
  const activeClient = client || supabase;

  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient.rpc('save_food_menu_week', {
      p_week_range: weekRange,
      p_days: days,
      p_publish: publish,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: {
        id: String(r.id || ''),
        weekRange: String(r.week_range || weekRange),
        published: publish,
        status: publish ? 'PUBLISHED' : 'DRAFT',
        providerName: String(r.provider_name || 'La Toque Gourmande'),
        items: days,
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}
