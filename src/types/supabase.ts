// ============================================================
// Supabase Database Types
// Generated for LoopWise Round 2
// ============================================================

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          email: string | null
          role: 'student' | 'eco-club'
          points: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          role: 'student' | 'eco-club'
          points?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          role?: 'student' | 'eco-club'
          points?: number
          created_at?: string
        }
      }
      observations: {
        Row: {
          id: string
          plastic_category: string
          location: string
          description: string | null
          photo_storage_path: string | null
          photo_phash: string | null
          flagged_for_review: boolean
          points_awarded: number
          reporter_id: string | null
          ai_category: string | null
          ai_confidence: number | null
          created_at: string
        }
        Insert: {
          id?: string
          plastic_category: string
          location: string
          description?: string | null
          photo_storage_path?: string | null
          photo_phash?: string | null
          flagged_for_review?: boolean
          points_awarded?: number
          reporter_id?: string | null
          ai_category?: string | null
          ai_confidence?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          plastic_category?: string
          location?: string
          description?: string | null
          photo_storage_path?: string | null
          photo_phash?: string | null
          flagged_for_review?: boolean
          points_awarded?: number
          reporter_id?: string | null
          ai_category?: string | null
          ai_confidence?: number | null
          created_at?: string
        }
      }
      reduction_actions: {
        Row: {
          id: string
          title: string
          description: string | null
          status: 'suggested' | 'adopted' | 'active' | 'completed'
          linked_hotspot_location: string | null
          linked_hotspot_category: string | null
          source_suggestion_id: string | null
          created_by: string | null
          assigned_to: string | null
          start_date: string | null
          completed_date: string | null
          notes: string[]
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: 'suggested' | 'adopted' | 'active' | 'completed'
          linked_hotspot_location?: string | null
          linked_hotspot_category?: string | null
          source_suggestion_id?: string | null
          created_by?: string | null
          assigned_to?: string | null
          start_date?: string | null
          completed_date?: string | null
          notes?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: 'suggested' | 'adopted' | 'active' | 'completed'
          linked_hotspot_location?: string | null
          linked_hotspot_category?: string | null
          source_suggestion_id?: string | null
          created_by?: string | null
          assigned_to?: string | null
          start_date?: string | null
          completed_date?: string | null
          notes?: string[]
          created_at?: string
        }
      }
      action_feedback: {
        Row: {
          id: string
          action_id: string
          sentiment: 'positive' | 'neutral' | 'negative' | null
          comment: string | null
          photo_storage_path: string | null
          location: string | null
          reporter_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          action_id: string
          sentiment?: 'positive' | 'neutral' | 'negative' | null
          comment?: string | null
          photo_storage_path?: string | null
          location?: string | null
          reporter_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          action_id?: string
          sentiment?: 'positive' | 'neutral' | 'negative' | null
          comment?: string | null
          photo_storage_path?: string | null
          location?: string | null
          reporter_id?: string | null
          created_at?: string
        }
      }
      student_suggestions: {
        Row: {
          id: string
          title: string
          explanation: string | null
          related_location: string | null
          status: 'pending' | 'adopted' | 'dismissed'
          reporter_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          explanation?: string | null
          related_location?: string | null
          status?: 'pending' | 'adopted' | 'dismissed'
          reporter_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          explanation?: string | null
          related_location?: string | null
          status?: 'pending' | 'adopted' | 'dismissed'
          reporter_id?: string | null
          created_at?: string
        }
      }
      points_log: {
        Row: {
          id: string
          user_id: string
          points: number
          reason: string
          reference_id: string
          reference_type: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          points: number
          reason: string
          reference_id: string
          reference_type: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          points?: number
          reason?: string
          reference_id?: string
          reference_type?: string
          created_at?: string
        }
      }
      daily_checkins: {
        Row: {
          id: string
          user_id: string
          checkin_type: string
          checkin_date: string
          observation_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          checkin_type: string
          checkin_date: string
          observation_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          checkin_type?: string
          checkin_date?: string
          observation_id?: string | null
          created_at?: string
        }
      }
      campus_locations: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          name: string
          role: string
          department: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          role: string
          department?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          role?: string
          department?: string | null
          created_at?: string
        }
      }
      plastic_logs: {
        Row: {
          id: string
          user_id: string
          location_id: string
          item_name: string
          category: string
          quantity: number
          estimated_weight_g: number
          image_url: string | null
          source: string
          logged_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          location_id: string
          item_name: string
          category: string
          quantity: number
          estimated_weight_g: number
          image_url?: string | null
          source?: string
          logged_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          location_id?: string
          item_name?: string
          category?: string
          quantity?: number
          estimated_weight_g?: number
          image_url?: string | null
          source?: string
          logged_at?: string
          created_at?: string
        }
      }
      reuse_listings: {
        Row: {
          id: string
          owner_id: string
          item_name: string
          description: string
          quantity: number
          condition: string
          location_id: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          item_name: string
          description: string
          quantity: number
          condition: string
          location_id: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          item_name?: string
          description?: string
          quantity?: number
          condition?: string
          location_id?: string
          status?: string
          created_at?: string
        }
      }
      reuse_requests: {
        Row: {
          id: string
          listing_id: string
          requester_id: string
          quantity: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          listing_id: string
          requester_id: string
          quantity: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          listing_id?: string
          requester_id?: string
          quantity?: number
          status?: string
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
