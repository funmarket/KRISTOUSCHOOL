export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      academic_years: {
        Row: {
          code: string
          created_at: string
          ends_on: string
          id: string
          is_active: boolean
          label: string
          starts_on: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          code: string
          created_at?: string
          ends_on: string
          id?: string
          is_active?: boolean
          label: string
          starts_on: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          ends_on?: string
          id?: string
          is_active?: boolean
          label?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: []
      }
      account_governance_audit_logs: {
        Row: {
          action: string
          actor_role: Database["public"]["Enums"]["app_role"]
          actor_user_id: string
          capability: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          previous_roles: string[]
          previous_status: Database["public"]["Enums"]["account_approval_status"]
          reason: string
          resulting_roles: string[]
          resulting_status: Database["public"]["Enums"]["account_approval_status"]
          target_user_id: string
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_role: Database["public"]["Enums"]["app_role"]
          actor_user_id: string
          capability?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          previous_roles?: string[]
          previous_status: Database["public"]["Enums"]["account_approval_status"]
          reason: string
          resulting_roles?: string[]
          resulting_status: Database["public"]["Enums"]["account_approval_status"]
          target_user_id: string
        }
        Update: {
          action?: string
          actor_role?: Database["public"]["Enums"]["app_role"]
          actor_user_id?: string
          capability?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          previous_roles?: string[]
          previous_status?: Database["public"]["Enums"]["account_approval_status"]
          reason?: string
          resulting_roles?: string[]
          resulting_status?: Database["public"]["Enums"]["account_approval_status"]
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_governance_audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_governance_audit_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      account_link_challenges: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          user_id: string
          verifier_hash: string
        }
        ComputedFields: never
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          user_id: string
          verifier_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
          verifier_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_link_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_announcements: {
        Row: {
          author_name: string
          author_role: string
          author_user_id: string
          body: string
          class_id: string
          created_at: string
          id: string
          priority: string
          title: string
        }
        ComputedFields: never
        Insert: {
          author_name: string
          author_role: string
          author_user_id: string
          body: string
          class_id: string
          created_at?: string
          id?: string
          priority?: string
          title: string
        }
        Update: {
          author_name?: string
          author_role?: string
          author_user_id?: string
          body?: string
          class_id?: string
          created_at?: string
          id?: string
          priority?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_announcements_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_announcements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_documents: {
        Row: {
          author_user_id: string
          class_id: string
          created_at: string
          description: string
          document_url: string
          file_type: string
          id: string
          title: string
        }
        ComputedFields: never
        Insert: {
          author_user_id: string
          class_id: string
          created_at?: string
          description?: string
          document_url: string
          file_type?: string
          id?: string
          title: string
        }
        Update: {
          author_user_id?: string
          class_id?: string
          created_at?: string
          description?: string
          document_url?: string
          file_type?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_documents_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_documents_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_gallery_items: {
        Row: {
          author_user_id: string
          caption: string
          class_id: string | null
          created_at: string
          id: string
          image_url: string
          is_public: boolean
          title: string
        }
        ComputedFields: never
        Insert: {
          author_user_id: string
          caption?: string
          class_id?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_public?: boolean
          title: string
        }
        Update: {
          author_user_id?: string
          caption?: string
          class_id?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_public?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_gallery_items_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_gallery_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_homework_items: {
        Row: {
          author_user_id: string
          class_id: string
          created_at: string
          description: string
          due_date: string
          id: string
          teacher_name: string
          title: string
        }
        ComputedFields: never
        Insert: {
          author_user_id: string
          class_id: string
          created_at?: string
          description?: string
          due_date: string
          id?: string
          teacher_name: string
          title: string
        }
        Update: {
          author_user_id?: string
          class_id?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          teacher_name?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_homework_items_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_homework_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_question_replies: {
        Row: {
          author_name: string
          author_user_id: string
          content: string
          created_at: string
          id: string
          is_hidden: boolean
          question_id: string
        }
        ComputedFields: never
        Insert: {
          author_name: string
          author_user_id: string
          content: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          question_id: string
        }
        Update: {
          author_name?: string
          author_user_id?: string
          content?: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_question_replies_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_question_replies_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "class_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_questions: {
        Row: {
          author_name: string
          author_user_id: string
          class_id: string
          content: string
          created_at: string
          id: string
          is_hidden: boolean
          moderated_by: string | null
        }
        ComputedFields: never
        Insert: {
          author_name: string
          author_user_id: string
          class_id: string
          content: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          moderated_by?: string | null
        }
        Update: {
          author_name?: string
          author_user_id?: string
          class_id?: string
          content?: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          moderated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_questions_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_questions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_questions_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      directory_entries: {
        Row: {
          bio: string
          created_at: string
          created_by: string | null
          display_name: string
          entry_type: string
          id: string
          is_published: boolean
          languages: string[]
          photo_url: string
          sort_order: number
          tags: string[]
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          bio?: string
          created_at?: string
          created_by?: string | null
          display_name: string
          entry_type: string
          id?: string
          is_published?: boolean
          languages?: string[]
          photo_url?: string
          sort_order?: number
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          bio?: string
          created_at?: string
          created_by?: string | null
          display_name?: string
          entry_type?: string
          id?: string
          is_published?: boolean
          languages?: string[]
          photo_url?: string
          sort_order?: number
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "directory_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_applications: {
        Row: {
          birth_date: string
          created_at: string
          desired_level_code: string
          email: string | null
          id: string
          notes: string | null
          parent_full_name: string
          phone: string
          reference_code: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_full_name: string
          submitted_by_user_id: string | null
          updated_at: string
          version: number
        }
        ComputedFields: never
        Insert: {
          birth_date: string
          created_at?: string
          desired_level_code: string
          email?: string | null
          id?: string
          notes?: string | null
          parent_full_name: string
          phone: string
          reference_code: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_full_name: string
          submitted_by_user_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          birth_date?: string
          created_at?: string
          desired_level_code?: string
          email?: string | null
          id?: string
          notes?: string | null
          parent_full_name?: string
          phone?: string
          reference_code?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_full_name?: string
          submitted_by_user_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_applications_desired_level_code_fkey"
            columns: ["desired_level_code"]
            isOneToOne: false
            referencedRelation: "school_levels"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "enrollment_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_applications_submitted_by_user_id_fkey"
            columns: ["submitted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_menu_days: {
        Row: {
          day_label: string
          day_order: number
          dessert: string
          id: string
          main_dish: string
          menu_week_id: string
          notes: string | null
          side_dish: string
          starter: string
        }
        ComputedFields: never
        Insert: {
          day_label: string
          day_order: number
          dessert?: string
          id?: string
          main_dish: string
          menu_week_id: string
          notes?: string | null
          side_dish?: string
          starter?: string
        }
        Update: {
          day_label?: string
          day_order?: number
          dessert?: string
          id?: string
          main_dish?: string
          menu_week_id?: string
          notes?: string | null
          side_dish?: string
          starter?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_menu_days_menu_week_id_fkey"
            columns: ["menu_week_id"]
            isOneToOne: false
            referencedRelation: "food_menu_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      food_menu_weeks: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          provider_name: string
          status: string
          updated_at: string
          week_end: string | null
          week_range: string
          week_start: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          provider_name?: string
          status?: string
          updated_at?: string
          week_end?: string | null
          week_range: string
          week_start?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          provider_name?: string
          status?: string
          updated_at?: string
          week_end?: string | null
          week_range?: string
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_menu_weeks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_capability_grants: {
        Row: {
          active: boolean
          capability: string
          created_at: string
          granted_by: string
          id: string
          manager_user_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          capability: string
          created_at?: string
          granted_by: string
          id?: string
          manager_user_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          capability?: string
          created_at?: string
          granted_by?: string
          id?: string
          manager_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_capability_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_capability_grants_manager_user_id_fkey"
            columns: ["manager_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string
          created_by_user_id: string
          id: string
          last_message_preview: string
          subject: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          last_message_preview?: string
          subject?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          last_message_preview?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          created_at: string
          dispatched_at: string | null
          event_type: string
          id: string
          payload: NonNullable<Json>
          source_id: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          dispatched_at?: string | null
          event_type: string
          id?: string
          payload?: NonNullable<Json>
          source_id?: string | null
        }
        Update: {
          created_at?: string
          dispatched_at?: string | null
          event_type?: string
          id?: string
          payload?: NonNullable<Json>
          source_id?: string | null
        }
        Relationships: []
      }
      parent_child_links: {
        Row: {
          active: boolean
          created_at: string
          id: string
          parent_user_id: string
          relationship_label: string
          student_id: string
          updated_at: string
          verified_by: string | null
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          parent_user_id: string
          relationship_label?: string
          student_id: string
          updated_at?: string
          verified_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          parent_user_id?: string
          relationship_label?: string
          student_id?: string
          updated_at?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_child_links_parent_user_id_fkey"
            columns: ["parent_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_child_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_child_links_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_notes: {
        Row: {
          class_id: string | null
          content: string
          created_at: string
          id: string
          parent_name: string
          parent_user_id: string
          recipient_teacher_id: string | null
          replied_at: string | null
          replied_by_name: string | null
          replied_by_user_id: string | null
          reply_content: string | null
          school_day: string
          status: string
          student_id: string
          student_name: string
          topic: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          class_id?: string | null
          content: string
          created_at?: string
          id?: string
          parent_name: string
          parent_user_id: string
          recipient_teacher_id?: string | null
          replied_at?: string | null
          replied_by_name?: string | null
          replied_by_user_id?: string | null
          reply_content?: string | null
          school_day: string
          status?: string
          student_id: string
          student_name: string
          topic: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          content?: string
          created_at?: string
          id?: string
          parent_name?: string
          parent_user_id?: string
          recipient_teacher_id?: string | null
          replied_at?: string | null
          replied_by_name?: string | null
          replied_by_user_id?: string | null
          reply_content?: string | null
          school_day?: string
          status?: string
          student_id?: string
          student_name?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_notes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_notes_parent_user_id_fkey"
            columns: ["parent_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_notes_recipient_teacher_id_fkey"
            columns: ["recipient_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_notes_replied_by_user_id_fkey"
            columns: ["replied_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_approval_status"]
          admission_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          governance_version: number
          id: string
          phone: string | null
          requested_role: Database["public"]["Enums"]["app_role"] | null
          staff_id: string | null
          status_reason: string | null
          status_reviewed_at: string | null
          status_reviewed_by: string | null
          updated_at: string
          username: string
          username_normalized: string | null
        }
        ComputedFields: never
        Insert: {
          account_status?: Database["public"]["Enums"]["account_approval_status"]
          admission_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          governance_version?: number
          id: string
          phone?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"] | null
          staff_id?: string | null
          status_reason?: string | null
          status_reviewed_at?: string | null
          status_reviewed_by?: string | null
          updated_at?: string
          username: string
          username_normalized?: never
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_approval_status"]
          admission_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          governance_version?: number
          id?: string
          phone?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"] | null
          staff_id?: string | null
          status_reason?: string | null
          status_reviewed_at?: string | null
          status_reviewed_by?: string | null
          updated_at?: string
          username?: string
          username_normalized?: never
        }
        Relationships: [
          {
            foreignKeyName: "profiles_status_reviewed_by_fkey"
            columns: ["status_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_school_inquiries: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          phone: string | null
          responded_at: string | null
          responded_by: string | null
          sender_name: string
          staff_response: string | null
          status: string
          subject: string
          submitted_by_user_id: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          phone?: string | null
          responded_at?: string | null
          responded_by?: string | null
          sender_name: string
          staff_response?: string | null
          status?: string
          subject: string
          submitted_by_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          phone?: string | null
          responded_at?: string | null
          responded_by?: string | null
          sender_name?: string
          staff_response?: string | null
          status?: string
          subject?: string
          submitted_by_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_school_inquiries_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_school_inquiries_submitted_by_user_id_fkey"
            columns: ["submitted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_assignments: {
        Row: {
          active: boolean
          assigned_by: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          assigned_by?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          assigned_by?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_broadcasts: {
        Row: {
          audience_scope: string
          author_name: string
          author_role: string
          body: string
          created_at: string
          created_by: string
          id: string
          is_public: boolean
          priority: string
          published_at: string | null
          status: string
          target_class_ids: string[]
          target_level_codes: string[]
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          audience_scope?: string
          author_name: string
          author_role: string
          body: string
          created_at?: string
          created_by: string
          id?: string
          is_public?: boolean
          priority?: string
          published_at?: string | null
          status?: string
          target_class_ids?: string[]
          target_level_codes?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          audience_scope?: string
          author_name?: string
          author_role?: string
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          is_public?: boolean
          priority?: string
          published_at?: string | null
          status?: string
          target_class_ids?: string[]
          target_level_codes?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_broadcasts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_calendar_event_targets: {
        Row: {
          class_id: string
          event_id: string
        }
        ComputedFields: never
        Insert: {
          class_id: string
          event_id: string
        }
        Update: {
          class_id?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_calendar_event_targets_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_calendar_event_targets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "school_calendar_event_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_calendar_event_targets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "school_calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      school_calendar_events: {
        Row: {
          audience_mode: string
          cancellation_reason: string | null
          category: string
          class_id: string | null
          created_at: string
          created_by: string
          description: string
          end_date: string
          end_time: string | null
          id: string
          is_all_day: boolean
          is_public: boolean
          start_date: string
          start_time: string | null
          status: string
          timezone: string
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          audience_mode?: string
          cancellation_reason?: string | null
          category?: string
          class_id?: string | null
          created_at?: string
          created_by: string
          description?: string
          end_date: string
          end_time?: string | null
          id?: string
          is_all_day?: boolean
          is_public?: boolean
          start_date: string
          start_time?: string | null
          status?: string
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          audience_mode?: string
          cancellation_reason?: string | null
          category?: string
          class_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          end_date?: string
          end_time?: string | null
          id?: string
          is_all_day?: boolean
          is_public?: boolean
          start_date?: string
          start_time?: string | null
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_calendar_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_calendar_responses: {
        Row: {
          event_id: string
          id: string
          response: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          event_id: string
          id?: string
          response: string
          updated_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          response?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_calendar_responses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "school_calendar_event_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_calendar_responses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "school_calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_calendar_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_classes: {
        Row: {
          academic_year_id: string
          capacity: number
          created_at: string
          created_by: string | null
          id: string
          is_archived: boolean
          level_code: string
          name: string
          room_label: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          academic_year_id: string
          capacity?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          level_code: string
          name: string
          room_label?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          capacity?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          level_code?: string
          name?: string
          room_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_classes_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_classes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_classes_level_code_fkey"
            columns: ["level_code"]
            isOneToOne: false
            referencedRelation: "school_levels"
            referencedColumns: ["code"]
          },
        ]
      }
      school_levels: {
        Row: {
          code: string
          label_ar: string
          label_en: string
          label_fr: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          code: string
          label_ar: string
          label_en: string
          label_fr: string
          sort_order: number
        }
        Update: {
          code?: string
          label_ar?: string
          label_en?: string
          label_fr?: string
          sort_order?: number
        }
        Relationships: []
      }
      school_public_content: {
        Row: {
          body_ar: string
          body_en: string
          body_fr: string
          is_published: boolean
          slug: string
          title_ar: string
          title_en: string
          title_fr: string
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          body_ar: string
          body_en: string
          body_fr: string
          is_published?: boolean
          slug: string
          title_ar: string
          title_en: string
          title_fr: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_ar?: string
          body_en?: string
          body_fr?: string
          is_published?: boolean
          slug?: string
          title_ar?: string
          title_en?: string
          title_fr?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_public_content_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_class_memberships: {
        Row: {
          academic_year_id: string
          assigned_by: string | null
          class_id: string
          created_at: string
          ended_at: string | null
          id: string
          started_at: string
          status: string
          student_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          academic_year_id: string
          assigned_by?: string | null
          class_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          assigned_by?: string | null
          class_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_class_memberships_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_memberships_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_memberships_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_memberships_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          birth_date: string
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          linked_profile_id: string | null
          safety_note: string | null
          status: string
          student_code: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          birth_date: string
          created_at?: string
          created_by?: string | null
          full_name: string
          id?: string
          linked_profile_id?: string | null
          safety_note?: string | null
          status?: string
          student_code: string
          updated_at?: string
        }
        Update: {
          birth_date?: string
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          linked_profile_id?: string | null
          safety_note?: string | null
          status?: string
          student_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_linked_profile_id_fkey"
            columns: ["linked_profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_class_assignments: {
        Row: {
          active: boolean
          assigned_by: string | null
          class_id: string
          created_at: string
          id: string
          is_homeroom: boolean
          teacher_user_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          assigned_by?: string | null
          class_id: string
          created_at?: string
          id?: string
          is_homeroom?: boolean
          teacher_user_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          assigned_by?: string | null
          class_id?: string
          created_at?: string
          id?: string
          is_homeroom?: boolean
          teacher_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_class_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_class_assignments_teacher_user_id_fkey"
            columns: ["teacher_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_identities: {
        Row: {
          created_at: string
          first_name: string | null
          language_code: string | null
          last_authenticated_at: string
          last_name: string | null
          telegram_user_id: number
          telegram_username: string | null
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          first_name?: string | null
          language_code?: string | null
          last_authenticated_at?: string
          last_name?: string | null
          telegram_user_id: number
          telegram_username?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          language_code?: string | null
          last_authenticated_at?: string
          last_name?: string | null
          telegram_user_id?: number
          telegram_username?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_name: string
          sender_user_id: string
          thread_id: string
        }
        ComputedFields: never
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_name: string
          sender_user_id: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_name?: string
          sender_user_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_participants: {
        Row: {
          id: string
          thread_id: string
          unread: boolean
          user_id: string
        }
        ComputedFields: never
        Insert: {
          id?: string
          thread_id: string
          unread?: boolean
          user_id: string
        }
        Update: {
          id?: string
          thread_id?: string
          unread?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          is_read: boolean
          read_at: string | null
          recipient_user_id: string
          target_ref_id: string | null
          target_tab: string | null
          title: string
        }
        ComputedFields: never
        Insert: {
          body: string
          category: string
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          recipient_user_id: string
          target_ref_id?: string | null
          target_tab?: string | null
          title: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          recipient_user_id?: string
          target_ref_id?: string | null
          target_tab?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          language: string
          notification_sound: string
          sound_muted: boolean
          theme: string
          updated_at: string
          user_id: string
          vibration_enabled: boolean
        }
        ComputedFields: never
        Insert: {
          language?: string
          notification_sound?: string
          sound_muted?: boolean
          theme?: string
          updated_at?: string
          user_id: string
          vibration_enabled?: boolean
        }
        Update: {
          language?: string
          notification_sound?: string
          sound_muted?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
          vibration_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      school_calendar_event_feed: {
        Row: {
          audience_mode: string | null
          cancellation_reason: string | null
          category: string | null
          class_id: string | null
          description: string | null
          end_date: string | null
          end_time: string | null
          id: string | null
          is_all_day: boolean | null
          is_public: boolean | null
          start_date: string | null
          start_time: string | null
          status: string | null
          target_class_ids: string[] | null
          timezone: string | null
          title: string | null
        }
        ComputedFields: never
        Insert: {
          audience_mode?: string | null
          cancellation_reason?: string | null
          category?: string | null
          class_id?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string | null
          is_all_day?: boolean | null
          is_public?: boolean | null
          start_date?: string | null
          start_time?: string | null
          status?: string | null
          target_class_ids?: never
          timezone?: string | null
          title?: string | null
        }
        Update: {
          audience_mode?: string | null
          cancellation_reason?: string | null
          category?: string | null
          class_id?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string | null
          is_all_day?: boolean | null
          is_public?: boolean | null
          start_date?: string | null
          start_time?: string | null
          status?: string | null
          target_class_ids?: never
          timezone?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_calendar_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_teacher_to_class: {
        Args: {
          p_active?: boolean
          p_class_id: string
          p_is_homeroom?: boolean
          p_teacher_user_id: string
        }
        Returns: Json
      }
      calendar_assert_audience: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      calendar_can_read_event: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      can_access_class: { Args: { p_class_id: string }; Returns: boolean }
      can_access_message_thread: {
        Args: { p_thread_id: string }
        Returns: boolean
      }
      can_access_student_record: {
        Args: { p_student_id: string }
        Returns: boolean
      }
      can_users_direct_message: {
        Args: { p_recipient_id: string; p_sender_id: string }
        Returns: boolean
      }
      cancel_school_calendar_event: {
        Args: { p_event_id: string; p_reason: string }
        Returns: {
          audience_mode: string
          cancellation_reason: string | null
          category: string
          class_id: string | null
          created_at: string
          created_by: string
          description: string
          end_date: string
          end_time: string | null
          id: string
          is_all_day: boolean
          is_public: boolean
          start_date: string
          start_time: string | null
          status: string
          timezone: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "school_calendar_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_telegram_account_link: {
        Args: {
          p_first_name: string
          p_language_code: string
          p_last_name: string
          p_telegram_user_id: number
          p_telegram_username: string
          p_verifier_hash: string
        }
        Returns: undefined
      }
      create_and_enroll_student: {
        Args: {
          p_birth_date: string
          p_class_id: string
          p_full_name: string
          p_linked_profile_id?: string
          p_parent_user_id?: string
          p_relationship_label?: string
          p_student_code: string
        }
        Returns: Json
      }
      create_class_announcement: {
        Args: {
          p_body: string
          p_class_id: string
          p_priority?: string
          p_title: string
        }
        Returns: {
          author_name: string
          author_role: string
          author_user_id: string
          body: string
          class_id: string
          created_at: string
          id: string
          priority: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "class_announcements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_class_homework: {
        Args: {
          p_class_id: string
          p_description: string
          p_due_date: string
          p_title: string
        }
        Returns: {
          author_user_id: string
          class_id: string
          created_at: string
          description: string
          due_date: string
          id: string
          teacher_name: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "class_homework_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_school_calendar_event: {
        Args: {
          p_audience_mode?: string
          p_category: string
          p_class_id?: string
          p_description: string
          p_end_date?: string
          p_is_all_day?: boolean
          p_is_public?: boolean
          p_start_date: string
          p_teacher_user_id?: string
          p_title: string
        }
        Returns: {
          audience_mode: string
          cancellation_reason: string | null
          category: string
          class_id: string | null
          created_at: string
          created_by: string
          description: string
          end_date: string
          end_time: string | null
          id: string
          is_all_day: boolean
          is_public: boolean
          start_date: string
          start_time: string | null
          status: string
          timezone: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "school_calendar_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_school_class: {
        Args: {
          p_academic_year_code: string
          p_capacity?: number
          p_level_code: string
          p_name: string
          p_room_label?: string
        }
        Returns: Json
      }
      current_profile_id: { Args: Record<PropertyKey, never>; Returns: string }
      current_user_has_capability: {
        Args: { p_capability: string }
        Returns: boolean
      }
      current_user_has_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      dearmor: { Args: { "": string }; Returns: string }
      enqueue_school_notification: {
        Args: {
          p_body: string
          p_category: string
          p_recipient_user_id: string
          p_target_ref_id?: string
          p_target_tab?: string
          p_title: string
        }
        Returns: string
      }
      gen_random_uuid: { Args: Record<PropertyKey, never>; Returns: string }
      gen_salt: { Args: { "": string }; Returns: string }
      get_my_school_context: { Args: Record<PropertyKey, never>; Returns: Json }
      governance_appoint_privileged_role: {
        Args: {
          p_action: string
          p_confirmed?: boolean
          p_expected_version: number
          p_reason: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_target_user_id: string
        }
        Returns: Json
      }
      governance_get_account_detail: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      governance_get_actor_scope: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      governance_list_account_directory: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_role?: Database["public"]["Enums"]["app_role"]
          p_search?: string
          p_status?: Database["public"]["Enums"]["account_approval_status"]
        }
        Returns: Json
      }
      governance_list_manager_grants: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      governance_list_pending_accounts: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_requested_role?: Database["public"]["Enums"]["app_role"]
          p_search?: string
        }
        Returns: Json
      }
      governance_resolve_caller_role: {
        Args: { p_require_owner?: boolean }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      governance_review_account: {
        Args: {
          p_assigned_role?: Database["public"]["Enums"]["app_role"]
          p_decision: string
          p_expected_version?: number
          p_idempotency_key?: string
          p_reason?: string
          p_target_user_id: string
        }
        Returns: Json
      }
      governance_set_manager_capability: {
        Args: {
          p_active: boolean
          p_capability: string
          p_manager_user_id: string
          p_reason: string
        }
        Returns: Json
      }
      is_allowed_username_codepoint: { Args: { cp: number }; Returns: boolean }
      is_approved_school_member: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_linked_student_self: {
        Args: { p_student_id: string }
        Returns: boolean
      }
      is_username_letter_or_digit_codepoint: {
        Args: { cp: number }
        Returns: boolean
      }
      is_username_mark_codepoint: { Args: { cp: number }; Returns: boolean }
      is_username_separator_codepoint: {
        Args: { cp: number }
        Returns: boolean
      }
      is_valid_username: { Args: { input: string }; Returns: boolean }
      list_approved_message_recipients: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      list_school_classes_with_rosters: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      mark_all_user_notifications_read: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      mark_user_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      moderate_class_question: {
        Args: { p_hidden: boolean; p_question_id: string }
        Returns: {
          author_name: string
          author_user_id: string
          class_id: string
          content: string
          created_at: string
          id: string
          is_hidden: boolean
          moderated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "class_questions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      normalize_username_display: { Args: { input: string }; Returns: string }
      normalize_username_key: { Args: { input: string }; Returns: string }
      pgp_armor_headers: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      post_class_question: {
        Args: { p_class_id: string; p_content: string }
        Returns: {
          author_name: string
          author_user_id: string
          class_id: string
          content: string
          created_at: string
          id: string
          is_hidden: boolean
          moderated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "class_questions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_school_broadcast: {
        Args: {
          p_audience_scope?: string
          p_body: string
          p_is_public?: boolean
          p_priority?: string
          p_target_class_ids?: string[]
          p_target_level_codes?: string[]
          p_title: string
        }
        Returns: {
          audience_scope: string
          author_name: string
          author_role: string
          body: string
          created_at: string
          created_by: string
          id: string
          is_public: boolean
          priority: string
          published_at: string | null
          status: string
          target_class_ids: string[]
          target_level_codes: string[]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "school_broadcasts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reply_class_question: {
        Args: { p_content: string; p_question_id: string }
        Returns: {
          author_name: string
          author_user_id: string
          content: string
          created_at: string
          id: string
          is_hidden: boolean
          question_id: string
        }
        SetofOptions: {
          from: "*"
          to: "class_question_replies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reply_operational_thread: {
        Args: { p_content: string; p_thread_id: string }
        Returns: {
          content: string
          created_at: string
          id: string
          sender_name: string
          sender_user_id: string
          thread_id: string
        }
        SetofOptions: {
          from: "*"
          to: "thread_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reply_parent_note: {
        Args: { p_note_id: string; p_reply_content: string }
        Returns: {
          class_id: string | null
          content: string
          created_at: string
          id: string
          parent_name: string
          parent_user_id: string
          recipient_teacher_id: string | null
          replied_at: string | null
          replied_by_name: string | null
          replied_by_user_id: string | null
          reply_content: string | null
          school_day: string
          status: string
          student_id: string
          student_name: string
          topic: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "parent_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_public_inquiry: {
        Args: {
          p_inquiry_id: string
          p_staff_response: string
          p_status: string
        }
        Returns: Json
      }
      respond_to_calendar_event: {
        Args: { p_event_id: string; p_response: string }
        Returns: {
          event_id: string
          id: string
          response: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "school_calendar_responses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_enrollment_application: {
        Args: {
          p_application_id: string
          p_decision: string
          p_expected_version?: number
          p_review_note?: string
        }
        Returns: Json
      }
      save_food_menu_week: {
        Args: { p_days: Json; p_publish?: boolean; p_week_range: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          provider_name: string
          status: string
          updated_at: string
          week_end: string | null
          week_range: string
          week_start: string | null
        }
        SetofOptions: {
          from: "*"
          to: "food_menu_weeks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_operational_message: {
        Args: {
          p_content: string
          p_recipient_user_id: string
          p_subject: string
        }
        Returns: Json
      }
      send_parent_note: {
        Args: { p_content: string; p_student_id: string; p_topic: string }
        Returns: Json
      }
      submit_enrollment_application: {
        Args: {
          p_birth_date: string
          p_desired_level_code: string
          p_email?: string
          p_notes?: string
          p_parent_full_name: string
          p_phone: string
          p_student_full_name: string
        }
        Returns: Json
      }
      submit_public_inquiry: {
        Args: {
          p_email: string
          p_message: string
          p_phone: string
          p_sender_name: string
          p_subject: string
        }
        Returns: Json
      }
      upsert_directory_entry: {
        Args: {
          p_bio?: string
          p_display_name?: string
          p_entry_type?: string
          p_id?: string
          p_is_published?: boolean
          p_languages?: string[]
          p_photo_url?: string
          p_tags?: string[]
          p_title?: string
        }
        Returns: {
          bio: string
          created_at: string
          created_by: string | null
          display_name: string
          entry_type: string
          id: string
          is_published: boolean
          languages: string[]
          photo_url: string
          sort_order: number
          tags: string[]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "directory_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_my_preferences: {
        Args: {
          p_language?: string
          p_notification_sound?: string
          p_sound_muted?: boolean
          p_theme?: string
          p_vibration_enabled?: boolean
        }
        Returns: {
          language: string
          notification_sound: string
          sound_muted: boolean
          theme: string
          updated_at: string
          user_id: string
          vibration_enabled: boolean
        }
        SetofOptions: {
          from: "*"
          to: "user_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_school_calendar_event: {
        Args: {
          p_category: string
          p_class_id?: string
          p_description: string
          p_end_date?: string
          p_is_all_day?: boolean
          p_is_public?: boolean
          p_start_date: string
          p_title: string
        }
        Returns: {
          audience_mode: string
          cancellation_reason: string | null
          category: string
          class_id: string | null
          created_at: string
          created_by: string
          description: string
          end_date: string
          end_time: string | null
          id: string
          is_all_day: boolean
          is_public: boolean
          start_date: string
          start_time: string | null
          status: string
          timezone: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "school_calendar_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      account_approval_status:
        | "PENDING"
        | "APPROVED"
        | "REJECTED"
        | "SUSPENDED"
        | "REVOKED"
      app_role:
        | "APP_ADMIN"
        | "MANAGER"
        | "PARENT"
        | "STUDENT"
        | "TEACHER"
        | "SCHOOL_STAFF"
        | "ADMINISTRATIVE_PERSONNEL"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_approval_status: [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "SUSPENDED",
        "REVOKED",
      ],
      app_role: [
        "APP_ADMIN",
        "MANAGER",
        "PARENT",
        "STUDENT",
        "TEACHER",
        "SCHOOL_STAFF",
        "ADMINISTRATIVE_PERSONNEL",
      ],
    },
  },
} as const
