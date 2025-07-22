import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Database types based on our schema
interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string | null;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          email?: string | null;
          created_at?: string;
        };
      };
      practice_sessions: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          duration: number;
          mood: string;
          techniques: string[];
          songs: string[];
          notes: string;
          tags: string[];
          recordings: any[];
          link: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          duration: number;
          mood: string;
          techniques?: string[];
          songs?: string[];
          notes?: string;
          tags?: string[];
          recordings?: any[];
          link?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          duration?: number;
          mood?: string;
          techniques?: string[];
          songs?: string[];
          notes?: string;
          tags?: string[];
          recordings?: any[];
          link?: string;
          created_at?: string;
        };
      };
      repertoire: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          artist: string;
          difficulty: string;
          mastery: number;
          date_added: string;
          last_practiced: string | null;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          artist: string;
          difficulty: string;
          mastery?: number;
          date_added?: string;
          last_practiced?: string | null;
          notes?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          artist?: string;
          difficulty?: string;
          mastery?: number;
          date_added?: string;
          last_practiced?: string | null;
          notes?: string;
          created_at?: string;
        };
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string;
          target_date: string;
          status: string;
          progress: number;
          category: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string;
          target_date: string;
          status?: string;
          progress?: number;
          category: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string;
          target_date?: string;
          status?: string;
          progress?: number;
          category?: string;
          created_at?: string;
        };
      };
    };
  };
}