import { supabase, classifySupabaseError } from '../supabase.ts';
import type { BackendOpResult, UserPreferencesState } from '../../types.ts';

function unavailableResult<T>(): BackendOpResult<T> {
  return {
    ok: false,
    status: 'BLOCKED_BACKEND',
    errorCode: 'backend_unavailable',
    errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
  };
}

export async function fetchUserPreferences(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<UserPreferencesState>> {
  const activeClient = client || supabase;
  if (!activeClient) return unavailableResult();
  try {
    const { data, error } = await activeClient.from('user_preferences').select('*').maybeSingle();
    if (error) return { ok: false, ...classifySupabaseError(error) };
    if (!data) {
      return {
        ok: true,
        status: 'READY',
        data: {
          language: 'ar',
          theme: 'light',
          notificationSound: 'Kristou Bell',
          soundMuted: false,
          vibrationEnabled: true,
        },
      };
    }
    const row = data as Record<string, unknown>;
    return {
      ok: true,
      status: 'READY',
      data: {
        language: (String(row.language || 'ar') as UserPreferencesState['language']),
        theme: (String(row.theme || 'light') as UserPreferencesState['theme']),
        notificationSound: (String(row.notification_sound || 'Kristou Bell') as UserPreferencesState['notificationSound']),
        soundMuted: Boolean(row.sound_muted),
        vibrationEnabled: row.vibration_enabled !== false,
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function loadMyPreferences(
  userIdOrClient?: string | any,
  maybeClient?: any,
): Promise<BackendOpResult<UserPreferencesState>> {
  const client = typeof userIdOrClient === 'string' ? maybeClient : userIdOrClient;
  return fetchUserPreferences(client);
}

export async function updateUserPreferences(
  preferences: Partial<UserPreferencesState>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<UserPreferencesState>> {
  const fullPrefs: UserPreferencesState = {
    language: preferences.language || 'ar',
    theme: preferences.theme || 'light',
    notificationSound: preferences.notificationSound || 'Kristou Bell',
    soundMuted: preferences.soundMuted ?? false,
    vibrationEnabled: preferences.vibrationEnabled ?? true,
  };
  const activeClient = client || supabase;
  if (!activeClient) return unavailableResult();
  try {
    const { error } = await activeClient.rpc('upsert_my_preferences', {
      p_language: fullPrefs.language,
      p_theme: fullPrefs.theme,
      p_notification_sound: fullPrefs.notificationSound,
      p_sound_muted: fullPrefs.soundMuted,
      p_vibration_enabled: fullPrefs.vibrationEnabled,
    });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    return { ok: true, status: 'READY', data: fullPrefs };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function saveMyPreferences(
  preferences: Partial<UserPreferencesState>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<UserPreferencesState>> {
  return updateUserPreferences(preferences, client);
}
