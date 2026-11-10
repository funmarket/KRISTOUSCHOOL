/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

// Retrieve only public runtime configuration. Never embed a project URL or key in source.
const getEnvVar = (key: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const val = (import.meta as any).env[key];
    if (val) return val;
  }
  if (typeof process !== 'undefined' && process.env) {
    const val = process.env[key];
    if (val) return val;
  }
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL');
const supabasePublishableKey =
  getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY') ||
  getEnvVar('VITE_SUPABASE_ANON_KEY') ||
  getEnvVar('SUPABASE_PUBLISHABLE_KEY') ||
  getEnvVar('SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export interface DatabaseSchema {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          username_normalized: string;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          requested_role: string;
          staff_id: string | null;
          admission_id: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          requested_role?: string;
          staff_id?: string | null;
          admission_id?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
        };
      };
      role_assignments: {
        Row: { id: string; user_id: string; role: string; active: boolean; assigned_by: string | null; created_at: string; updated_at: string };
        Insert: { user_id: string; role: string; active?: boolean; assigned_by?: string | null };
        Update: { active?: boolean };
      };
      users: {
        Row: {
          id: string;
          username: string;
          full_name: string;
          role: string;
          email: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          full_name: string;
          role: string;
          email?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          full_name?: string;
          role?: string;
          email?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
      };
      children: {
        Row: {
          id: string;
          full_name: string;
          class_id: string;
          class_name: string;
          level: string;
          birth_date: string;
          photo_url: string | null;
          medical_notes: string | null;
        };
        Insert: {
          id?: string;
          full_name: string;
          class_id: string;
          class_name: string;
          level: string;
          birth_date: string;
          photo_url?: string | null;
          medical_notes?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          class_id?: string;
          class_name?: string;
          level?: string;
          birth_date?: string;
          photo_url?: string | null;
          medical_notes?: string | null;
        };
      };
      parent_notes: {
        Row: {
          id: string;
          parent_id: string;
          parent_name: string;
          child_id: string;
          child_name: string;
          teacher_id: string | null;
          topic: string;
          content: string;
          created_at: string;
          status: string;
          reply_content: string | null;
        };
        Insert: {
          id?: string;
          parent_id: string;
          parent_name: string;
          child_id: string;
          child_name: string;
          teacher_id?: string | null;
          topic: string;
          content: string;
          created_at?: string;
          status?: string;
          reply_content?: string | null;
        };
        Update: {
          id?: string;
          parent_id?: string;
          parent_name?: string;
          child_id?: string;
          child_name?: string;
          teacher_id?: string | null;
          topic?: string;
          content?: string;
          created_at?: string;
          status?: string;
          reply_content?: string | null;
        };
      };
      pickup_records: {
        Row: {
          id: string;
          child_id: string;
          child_name: string;
          class_id: string;
          class_name: string;
          state: string;
          parent_arrived_at: string | null;
          released_at: string | null;
          released_by: string | null;
          authorized_person: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          child_name: string;
          class_id: string;
          class_name: string;
          state: string;
          parent_arrived_at?: string | null;
          released_at?: string | null;
          released_by?: string | null;
          authorized_person: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          child_name?: string;
          class_id?: string;
          class_name?: string;
          state?: string;
          parent_arrived_at?: string | null;
          released_at?: string | null;
          released_by?: string | null;
          authorized_person?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

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
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the runtime environment.',
    );
  }

  return supabase;
}
