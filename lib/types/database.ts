export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      requests: {
        Row: {
          id: string
          coordinator_id: string
          asana_task_id: string | null
          asana_task_url: string | null
          source: string
          status: string
          student_name: string
          student_email: string
          subject: string | null
          requested_schedule: Json | null
          timezone: string | null
          start_date: string | null
          notes: string | null
          matched_proposal_id: string | null
          offered_rate: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          coordinator_id: string
          asana_task_id?: string | null
          asana_task_url?: string | null
          source?: string
          status?: string
          student_name: string
          student_email?: string
          subject?: string | null
          requested_schedule?: Json | null
          timezone?: string | null
          start_date?: string | null
          notes?: string | null
          matched_proposal_id?: string | null
          offered_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          coordinator_id?: string
          asana_task_id?: string | null
          asana_task_url?: string | null
          source?: string
          status?: string
          student_name?: string
          student_email?: string
          subject?: string | null
          requested_schedule?: Json | null
          timezone?: string | null
          start_date?: string | null
          notes?: string | null
          matched_proposal_id?: string | null
          offered_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_matched_proposal_id_fkey"
            columns: ["matched_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          asana_task_id: string | null
          coordinator_id: string | null
          created_at: string
          decline_reason: string | null
          expires_at: string
          id: string
          notes: string | null
          nylas_event_id: string | null
          requested_schedule: Json
          resolved_at: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          student_email: string
          student_name: string
          subject: string
          timezone: string
          tutor_id: string | null
        }
        Insert: {
          asana_task_id?: string | null
          coordinator_id?: string | null
          created_at?: string
          decline_reason?: string | null
          expires_at?: string
          id?: string
          notes?: string | null
          nylas_event_id?: string | null
          requested_schedule?: Json
          resolved_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          student_email: string
          student_name: string
          subject: string
          timezone: string
          tutor_id?: string | null
        }
        Update: {
          asana_task_id?: string | null
          coordinator_id?: string | null
          created_at?: string
          decline_reason?: string | null
          expires_at?: string
          id?: string
          notes?: string | null
          nylas_event_id?: string | null
          requested_schedule?: Json
          resolved_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          student_email?: string
          student_name?: string
          subject?: string
          timezone?: string
          tutor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      tutor_context: {
        Row: {
          context: Json
          id: string
          tutor_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          context?: Json
          id?: string
          tutor_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          context?: Json
          id?: string
          tutor_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_context_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_context_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_subject_changes: {
        Row: {
          id: string
          tutor_id: string
          subject_id: string
          tutor_subject_id: string | null
          change_type: string
          requested_confidence: string | null
          requested_note: string | null
          status: string
          reviewed_by: string | null
          reviewed_at: string | null
          decline_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tutor_id: string
          subject_id: string
          tutor_subject_id?: string | null
          change_type: string
          requested_confidence?: string | null
          requested_note?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          decline_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tutor_id?: string
          subject_id?: string
          tutor_subject_id?: string | null
          change_type?: string
          requested_confidence?: string | null
          requested_note?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          decline_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_subject_changes_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_subject_changes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_subject_changes_tutor_subject_id_fkey"
            columns: ["tutor_subject_id"]
            isOneToOne: false
            referencedRelation: "tutor_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_subjects: {
        Row: {
          coordinator_confidence: string
          created_at: string
          graded_by: string | null
          id: string
          qualification_note: string | null
          subject_id: string
          tutor_confidence: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          coordinator_confidence?: string
          created_at?: string
          graded_by?: string | null
          id?: string
          qualification_note?: string | null
          subject_id: string
          tutor_confidence?: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          coordinator_confidence?: string
          created_at?: string
          graded_by?: string | null
          id?: string
          qualification_note?: string | null
          subject_id?: string
          tutor_confidence?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_subjects_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_subjects_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          asana_access_token: string | null
          asana_project_id: string | null
          bio: string | null
          booking_page_url: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          max_weekly_hours: number
          meeting_link: string | null
          min_rate: number
          min_weekly_hours: number
          name: string
          nylas_grant_id: string | null
          nylas_scheduler_config_id: string | null
          photo_url: string | null
          region: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          timezone: string | null
          updated_at: string
        }
        Insert: {
          asana_access_token?: string | null
          asana_project_id?: string | null
          bio?: string | null
          booking_page_url?: string | null
          created_at?: string
          email: string
          id: string
          invited_by?: string | null
          max_weekly_hours: number
          meeting_link?: string | null
          min_rate?: number
          min_weekly_hours?: number
          name: string
          nylas_grant_id?: string | null
          nylas_scheduler_config_id?: string | null
          photo_url?: string | null
          region?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          asana_access_token?: string | null
          asana_project_id?: string | null
          bio?: string | null
          booking_page_url?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          max_weekly_hours?: number
          meeting_link?: string | null
          min_rate?: number
          min_weekly_hours?: number
          name?: string
          nylas_grant_id?: string | null
          nylas_scheduler_config_id?: string | null
          photo_url?: string | null
          region?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_role: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      confidence_level: "HIGH" | "MEDIUM" | "UNPROVEN" | "LOW"
      proposal_status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED"
      user_role: "SUPER_ADMIN" | "COORDINATOR" | "TUTOR"
      user_status: "PENDING" | "ACTIVE" | "DISABLED"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      confidence_level: ["HIGH", "MEDIUM", "UNPROVEN", "LOW"],
      proposal_status: ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED"],
      user_role: ["SUPER_ADMIN", "COORDINATOR", "TUTOR"],
      user_status: ["PENDING", "ACTIVE", "DISABLED"],
    },
  },
} as const
