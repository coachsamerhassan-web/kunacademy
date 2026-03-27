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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          created_at: string | null
          enrollment_id: string
          id: string
          marked_by: string | null
          notes: string | null
          session_date: string
          session_number: number | null
          status: string
        }
        Insert: {
          created_at?: string | null
          enrollment_id: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          session_date: string
          session_number?: number | null
          status: string
        }
        Update: {
          created_at?: string | null
          enrollment_id?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          session_date?: string
          session_number?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability: {
        Row: {
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          provider_id: string
          start_time: string
        }
        Insert: {
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          provider_id: string
          start_time: string
        }
        Update: {
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          provider_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          body_ar: string | null
          body_en: string | null
          category: string | null
          content_doc_id: string | null
          created_at: string | null
          excerpt_ar: string | null
          excerpt_en: string | null
          featured_image: string | null
          id: string
          is_published: boolean | null
          published_at: string | null
          slug: string
          tags: string[] | null
          title_ar: string
          title_en: string | null
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          body_ar?: string | null
          body_en?: string | null
          category?: string | null
          content_doc_id?: string | null
          created_at?: string | null
          excerpt_ar?: string | null
          excerpt_en?: string | null
          featured_image?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          slug: string
          tags?: string[] | null
          title_ar: string
          title_en?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          body_ar?: string | null
          body_en?: string | null
          category?: string | null
          content_doc_id?: string | null
          created_at?: string | null
          excerpt_ar?: string | null
          excerpt_en?: string | null
          featured_image?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          slug?: string
          tags?: string[] | null
          title_ar?: string
          title_en?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_members: {
        Row: {
          board_id: string
          id: string
          joined_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          board_id: string
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          board_id?: string
          id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_members_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "community_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_access: {
        Row: {
          book_slug: string
          granted_at: string | null
          granted_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          book_slug: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          book_slug?: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          coach_id: string | null
          created_at: string | null
          customer_id: string
          end_time: string
          id: string
          meeting_url: string | null
          notes: string | null
          payment_id: string | null
          provider_id: string | null
          service_id: string | null
          start_time: string
          status: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          coach_id?: string | null
          created_at?: string | null
          customer_id: string
          end_time: string
          id?: string
          meeting_url?: string | null
          notes?: string | null
          payment_id?: string | null
          provider_id?: string | null
          service_id?: string | null
          start_time: string
          status?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          coach_id?: string | null
          created_at?: string | null
          customer_id?: string
          end_time?: string
          id?: string
          meeting_url?: string | null
          notes?: string | null
          payment_id?: string | null
          provider_id?: string | null
          service_id?: string | null
          start_time?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          credential_type: string | null
          enrollment_id: string
          id: string
          issued_at: string | null
          pdf_url: string | null
          template_id: string | null
          user_id: string
          verification_code: string | null
        }
        Insert: {
          credential_type?: string | null
          enrollment_id: string
          id?: string
          issued_at?: string | null
          pdf_url?: string | null
          template_id?: string | null
          user_id: string
          verification_code?: string | null
        }
        Update: {
          credential_type?: string | null
          enrollment_id?: string
          id?: string
          issued_at?: string | null
          pdf_url?: string | null
          template_id?: string | null
          user_id?: string
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_badges: {
        Row: {
          avg_rating: number
          badge_tier: string
          coach_id: string
          review_count: number
          updated_at: string | null
        }
        Insert: {
          avg_rating?: number
          badge_tier: string
          coach_id: string
          review_count?: number
          updated_at?: string | null
        }
        Update: {
          avg_rating?: number
          badge_tier?: string
          coach_id?: string
          review_count?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_badges_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_ratings: {
        Row: {
          booking_id: string | null
          coach_id: string
          created_at: string | null
          id: string
          is_published: boolean | null
          rating: number
          review_text: string | null
          testimonial_id: string | null
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          coach_id: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          rating: number
          review_text?: string | null
          testimonial_id?: string | null
          user_id: string
        }
        Update: {
          booking_id?: string | null
          coach_id?: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          rating?: number
          review_text?: string | null
          testimonial_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_ratings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_ratings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_ratings_testimonial_id_fkey"
            columns: ["testimonial_id"]
            isOneToOne: false
            referencedRelation: "testimonials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_schedules: {
        Row: {
          coach_id: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          start_time: string
          timezone: string | null
        }
        Insert: {
          coach_id: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          start_time: string
          timezone?: string | null
        }
        Update: {
          coach_id?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          start_time?: string
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_schedules_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_time_off: {
        Row: {
          coach_id: string
          created_at: string | null
          end_date: string
          id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_time_off_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rates: {
        Row: {
          category: string
          created_at: string | null
          created_by: string | null
          id: string
          rate_pct: number
          scope: string
          scope_id: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          rate_pct: number
          scope: string
          scope_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          rate_pct?: number
          scope?: string
          scope_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_boards: {
        Row: {
          course_id: string | null
          created_at: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          is_admin_only: boolean | null
          name_ar: string
          name_en: string
          slug: string
          type: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_admin_only?: boolean | null
          name_ar: string
          name_en: string
          slug: string
          type: string
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_admin_only?: boolean | null
          name_ar?: string
          name_en?: string
          slug?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_boards_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string
          board_id: string
          content: string
          created_at: string | null
          id: string
          is_pinned: boolean | null
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          author_id: string
          board_id: string
          content: string
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          board_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "community_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reactions: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sections: {
        Row: {
          course_id: string
          created_at: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          order: number
          title_ar: string
          title_en: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          order?: number
          title_ar: string
          title_en: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          order?: number
          title_ar?: string
          title_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          coach_ids: string[] | null
          created_at: string | null
          description_ar: string | null
          description_en: string | null
          duration_hours: number | null
          format: string | null
          icf_details: string | null
          id: string
          instructor_id: string | null
          internal_category: string | null
          is_featured: boolean | null
          is_free: boolean | null
          is_icf_accredited: boolean | null
          is_published: boolean | null
          level: string | null
          location: string | null
          nav_group: string | null
          price_aed: number | null
          price_egp: number | null
          price_eur: number | null
          price_sar: number | null
          price_usd: number | null
          slug: string
          thumbnail_url: string | null
          title_ar: string
          title_en: string
          total_lessons: number | null
          total_video_minutes: number | null
          type: string | null
        }
        Insert: {
          coach_ids?: string[] | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          duration_hours?: number | null
          format?: string | null
          icf_details?: string | null
          id?: string
          instructor_id?: string | null
          internal_category?: string | null
          is_featured?: boolean | null
          is_free?: boolean | null
          is_icf_accredited?: boolean | null
          is_published?: boolean | null
          level?: string | null
          location?: string | null
          nav_group?: string | null
          price_aed?: number | null
          price_egp?: number | null
          price_eur?: number | null
          price_sar?: number | null
          price_usd?: number | null
          slug: string
          thumbnail_url?: string | null
          title_ar: string
          title_en: string
          total_lessons?: number | null
          total_video_minutes?: number | null
          type?: string | null
        }
        Update: {
          coach_ids?: string[] | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          duration_hours?: number | null
          format?: string | null
          icf_details?: string | null
          id?: string
          instructor_id?: string | null
          internal_category?: string | null
          is_featured?: boolean | null
          is_free?: boolean | null
          is_icf_accredited?: boolean | null
          is_published?: boolean | null
          level?: string | null
          location?: string | null
          nav_group?: string | null
          price_aed?: number | null
          price_egp?: number | null
          price_eur?: number | null
          price_sar?: number | null
          price_usd?: number | null
          slug?: string
          thumbnail_url?: string | null
          title_ar?: string
          title_en?: string
          total_lessons?: number | null
          total_video_minutes?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string | null
          id: string
          note: string | null
          source_id: string | null
          source_type: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string | null
          id?: string
          note?: string | null
          source_id?: string | null
          source_type?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string | null
          id?: string
          note?: string | null
          source_id?: string | null
          source_type?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_assets: {
        Row: {
          created_at: string | null
          display_name: string | null
          file_size_bytes: number | null
          file_type: string
          file_url: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          file_size_bytes?: number | null
          file_type: string
          file_url: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          file_size_bytes?: number | null
          file_type?: string
          file_url?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      download_tokens: {
        Row: {
          asset_id: string
          created_at: string | null
          download_count: number | null
          expires_at: string
          id: string
          max_downloads: number | null
          order_item_id: string
          token: string | null
          user_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string | null
          download_count?: number | null
          expires_at: string
          id?: string
          max_downloads?: number | null
          order_item_id: string
          token?: string | null
          user_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string | null
          download_count?: number | null
          expires_at?: string
          id?: string
          max_downloads?: number | null
          order_item_id?: string
          token?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "download_tokens_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "digital_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "download_tokens_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "download_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      earnings: {
        Row: {
          available_at: string | null
          commission_amount: number
          commission_pct: number
          created_at: string | null
          currency: string
          gross_amount: number
          id: string
          net_amount: number
          source_id: string | null
          source_type: string
          status: string | null
          user_id: string
        }
        Insert: {
          available_at?: string | null
          commission_amount: number
          commission_pct: number
          created_at?: string | null
          currency?: string
          gross_amount: number
          id?: string
          net_amount: number
          source_id?: string | null
          source_type: string
          status?: string | null
          user_id: string
        }
        Update: {
          available_at?: string | null
          commission_amount?: number
          commission_pct?: number
          created_at?: string | null
          currency?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          source_id?: string | null
          source_type?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "earnings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          enrolled_at: string | null
          enrollment_type: string | null
          expires_at: string | null
          id: string
          progress_data: Json | null
          status: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          enrolled_at?: string | null
          enrollment_type?: string | null
          expires_at?: string | null
          id?: string
          progress_data?: Json | null
          status?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          enrolled_at?: string | null
          enrollment_type?: string | null
          expires_at?: string | null
          id?: string
          progress_data?: Json | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_drafts: {
        Row: {
          field_name: string
          id: string
          instructor_id: string
          new_value: string | null
          old_value: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string | null
          submitted_at: string | null
        }
        Insert: {
          field_name: string
          id?: string
          instructor_id: string
          new_value?: string | null
          old_value?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string | null
          submitted_at?: string | null
        }
        Update: {
          field_name?: string
          id?: string
          instructor_id?: string
          new_value?: string | null
          old_value?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_drafts_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_drafts_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instructors: {
        Row: {
          bio_ar: string | null
          bio_en: string | null
          coach_level: string | null
          coaching_styles: string[] | null
          credentials: string | null
          development_types: string[] | null
          display_order: number | null
          id: string
          is_platform_coach: boolean | null
          is_visible: boolean | null
          photo_url: string | null
          pricing_json: Json | null
          profile_id: string | null
          slug: string
          specialties: string[] | null
          title_ar: string
          title_en: string
        }
        Insert: {
          bio_ar?: string | null
          bio_en?: string | null
          coach_level?: string | null
          coaching_styles?: string[] | null
          credentials?: string | null
          development_types?: string[] | null
          display_order?: number | null
          id?: string
          is_platform_coach?: boolean | null
          is_visible?: boolean | null
          photo_url?: string | null
          pricing_json?: Json | null
          profile_id?: string | null
          slug: string
          specialties?: string[] | null
          title_ar: string
          title_en: string
        }
        Update: {
          bio_ar?: string | null
          bio_en?: string | null
          coach_level?: string | null
          coaching_styles?: string[] | null
          credentials?: string | null
          development_types?: string[] | null
          display_order?: number | null
          id?: string
          is_platform_coach?: boolean | null
          is_visible?: boolean | null
          photo_url?: string | null
          pricing_json?: Json | null
          profile_id?: string | null
          slug?: string
          specialties?: string[] | null
          title_ar?: string
          title_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          id: string
          lesson_id: string
          playback_position_seconds: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          lesson_id: string
          playback_position_seconds?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          lesson_id?: string
          playback_position_seconds?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lesson_syllabus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content_ar: string | null
          content_en: string | null
          course_id: string
          description_ar: string | null
          description_en: string | null
          duration_minutes: number | null
          id: string
          is_preview: boolean | null
          order: number
          section_id: string | null
          title_ar: string
          title_en: string
          video_id: string | null
          video_provider: string | null
          video_url: string | null
        }
        Insert: {
          content_ar?: string | null
          content_en?: string | null
          course_id: string
          description_ar?: string | null
          description_en?: string | null
          duration_minutes?: number | null
          id?: string
          is_preview?: boolean | null
          order: number
          section_id?: string | null
          title_ar: string
          title_en: string
          video_id?: string | null
          video_provider?: string | null
          video_url?: string | null
        }
        Update: {
          content_ar?: string | null
          content_en?: string | null
          course_id?: string
          description_ar?: string | null
          description_en?: string | null
          duration_minutes?: number | null
          id?: string
          is_preview?: boolean | null
          order?: number
          section_id?: string | null
          title_ar?: string
          title_en?: string
          video_id?: string | null
          video_provider?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          access_duration_days: number | null
          course_id: string
          created_at: string | null
          display_order: number | null
          id: string
          is_published: boolean | null
          title_ar: string
          title_en: string
          type: string
          url: string
        }
        Insert: {
          access_duration_days?: number | null
          course_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_published?: boolean | null
          title_ar: string
          title_en: string
          type: string
          url: string
        }
        Update: {
          access_duration_days?: number | null
          course_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_published?: boolean | null
          title_ar?: string
          title_en?: string
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity?: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          currency: string
          customer_id: string
          id: string
          payment_gateway: string | null
          payment_id: string | null
          shipping_address: Json | null
          status: string | null
          total_amount: number
        }
        Insert: {
          created_at?: string | null
          currency: string
          customer_id: string
          id?: string
          payment_gateway?: string | null
          payment_id?: string | null
          shipping_address?: Json | null
          status?: string | null
          total_amount: number
        }
        Update: {
          created_at?: string | null
          currency?: string
          customer_id?: string
          id?: string
          payment_gateway?: string | null
          payment_id?: string | null
          shipping_address?: Json | null
          status?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedules: {
        Row: {
          created_at: string | null
          currency: string
          id: string
          installments: Json
          paid_amount: number | null
          payment_id: string
          remaining_amount: number
          schedule_type: string
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          currency?: string
          id?: string
          installments?: Json
          paid_amount?: number | null
          payment_id: string
          remaining_amount: number
          schedule_type: string
          total_amount: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          currency?: string
          id?: string
          installments?: Json
          paid_amount?: number | null
          payment_id?: string
          remaining_amount?: number
          schedule_type?: string
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string | null
          currency: string
          gateway: string | null
          gateway_payment_id: string | null
          id: string
          metadata: Json | null
          order_id: string | null
          status: string | null
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string | null
          currency: string
          gateway?: string | null
          gateway_payment_id?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string | null
          currency?: string
          gateway?: string | null
          gateway_payment_id?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          admin_note: string | null
          amount: number
          bank_details: Json | null
          created_at: string | null
          currency: string
          id: string
          notes: string | null
          payment_method: string | null
          processed_at: string | null
          processed_by: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          bank_details?: Json | null
          created_at?: string | null
          currency?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          bank_details?: Json | null
          created_at?: string | null
          currency?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string | null
          category: string | null
          content_ar: string | null
          content_en: string | null
          excerpt_ar: string | null
          excerpt_en: string | null
          featured_image: string | null
          id: string
          is_published: boolean | null
          published_at: string | null
          slug: string
          title_ar: string
          title_en: string
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          content_ar?: string | null
          content_en?: string | null
          excerpt_ar?: string | null
          excerpt_en?: string | null
          featured_image?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          slug: string
          title_ar: string
          title_en: string
        }
        Update: {
          author_id?: string | null
          category?: string | null
          content_ar?: string | null
          content_en?: string | null
          excerpt_ar?: string | null
          excerpt_en?: string | null
          featured_image?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          slug?: string
          title_ar?: string
          title_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          commission_override_pct: number | null
          creator_id: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          images: Json | null
          is_active: boolean | null
          name_ar: string
          name_en: string
          price_aed: number | null
          price_egp: number | null
          price_usd: number | null
          product_type: string | null
          slug: string
          stock: number | null
        }
        Insert: {
          commission_override_pct?: number | null
          creator_id?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          images?: Json | null
          is_active?: boolean | null
          name_ar: string
          name_en: string
          price_aed?: number | null
          price_egp?: number | null
          price_usd?: number | null
          product_type?: string | null
          slug: string
          stock?: number | null
        }
        Update: {
          commission_override_pct?: number | null
          creator_id?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          images?: Json | null
          is_active?: boolean | null
          name_ar?: string
          name_en?: string
          price_aed?: number | null
          price_egp?: number | null
          price_usd?: number | null
          product_type?: string | null
          slug?: string
          stock?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string | null
          email: string
          full_name_ar: string | null
          full_name_en: string | null
          id: string
          phone: string | null
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          email: string
          full_name_ar?: string | null
          full_name_en?: string | null
          id: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          email?: string
          full_name_ar?: string | null
          full_name_en?: string | null
          id?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: []
      }
      providers: {
        Row: {
          bio_ar: string | null
          bio_en: string | null
          credentials: string | null
          id: string
          is_visible: boolean | null
          languages: string[] | null
          profile_id: string | null
          specialties: string[] | null
        }
        Insert: {
          bio_ar?: string | null
          bio_en?: string | null
          credentials?: string | null
          id?: string
          is_visible?: boolean | null
          languages?: string[] | null
          profile_id?: string | null
          specialties?: string[] | null
        }
        Update: {
          bio_ar?: string | null
          bio_en?: string | null
          credentials?: string | null
          id?: string
          is_visible?: boolean | null
          languages?: string[] | null
          profile_id?: string | null
          specialties?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          audience: string
          description_ar: string | null
          description_en: string | null
          display_order: number | null
          id: string
          name_ar: string
          name_en: string
          slug: string
        }
        Insert: {
          audience: string
          description_ar?: string | null
          description_en?: string | null
          display_order?: number | null
          id?: string
          name_ar: string
          name_en: string
          slug: string
        }
        Update: {
          audience?: string
          description_ar?: string | null
          description_en?: string | null
          display_order?: number | null
          id?: string
          name_ar?: string
          name_en?: string
          slug?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          category_id: string | null
          commission_override_pct: number | null
          description_ar: string | null
          description_en: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          name_ar: string
          name_en: string
          price_aed: number | null
          price_egp: number | null
          price_sar: number | null
          price_usd: number | null
          sessions_count: number | null
          validity_days: number | null
        }
        Insert: {
          category_id?: string | null
          commission_override_pct?: number | null
          description_ar?: string | null
          description_en?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean | null
          name_ar: string
          name_en: string
          price_aed?: number | null
          price_egp?: number | null
          price_sar?: number | null
          price_usd?: number | null
          sessions_count?: number | null
          validity_days?: number | null
        }
        Update: {
          category_id?: string | null
          commission_override_pct?: number | null
          description_ar?: string | null
          description_en?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name_ar?: string
          name_en?: string
          price_aed?: number | null
          price_egp?: number | null
          price_sar?: number | null
          price_usd?: number | null
          sessions_count?: number | null
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          author_name_ar: string | null
          author_name_en: string | null
          coach_id: string | null
          content_ar: string
          content_en: string | null
          id: string
          is_featured: boolean | null
          migrated_at: string | null
          program: string | null
          rating: number | null
          source_type: string | null
          video_url: string | null
        }
        Insert: {
          author_name_ar?: string | null
          author_name_en?: string | null
          coach_id?: string | null
          content_ar: string
          content_en?: string | null
          id?: string
          is_featured?: boolean | null
          migrated_at?: string | null
          program?: string | null
          rating?: number | null
          source_type?: string | null
          video_url?: string | null
        }
        Update: {
          author_name_ar?: string | null
          author_name_en?: string | null
          coach_id?: string | null
          content_ar?: string
          content_en?: string | null
          id?: string
          is_featured?: boolean | null
          migrated_at?: string | null
          program?: string | null
          rating?: number | null
          source_type?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      lesson_syllabus: {
        Row: {
          course_id: string | null
          description_ar: string | null
          description_en: string | null
          duration_minutes: number | null
          id: string | null
          is_preview: boolean | null
          order: number | null
          section_id: string | null
          title_ar: string | null
          title_en: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
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
    Enums: {},
  },
} as const

// ── Convenience type aliases (Row types) ───────────────────────────────────
// Maps friendly names to Tables<'table_name'>['Row'] for backward compatibility

type TableRow<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

export type Profile = TableRow<'profiles'>
export type Course = TableRow<'courses'>
export type CourseSection = TableRow<'course_sections'>
export type Lesson = TableRow<'lessons'>
export type LessonSyllabus = Pick<TableRow<'lessons'>, 'id' | 'title_ar' | 'title_en' | 'order' | 'is_preview'>
export type LessonProgress = TableRow<'lesson_progress'>
export type Enrollment = TableRow<'enrollments'>
export type Booking = TableRow<'bookings'>
export type Payment = TableRow<'payments'>
export type Service = TableRow<'services'>
export type Product = TableRow<'products'>
export type Order = TableRow<'orders'>
export type OrderItem = TableRow<'order_items'>
export type DigitalAsset = TableRow<'digital_assets'>
export type DownloadToken = TableRow<'download_tokens'>
export type BlogPost = TableRow<'blog_posts'>
export type CoachRating = TableRow<'coach_ratings'>
export type CoachBadge = TableRow<'coach_badges'>
export type CreditTransaction = TableRow<'credit_transactions'>
export type Earning = TableRow<'earnings'>
export type PayoutRequest = TableRow<'payout_requests'>
export type CommunityPost = TableRow<'community_posts'>
export type Certificate = TableRow<'certificates'>
export type Material = TableRow<'materials'>
export type VideoProvider = string

// ── Enum-like string union types ───────────────────────────────────────────

export type EnrollmentStatus = 'active' | 'completed' | 'cancelled' | 'suspended'
export type EnrollmentType = 'self' | 'admin' | 'gift'
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
export type CreditType = 'purchase' | 'referral' | 'refund' | 'admin' | 'commission'
export type EarningSource = 'booking' | 'course' | 'referral' | 'commission'
export type EarningStatus = 'pending' | 'approved' | 'paid'
export type PayoutStatus = 'pending' | 'approved' | 'processing' | 'paid' | 'rejected'
export type ScheduleType = 'monthly' | 'quarterly' | 'custom'
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum'
export type ProductType = 'physical' | 'digital' | 'subscription'
export type CommissionScope = 'global' | 'program' | 'individual'
