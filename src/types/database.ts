export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          username: string | null;
          full_name: string | null;
          role: 'learner' | 'elder' | 'admin' | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          username?: string | null;
          full_name?: string | null;
          role?: 'learner' | 'elder' | 'admin' | null;
          created_at?: string | null;
        };
        Update: {
          email?: string | null;
          username?: string | null;
          full_name?: string | null;
          role?: 'learner' | 'elder' | 'admin' | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
