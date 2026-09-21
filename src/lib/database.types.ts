// INTERIM: hand-generated from supabase/schema.sql (the source of truth).
// Replace with the generated output once the schema is applied and the Supabase CLI is authenticated:
//   npx supabase gen types typescript --project-id nfikkjuuzwphswutocao --schema public > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string
          name: string
          type: string
          location: string
          lot_area_sqm: number | null
          price: number | null
          description: string | null
          image_url: string | null
          is_pinned: boolean
          map_pins: Json
          created_at: string
          sold_by: string | null
          sold_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: string
          location: string
          lot_area_sqm?: number | null
          price?: number | null
          description?: string | null
          image_url?: string | null
          is_pinned?: boolean
          map_pins?: Json
          created_at?: string
          sold_by?: string | null
          sold_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          location?: string
          lot_area_sqm?: number | null
          price?: number | null
          description?: string | null
          image_url?: string | null
          is_pinned?: boolean
          map_pins?: Json
          created_at?: string
          sold_by?: string | null
          sold_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_sold_by_fkey"
            columns: ["sold_by"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          id: string
          name: string
          email: string
          phone: string
          project_type: string | null
          message: string
          property_id: string | null
          property_name: string | null
          is_read: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone: string
          project_type?: string | null
          message: string
          property_id?: string | null
          property_name?: string | null
          is_read?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string
          project_type?: string | null
          message?: string
          property_id?: string | null
          property_name?: string | null
          is_read?: boolean
          created_at?: string
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
      agents: {
        Row: {
          id: string
          user_id: string | null
          email: string
          name: string
          phone: string | null
          role: string
          upline_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          email: string
          name: string
          phone?: string | null
          role?: string
          upline_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          email?: string
          name?: string
          phone?: string | null
          role?: string
          upline_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
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
      commission_settings: {
        Row: {
          id: string
          role: string
          rate: number
          updated_at: string
        }
        Insert: {
          id?: string
          role: string
          rate?: number
          updated_at?: string
        }
        Update: {
          id?: string
          role?: string
          rate?: number
          updated_at?: string
        }
        Relationships: [
        ]
      }
      commissions: {
        Row: {
          id: string
          property_id: string
          agent_id: string
          role_at_sale: string
          sale_price: number
          rate: number
          amount: number
          status: string
          paid_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          property_id: string
          agent_id: string
          role_at_sale: string
          sale_price: number
          rate: number
          amount: number
          status?: string
          paid_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          agent_id?: string
          role_at_sale?: string
          sale_price?: number
          rate?: number
          amount?: number
          status?: string
          paid_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          action: string
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id: string
          action: string
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          entity_type?: string
          entity_id?: string
          action?: string
          details?: Json | null
          created_at?: string
        }
        Relationships: [
        ]
      }
      cms_content: {
        Row: {
          id: string
          page_id: string
          title: string | null
          subtitle: string | null
          content: string | null
          image_url: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          page_id: string
          title?: string | null
          subtitle?: string | null
          content?: string | null
          image_url?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          page_id?: string
          title?: string | null
          subtitle?: string | null
          content?: string | null
          image_url?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      notification_settings: {
        Row: {
          id: string
          notification_type: string
          enabled: boolean
          subject_template: string | null
          body_template: string | null
          recipients: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          notification_type: string
          enabled?: boolean
          subject_template?: string | null
          body_template?: string | null
          recipients?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          notification_type?: string
          enabled?: boolean
          subject_template?: string | null
          body_template?: string | null
          recipients?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      notification_history: {
        Row: {
          id: string
          notification_type: string
          recipient: string
          subject: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          notification_type: string
          recipient: string
          subject?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          notification_type?: string
          recipient?: string
          subject?: string | null
          status?: string
          created_at?: string
        }
        Relationships: [
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
