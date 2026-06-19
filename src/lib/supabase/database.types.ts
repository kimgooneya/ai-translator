// Auto-generated-friendly database types. Hand-written to match the schema in
// supabase/migrations/0001_init.sql. If the schema changes, update both files.
// (Run `supabase gen types typescript` once the project is linked to regenerate.)

export type UserRole = "user" | "admin";

export type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
};

export type TranslationHistoryRow = {
  id: string;
  user_id: string;
  request: Record<string, unknown>;
  response: string;
  provider_name: string;
  model_name: string;
  created_at: string;
  tokens_used: number | null;
};

export type GlossaryRow = {
  id: string;
  user_id: string;
  enabled: boolean;
  created_at: string;
};

export type GlossaryEntryRow = {
  id: string;
  glossary_id: string;
  source: string;
  target: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at"> & { created_at?: string };
        Update: Partial<Omit<Profile, "id">>;
        Relationships: [];
      };
      translation_history: {
        Row: TranslationHistoryRow;
        Insert: Omit<TranslationHistoryRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<TranslationHistoryRow, "id" | "user_id">>;
        Relationships: [];
      };
      glossaries: {
        Row: GlossaryRow;
        Insert: Omit<GlossaryRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<GlossaryRow, "id" | "user_id">>;
        Relationships: [];
      };
      glossary_entries: {
        Row: GlossaryEntryRow;
        Insert: Omit<GlossaryEntryRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<GlossaryEntryRow, "id" | "glossary_id">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
    };
  };
}
