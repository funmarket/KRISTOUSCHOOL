import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, requireSupabaseClient } from './supabase';
import { createTelegramLinkUrl } from './telegram';
import type { User, UserRole } from '../types';

export type SignupRole = 'GENERAL_USER' | 'PARENT' | 'STUDENT' | 'TEACHER' | 'SCHOOL_STAFF' | 'ADMINISTRATIVE_PERSONNEL';

const roleMap: Record<string, UserRole> = {
  GENERAL_USER: 'GENERAL_USER',
  PARENT: 'PARENT',
  STUDENT: 'STUDENT',
  TEACHER: 'TEACHER',
  SCHOOL_STAFF: 'SCHOOL_STAFF',
  ADMINISTRATIVE_PERSONNEL: 'ADMINISTRATIVE_PERSONNEL',
  MANAGER: 'MANAGER',
  PRINCIPAL: 'MANAGER',
  EMPLOYEE: 'MANAGER',
  APP_ADMIN: 'ADMIN',
};

export function isPhoneIdentifier(value: string) {
  return /^\+?[1-9]\d{7,14}$/.test(value.trim().replace(/[\s()-]/g, ''));
}

export function normalizePhone(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, '');
  return compact.startsWith('+') ? compact : `+${compact}`;
}

export function isEmailIdentifier(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function signUpAccount(input: {
  username: string;
  password: string;
  email?: string;
  phone?: string;
  fullName: string;
  requestedRole: SignupRole;
  staffId?: string;
  admissionId?: string;
}) {
  const client = requireSupabaseClient();
  const email = input.email?.trim().toLowerCase() || undefined;
  const phone = input.phone ? normalizePhone(input.phone) : undefined;
  if (!email && !phone) throw new Error('Provide an email address or full phone number.');
  const credentials = email
    ? { email, password: input.password }
    : { phone: phone as string, password: input.password };
  const { data, error } = await client.auth.signUp({
    ...credentials,
    options: { data: { username: input.username.trim(), full_name: input.fullName.trim(), requested_role: input.requestedRole, staff_id: input.staffId?.trim() || undefined, admission_id: input.admissionId?.trim() || undefined } },
  });
  if (error) throw error;
  return data;
}

export async function signInAccount(identifier: string, password: string): Promise<{ session: Session; user: SupabaseUser }> {
  const client = requireSupabaseClient();
  const value = identifier.trim();
  if (isEmailIdentifier(value)) {
    const { data, error } = await client.auth.signInWithPassword({ email: value.toLowerCase(), password });
    if (error || !data.session || !data.user) throw error ?? new Error('Invalid credentials');
    return data as { session: Session; user: SupabaseUser };
  }
  if (isPhoneIdentifier(value)) {
    const { data, error } = await client.auth.signInWithPassword({ phone: normalizePhone(value), password });
    if (error || !data.session || !data.user) throw error ?? new Error('Invalid credentials');
    return data as { session: Session; user: SupabaseUser };
  }

  const { data, error } = await client.functions.invoke('auth-username-signin', { body: { username: value, password } });
  if (error || !data?.session || !data?.user) throw error ?? new Error('Invalid credentials');
  const { error: sessionError } = await client.auth.setSession(data.session);
  if (sessionError) throw sessionError;
  return data as { session: Session; user: SupabaseUser };
}

export async function loadCanonicalUser(authUser: SupabaseUser): Promise<User> {
  const client = requireSupabaseClient();
  const typedClient = client as any;
  const [
    { data: profile, error: profileError },
    { data: assignments, error: roleError },
    { data: telegramIdentity, error: telegramError },
  ] = await Promise.all([
    typedClient.from('profiles').select('id,username,full_name,email,avatar_url').eq('id', authUser.id).single(),
    typedClient.from('role_assignments').select('role').eq('user_id', authUser.id).eq('active', true),
    typedClient.from('telegram_identities').select('telegram_user_id').eq('user_id', authUser.id).maybeSingle(),
  ]);
  if (profileError || roleError || telegramError || !profile) throw profileError ?? roleError ?? telegramError ?? new Error('Profile unavailable');
  const roles = (assignments ?? []).map((row: { role: string }) => row.role);
  const role = roleMap[roles.includes('APP_ADMIN') ? 'APP_ADMIN' : roles.find((candidate: string) => candidate !== 'GENERAL_USER') ?? 'GENERAL_USER'] ?? 'GENERAL_USER';
  return {
    id: profile.id,
    username: profile.username,
    fullName: profile.full_name || profile.username,
    email: profile.email ?? authUser.email ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    role,
    capabilities: roles,
    telegramLinked: Boolean(telegramIdentity),
  };
}

export async function createTelegramLinkChallenge() {
  const client = requireSupabaseClient();
  const { data, error } = await client.functions.invoke('telegram-link-challenge', { body: {} });
  if (error || !data?.linkCode) throw error ?? new Error('Unable to start Telegram linking');
  return {
    linkUrl: createTelegramLinkUrl(data.linkCode as string),
    expiresInSeconds: Number(data.expiresInSeconds) || 600,
  };
}

let lastTelegramLinkAttempt: { initData: string; result: Promise<void> } | null = null;

export function completeTelegramLinkFromInitData(initData: string): Promise<void> {
  if (lastTelegramLinkAttempt?.initData === initData) return lastTelegramLinkAttempt.result;
  const result = (async () => {
    const client = requireSupabaseClient();
    const { data, error } = await client.functions.invoke('telegram-auth', { body: { initData } });
    if (error || data?.linked !== true) throw new Error('Telegram link could not be confirmed');
  })();
  lastTelegramLinkAttempt = { initData, result };
  return result;
}

export async function signOutAccount() {
  if (supabase) await supabase.auth.signOut();
}
