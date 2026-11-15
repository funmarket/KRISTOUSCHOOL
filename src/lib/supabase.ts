/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

declare const __KRISTOU_SUPABASE_URL__: string;
declare const __KRISTOU_SUPABASE_PUBLISHABLE_KEY__: string;

// vite.config.ts selectively injects only public config, never a service-role key.
const supabaseUrl = __KRISTOU_SUPABASE_URL__;
const supabasePublishableKey = __KRISTOU_SUPABASE_PUBLISHABLE_KEY__;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

import type { Database } from './database.types';

// Preserve the existing client type export with one generated schema owner.
export type DatabaseSchema = Database;

export const supabase = isSupabaseConfigured
  ? createClient<DatabaseSchema>(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export function requireSupabaseClient() {
  if (!supabase) {
    throw new Error(
      'Supabase public configuration was not included in this frontend build. Check the deployment build variables and rebuild.',
    );
  }

  return supabase;
}

export function classifySupabaseError(error: unknown): {
  status: 'BLOCKED_BACKEND' | 'UNAUTHORIZED' | 'ERROR';
  errorCode: string;
  errorMessage: string;
} {
  if (!isSupabaseConfigured) {
    return {
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'Supabase public configuration is not available in this build.',
    };
  }
  if (!error || typeof error !== 'object') {
    return {
      status: 'ERROR',
      errorCode: 'operation_failed',
      errorMessage: 'Operation could not be completed.',
    };
  }

  const rawCode =
    typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code.trim()
      : '';
  const rawMessage =
    typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message.trim()
      : '';

  if (
    rawCode === 'PGRST202' ||
    rawCode === 'PGRST205' ||
    rawCode === '42883' ||
    rawCode === '42P01' ||
    rawMessage.includes('Could not find the function') ||
    rawMessage.includes('Could not find the table') ||
    rawMessage.includes('schema cache') ||
    rawMessage.includes('Failed to fetch') ||
    rawMessage.includes('NetworkError')
  ) {
    return {
      status: 'BLOCKED_BACKEND',
      errorCode: 'backend_unavailable',
      errorMessage: 'This workflow is awaiting verified Supabase backend deployment.',
    };
  }

  if (
    rawCode === '42501' ||
    rawMessage.includes('actor_unauthenticated') ||
    rawMessage.includes('actor_not_approved') ||
    rawMessage.includes('insufficient_authority') ||
    rawMessage.includes('owner_only_operation') ||
    rawMessage.includes('students_cannot_direct_message') ||
    rawMessage.includes('row-level security')
  ) {
    return {
      status: 'UNAUTHORIZED',
      errorCode: rawMessage || rawCode || 'insufficient_authority',
      errorMessage: rawMessage || 'You are not authorized to perform this action.',
    };
  }

  return {
    status: 'ERROR',
    errorCode: rawMessage || rawCode || 'operation_failed',
    errorMessage: rawMessage || 'Operation failed.',
  };
}
