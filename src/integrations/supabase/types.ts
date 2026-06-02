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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          record_id: string | null
          table_name: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      behaviors: {
        Row: {
          action_description: string
          alignment_score: number | null
          created_at: string
          deputy_id: string
          id: string
          intent_id: string
          notes: string | null
          resources_used: number
          result_score: number | null
          time_spent: number
        }
        Insert: {
          action_description: string
          alignment_score?: number | null
          created_at?: string
          deputy_id: string
          id?: string
          intent_id: string
          notes?: string | null
          resources_used?: number
          result_score?: number | null
          time_spent?: number
        }
        Update: {
          action_description?: string
          alignment_score?: number | null
          created_at?: string
          deputy_id?: string
          id?: string
          intent_id?: string
          notes?: string | null
          resources_used?: number
          result_score?: number | null
          time_spent?: number
        }
        Relationships: [
          {
            foreignKeyName: "behaviors_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "strategic_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      bet_allocations: {
        Row: {
          bet_id: string
          coins: number
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          bet_id: string
          coins?: number
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          bet_id?: string
          coins?: number
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bet_allocations_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "strategic_bets"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          auto_headhunting: boolean | null
          city: string | null
          created_at: string
          education_level: string | null
          experience_range: string | null
          id: string
          industry: string | null
          job_title: string | null
          name: string
          progress: number
          skills: string[] | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_headhunting?: boolean | null
          city?: string | null
          created_at?: string
          education_level?: string | null
          experience_range?: string | null
          id?: string
          industry?: string | null
          job_title?: string | null
          name: string
          progress?: number
          skills?: string[] | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_headhunting?: boolean | null
          city?: string | null
          created_at?: string
          education_level?: string | null
          experience_range?: string | null
          id?: string
          industry?: string | null
          job_title?: string | null
          name?: string
          progress?: number
          skills?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      candidates: {
        Row: {
          campaign_id: string
          candidate_temperature: string | null
          created_at: string
          education: string | null
          email: string | null
          experience: string | null
          green_flags: string[] | null
          id: string
          last_company: string | null
          layer_scores: Json | null
          location: string | null
          match_score: number | null
          name: string | null
          phone: string | null
          raw_data: Json | null
          recommendation: string | null
          red_flags: string[] | null
          skills: string | null
          status: string
          title: string | null
        }
        Insert: {
          campaign_id: string
          candidate_temperature?: string | null
          created_at?: string
          education?: string | null
          email?: string | null
          experience?: string | null
          green_flags?: string[] | null
          id?: string
          last_company?: string | null
          layer_scores?: Json | null
          location?: string | null
          match_score?: number | null
          name?: string | null
          phone?: string | null
          raw_data?: Json | null
          recommendation?: string | null
          red_flags?: string[] | null
          skills?: string | null
          status?: string
          title?: string | null
        }
        Update: {
          campaign_id?: string
          candidate_temperature?: string | null
          created_at?: string
          education?: string | null
          email?: string | null
          experience?: string | null
          green_flags?: string[] | null
          id?: string
          last_company?: string | null
          layer_scores?: Json | null
          location?: string | null
          match_score?: number | null
          name?: string | null
          phone?: string | null
          raw_data?: Json | null
          recommendation?: string | null
          red_flags?: string[] | null
          skills?: string | null
          status?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string | null
          credit_pool: number | null
          credit_pool_enabled: boolean | null
          domain: string | null
          id: string
          last_credit_reset: string | null
          max_members: number
          monthly_credits: number
          name: string
          status: Database["public"]["Enums"]["company_status"]
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          used_credits: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_pool?: number | null
          credit_pool_enabled?: boolean | null
          domain?: string | null
          id?: string
          last_credit_reset?: string | null
          max_members?: number
          monthly_credits?: number
          name: string
          status?: Database["public"]["Enums"]["company_status"]
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          used_credits?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_pool?: number | null
          credit_pool_enabled?: boolean | null
          domain?: string | null
          id?: string
          last_credit_reset?: string | null
          max_members?: number
          monthly_credits?: number
          name?: string
          status?: Database["public"]["Enums"]["company_status"]
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          used_credits?: number
        }
        Relationships: []
      }
      company_invites: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          invite_code: string
          is_active: boolean
          max_uses: number | null
          role: Database["public"]["Enums"]["company_role"]
          used_count: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          invite_code: string
          is_active?: boolean
          max_uses?: number | null
          role?: Database["public"]["Enums"]["company_role"]
          used_count?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          invite_code?: string
          is_active?: boolean
          max_uses?: number | null
          role?: Database["public"]["Enums"]["company_role"]
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          can_invite: boolean
          company_id: string
          id: string
          invited_by: string | null
          is_active: boolean
          joined_at: string
          role: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Insert: {
          can_invite?: boolean
          company_id: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["company_role"]
          user_id: string
        }
        Update: {
          can_invite?: boolean
          company_id?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["company_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      compass_user_roles: {
        Row: {
          accessible_sections: string[] | null
          can_edit: boolean
          created_at: string
          diamonds: number
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["compass_role"]
          title: string | null
          user_id: string
        }
        Insert: {
          accessible_sections?: string[] | null
          can_edit?: boolean
          created_at?: string
          diamonds?: number
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["compass_role"]
          title?: string | null
          user_id: string
        }
        Update: {
          accessible_sections?: string[] | null
          can_edit?: boolean
          created_at?: string
          diamonds?: number
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["compass_role"]
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          description: string | null
          feature_key: string | null
          id: string
          transaction_type: string
          user_id: string | null
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string
          description?: string | null
          feature_key?: string | null
          id?: string
          transaction_type: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          description?: string | null
          feature_key?: string | null
          id?: string
          transaction_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_journals: {
        Row: {
          behavior_id: string
          created_at: string
          id: string
          rejected_options: string
          risk_prediction: string
          supporting_data: string
        }
        Insert: {
          behavior_id: string
          created_at?: string
          id?: string
          rejected_options: string
          risk_prediction: string
          supporting_data: string
        }
        Update: {
          behavior_id?: string
          created_at?: string
          id?: string
          rejected_options?: string
          risk_prediction?: string
          supporting_data?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_journals_behavior_id_fkey"
            columns: ["behavior_id"]
            isOneToOne: true
            referencedRelation: "behaviors"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          download_count: number
          file_path: string | null
          id: string
          is_active: boolean
          name: string
          payment_link: string | null
          price: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          download_count?: number
          file_path?: string | null
          id?: string
          is_active?: boolean
          name: string
          payment_link?: string | null
          price?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          download_count?: number
          file_path?: string | null
          id?: string
          is_active?: boolean
          name?: string
          payment_link?: string | null
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      feature_permissions: {
        Row: {
          allow_edit: boolean
          allow_view: boolean
          allowed_company_roles:
            | Database["public"]["Enums"]["company_role"][]
            | null
          allowed_tiers: Database["public"]["Enums"]["subscription_tier"][]
          created_at: string
          credit_cost: number
          description: string | null
          feature_category: string
          feature_key: string
          feature_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          allow_edit?: boolean
          allow_view?: boolean
          allowed_company_roles?:
            | Database["public"]["Enums"]["company_role"][]
            | null
          allowed_tiers?: Database["public"]["Enums"]["subscription_tier"][]
          created_at?: string
          credit_cost?: number
          description?: string | null
          feature_category?: string
          feature_key: string
          feature_name: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          allow_edit?: boolean
          allow_view?: boolean
          allowed_company_roles?:
            | Database["public"]["Enums"]["company_role"][]
            | null
          allowed_tiers?: Database["public"]["Enums"]["subscription_tier"][]
          created_at?: string
          credit_cost?: number
          description?: string | null
          feature_category?: string
          feature_key?: string
          feature_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      hr_uploads: {
        Row: {
          created_at: string
          data: Json
          employee_count: number
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          employee_count?: number
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          employee_count?: number
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      intent_assignments: {
        Row: {
          created_at: string
          id: string
          intent_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intent_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intent_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intent_assignments_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "strategic_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_path_records: {
        Row: {
          created_at: string
          education_level: string
          employee_email: string | null
          employee_name: string
          experience_years: number
          field_of_study: string | null
          id: string
          industry: string
          job_title: string
          result: Json
          seniority_level: string
          training_months: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          education_level: string
          employee_email?: string | null
          employee_name: string
          experience_years: number
          field_of_study?: string | null
          id?: string
          industry: string
          job_title: string
          result: Json
          seniority_level: string
          training_months?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          education_level?: string
          employee_email?: string | null
          employee_name?: string
          experience_years?: number
          field_of_study?: string | null
          id?: string
          industry?: string
          job_title?: string
          result?: Json
          seniority_level?: string
          training_months?: number | null
          user_id?: string
        }
        Relationships: []
      }
      legal_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      legal_docs: {
        Row: {
          article_number: string | null
          category: string
          content: string
          created_at: string
          embedding: string | null
          id: string
          source_url: string
          updated_at: string
        }
        Insert: {
          article_number?: string | null
          category: string
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          source_url: string
          updated_at?: string
        }
        Update: {
          article_number?: string | null
          category?: string
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          source_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_messages: {
        Row: {
          attachments: Json | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          sources: Json | null
        }
        Insert: {
          attachments?: Json | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          sources?: Json | null
        }
        Update: {
          attachments?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          sources?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "legal_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          authority: string | null
          company_id: string | null
          created_at: string
          description: string | null
          gateway: string
          id: string
          plan_type: string
          ref_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          authority?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          gateway?: string
          id?: string
          plan_type: string
          ref_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          authority?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          gateway?: string
          id?: string
          plan_type?: string
          ref_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string | null
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          published?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          last_credit_reset: string | null
          monthly_credits: number
          subscription_tier:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          title: string | null
          used_credits: number
          user_type: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          last_credit_reset?: string | null
          monthly_credits?: number
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          title?: string | null
          used_credits?: number
          user_type?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_credit_reset?: string | null
          monthly_credits?: number
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          title?: string | null
          used_credits?: number
          user_type?: string
        }
        Relationships: []
      }
      scenario_responses: {
        Row: {
          answer: string
          created_at: string
          id: string
          scenario_id: string
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          scenario_id: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          scenario_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_responses_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      scenarios: {
        Row: {
          category: string
          ceo_answer: string | null
          ceo_id: string | null
          created_at: string
          id: string
          intent_id: string | null
          is_active: boolean
          option_a: string
          option_b: string
          option_c: string
          question: string
        }
        Insert: {
          category?: string
          ceo_answer?: string | null
          ceo_id?: string | null
          created_at?: string
          id?: string
          intent_id?: string | null
          is_active?: boolean
          option_a: string
          option_b: string
          option_c: string
          question: string
        }
        Update: {
          category?: string
          ceo_answer?: string | null
          ceo_id?: string | null
          created_at?: string
          id?: string
          intent_id?: string | null
          is_active?: boolean
          option_a?: string
          option_b?: string
          option_c?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "strategic_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      site_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          rewarded: boolean
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          rewarded?: boolean
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          rewarded?: boolean
          user_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string | null
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label?: string | null
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string | null
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      strategic_achievements: {
        Row: {
          completed_at: string
          created_at: string
          department_id: string
          department_name: string
          id: string
          name: string
          owner_name: string
          strategic_importance: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          department_id: string
          department_name: string
          id?: string
          name: string
          owner_name: string
          strategic_importance?: number
          user_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          department_id?: string
          department_name?: string
          id?: string
          name?: string
          owner_name?: string
          strategic_importance?: number
          user_id?: string
        }
        Relationships: []
      }
      strategic_bets: {
        Row: {
          ceo_id: string
          created_at: string
          goal_description: string | null
          goal_title: string
          id: string
          year: number
        }
        Insert: {
          ceo_id: string
          created_at?: string
          goal_description?: string | null
          goal_title: string
          id?: string
          year?: number
        }
        Update: {
          ceo_id?: string
          created_at?: string
          goal_description?: string | null
          goal_title?: string
          id?: string
          year?: number
        }
        Relationships: []
      }
      strategic_intents: {
        Row: {
          ceo_id: string
          created_at: string
          description: string
          id: string
          status: string
          strategic_weight: number
          title: string
          tolerance_zone: number
          updated_at: string
        }
        Insert: {
          ceo_id: string
          created_at?: string
          description: string
          id?: string
          status?: string
          strategic_weight?: number
          title: string
          tolerance_zone?: number
          updated_at?: string
        }
        Update: {
          ceo_id?: string
          created_at?: string
          description?: string
          id?: string
          status?: string
          strategic_weight?: number
          title?: string
          tolerance_zone?: number
          updated_at?: string
        }
        Relationships: []
      }
      strategic_radar_analyses: {
        Row: {
          cash_liquidity: string | null
          company_logo: string | null
          company_name: string
          company_ticker: string | null
          competitors: Json | null
          created_at: string
          id: string
          industry: string | null
          maturity_score: number | null
          revenue: string | null
          revenue_value: number | null
          sector: string | null
          strategic_goal: string | null
          technology_lag: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cash_liquidity?: string | null
          company_logo?: string | null
          company_name: string
          company_ticker?: string | null
          competitors?: Json | null
          created_at?: string
          id?: string
          industry?: string | null
          maturity_score?: number | null
          revenue?: string | null
          revenue_value?: number | null
          sector?: string | null
          strategic_goal?: string | null
          technology_lag?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cash_liquidity?: string | null
          company_logo?: string | null
          company_name?: string
          company_ticker?: string | null
          competitors?: Json | null
          created_at?: string
          id?: string
          industry?: string | null
          maturity_score?: number | null
          revenue?: string | null
          revenue_value?: number | null
          sector?: string | null
          strategic_goal?: string | null
          technology_lag?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_chat_logs: {
        Row: {
          created_at: string
          id: string
          messages: Json
          session_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          session_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          session_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          avatar_url: string | null
          company: string
          content: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          rating: number
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company: string
          content: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          rating?: number
          role: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string
          content?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          rating?: number
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      unicorn_analyses: {
        Row: {
          analysis_result: Json | null
          api_connections: Json | null
          burn_rate: number | null
          chapter: string | null
          chapter_1_approved: boolean | null
          chapter_1_approved_at: string | null
          chapter_2_stable: boolean | null
          chapter_2_stable_at: string | null
          company_name: string
          company_url: string | null
          completed_at: string | null
          created_at: string
          current_valuation: number | null
          employees_list_path: string | null
          error_message: string | null
          financials_path: string | null
          founders_bio: string | null
          health_alerts: Json | null
          id: string
          linkedin_url: string | null
          milestone_funding: Json | null
          monthly_active_users: number | null
          pitch_deck_path: string | null
          pivot_history: Json | null
          regulatory_shield: Json | null
          shadow_cabinet: Json | null
          status: string | null
          u_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_result?: Json | null
          api_connections?: Json | null
          burn_rate?: number | null
          chapter?: string | null
          chapter_1_approved?: boolean | null
          chapter_1_approved_at?: string | null
          chapter_2_stable?: boolean | null
          chapter_2_stable_at?: string | null
          company_name: string
          company_url?: string | null
          completed_at?: string | null
          created_at?: string
          current_valuation?: number | null
          employees_list_path?: string | null
          error_message?: string | null
          financials_path?: string | null
          founders_bio?: string | null
          health_alerts?: Json | null
          id?: string
          linkedin_url?: string | null
          milestone_funding?: Json | null
          monthly_active_users?: number | null
          pitch_deck_path?: string | null
          pivot_history?: Json | null
          regulatory_shield?: Json | null
          shadow_cabinet?: Json | null
          status?: string | null
          u_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_result?: Json | null
          api_connections?: Json | null
          burn_rate?: number | null
          chapter?: string | null
          chapter_1_approved?: boolean | null
          chapter_1_approved_at?: string | null
          chapter_2_stable?: boolean | null
          chapter_2_stable_at?: string | null
          company_name?: string
          company_url?: string | null
          completed_at?: string | null
          created_at?: string
          current_valuation?: number | null
          employees_list_path?: string | null
          error_message?: string | null
          financials_path?: string | null
          founders_bio?: string | null
          health_alerts?: Json | null
          id?: string
          linkedin_url?: string | null
          milestone_funding?: Json | null
          monthly_active_users?: number | null
          pitch_deck_path?: string | null
          pivot_history?: Json | null
          regulatory_shield?: Json | null
          shadow_cabinet?: Json | null
          status?: string | null
          u_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          created_at: string
          credits: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_purchases: {
        Row: {
          id: string
          product_id: string
          purchased_at: string
          user_id: string
        }
        Insert: {
          id?: string
          product_id: string
          purchased_at?: string
          user_id: string
        }
        Update: {
          id?: string
          product_id?: string
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "digital_products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      deduct_credits:
        | { Args: { amount: number }; Returns: boolean }
        | {
            Args: { amount: number; description?: string; feature_key?: string }
            Returns: boolean
          }
      get_company_role: {
        Args: { _company_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["company_role"]
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_credits: { Args: never; Returns: number }
      has_compass_role: {
        Args: {
          _role: Database["public"]["Enums"]["compass_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_ip_address: { Args: { ip: string }; Returns: string }
      is_ceo: { Args: { _user_id: string }; Returns: boolean }
      is_company_ceo: { Args: { _user_id: string }; Returns: boolean }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      reset_monthly_credits: { Args: never; Returns: undefined }
      search_legal_docs: {
        Args: {
          filter_category?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          article_number: string
          category: string
          content: string
          id: string
          similarity: number
          source_url: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      company_role: "ceo" | "deputy" | "manager" | "employee"
      company_status: "active" | "suspended" | "trial"
      compass_role: "ceo" | "deputy" | "manager" | "expert"
      subscription_tier:
        | "individual_free"
        | "individual_expert"
        | "individual_pro"
        | "individual_plus"
        | "corporate_expert"
        | "corporate_decision_support"
        | "corporate_decision_making"
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
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      company_role: ["ceo", "deputy", "manager", "employee"],
      company_status: ["active", "suspended", "trial"],
      compass_role: ["ceo", "deputy", "manager", "expert"],
      subscription_tier: [
        "individual_free",
        "individual_expert",
        "individual_pro",
        "individual_plus",
        "corporate_expert",
        "corporate_decision_support",
        "corporate_decision_making",
      ],
    },
  },
} as const
