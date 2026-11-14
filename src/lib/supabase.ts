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

/**
 * Manually authored TypeScript schema contract for migrations 20261110*–20261114*.
 * Not generated via `supabase gen types typescript` yet (pending hosted migration/CLI typegen).
 */
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
          account_status: string;
          status_reason: string | null;
          status_reviewed_by: string | null;
          status_reviewed_at: string | null;
          governance_version: number;
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
        Row: {
          id: string;
          user_id: string;
          role: string;
          active: boolean;
          assigned_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; role: string; active?: boolean; assigned_by?: string | null };
        Update: { active?: boolean };
      };
      telegram_identities: {
        Row: {
          id: string;
          user_id: string;
          telegram_user_id: number;
          telegram_username: string | null;
          linked_at: string;
        };
        Insert: { user_id: string; telegram_user_id: number; telegram_username?: string | null };
        Update: { telegram_username?: string | null };
      };
      manager_capability_grants: {
        Row: {
          id: string;
          manager_user_id: string;
          capability: string;
          active: boolean;
          granted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          manager_user_id: string;
          capability: string;
          active?: boolean;
          granted_by?: string | null;
        };
        Update: { active?: boolean };
      };
      account_governance_audit_logs: {
        Row: {
          id: string;
          actor_user_id: string;
          actor_role: string;
          target_user_id: string;
          action: string;
          capability: string | null;
          previous_status: string;
          resulting_status: string;
          previous_roles: string[];
          resulting_roles: string[];
          reason: string;
          idempotency_key: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      user_preferences: {
        Row: {
          user_id: string;
          language: string;
          theme: string;
          notification_sound: string;
          sound_muted: boolean;
          vibration_enabled: boolean;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      user_notifications: {
        Row: {
          id: string;
          recipient_user_id: string;
          category: string;
          title: string;
          body: string;
          target_tab: string | null;
          target_ref_id: string | null;
          is_read: boolean;
          read_at: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      academic_years: {
        Row: {
          id: string;
          code: string;
          label: string;
          starts_on: string;
          ends_on: string;
          is_active: boolean;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      school_levels: {
        Row: {
          code: string;
          label_ar: string;
          label_fr: string;
          label_en: string;
          sort_order: number;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      school_classes: {
        Row: {
          id: string;
          academic_year_id: string;
          level_code: string;
          name: string;
          room_label: string | null;
          capacity: number;
          is_archived: boolean;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      students: {
        Row: {
          id: string;
          student_code: string;
          full_name: string;
          birth_date: string;
          linked_profile_id: string | null;
          status: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      student_class_memberships: {
        Row: {
          id: string;
          student_id: string;
          class_id: string;
          academic_year_id: string;
          status: string;
          started_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      teacher_class_assignments: {
        Row: {
          id: string;
          teacher_user_id: string;
          class_id: string;
          is_homeroom: boolean;
          active: boolean;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      parent_child_links: {
        Row: {
          id: string;
          parent_user_id: string;
          student_id: string;
          relationship_label: string;
          active: boolean;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      enrollment_applications: {
        Row: {
          id: string;
          reference_code: string;
          student_full_name: string;
          birth_date: string;
          desired_level_code: string;
          parent_full_name: string;
          phone: string;
          email: string | null;
          notes: string | null;
          submitted_by_user_id: string | null;
          status: string;
          review_note: string | null;
          reviewed_at: string | null;
          version: number;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      public_school_inquiries: {
        Row: {
          id: string;
          sender_name: string;
          phone: string | null;
          email: string | null;
          subject: string;
          message: string;
          submitted_by_user_id: string | null;
          status: string;
          staff_response: string | null;
          responded_at: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      school_broadcasts: {
        Row: {
          id: string;
          title: string;
          body: string;
          priority: string;
          status: string;
          audience_scope: string;
          target_level_codes: string[];
          target_class_ids: string[];
          is_public: boolean;
          published_at: string | null;
          author_name: string;
          author_role: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      school_calendar_events: {
        Row: {
          id: string;
          class_id: string | null;
          title: string;
          description: string;
          category: string;
          start_date: string;
          end_date: string;
          is_all_day: boolean;
          start_time: string | null;
          end_time: string | null;
          timezone: string;
          is_public: boolean;
          status: string;
          cancellation_reason: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      school_calendar_responses: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          response: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      class_announcements: {
        Row: {
          id: string;
          class_id: string;
          title: string;
          body: string;
          priority: string;
          author_name: string;
          author_role: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      class_homework_items: {
        Row: {
          id: string;
          class_id: string;
          title: string;
          description: string;
          due_date: string;
          teacher_name: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      class_documents: {
        Row: {
          id: string;
          class_id: string;
          title: string;
          description: string;
          document_url: string;
          file_type: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      class_gallery_items: {
        Row: {
          id: string;
          class_id: string | null;
          title: string;
          caption: string;
          image_url: string;
          is_public: boolean;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      class_questions: {
        Row: {
          id: string;
          class_id: string;
          author_user_id: string;
          author_name: string;
          content: string;
          is_hidden: boolean;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      class_question_replies: {
        Row: {
          id: string;
          question_id: string;
          author_user_id: string;
          author_name: string;
          content: string;
          is_hidden: boolean;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      parent_notes: {
        Row: {
          id: string;
          parent_user_id: string;
          parent_name: string;
          student_id: string;
          student_name: string;
          class_id: string | null;
          recipient_teacher_id: string | null;
          topic: string;
          content: string;
          school_day: string;
          status: string;
          reply_content: string | null;
          replied_by_name: string | null;
          replied_at: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      message_threads: {
        Row: {
          id: string;
          subject: string;
          created_by_user_id: string;
          last_message_preview: string;
          updated_at: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      thread_participants: {
        Row: {
          id: string;
          thread_id: string;
          user_id: string;
          unread: boolean;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      thread_messages: {
        Row: {
          id: string;
          thread_id: string;
          sender_user_id: string;
          sender_name: string;
          content: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      directory_entries: {
        Row: {
          id: string;
          entry_type: string;
          display_name: string;
          title: string;
          photo_url: string;
          bio: string;
          tags: string[];
          languages: string[];
          sort_order: number;
          is_published: boolean;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      food_menu_weeks: {
        Row: {
          id: string;
          week_range: string;
          provider_name: string;
          status: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      food_menu_days: {
        Row: {
          id: string;
          menu_week_id: string;
          day_order: number;
          day_label: string;
          starter: string;
          main_dish: string;
          side_dish: string;
          dessert: string;
          notes: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      school_public_content: {
        Row: {
          slug: string;
          title_ar: string;
          title_fr: string;
          title_en: string;
          body_ar: string;
          body_fr: string;
          body_en: string;
          is_published: boolean;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_school_class: {
        Args: {
          p_academic_year_code: string;
          p_level_code: string;
          p_name: string;
          p_capacity?: number;
          p_room_label?: string | null;
        };
        Returns: { id: string; name: string; levelCode: string };
      };
      create_and_enroll_student: {
        Args: {
          p_student_code: string;
          p_full_name: string;
          p_birth_date: string;
          p_class_id: string;
          p_parent_user_id?: string | null;
          p_relationship_label?: string;
          p_linked_profile_id?: string | null;
        };
        Returns: { studentId: string; studentCode: string; classId: string };
      };
      assign_teacher_to_class: {
        Args: {
          p_teacher_user_id: string;
          p_class_id: string;
          p_is_homeroom?: boolean;
          p_active?: boolean;
        };
        Returns: { teacherUserId: string; classId: string; active: boolean };
      };
      list_school_classes_with_rosters: {
        Args: Record<string, never>;
        Returns: unknown[];
      };
      get_my_school_context: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      publish_school_broadcast: {
        Args: {
          p_title: string;
          p_body: string;
          p_priority?: string;
          p_audience_scope?: string;
          p_is_public?: boolean;
          p_target_class_ids?: string[];
          p_target_level_codes?: string[];
        };
        Returns: DatabaseSchema['public']['Tables']['school_broadcasts']['Row'];
      };
      moderate_class_question: {
        Args: { p_question_id: string; p_hidden: boolean };
        Returns: DatabaseSchema['public']['Tables']['class_questions']['Row'];
      };
      post_class_question: {
        Args: { p_class_id: string; p_content: string };
        Returns: DatabaseSchema['public']['Tables']['class_questions']['Row'];
      };
      reply_class_question: {
        Args: { p_question_id: string; p_content: string };
        Returns: DatabaseSchema['public']['Tables']['class_question_replies']['Row'];
      };
      send_parent_note: {
        Args: { p_student_id: string; p_topic: string; p_content: string };
        Returns: { note: DatabaseSchema['public']['Tables']['parent_notes']['Row']; remainingToday: number };
      };
      reply_parent_note: {
        Args: { p_note_id: string; p_reply_content: string };
        Returns: DatabaseSchema['public']['Tables']['parent_notes']['Row'];
      };
      list_approved_message_recipients: {
        Args: Record<string, never>;
        Returns: { id: string; fullName: string; role: string }[];
      };
      send_operational_message: {
        Args: { p_recipient_user_id: string; p_subject: string; p_content: string };
        Returns: { threadId: string; message: DatabaseSchema['public']['Tables']['thread_messages']['Row'] };
      };
      reply_operational_thread: {
        Args: { p_thread_id: string; p_content: string };
        Returns: DatabaseSchema['public']['Tables']['thread_messages']['Row'];
      };
      [fn: string]: { Args: Record<string, unknown>; Returns: unknown };
    };
    Enums: {
      app_role:
        | 'APP_ADMIN'
        | 'MANAGER'
        | 'ADMINISTRATIVE_PERSONNEL'
        | 'TEACHER'
        | 'SCHOOL_STAFF'
        | 'PARENT'
        | 'STUDENT';
    };
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
