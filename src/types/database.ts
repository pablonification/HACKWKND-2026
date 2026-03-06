type Role = 'learner' | 'elder' | 'admin';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          username: string | null;
          full_name: string | null;
          role: Role | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          username?: string | null;
          full_name?: string | null;
          role?: Role | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          email?: string | null;
          username?: string | null;
          full_name?: string | null;
          role?: Role | null;
          avatar_url?: string | null;
          bio?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      recordings: {
        Row: {
          id: string;
          uploader_id: string;
          title: string;
          description: string | null;
          audio_url: string;
          duration_seconds: number | null;
          language_tag: string | null;
          dialect: string | null;
          topic_tags: string[] | null;
          transcription: string | null;
          translation: string | null;
          raw_transcription: string | null;
          auto_transcription: string | null;
          verified_transcription: string | null;
          transcription_candidates: unknown | null;
          transcription_match: unknown | null;
          transcription_word_replacements: unknown | null;
          transcription_language: string | null;
          auto_translation_ms: string | null;
          verified_translation_ms: string | null;
          is_verified: boolean;
          verified_at: string | null;
          verified_by: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          uploader_id: string;
          title: string;
          description?: string | null;
          audio_url: string;
          duration_seconds?: number | null;
          language_tag?: string | null;
          dialect?: string | null;
          topic_tags?: string[] | null;
          transcription?: string | null;
          translation?: string | null;
          raw_transcription?: string | null;
          auto_transcription?: string | null;
          verified_transcription?: string | null;
          transcription_candidates?: unknown | null;
          transcription_match?: unknown | null;
          transcription_word_replacements?: unknown | null;
          transcription_language?: string | null;
          auto_translation_ms?: string | null;
          verified_translation_ms?: string | null;
          is_verified?: boolean;
          verified_at?: string | null;
          verified_by?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          audio_url?: string;
          duration_seconds?: number | null;
          language_tag?: string | null;
          dialect?: string | null;
          topic_tags?: string[] | null;
          transcription?: string | null;
          translation?: string | null;
          raw_transcription?: string | null;
          auto_transcription?: string | null;
          verified_transcription?: string | null;
          transcription_candidates?: unknown | null;
          transcription_match?: unknown | null;
          transcription_word_replacements?: unknown | null;
          transcription_language?: string | null;
          auto_translation_ms?: string | null;
          verified_translation_ms?: string | null;
          is_verified?: boolean;
          verified_at?: string | null;
          verified_by?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'recordings_uploader_id_fkey';
            columns: ['uploader_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recordings_verified_by_fkey';
            columns: ['verified_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      words: {
        Row: {
          id: string;
          semai: string | null;
          semai_word: string;
          semai_key: string;
          meaning_ms: string | null;
          malay_translation: string | null;
          meaning_en: string | null;
          english_translation: string | null;
          pronunciation_url: string | null;
          example_sentence: string | null;
          topic_tags: string[] | null;
          category: string | null;
          difficulty: number | 'beginner' | 'intermediate' | 'advanced' | null;
          elder_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          semai?: string | null;
          semai_word?: string;
          semai_key?: string;
          meaning_ms?: string | null;
          malay_translation?: string | null;
          meaning_en?: string | null;
          english_translation?: string | null;
          pronunciation_url?: string | null;
          example_sentence?: string | null;
          topic_tags?: string[] | null;
          category?: string | null;
          difficulty?: number | 'beginner' | 'intermediate' | 'advanced' | null;
          elder_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          semai?: string | null;
          semai_word?: string;
          semai_key?: string;
          meaning_ms?: string | null;
          malay_translation?: string | null;
          meaning_en?: string | null;
          english_translation?: string | null;
          pronunciation_url?: string | null;
          example_sentence?: string | null;
          topic_tags?: string[] | null;
          category?: string | null;
          difficulty?: number | 'beginner' | 'intermediate' | 'advanced' | null;
          elder_id?: string | null;
          created_by?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'words_elder_id_fkey';
            columns: ['elder_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'words_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      progress: {
        Row: {
          id: string;
          user_id: string;
          word_id: string;
          mastery_level: number;
          next_review_at: string | null;
          last_reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          word_id: string;
          mastery_level?: number;
          next_review_at?: string | null;
          last_reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          mastery_level?: number;
          next_review_at?: string | null;
          last_reviewed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'progress_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'progress_word_id_fkey';
            columns: ['word_id'];
            referencedRelation: 'words';
            referencedColumns: ['id'];
          },
        ];
      };
      streaks: {
        Row: {
          id: string;
          user_id: string;
          current_streak: number;
          longest_streak: number;
          last_activity_date: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          current_streak?: number;
          longest_streak?: number;
          last_activity_date?: string | null;
          updated_at?: string | null;
        };
        Update: {
          current_streak?: number;
          longest_streak?: number;
          last_activity_date?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'streaks_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      stories: {
        Row: {
          id: string;
          author_id: string | null;
          title: string;
          content: string;
          image_url: string | null;
          image_prompt: string | null;
          topic_tags: string[] | null;
          is_published: boolean;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          author_id?: string | null;
          title: string;
          content: string;
          image_url?: string | null;
          image_prompt?: string | null;
          topic_tags?: string[] | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          title?: string;
          content?: string;
          image_url?: string | null;
          image_prompt?: string | null;
          topic_tags?: string[] | null;
          is_published?: boolean;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'stories_author_id_fkey';
            columns: ['author_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      requests: {
        Row: {
          id: string;
          requester_id: string;
          request_type: 'word' | 'phrase' | 'topic' | 'story' | null;
          content: string;
          status: 'pending' | 'in_progress' | 'fulfilled' | 'rejected';
          fulfilled_by: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          requester_id: string;
          request_type?: 'word' | 'phrase' | 'topic' | 'story' | null;
          content: string;
          status?: 'pending' | 'in_progress' | 'fulfilled' | 'rejected';
          fulfilled_by?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          request_type?: 'word' | 'phrase' | 'topic' | 'story' | null;
          content?: string;
          status?: 'pending' | 'in_progress' | 'fulfilled' | 'rejected';
          fulfilled_by?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'requests_requester_id_fkey';
            columns: ['requester_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      follows: {
        Row: {
          id: string;
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: 'follows_follower_id_fkey';
            columns: ['follower_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'follows_following_id_fkey';
            columns: ['following_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
