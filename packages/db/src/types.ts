// Generated database types — matches the 16-table schema
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string; full_name_ar: string | null; full_name_en: string | null; phone: string | null; country: string | null; role: 'student' | 'provider' | 'admin'; avatar_url: string | null; created_at: string };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
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
      enrollments: {
        Row: { id: string; user_id: string; course_id: string; progress_data: Record<string, unknown>; completed_at: string | null; enrolled_at: string };
        Insert: { user_id: string; course_id: string; progress_data?: Record<string, unknown> };
        Update: Partial<Database['public']['Tables']['enrollments']['Insert']> & { completed_at?: string };
      };
      services: {
        Row: { id: string; name_ar: string; name_en: string; description_ar: string | null; description_en: string | null; duration_minutes: number; price_aed: number; price_egp: number; price_usd: number; is_active: boolean };
        Insert: Omit<Database['public']['Tables']['services']['Row'], 'id' | 'is_active'>;
        Update: Partial<Database['public']['Tables']['services']['Insert']>;
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
      products: {
        Row: { id: string; name_ar: string; name_en: string; slug: string; description_ar: string | null; description_en: string | null; price_aed: number; price_egp: number; price_usd: number; images: unknown[]; stock: number; is_active: boolean };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'is_active' | 'stock' | 'images'> & { images?: unknown[]; stock?: number };
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
      orders: {
        Row: { id: string; customer_id: string; status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'; total_amount: number; currency: string; payment_gateway: string | null; payment_id: string | null; shipping_address: Record<string, unknown> | null; created_at: string };
        Insert: { customer_id: string; total_amount: number; currency: string };
        Update: Partial<Database['public']['Tables']['orders']['Row']>;
      };
      order_items: {
        Row: { id: string; order_id: string; product_id: string; quantity: number; unit_price: number };
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>;
      };
      bookings: {
        Row: { id: string; service_id: string | null; provider_id: string | null; customer_id: string; start_time: string; end_time: string; status: 'pending' | 'confirmed' | 'completed' | 'cancelled'; payment_id: string | null; notes: string | null; created_at: string };
        Insert: { customer_id: string; start_time: string; end_time: string; service_id?: string; provider_id?: string; notes?: string };
        Update: Partial<Database['public']['Tables']['bookings']['Row']>;
      };
      payments: {
        Row: { id: string; order_id: string | null; booking_id: string | null; gateway: 'stripe' | 'paytabs' | 'tabby'; gateway_payment_id: string | null; amount: number; currency: string; status: 'pending' | 'completed' | 'failed' | 'refunded'; metadata: Record<string, unknown>; created_at: string };
        Insert: { amount: number; currency: string; gateway: 'stripe' | 'paytabs' | 'tabby'; order_id?: string; booking_id?: string };
        Update: Partial<Database['public']['Tables']['payments']['Row']>;
      };
      posts: {
        Row: { id: string; title_ar: string; title_en: string; slug: string; content_ar: string | null; content_en: string | null; excerpt_ar: string | null; excerpt_en: string | null; category: string | null; featured_image: string | null; author_id: string | null; is_published: boolean; published_at: string | null };
        Insert: { title_ar: string; title_en: string; slug: string };
        Update: Partial<Database['public']['Tables']['posts']['Insert']>;
      };
      testimonials: {
        Row: { id: string; author_name_ar: string | null; author_name_en: string | null; content_ar: string; content_en: string | null; coach_id: string | null; program: string | null; rating: number | null; video_url: string | null; is_featured: boolean; source_type: string | null; migrated_at: string | null };
        Insert: { content_ar: string };
        Update: Partial<Database['public']['Tables']['testimonials']['Row']>;
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
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
  };
}
