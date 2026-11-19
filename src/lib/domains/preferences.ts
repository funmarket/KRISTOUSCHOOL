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
  if (!client) return unavailableResult();
  try {
    const { data, error } = await client.from('user_preferences').select('*').maybeSingle();
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
        notificationSound: (String(row.notification_sound || row.sound_option || 'Kristou Bell') as UserPreferencesState['notificationSound']),
        soundMuted: row.sound_muted !== undefined ? Boolean(row.sound_muted) : (row.sound_enabled === false),
        vibrationEnabled: row.vibration_enabled !== false,
      },
    };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function loadMyPreferences(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<UserPreferencesState>> {
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
    await activeClient.rpc('upsert_user_preferences', {
      p_language: fullPrefs.language,
      p_theme: fullPrefs.theme,
      p_sound_enabled: !fullPrefs.soundMuted,
      p_sound_option: fullPrefs.notificationSound,
      p_vibration_enabled: fullPrefs.vibrationEnabled,
    });
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
