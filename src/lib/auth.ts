import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, requireSupabaseClient } from './supabase.ts';
import {
  isValidPhoneInput,
  isValidUsername,
  normalizePhoneInput,
  normalizeUsernameDisplay,
  normalizeUsernameKey,
} from './username.ts';
import {
  AUTH_ROLE_MAP,
  REGISTRATION_ROLES,
  isRegistrationRole,
  resolveCanonicalAccountRole,
  type RegistrationRole,
  type SignupRole,
} from './authRoles.ts';
import {
  authenticateTelegramInitData,
  clearTelegramAuthCache,
  completeTelegramLinkFromInitData,
  createTelegramLinkChallenge,
  type TelegramAuthResult,
} from './telegramAuth.ts';
import type { AccountRole, User, UserRole } from '../types.ts';

export {
  REGISTRATION_ROLES,
  isRegistrationRole,
  resolveCanonicalAccountRole,
  authenticateTelegramInitData,
  completeTelegramLinkFromInitData,
  createTelegramLinkChallenge,
  type RegistrationRole,
  type SignupRole,
  type TelegramAuthResult,
};

const roleMap = AUTH_ROLE_MAP;

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

  const roleCaps = roles.filter((candidate: string): candidate is AccountRole => Boolean(roleMap[candidate]));
  const mergedCaps = new Set<string>(roleCaps);

  if (role === 'MANAGER') {
    try {
      const { data: grantRows, error: grantError } = await typedClient
        .from('manager_capability_grants')
        .select('capability')
        .eq('manager_user_id', authUser.id)
        .eq('active', true);
      if (!grantError && Array.isArray(grantRows)) {
        for (const row of grantRows) {
          if (typeof row?.capability === 'string' && row.capability.trim()) {
            mergedCaps.add(row.capability.trim());
          }
        }
      }
    } catch {
      // Gracefully tolerate absent manager_capability_grants table or partial test stubs
    }
  }

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
    capabilities: [...mergedCaps],
    telegramLinked: Boolean(telegramIdentity),
  };
}

export async function signOutAccount() {
  clearTelegramAuthCache();
  if (supabase) await supabase.auth.signOut();
}

