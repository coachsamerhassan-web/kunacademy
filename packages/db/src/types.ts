// Generated from SQL migrations: 20260324_initial_schema.sql,
// 20260324_v2_remaining.sql, 20260324_ems_schema.sql
// 38 tables | All prices INTEGER minor units (250 AED = 25000)

// ── Enum-like union types ──────────────────────────────────────────────────
export type UserRole = 'student' | 'provider' | 'admin';
export type CoachLevel = 'basic' | 'professional' | 'expert' | 'master';
export type NavGroup = 'certifications' | 'courses' | 'retreats' | 'corporate' | 'family' | 'coaching' | 'free';
export type CourseType = 'certification' | 'course' | 'retreat' | 'workshop' | 'masterclass' | 'coaching' | 'webinar' | 'free';
export type PaymentGateway = 'stripe' | 'paytabs' | 'tabby' | 'instapay';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type PostCategory = 'somatic-thinking' | 'parenting' | 'leadership' | 'kinetic-barakah' | 'coaching';
export type DraftStatus = 'pending' | 'approved' | 'rejected';
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type CreditType = 'earn' | 'spend' | 'payout';
export type ProductType = 'physical' | 'digital' | 'hybrid';
export type CommissionScope = 'global' | 'level' | 'profile' | 'item';
export type CommissionCategory = 'services' | 'products';
export type EarningSource = 'service_booking' | 'product_sale' | 'referral';
export type EarningStatus = 'pending' | 'available' | 'paid_out';
export type PayoutStatus = 'requested' | 'approved' | 'processed' | 'rejected';
export type ScheduleType = 'deposit_balance' | 'installment';
export type EnrollmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'dropped';
export type EnrollmentType = 'recorded' | 'live' | 'retreat' | 'coaching_package';
export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'late';
export type MaterialType = 'pdf' | 'video' | 'link' | 'audio' | 'image';
export type BoardType = 'general' | 'cohort' | 'announcements';
export type BoardMemberRole = 'member' | 'moderator' | 'admin';
export type CommunityReaction = 'heart' | 'hands' | 'lightbulb';
export type ServiceAudience = 'seeker' | 'student' | 'corporate';

// ── Row types ──────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  full_name_ar: string | null;
  full_name_en: string | null;
  phone: string | null;
  country: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

export interface Instructor {
  id: string;
  profile_id: string | null;
  slug: string;
  title_ar: string;
  title_en: string;
  bio_ar: string | null;
  bio_en: string | null;
  photo_url: string | null;
  credentials: string | null;
  coach_level: CoachLevel | null;
  specialties: string[] | null;
  coaching_styles: string[] | null;
  development_types: string[] | null;
  pricing_json: Record<string, unknown> | null;
  is_visible: boolean;
  is_platform_coach: boolean;
  display_order: number;
}

export interface Payment {
  id: string;
  order_id: string | null;
  booking_id: string | null;
  gateway: PaymentGateway | null;
  gateway_payment_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Course {
  id: string;
  title_ar: string;
  title_en: string;
  slug: string;
  description_ar: string | null;
  description_en: string | null;
  instructor_id: string | null;
  coach_ids: string[] | null;
  price_aed: number;
  price_egp: number;
  price_usd: number;
  price_eur: number;
  duration_hours: number | null;
  level: string | null;
  nav_group: NavGroup | null;
  internal_category: string | null;
  type: CourseType | null;
  format: string | null;
  location: string | null;
  is_featured: boolean;
  is_free: boolean;
  is_icf_accredited: boolean;
  icf_details: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  created_at: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  title_ar: string;
  title_en: string;
  content_ar: string | null;
  content_en: string | null;
  video_url: string | null;
  order: number;
  duration_minutes: number | null;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  progress_data: Record<string, unknown>;
  completed_at: string | null;
  enrolled_at: string;
  status: EnrollmentStatus;
  enrollment_type: EnrollmentType;
  expires_at: string | null;
}

export interface Service {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  duration_minutes: number;
  price_aed: number;
  price_egp: number;
  price_usd: number;
  is_active: boolean;
  commission_override_pct: number | null;
  category_id: string | null;
  sessions_count: number | null;
  validity_days: number | null;
}

export interface Provider {
  id: string;
  profile_id: string | null;
  bio_ar: string | null;
  bio_en: string | null;
  specialties: string[] | null;
  languages: string[] | null;
  credentials: string | null;
  is_visible: boolean;
}

export interface Availability {
  id: string;
  provider_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface Product {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  description_ar: string | null;
  description_en: string | null;
  price_aed: number;
  price_egp: number;
  price_usd: number;
  images: unknown[];
  stock: number;
  is_active: boolean;
  product_type: ProductType;
  creator_id: string | null;
  commission_override_pct: number | null;
}

export interface Order {
  id: string;
  customer_id: string;
  status: OrderStatus;
  total_amount: number;
  currency: string;
  payment_gateway: string | null;
  payment_id: string | null;
  shipping_address: Record<string, unknown> | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface Booking {
  id: string;
  service_id: string | null;
  provider_id: string | null;
  customer_id: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  payment_id: string | null;
  notes: string | null;
  created_at: string;
  coach_id: string | null;
  meeting_url: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
}

export interface Post {
  id: string;
  title_ar: string;
  title_en: string;
  slug: string;
  content_ar: string | null;
  content_en: string | null;
  excerpt_ar: string | null;
  excerpt_en: string | null;
  category: PostCategory | null;
  featured_image: string | null;
  author_id: string | null;
  is_published: boolean;
  published_at: string | null;
}

export interface Testimonial {
  id: string;
  author_name_ar: string | null;
  author_name_en: string | null;
  content_ar: string;
  content_en: string | null;
  coach_id: string | null;
  program: string | null;
  rating: number | null;
  video_url: string | null;
  is_featured: boolean;
  source_type: string | null;
  migrated_at: string | null;
}

export interface InstructorDraft {
  id: string;
  instructor_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  status: DraftStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewer_id: string | null;
  review_note: string | null;
}

// ── v2_remaining tables ────────────────────────────────────────────────────

export interface CoachRating {
  id: string;
  coach_id: string;
  user_id: string;
  rating: number;
  review_text: string | null;
  testimonial_id: string | null;
  booking_id: string | null;
  is_published: boolean;
  created_at: string;
}

export interface CoachBadge {
  coach_id: string;
  badge_tier: BadgeTier;
  avg_rating: number;
  review_count: number;
  updated_at: string;
}

export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: CreditType;
  source_type: string | null;
  source_id: string | null;
  balance_after: number;
  note: string | null;
  created_at: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string | null;
  body_ar: string | null;
  body_en: string | null;
  excerpt_ar: string | null;
  excerpt_en: string | null;
  author_id: string | null;
  category: string | null;
  tags: string[] | null;
  featured_image: string | null;
  content_doc_id: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DigitalAsset {
  id: string;
  product_id: string;
  file_url: string;
  file_type: string;
  file_size_bytes: number | null;
  display_name: string | null;
  created_at: string;
}

export interface DownloadToken {
  id: string;
  order_item_id: string;
  user_id: string;
  asset_id: string;
  token: string;
  expires_at: string;
  download_count: number;
  max_downloads: number;
  created_at: string;
}

export interface CommissionRate {
  id: string;
  scope: CommissionScope;
  scope_id: string | null;
  category: CommissionCategory;
  rate_pct: number;
  created_by: string | null;
  created_at: string;
}

export interface Earning {
  id: string;
  user_id: string;
  source_type: EarningSource;
  source_id: string | null;
  gross_amount: number;
  commission_pct: number;
  commission_amount: number;
  net_amount: number;
  currency: string;
  status: EarningStatus;
  created_at: string;
}

export interface PayoutRequest {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  processed_by: string | null;
  processed_at: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

export interface PaymentSchedule {
  id: string;
  payment_id: string;
  user_id: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  schedule_type: ScheduleType;
  installments: unknown[];
  currency: string;
  created_at: string;
}

// ── EMS tables ─────────────────────────────────────────────────────────────

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  playback_position_seconds: number;
  completed: boolean;
  completed_at: string | null;
  updated_at: string;
}

export interface Attendance {
  id: string;
  enrollment_id: string;
  session_date: string;
  session_number: number | null;
  status: AttendanceStatus;
  notes: string | null;
  marked_by: string | null;
  created_at: string;
}

export interface Material {
  id: string;
  course_id: string;
  title_ar: string;
  title_en: string;
  type: MaterialType;
  url: string;
  access_duration_days: number | null;
  display_order: number;
  is_published: boolean;
  created_at: string;
}

export interface Certificate {
  id: string;
  user_id: string;
  enrollment_id: string;
  template_id: string | null;
  credential_type: string | null;
  issued_at: string;
  pdf_url: string | null;
  verification_code: string;
}

export interface CoachSchedule {
  id: string;
  coach_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
}

export interface CoachTimeOff {
  id: string;
  coach_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string;
}

export interface ServiceCategory {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  audience: ServiceAudience;
  display_order: number;
}

export interface CommunityBoard {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  type: BoardType;
  is_admin_only: boolean;
  course_id: string | null;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  board_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunityReactionRow {
  id: string;
  post_id: string;
  user_id: string;
  reaction: CommunityReaction;
  created_at: string;
}

export interface BoardMember {
  id: string;
  board_id: string;
  user_id: string;
  role: BoardMemberRole;
  joined_at: string;
}

// ── Database interface (Supabase-compatible) ───────────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & Pick<Profile, 'id' | 'email'>; Update: Partial<Profile> };
      instructors: { Row: Instructor; Insert: Partial<Instructor> & Pick<Instructor, 'slug' | 'title_ar' | 'title_en'>; Update: Partial<Instructor> };
      payments: { Row: Payment; Insert: Partial<Payment> & Pick<Payment, 'amount' | 'currency'>; Update: Partial<Payment> };
      courses: { Row: Course; Insert: Partial<Course> & Pick<Course, 'title_ar' | 'title_en' | 'slug'>; Update: Partial<Course> };
      lessons: { Row: Lesson; Insert: Partial<Lesson> & Pick<Lesson, 'course_id' | 'title_ar' | 'title_en' | 'order'>; Update: Partial<Lesson> };
      enrollments: { Row: Enrollment; Insert: Partial<Enrollment> & Pick<Enrollment, 'user_id' | 'course_id'>; Update: Partial<Enrollment> };
      services: { Row: Service; Insert: Partial<Service> & Pick<Service, 'name_ar' | 'name_en' | 'duration_minutes'>; Update: Partial<Service> };
      providers: { Row: Provider; Insert: Partial<Provider>; Update: Partial<Provider> };
      availability: { Row: Availability; Insert: Partial<Availability> & Pick<Availability, 'provider_id' | 'day_of_week' | 'start_time' | 'end_time'>; Update: Partial<Availability> };
      products: { Row: Product; Insert: Partial<Product> & Pick<Product, 'name_ar' | 'name_en' | 'slug'>; Update: Partial<Product> };
      orders: { Row: Order; Insert: Partial<Order> & Pick<Order, 'customer_id' | 'total_amount' | 'currency'>; Update: Partial<Order> };
      order_items: { Row: OrderItem; Insert: Partial<OrderItem> & Pick<OrderItem, 'order_id' | 'product_id' | 'unit_price'>; Update: Partial<OrderItem> };
      bookings: { Row: Booking; Insert: Partial<Booking> & Pick<Booking, 'customer_id' | 'start_time' | 'end_time'>; Update: Partial<Booking> };
      posts: { Row: Post; Insert: Partial<Post> & Pick<Post, 'title_ar' | 'title_en' | 'slug'>; Update: Partial<Post> };
      testimonials: { Row: Testimonial; Insert: Partial<Testimonial> & Pick<Testimonial, 'content_ar'>; Update: Partial<Testimonial> };
      instructor_drafts: { Row: InstructorDraft; Insert: Partial<InstructorDraft> & Pick<InstructorDraft, 'instructor_id' | 'field_name'>; Update: Partial<InstructorDraft> };
      coach_ratings: { Row: CoachRating; Insert: Partial<CoachRating> & Pick<CoachRating, 'coach_id' | 'user_id' | 'rating'>; Update: Partial<CoachRating> };
      coach_badges: { Row: CoachBadge; Insert: Partial<CoachBadge> & Pick<CoachBadge, 'coach_id' | 'badge_tier'>; Update: Partial<CoachBadge> };
      referral_codes: { Row: ReferralCode; Insert: Partial<ReferralCode> & Pick<ReferralCode, 'user_id' | 'code'>; Update: Partial<ReferralCode> };
      credit_transactions: { Row: CreditTransaction; Insert: Partial<CreditTransaction> & Pick<CreditTransaction, 'user_id' | 'amount' | 'type' | 'balance_after'>; Update: Partial<CreditTransaction> };
      blog_posts: { Row: BlogPost; Insert: Partial<BlogPost> & Pick<BlogPost, 'slug' | 'title_ar'>; Update: Partial<BlogPost> };
      digital_assets: { Row: DigitalAsset; Insert: Partial<DigitalAsset> & Pick<DigitalAsset, 'product_id' | 'file_url' | 'file_type'>; Update: Partial<DigitalAsset> };
      download_tokens: { Row: DownloadToken; Insert: Partial<DownloadToken> & Pick<DownloadToken, 'order_item_id' | 'user_id' | 'asset_id' | 'expires_at'>; Update: Partial<DownloadToken> };
      commission_rates: { Row: CommissionRate; Insert: Partial<CommissionRate> & Pick<CommissionRate, 'scope' | 'category' | 'rate_pct'>; Update: Partial<CommissionRate> };
      earnings: { Row: Earning; Insert: Partial<Earning> & Pick<Earning, 'user_id' | 'source_type' | 'gross_amount' | 'commission_pct' | 'commission_amount' | 'net_amount'>; Update: Partial<Earning> };
      payout_requests: { Row: PayoutRequest; Insert: Partial<PayoutRequest> & Pick<PayoutRequest, 'user_id' | 'amount'>; Update: Partial<PayoutRequest> };
      payment_schedules: { Row: PaymentSchedule; Insert: Partial<PaymentSchedule> & Pick<PaymentSchedule, 'payment_id' | 'user_id' | 'total_amount' | 'remaining_amount' | 'schedule_type'>; Update: Partial<PaymentSchedule> };
      lesson_progress: { Row: LessonProgress; Insert: Partial<LessonProgress> & Pick<LessonProgress, 'user_id' | 'lesson_id'>; Update: Partial<LessonProgress> };
      attendance: { Row: Attendance; Insert: Partial<Attendance> & Pick<Attendance, 'enrollment_id' | 'session_date' | 'status'>; Update: Partial<Attendance> };
      materials: { Row: Material; Insert: Partial<Material> & Pick<Material, 'course_id' | 'title_ar' | 'title_en' | 'type' | 'url'>; Update: Partial<Material> };
      certificates: { Row: Certificate; Insert: Partial<Certificate> & Pick<Certificate, 'user_id' | 'enrollment_id'>; Update: Partial<Certificate> };
      coach_schedules: { Row: CoachSchedule; Insert: Partial<CoachSchedule> & Pick<CoachSchedule, 'coach_id' | 'day_of_week' | 'start_time' | 'end_time'>; Update: Partial<CoachSchedule> };
      coach_time_off: { Row: CoachTimeOff; Insert: Partial<CoachTimeOff> & Pick<CoachTimeOff, 'coach_id' | 'start_date' | 'end_date'>; Update: Partial<CoachTimeOff> };
      service_categories: { Row: ServiceCategory; Insert: Partial<ServiceCategory> & Pick<ServiceCategory, 'slug' | 'name_ar' | 'name_en' | 'audience'>; Update: Partial<ServiceCategory> };
      community_boards: { Row: CommunityBoard; Insert: Partial<CommunityBoard> & Pick<CommunityBoard, 'slug' | 'name_ar' | 'name_en' | 'type'>; Update: Partial<CommunityBoard> };
      community_posts: { Row: CommunityPost; Insert: Partial<CommunityPost> & Pick<CommunityPost, 'board_id' | 'author_id' | 'content'>; Update: Partial<CommunityPost> };
      community_reactions: { Row: CommunityReactionRow; Insert: Partial<CommunityReactionRow> & Pick<CommunityReactionRow, 'post_id' | 'user_id' | 'reaction'>; Update: Partial<CommunityReactionRow> };
      board_members: { Row: BoardMember; Insert: Partial<BoardMember> & Pick<BoardMember, 'board_id' | 'user_id'>; Update: Partial<BoardMember> };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
  };
}

// ── Helper type: extract Row from table name ───────────────────────────────
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
