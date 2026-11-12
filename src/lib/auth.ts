import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, requireSupabaseClient } from './supabase';
import { createTelegramLinkUrl } from './telegram';
import { isValidUsername } from './username';
import type { AccountRole, User } from '../types';

export const REGISTRATION_ROLES = [
  'APP_ADMIN',
  'MANAGER',
  'PARENT',
  'STUDENT',
  'TEACHER',
  'SCHOOL_STAFF',
  'ADMINISTRATIVE_PERSONNEL',
] as const satisfies readonly AccountRole[];

export type RegistrationRole = (typeof REGISTRATION_ROLES)[number];
export type SignupRole = RegistrationRole;

export function isRegistrationRole(value: unknown): value is RegistrationRole {
  return typeof value === 'string' && (REGISTRATION_ROLES as readonly string[]).includes(value);
}

const roleMap: Record<string, AccountRole> = {
  APP_ADMIN: 'APP_ADMIN',
  MANAGER: 'MANAGER',
  PARENT: 'PARENT',
  STUDENT: 'STUDENT',
  TEACHER: 'TEACHER',
  SCHOOL_STAFF: 'SCHOOL_STAFF',
  ADMINISTRATIVE_PERSONNEL: 'ADMINISTRATIVE_PERSONNEL',
};

export function resolveCanonicalAccountRole(roles: readonly string[]): AccountRole | null {
  if (roles.includes('APP_ADMIN')) return 'APP_ADMIN';
  for (const candidate of roles) {
    const mapped = roleMap[candidate];
    if (mapped) return mapped;
  }
  return null;
}

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

export async function signUpAccount(
  input: {
    username: string;
    password: string;
    email?: string;
    phone?: string;
    fullName: string;
    requestedRole: SignupRole;
    staffId?: string;
    admissionId?: string;
  },
  clientOverride?: { auth: { signUp: (credentials: any) => Promise<{ data: any; error: any }> } },
) {
  if (!isRegistrationRole(input.requestedRole)) throw new Error('invalid_requested_role');
  if (!isValidUsername(input.username)) throw new Error('invalid_username_format');
  const client = clientOverride ?? requireSupabaseClient();
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
  if (error?.message.toLowerCase().includes('database error saving new user')) {
    throw new Error('username_unavailable_or_invalid');
  }
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

export async function loadCanonicalUser(authUser: SupabaseUser, clientOverride?: any): Promise<User> {
  const client = clientOverride ?? requireSupabaseClient();
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
  const role = resolveCanonicalAccountRole(roles);
  if (!role) throw new Error('account_not_approved');
  return {
    id: profile.id,
    username: profile.username,
    fullName: profile.full_name || profile.username,
    email: profile.email ?? authUser.email ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    role,
    capabilities: roles.filter((candidate: string): candidate is AccountRole => Boolean(roleMap[candidate])),
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

export type TelegramAuthResult = { user: User; linked: boolean };

let lastTelegramAuthAttempt: { initData: string; result: Promise<TelegramAuthResult> } | null = null;

export function authenticateTelegramInitData(initData: string): Promise<TelegramAuthResult> {
  if (lastTelegramAuthAttempt?.initData === initData) return lastTelegramAuthAttempt.result;
  const result = (async () => {
    const client = requireSupabaseClient();
    const { data, error } = await client.functions.invoke('telegram-auth', { body: { initData } });
    if (error || !data?.user) throw new Error(data?.error || 'Telegram account is not linked');

    const rawUser = data.user as {
      id: string;
      username: string;
      fullName?: string;
      email?: string | null;
      avatarUrl?: string | null;
      role?: string;
      capabilities?: string[];
      telegramLinked?: boolean;
    };
    const capabilities = Array.isArray(rawUser.capabilities) ? rawUser.capabilities : [];
    const roleName = resolveCanonicalAccountRole([rawUser.role ?? '', ...capabilities]);
    if (!roleName) throw new Error('account_not_approved');
    return {
      linked: data.linked === true,
      user: {
        id: rawUser.id,
        username: rawUser.username,
        fullName: rawUser.fullName || rawUser.username,
        email: rawUser.email ?? undefined,
        avatarUrl: rawUser.avatarUrl ?? undefined,
        role: roleName,
        capabilities: capabilities.filter((candidate): candidate is AccountRole => Boolean(roleMap[candidate])),
        telegramLinked: rawUser.telegramLinked ?? true,
      },
    };
  })();
  lastTelegramAuthAttempt = { initData, result };
  return result;
}

export async function completeTelegramLinkFromInitData(initData: string): Promise<User> {
  const result = await authenticateTelegramInitData(initData);
  if (!result.linked) throw new Error('Telegram link could not be confirmed');
  return result.user;
}

export async function signOutAccount() {
  if (supabase) await supabase.auth.signOut();
}
