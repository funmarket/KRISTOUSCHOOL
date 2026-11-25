import type { AccountRole } from '../types.ts';

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

export const AUTH_ROLE_MAP: Record<string, AccountRole> = {
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
    const mapped = AUTH_ROLE_MAP[candidate];
    if (mapped) return mapped;
  }
  return null;
}
