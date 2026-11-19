import { supabase, classifySupabaseError } from '../supabase.ts';

import type { BackendOpResult, FoodMenuItem, FoodMenuWeek } from '../../types.ts';

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
  if (!client) return unavailableResult();
  try {
    const { data: weeks, error } = await client
      .from('food_menu_weeks')
      .select('id, week_range, provider_name, status, created_at')
      .eq('status', 'PUBLISHED')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const week = Array.isArray(weeks) && weeks.length > 0 ? (weeks[0] as Record<string, unknown>) : null;
    if (!week) return { ok: true, status: 'READY', data: null };

    const { data: days, error: daysErr } = await client
      .from('food_menu_days')
      .select('day_order, day_label, starter, main_dish, side_dish, dessert, notes')
      .eq('menu_week_id', String(week.id))
      .order('day_order', { ascending: true });
    if (daysErr) return { ok: false, ...classifySupabaseError(daysErr) };

    const items: FoodMenuItem[] = Array.isArray(days)
      ? days.map((d: Record<string, unknown>) => ({
          day: String(d.day_label),
          starter: String(d.starter ?? ''),
          main: String(d.main_dish ?? ''),
          side: String(d.side_dish ?? ''),
          dessert: String(d.dessert ?? ''),
          notes: d.notes ? String(d.notes) : undefined,
        }))
      : [];

    return {
      ok: true,
      status: 'READY',
      data: {
        id: String(week.id),
        weekRange: String(week.week_range),
        providerName: String(week.provider_name ?? 'La Toque Gourmande'),
        published: String(week.status) === 'PUBLISHED',
        status: String(week.status) as FoodMenuWeek['status'],
        items,
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function saveFoodMenuWeek(
  weekRange: string,
  days: FoodMenuItem[],
  publish = true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<{ id: string }>> {
  if (weekRange.trim().length < 3 || days.length === 0) {
    return { ok: false, status: 'ERROR', errorCode: 'invalid_menu_input', errorMessage: 'Week range and at least one day are required.' };
  }
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.rpc('save_food_menu_week', {
      p_week_range: weekRange.trim(),
      p_days: days,
      p_publish: publish,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const row = (data ?? {}) as { id?: string };
    return { ok: true, status: 'READY', data: { id: String(row.id ?? '') } };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

