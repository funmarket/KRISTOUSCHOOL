import { supabase, classifySupabaseError } from '../supabase.ts';
import { invokeTelegramPrivateOperation } from '../telegramPrivateOperations.ts';
import type { BackendOpResult, Language, ThemeMode, NotificationSoundOption } from '../../types.ts';

export interface UserPreferencesState {
  language: Language;
  theme: ThemeMode;
  notificationSound: NotificationSoundOption;
  soundMuted: boolean;
  vibrationEnabled: boolean;
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
    errorMessage: 'The server returned an invalid preferences response.',
  };
}

function parsePreferencesRow(data: unknown): UserPreferencesState | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  if (
    typeof row.language !== 'string' ||
    typeof row.theme !== 'string' ||
    typeof row.notification_sound !== 'string' ||
    typeof row.sound_muted !== 'boolean' ||
    typeof row.vibration_enabled !== 'boolean'
  ) {
    return null;
  }

  return {
    language: row.language as Language,
    theme: row.theme as ThemeMode,
    notificationSound: row.notification_sound as NotificationSoundOption,
    soundMuted: row.sound_muted,
    vibrationEnabled: row.vibration_enabled,
  };
}

export async function loadMyPreferences(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<UserPreferencesState | null>> {
  if (!client) return unavailableResult();
  try {
    const telegram = await invokeTelegramPrivateOperation<unknown>(
      'preferences.load', { expectedUserId: userId }, client,
    );
    const { data, error } = telegram.handled
      ? { data: telegram.data, error: null }
      : await client
        .from('user_preferences')
        .select('language, theme, notification_sound, sound_muted, vibration_enabled')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) return { ok: false, ...classifySupabaseError(error) };
    if (!data) return { ok: true, status: 'READY', data: null };
    const preferences = parsePreferencesRow(data);
    if (!preferences) return invalidResponseResult();
    return { ok: true, status: 'READY', data: preferences };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export async function saveMyPreferences(
  prefs: Partial<UserPreferencesState>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any = supabase,
): Promise<BackendOpResult<UserPreferencesState>> {
  if (!client) return unavailableResult();
  try {
    const values = {
      language: prefs.language ?? null,
      theme: prefs.theme ?? null,
      notificationSound: prefs.notificationSound ?? null,
      soundMuted: prefs.soundMuted ?? null,
      vibrationEnabled: prefs.vibrationEnabled ?? null,
    };
    const telegram = await invokeTelegramPrivateOperation<unknown>('preferences.save', values, client);
    const { data, error } = telegram.handled
      ? { data: telegram.data, error: null }
      : await client.rpc('upsert_my_preferences', {
        p_language: values.language,
        p_theme: values.theme,
        p_notification_sound: values.notificationSound,
        p_sound_muted: values.soundMuted,
        p_vibration_enabled: values.vibrationEnabled,
      });
    if (error) return { ok: false, ...classifySupabaseError(error) };
    const preferences = parsePreferencesRow(data);
    if (!preferences) return invalidResponseResult();
    return { ok: true, status: 'READY', data: preferences };
  } catch (err) {
    return { ok: false, ...classifySupabaseError(err) };
  }
}

export const fetchUserPreferences = loadMyPreferences;

export const updateUserPreferences = saveMyPreferences;

