// Auto-generated-friendly database types. Hand-written to match the schema in
// supabase/migrations/0001_init.sql + 0002_admin_managed_keys.sql. If the
// schema changes, update both files.
// (Run `supabase gen types typescript` once the project is linked to regenerate.)

export type UserRole = "user" | "admin";

// `status` is a text column with a check constraint (not a PG enum), but we
// surface it as a closed union for ergonomics. See 0002_admin_managed_keys.sql.
export type UserStatus = "active" | "suspended";

export type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
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

export type ProviderPresetRow = {
  id: string;
  display_name: string;
  base_url: string;
  models: string[];
  default_model: string;
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type ProviderKeyRow = {
  id: string;
  provider_id: string;
  encrypted_key: string;
  key_hint: string;
  label: string | null;
  enabled: boolean;
  created_at: string;
  created_by: string | null;
};

export type UsageLogRow = {
  id: string;
  user_id: string;
  provider_id: string;
  model: string;
  source_lang: string;
  target_lang: string;
  input_chars: number;
  output_chars: number;
  duration_ms: number | null;
  status: "ok" | "error";
  error_code: string | null;
  created_at: string;
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
      provider_presets: {
        Row: ProviderPresetRow;
        Insert: Omit<ProviderPresetRow, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ProviderPresetRow, "id">>;
        Relationships: [];
      };
      provider_keys: {
        Row: ProviderKeyRow;
        Insert: Omit<ProviderKeyRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ProviderKeyRow, "id" | "provider_id">>;
        Relationships: [];
      };
      usage_logs: {
        Row: UsageLogRow;
        Insert: Omit<UsageLogRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<UsageLogRow, "id" | "user_id">>;
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
