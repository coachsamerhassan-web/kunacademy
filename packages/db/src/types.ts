// Generated database types — matches v2 schema (16 base + 11 EMS + 11 remaining = 38 tables)
// Last updated: 2026-03-24

export type EnrollmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'dropped';
export type EnrollmentType = 'recorded' | 'live' | 'retreat' | 'coaching_package';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
export type CreditType = 'earn' | 'spend' | 'payout';
export type EarningSource = 'service_booking' | 'product_sale' | 'referral';
export type EarningStatus = 'pending' | 'available' | 'paid_out';
export type PayoutStatus = 'requested' | 'approved' | 'processed' | 'rejected';
export type ScheduleType = 'deposit_balance' | 'installment';
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type ProductType = 'physical' | 'digital' | 'hybrid';
export type CommissionScope = 'global' | 'level' | 'profile' | 'item';

export interface Database {
  public: {
    Tables: {
      // ─── Core ───────────────────────────────────────
      profiles: {
        Row: { id: string; email: string; full_name_ar: string | null; full_name_en: string | null; phone: string | null; country: string | null; role: 'student' | 'provider' | 'admin'; avatar_url: string | null; created_at: string };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      instructors: {
        Row: { id: string; profile_id: string | null; slug: string; title_ar: string; title_en: string; bio_ar: string | null; bio_en: string | null; photo_url: string | null; credentials: string | null; coach_level: string | null; specialties: string[] | null; coaching_styles: string[] | null; development_types: string[] | null; pricing_json: unknown; is_visible: boolean; is_platform_coach: boolean; display_order: number };
        Insert: { slug: string; title_ar: string; title_en: string };
        Update: Partial<Database['public']['Tables']['instructors']['Row']>;
      };
      instructor_drafts: {
        Row: { id: string; instructor_id: string; field_name: string; old_value: string | null; new_value: string | null; status: 'pending' | 'approved' | 'rejected'; submitted_at: string; reviewed_at: string | null; reviewer_id: string | null; review_note: string | null };
        Insert: { instructor_id: string; field_name: string; new_value: string };
        Update: Partial<Database['public']['Tables']['instructor_drafts']['Row']>;
      };

      // ─── Programs & Learning ────────────────────────
      courses: {
        Row: { id: string; title_ar: string; title_en: string; slug: string; description_ar: string | null; description_en: string | null; instructor_id: string | null; coach_ids: string[] | null; price_aed: number; price_egp: number; price_usd: number; price_eur: number; duration_hours: number | null; level: string | null; nav_group: string | null; internal_category: string | null; type: string | null; format: string | null; location: string | null; is_featured: boolean; is_free: boolean; is_icf_accredited: boolean; icf_details: string | null; thumbnail_url: string | null; is_published: boolean; created_at: string };
        Insert: Partial<Database['public']['Tables']['courses']['Row']> & { title_ar: string; title_en: string; slug: string };
        Update: Partial<Database['public']['Tables']['courses']['Insert']>;
      };
      lessons: {
        Row: { id: string; course_id: string; title_ar: string; title_en: string; content_ar: string | null; content_en: string | null; video_url: string | null; order: number; duration_minutes: number | null };
        Insert: Omit<Database['public']['Tables']['lessons']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['lessons']['Insert']>;
      };
      lesson_progress: {
        Row: { id: string; user_id: string; lesson_id: string; playback_position_seconds: number; completed: boolean; completed_at: string | null; updated_at: string };
        Insert: { user_id: string; lesson_id: string; playback_position_seconds?: number; completed?: boolean };
        Update: Partial<Database['public']['Tables']['lesson_progress']['Insert']>;
      };
      enrollments: {
        Row: { id: string; user_id: string; course_id: string; status: EnrollmentStatus; enrollment_type: EnrollmentType; progress_data: Record<string, unknown>; completed_at: string | null; enrolled_at: string; expires_at: string | null };
        Insert: { user_id: string; course_id: string; status?: EnrollmentStatus; enrollment_type?: EnrollmentType; progress_data?: Record<string, unknown> };
        Update: Partial<Database['public']['Tables']['enrollments']['Insert']> & { completed_at?: string };
      };
      attendance: {
        Row: { id: string; enrollment_id: string; session_date: string; session_number: number | null; status: 'present' | 'absent' | 'excused' | 'late'; notes: string | null; marked_by: string | null; created_at: string };
        Insert: { enrollment_id: string; session_date: string; status: 'present' | 'absent' | 'excused' | 'late'; session_number?: number; notes?: string };
        Update: Partial<Database['public']['Tables']['attendance']['Insert']>;
      };
      materials: {
        Row: { id: string; course_id: string; title_ar: string; title_en: string; type: 'pdf' | 'video' | 'link' | 'audio' | 'image'; url: string; access_duration_days: number | null; display_order: number; is_published: boolean; created_at: string };
        Insert: { course_id: string; title_ar: string; title_en: string; type: 'pdf' | 'video' | 'link' | 'audio' | 'image'; url: string };
        Update: Partial<Database['public']['Tables']['materials']['Insert']>;
      };
      certificates: {
        Row: { id: string; user_id: string; enrollment_id: string; template_id: string | null; credential_type: string | null; issued_at: string; pdf_url: string | null; verification_code: string };
        Insert: { user_id: string; enrollment_id: string; template_id?: string; credential_type?: string };
        Update: Partial<Database['public']['Tables']['certificates']['Insert']>;
      };

      // ─── Coaching & Booking ─────────────────────────
      services: {
        Row: { id: string; name_ar: string; name_en: string; description_ar: string | null; description_en: string | null; duration_minutes: number; price_aed: number; price_egp: number; price_usd: number; is_active: boolean; category_id: string | null; sessions_count: number | null; validity_days: number | null; commission_override_pct: number | null };
        Insert: Omit<Database['public']['Tables']['services']['Row'], 'id' | 'is_active'>;
        Update: Partial<Database['public']['Tables']['services']['Insert']>;
      };
      service_categories: {
        Row: { id: string; slug: string; name_ar: string; name_en: string; description_ar: string | null; description_en: string | null; audience: 'seeker' | 'student' | 'corporate'; display_order: number };
        Insert: { slug: string; name_ar: string; name_en: string; audience: 'seeker' | 'student' | 'corporate' };
        Update: Partial<Database['public']['Tables']['service_categories']['Insert']>;
      };
      providers: {
        Row: { id: string; profile_id: string | null; bio_ar: string | null; bio_en: string | null; specialties: string[] | null; languages: string[] | null; credentials: string | null; is_visible: boolean };
        Insert: Partial<Database['public']['Tables']['providers']['Row']>;
        Update: Partial<Database['public']['Tables']['providers']['Insert']>;
      };
      availability: {
        Row: { id: string; provider_id: string; day_of_week: number; start_time: string; end_time: string; is_active: boolean };
        Insert: Omit<Database['public']['Tables']['availability']['Row'], 'id' | 'is_active'>;
        Update: Partial<Database['public']['Tables']['availability']['Insert']>;
      };
      coach_schedules: {
        Row: { id: string; coach_id: string; day_of_week: number; start_time: string; end_time: string; timezone: string; is_active: boolean };
        Insert: { coach_id: string; day_of_week: number; start_time: string; end_time: string; timezone?: string };
        Update: Partial<Database['public']['Tables']['coach_schedules']['Insert']>;
      };
      coach_time_off: {
        Row: { id: string; coach_id: string; start_date: string; end_date: string; reason: string | null; created_at: string };
        Insert: { coach_id: string; start_date: string; end_date: string; reason?: string };
        Update: Partial<Database['public']['Tables']['coach_time_off']['Insert']>;
      };
      bookings: {
        Row: { id: string; service_id: string | null; provider_id: string | null; customer_id: string; coach_id: string | null; start_time: string; end_time: string; status: BookingStatus; payment_id: string | null; notes: string | null; meeting_url: string | null; cancelled_at: string | null; cancellation_reason: string | null; created_at: string };
        Insert: { customer_id: string; start_time: string; end_time: string; service_id?: string; provider_id?: string; coach_id?: string; notes?: string };
        Update: Partial<Database['public']['Tables']['bookings']['Row']>;
      };
      coach_ratings: {
        Row: { id: string; coach_id: string; user_id: string; rating: number; review_text: string | null; testimonial_id: string | null; booking_id: string | null; is_published: boolean; created_at: string };
        Insert: { coach_id: string; user_id: string; rating: number; review_text?: string; booking_id?: string };
        Update: Partial<Database['public']['Tables']['coach_ratings']['Insert']>;
      };
      coach_badges: {
        Row: { coach_id: string; badge_tier: BadgeTier; avg_rating: number; review_count: number; updated_at: string };
        Insert: { coach_id: string; badge_tier: BadgeTier; avg_rating: number; review_count: number };
        Update: Partial<Database['public']['Tables']['coach_badges']['Insert']>;
      };

      // ─── Commerce ───────────────────────────────────
      products: {
        Row: { id: string; name_ar: string; name_en: string; slug: string; description_ar: string | null; description_en: string | null; price_aed: number; price_egp: number; price_usd: number; images: unknown[]; stock: number; is_active: boolean; product_type: ProductType; creator_id: string | null; commission_override_pct: number | null };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'is_active' | 'stock' | 'images' | 'product_type'> & { images?: unknown[]; stock?: number; product_type?: ProductType };
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
      digital_assets: {
        Row: { id: string; product_id: string; file_url: string; file_type: string; file_size_bytes: number | null; display_name: string | null; created_at: string };
        Insert: { product_id: string; file_url: string; file_type: string; file_size_bytes?: number; display_name?: string };
        Update: Partial<Database['public']['Tables']['digital_assets']['Insert']>;
      };
      download_tokens: {
        Row: { id: string; order_item_id: string; user_id: string; asset_id: string; token: string; expires_at: string; download_count: number; max_downloads: number; created_at: string };
        Insert: { order_item_id: string; user_id: string; asset_id: string; expires_at: string; max_downloads?: number };
        Update: { download_count?: number };
      };
      orders: {
        Row: { id: string; customer_id: string; status: OrderStatus; total_amount: number; currency: string; payment_gateway: string | null; payment_id: string | null; shipping_address: Record<string, unknown> | null; created_at: string };
        Insert: { customer_id: string; total_amount: number; currency: string };
        Update: Partial<Database['public']['Tables']['orders']['Row']>;
      };
      order_items: {
        Row: { id: string; order_id: string; product_id: string; quantity: number; unit_price: number };
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>;
      };

      // ─── Payments & Financials ──────────────────────
      payments: {
        Row: { id: string; order_id: string | null; booking_id: string | null; gateway: 'stripe' | 'paytabs' | 'tabby'; gateway_payment_id: string | null; amount: number; currency: string; status: PaymentStatus; metadata: Record<string, unknown>; created_at: string };
        Insert: { amount: number; currency: string; gateway: 'stripe' | 'paytabs' | 'tabby'; order_id?: string; booking_id?: string };
        Update: Partial<Database['public']['Tables']['payments']['Row']>;
      };
      payment_schedules: {
        Row: { id: string; payment_id: string; user_id: string; total_amount: number; paid_amount: number; remaining_amount: number; schedule_type: ScheduleType; installments: Array<{ due_date: string; amount: number; status: 'pending' | 'paid' | 'overdue'; paid_at?: string }>; currency: string; created_at: string };
        Insert: { payment_id: string; user_id: string; total_amount: number; remaining_amount: number; schedule_type: ScheduleType; installments: Array<{ due_date: string; amount: number; status: 'pending' | 'paid' | 'overdue' }>; currency?: string };
        Update: Partial<Database['public']['Tables']['payment_schedules']['Insert']>;
      };
      commission_rates: {
        Row: { id: string; scope: CommissionScope; scope_id: string | null; category: 'services' | 'products'; rate_pct: number; created_by: string | null; created_at: string };
        Insert: { scope: CommissionScope; category: 'services' | 'products'; rate_pct: number; scope_id?: string; created_by?: string };
        Update: Partial<Database['public']['Tables']['commission_rates']['Insert']>;
      };
      earnings: {
        Row: { id: string; user_id: string; source_type: EarningSource; source_id: string | null; gross_amount: number; commission_pct: number; commission_amount: number; net_amount: number; currency: string; status: EarningStatus; created_at: string };
        Insert: { user_id: string; source_type: EarningSource; gross_amount: number; commission_pct: number; commission_amount: number; net_amount: number; currency?: string };
        Update: { status?: EarningStatus };
      };
      payout_requests: {
        Row: { id: string; user_id: string; amount: number; currency: string; status: PayoutStatus; processed_by: string | null; processed_at: string | null; payment_method: string | null; notes: string | null; created_at: string };
        Insert: { user_id: string; amount: number; currency?: string; payment_method?: string };
        Update: { status?: PayoutStatus; processed_by?: string; processed_at?: string; notes?: string };
      };

      // ─── Referrals & Credits ────────────────────────
      referral_codes: {
        Row: { id: string; user_id: string; code: string; is_active: boolean; created_at: string };
        Insert: { user_id: string; code: string };
        Update: { is_active?: boolean };
      };
      credit_transactions: {
        Row: { id: string; user_id: string; amount: number; type: CreditType; source_type: string | null; source_id: string | null; balance_after: number; note: string | null; created_at: string };
        Insert: { user_id: string; amount: number; type: CreditType; balance_after: number; source_type?: string; source_id?: string; note?: string };
        Update: never; // immutable ledger
      };

      // ─── Content ────────────────────────────────────
      posts: {
        Row: { id: string; title_ar: string; title_en: string; slug: string; content_ar: string | null; content_en: string | null; excerpt_ar: string | null; excerpt_en: string | null; category: string | null; featured_image: string | null; author_id: string | null; is_published: boolean; published_at: string | null };
        Insert: { title_ar: string; title_en: string; slug: string };
        Update: Partial<Database['public']['Tables']['posts']['Insert']>;
      };
      blog_posts: {
        Row: { id: string; slug: string; title_ar: string; title_en: string | null; body_ar: string | null; body_en: string | null; excerpt_ar: string | null; excerpt_en: string | null; author_id: string | null; category: string | null; tags: string[] | null; featured_image: string | null; content_doc_id: string | null; is_published: boolean; published_at: string | null; created_at: string; updated_at: string };
        Insert: { slug: string; title_ar: string; title_en?: string };
        Update: Partial<Database['public']['Tables']['blog_posts']['Row']>;
      };
      testimonials: {
        Row: { id: string; author_name_ar: string | null; author_name_en: string | null; content_ar: string; content_en: string | null; coach_id: string | null; program: string | null; rating: number | null; video_url: string | null; is_featured: boolean; source_type: string | null; migrated_at: string | null };
        Insert: { content_ar: string };
        Update: Partial<Database['public']['Tables']['testimonials']['Row']>;
      };

      // ─── Community ──────────────────────────────────
      community_boards: {
        Row: { id: string; slug: string; name_ar: string; name_en: string; description_ar: string | null; description_en: string | null; type: 'general' | 'cohort' | 'announcements'; is_admin_only: boolean; course_id: string | null; created_at: string };
        Insert: { slug: string; name_ar: string; name_en: string; type: 'general' | 'cohort' | 'announcements' };
        Update: Partial<Database['public']['Tables']['community_boards']['Insert']>;
      };
      community_posts: {
        Row: { id: string; board_id: string; author_id: string; parent_id: string | null; content: string; is_pinned: boolean; created_at: string; updated_at: string };
        Insert: { board_id: string; author_id: string; content: string; parent_id?: string };
        Update: { content?: string; is_pinned?: boolean };
      };
      community_reactions: {
        Row: { id: string; post_id: string; user_id: string; reaction: 'heart' | 'hands' | 'lightbulb'; created_at: string };
        Insert: { post_id: string; user_id: string; reaction: 'heart' | 'hands' | 'lightbulb' };
        Update: never; // immutable
      };
      board_members: {
        Row: { id: string; board_id: string; user_id: string; role: 'member' | 'moderator' | 'admin'; joined_at: string };
        Insert: { board_id: string; user_id: string; role?: 'member' | 'moderator' | 'admin' };
        Update: { role?: 'member' | 'moderator' | 'admin' };
      };
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      update_coach_badge: { Args: Record<string, never>; Returns: void };
    };
  };
}

// ─── Convenience type aliases ─────────────────────────
export type Tables = Database['public']['Tables'];
export type Profile = Tables['profiles']['Row'];
export type Course = Tables['courses']['Row'];
export type Enrollment = Tables['enrollments']['Row'];
export type Booking = Tables['bookings']['Row'];
export type Payment = Tables['payments']['Row'];
export type Service = Tables['services']['Row'];
export type Product = Tables['products']['Row'];
export type BlogPost = Tables['blog_posts']['Row'];
export type CoachRating = Tables['coach_ratings']['Row'];
export type CoachBadge = Tables['coach_badges']['Row'];
export type CreditTransaction = Tables['credit_transactions']['Row'];
export type Earning = Tables['earnings']['Row'];
export type PayoutRequest = Tables['payout_requests']['Row'];
export type CommunityPost = Tables['community_posts']['Row'];
