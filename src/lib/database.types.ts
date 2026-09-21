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
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      agents: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          role: string
          updated_at: string
          upline_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          role?: string
          updated_at?: string
          upline_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          role?: string
          updated_at?: string
          upline_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_upline_id_fkey"
            columns: ["upline_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_content: {
        Row: {
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          page_id: string
          status: string
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          page_id: string
          status?: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          page_id?: string
          status?: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      commission_settings: {
        Row: {
          id: string
          rate: number
          role: string
          updated_at: string
        }
        Insert: {
          id?: string
          rate?: number
          role: string
          updated_at?: string
        }
        Update: {
          id?: string
          rate?: number
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          agent_id: string
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          property_id: string
          rate: number
          role_at_sale: string
          sale_price: number
          status: string
        }
        Insert: {
          agent_id: string
          amount: number
          created_at?: string
          id?: string
          paid_at?: string | null
          property_id: string
          rate: number
          role_at_sale: string
          sale_price: number
          status?: string
        }
        Update: {
          agent_id?: string
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          property_id?: string
          rate?: number
          role_at_sale?: string
          sale_price?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean
          message: string
          name: string
          phone: string
          project_type: string | null
          property_id: string | null
          property_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean
          message: string
          name: string
          phone: string
          project_type?: string | null
          property_id?: string | null
          property_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean
          message?: string
          name?: string
          phone?: string
          project_type?: string | null
          property_id?: string | null
          property_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_history: {
        Row: {
          created_at: string
          id: string
          notification_type: string
          recipient: string
          status: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notification_type: string
          recipient: string
          status?: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notification_type?: string
          recipient?: string
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          body_template: string | null
          created_at: string
          enabled: boolean
          id: string
          notification_type: string
          recipients: string[] | null
          subject_template: string | null
          updated_at: string
        }
        Insert: {
          body_template?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          notification_type: string
          recipients?: string[] | null
          subject_template?: string | null
          updated_at?: string
        }
        Update: {
          body_template?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          notification_type?: string
          recipients?: string[] | null
          subject_template?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_commission_rates: {
        Row: {
          id: string
          project_id: string
          rate: number
          role: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          rate?: number
          role: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          rate?: number
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_commission_rates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string
          created_at: string
          id: string
          name: string
          price_per_sqm: number
          type: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          name: string
          price_per_sqm?: number
          type?: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          name?: string
          price_per_sqm?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          block_no: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_pinned: boolean
          location: string
          lot_area_sqm: number | null
          lot_no: string | null
          map_pins: Json
          name: string
          price: number | null
          project_id: string | null
          sold_at: string | null
          sold_by: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          block_no?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          location: string
          lot_area_sqm?: number | null
          lot_no?: string | null
          map_pins?: Json
          name: string
          price?: number | null
          project_id?: string | null
          sold_at?: string | null
          sold_by?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          block_no?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          location?: string
          lot_area_sqm?: number | null
          lot_no?: string | null
          map_pins?: Json
          name?: string
          price?: number | null
          project_id?: string | null
          sold_at?: string | null
          sold_by?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_sold_by_fkey"
            columns: ["sold_by"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_agent_id: { Args: never; Returns: string }
      get_downline: { Args: { root: string }; Returns: string[] }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
