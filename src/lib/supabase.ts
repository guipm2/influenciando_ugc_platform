import { createClient } from '@supabase/supabase-js';

// These environment variables are safe to expose in the client-side bundle
// VITE_SUPABASE_URL: Public Supabase project URL
// VITE_SUPABASE_ANON_KEY: Public anonymous key for client-side access (designed to be exposed)
// Row Level Security (RLS) in Supabase protects sensitive data even with exposed anon key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Manter sessão por mais tempo
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'supabase.auth.token',
  },
  global: {
    headers: {
      'x-client-info': 'influenciando-platform',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          bio: string | null;
          location: string | null;
          niche: string | null;
          followers: string | null;
          website: string | null;
          phone: string | null;
          avatar_url: string | null;
          role: 'creator' | 'analyst';
          terms_accepted: boolean;
          terms_accepted_at: string | null;
          terms_version: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          bio?: string | null;
          location?: string | null;
          niche?: string | null;
          followers?: string | null;
          website?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: 'creator' | 'analyst';
          terms_accepted?: boolean;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          bio?: string | null;
          location?: string | null;
          niche?: string | null;
          followers?: string | null;
          website?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: 'creator' | 'analyst';
          terms_accepted?: boolean;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      opportunities: {
        Row: {
          id: string;
          analyst_id: string | null;
          title: string;
          company: string;
          description: string;
          budget_min: number;
          budget_max: number;
          location: string;
          content_type: string;
          requirements: Json;
          deadline: string;
          status: string;
          candidates_count: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          analyst_id?: string | null;
          title: string;
          company: string;
          description: string;
          budget_min: number;
          budget_max: number;
          location?: string;
          content_type: string;
          requirements?: Json;
          deadline: string;
          status?: string;
          candidates_count?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          analyst_id?: string | null;
          title?: string;
          company?: string;
          description?: string;
          budget_min?: number;
          budget_max?: number;
          location?: string;
          content_type?: string;
          requirements?: Json;
          deadline?: string;
          status?: string;
          candidates_count?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      opportunity_applications: {
        Row: {
          id: string;
          opportunity_id: string;
          creator_id: string;
          message: string | null;
          status: string;
          applied_at: string;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          opportunity_id: string;
          creator_id: string;
          message?: string | null;
          status?: string;
          applied_at?: string;
          reviewed_at?: string | null;
        };
        Update: {
          id?: string;
          opportunity_id?: string;
          creator_id?: string;
          message?: string | null;
          status?: string;
          applied_at?: string;
          reviewed_at?: string | null;
        };
      };
      analysts: {
        Row: {
          id: string;
          email: string;
          name: string;
          company: string;
          role: 'analyst';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          company: string;
          role?: 'analyst';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          company?: string;
          role?: 'analyst';
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          data: Json;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          data?: Json;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          message?: string;
          data?: Json;
          read?: boolean;
          created_at?: string;
        };
      };
    };
  };
};