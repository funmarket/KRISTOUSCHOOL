import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, requireSupabaseClient } from './supabase.ts';
import { createTelegramLinkUrl } from './telegram.ts';
import {
  isValidPhoneInput,
  isValidUsername,
  normalizePhoneInput,
  normalizeUsernameDisplay,
  normalizeUsernameKey,
} from './username.ts';
import type { AccountRole, User, UserRole } from '../types.ts';

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

export function isPhoneIdentifier(value: string): boolean {
  return isValidPhoneInput(value);
}

export function normalizePhone(value: string): string {
  return normalizePhoneInput(value);
}

export function isEmailIdentifier(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function signUpAccount(
  input: {
    username?: string;
    password: string;
    email?: string;
    phone?: string;
    fullName: string;
    requestedRole: SignupRole;
    staffId?: string;
    admissionId?: string;
  },
  clientOverride?: {
    auth: {
      signUp: (credentials: any) => Promise<{ data: any; error: any }>;
      updateUser?: (attributes: any) => Promise<{ data: any; error: any }>;
    };
  },
) {
  if (!isRegistrationRole(input.requestedRole)) throw new Error('invalid_requested_role');

  const rawUsername = input.username?.trim() || undefined;
  if (rawUsername !== undefined && !isValidUsername(rawUsername)) {
    throw new Error('invalid_username_format');
  }

  const email = input.email?.trim().toLowerCase() || undefined;
  if (email !== undefined && !isEmailIdentifier(email)) {
    throw new Error('invalid_email_format');
  }

  const rawPhone = input.phone?.trim() || undefined;
  const phone = rawPhone !== undefined ? normalizePhoneInput(rawPhone) : undefined;

  if (!email && !phone) {
    if (rawUsername) {
      throw new Error('username_only_requires_contact_or_backend_auth');
    }
    throw new Error('missing_login_identifier');
  }

  if (!email && phone && !rawUsername) {
    throw new Error('username_required_for_phone_registration');
  }

  const client = clientOverride ?? requireSupabaseClient();
  const usernameDisplay = rawUsername ? normalizeUsernameDisplay(rawUsername) : undefined;
  const usernameKey = rawUsername ? normalizeUsernameKey(rawUsername) : undefined;
  const secondaryPhoneVerificationRequired = Boolean(email && phone);

  const credentials = email
    ? { email, password: input.password }
    : { phone: phone as string, password: input.password };

  const { data, error } = await client.auth.signUp({
    ...credentials,
    options: {
      data: {
        username: usernameDisplay,
        username_normalized: usernameKey,
        full_name: input.fullName.trim(),
        requested_role: input.requestedRole,
        staff_id: input.staffId?.trim() || undefined,
        admission_id: input.admissionId?.trim() || undefined,
        pending_phone: secondaryPhoneVerificationRequired ? phone : undefined,
      },
    },
  });

  if (error?.message?.toLowerCase().includes('database error saving new user')) {
    throw new Error('username_unavailable_or_invalid');
  }
  if (error) throw error;

  if (secondaryPhoneVerificationRequired && data?.session && typeof client.auth.updateUser === 'function') {
    await client.auth.updateUser({ phone }).catch(() => null);
  }

  return {
    ...data,
    secondaryPhoneVerificationRequired,
  };
}

async function unwrapFunctionsError(error: any): Promise<Error> {
  const context = error?.context;
  const status = typeof context?.status === 'number' ? context.status : undefined;
  let payload: any = null;

  if (context) {
    try {
      if (typeof context.clone === 'function') {
        payload = await context.clone().json();
      } else if (typeof context.json === 'function') {
        payload = await context.json();
      }
    } catch {
      payload = null;
    }
  }

  const remoteCode =
    typeof payload?.error === 'string'
      ? payload.error
      : typeof payload?.code === 'string'
      ? payload.code
      : '';

  if (
    remoteCode === 'email_not_confirmed' ||
    remoteCode === 'phone_not_confirmed' ||
    remoteCode === 'contact_not_confirmed'
  ) {
    return Object.assign(new Error(remoteCode), { code: remoteCode, status });
  }

  if ((status === 401 || status === 400) && remoteCode === 'invalid_credentials') {
    return Object.assign(new Error('Invalid login credentials'), {
      code: 'invalid_credentials',
      status,
    });
  }

  return Object.assign(new Error('sign_in_failed'), {
    code: 'sign_in_failed',
    status,
  });
}

function normalizeProviderSignInError(error: any): Error {
  if (!error) {
    return Object.assign(new Error('sign_in_failed'), { code: 'sign_in_failed' });
  }
  const code = typeof error.code === 'string' ? error.code : '';
  if (
    code === 'email_not_confirmed' ||
    code === 'phone_not_confirmed' ||
    code === 'contact_not_confirmed'
  ) {
    return Object.assign(new Error(code), { code, status: error.status });
  }
  if (
    code === 'invalid_credentials' ||
    code === 'invalid_grant' ||
    error.message === 'Invalid login credentials' ||
    error.message === 'Invalid credentials'
  ) {
    return Object.assign(new Error('Invalid login credentials'), {
      code: 'invalid_credentials',
      status: error.status,
    });
  }
  return Object.assign(new Error('sign_in_failed'), {
    code: 'sign_in_failed',
    status: error.status,
  });
}

export async function signInAccount(
  identifier: string,
  password: string,
  clientOverride?: any,
): Promise<{ session: Session; user: SupabaseUser }> {
  const client = clientOverride ?? requireSupabaseClient();
  const value = identifier.trim();

  if (isEmailIdentifier(value)) {
    const { data, error } = await client.auth.signInWithPassword({
      email: value.toLowerCase(),
      password,
    });
    if (error || !data?.session || !data?.user) {
      throw normalizeProviderSignInError(error);
    }
    return data as { session: Session; user: SupabaseUser };
  }

  if (isPhoneIdentifier(value)) {
    throw Object.assign(new Error('phone_sign_in_not_supported'), {
      code: 'phone_sign_in_not_supported',
    });
  }

  const usernameDisplay = normalizeUsernameDisplay(value);
  const usernameKey = normalizeUsernameKey(value);
  const { data, error } = await client.functions.invoke('auth-username-signin', {
    body: { username: usernameDisplay, usernameKey, password },
  });

  if (error) {
    throw await unwrapFunctionsError(error);
  }

  if (!data?.session || !data?.user) {
    throw Object.assign(new Error('sign_in_failed'), { code: 'sign_in_failed' });
  }

  const { error: sessionError } = await client.auth.setSession(data.session);
  if (sessionError) {
    throw Object.assign(new Error('sign_in_failed'), { code: 'sign_in_failed' });
  }

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
    typedClient
      .from('profiles')
      .select('id,username,full_name,email,avatar_url,account_status,requested_role')
      .eq('id', authUser.id)
      .single(),
    typedClient.from('role_assignments').select('role').eq('user_id', authUser.id).eq('active', true),
    typedClient.from('telegram_identities').select('telegram_user_id').eq('user_id', authUser.id).maybeSingle(),
  ]);
  if (profileError || roleError || telegramError || !profile) {
    throw profileError ?? roleError ?? telegramError ?? new Error('Profile unavailable');
  }

  const rawProfileStatus =
    typeof (profile as { account_status?: unknown }).account_status === 'string'
      ? (profile as { account_status: string }).account_status.trim()
      : typeof (profile as { accountStatus?: unknown }).accountStatus === 'string'
      ? (profile as { accountStatus: string }).accountStatus.trim()
      : '';
  if (rawProfileStatus !== 'APPROVED') {
    throw new Error('account_not_approved');
  }

  const roles = (assignments ?? []).map((row: { role: string }) => row.role);
  const role = resolveCanonicalAccountRole(roles);
  if (!role) throw new Error('account_not_approved');

  const rawRequestedRole =
    (profile as { requested_role?: unknown }).requested_role ??
    (profile as { requestedRole?: unknown }).requestedRole;

  return {
    id: profile.id,
    username: profile.username,
    fullName: profile.full_name || profile.username,
    email: profile.email ?? authUser.email ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    role: role as UserRole,
    accountStatus: 'APPROVED',
    requestedRole: isRegistrationRole(rawRequestedRole) ? rawRequestedRole : undefined,
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

export function authenticateTelegramInitData(
  initData: string,
  clientOverride?: { functions: { invoke: (fn: string, opts: any) => Promise<{ data: any; error: any }> } },
): Promise<TelegramAuthResult> {
  if (!clientOverride && lastTelegramAuthAttempt?.initData === initData) {
    return lastTelegramAuthAttempt.result;
  }
  const result = (async () => {
    const client = clientOverride ?? requireSupabaseClient();
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
      accountStatus?: string;
      account_status?: string;
    };
    const rawTgStatus = rawUser.accountStatus ?? rawUser.account_status;
    if (
      rawTgStatus === 'PENDING' ||
      rawTgStatus === 'REJECTED' ||
      rawTgStatus === 'SUSPENDED' ||
      rawTgStatus === 'REVOKED'
    ) {
      throw new Error('account_not_approved');
    }
    const rawCapabilities = Array.isArray(rawUser.capabilities) ? rawUser.capabilities : [];
    const candidateRoles = [
      ...(rawUser.role ? [rawUser.role] : []),
      ...rawCapabilities,
    ];
    const resolvedRole = resolveCanonicalAccountRole(candidateRoles);
    if (!resolvedRole) {
      throw new Error('account_not_approved');
    }
    const canonicalCapabilities = rawCapabilities.filter((candidate: string) =>
      Boolean(roleMap[candidate]),
    );
    return {
      linked: data.linked === true,
      user: {
        id: rawUser.id,
        username: rawUser.username,
        fullName: rawUser.fullName || rawUser.username,
        email: rawUser.email ?? undefined,
        avatarUrl: rawUser.avatarUrl ?? undefined,
        role: resolvedRole,
        capabilities: canonicalCapabilities.length > 0 ? canonicalCapabilities : [resolvedRole],
        telegramLinked: rawUser.telegramLinked ?? true,
      },
    };
  })();
  if (!clientOverride) {
    lastTelegramAuthAttempt = { initData, result };
  }
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

