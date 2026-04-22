/**
 * @kunacademy/db — Slim type exports (Wave 6.75d)
 *
 * Replaces the 69KB Supabase-generated types.ts.
 * All types are derived from Drizzle schema using $inferSelect / $inferInsert.
 *
 * NOTE: Supabase types (Database, Tables, etc.) are intentionally removed.
 *       Use Drizzle inferred types or explicit TypeScript interfaces instead.
 */

// ── Drizzle table row types ─────────────────────────────────────────────────

export type { Products as Product, NewProducts as NewProduct } from './schema/products';
export type { Orders, NewOrders } from './schema/orders';
export type { Profiles as Profile, NewProfiles as NewProfile } from './schema/profiles';
export type { Enrollments as Enrollment, NewEnrollments as NewEnrollment } from './schema/enrollments';
export type { Bookings as Booking, NewBookings as NewBooking } from './schema/bookings';
export type { Payments as Payment, NewPayments as NewPayment } from './schema/payments';
export type { Lessons as Lesson, NewLessons as NewLesson } from './schema/lessons';
export type { Courses as Course, NewCourses as NewCourse } from './schema/courses';
export type { CourseSections as CourseSection, NewCourseSections as NewCourseSection } from './schema/course_sections';
export type { LessonProgress, NewLessonProgress } from './schema/lesson_progress';
export type { LessonSyllabus, NewLessonSyllabus } from './schema/lesson_syllabus';
export type { DigitalAssets as DigitalAsset, NewDigitalAssets as NewDigitalAsset } from './schema/digital_assets';
export type { DownloadTokens as DownloadToken, NewDownloadTokens as NewDownloadToken } from './schema/download_tokens';
export type { BlogPosts as BlogPost, NewBlogPosts as NewBlogPost } from './schema/blog_posts';
export type { CoachRatings as CoachRating, NewCoachRatings as NewCoachRating } from './schema/coach_ratings';
export type { CoachBadges as CoachBadge, NewCoachBadges as NewCoachBadge } from './schema/coach_badges';
export type { CreditTransactions as CreditTransaction, NewCreditTransactions as NewCreditTransaction } from './schema/credit_transactions';
export type { Earnings as Earning, NewEarnings as NewEarning } from './schema/earnings';
export type { PayoutRequests as PayoutRequest, NewPayoutRequests as NewPayoutRequest } from './schema/payout_requests';
export type { CommunityPosts as CommunityPost, NewCommunityPosts as NewCommunityPost } from './schema/community_posts';
export type { Certificates as Certificate, NewCertificates as NewCertificate } from './schema/certificates';
export type { Materials as Material, NewMaterials as NewMaterial } from './schema/materials';
export type { Services as Service, NewServices as NewService } from './schema/services';
export type { OrderItems as OrderItem, NewOrderItems as NewOrderItem } from './schema/order_items';

// ── String literal union types (replaces Supabase enum types) ───────────────
// These are used by UI components for type-safe string comparisons.

/** Product type — matches product_type column values */
export type ProductType = 'digital' | 'physical' | 'subscription';

/** Order status — matches orders.status column values */
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

/** Enrollment status — matches enrollments.status column values */
export type EnrollmentStatus = 'active' | 'completed' | 'cancelled' | 'pending';

/** Enrollment type */
export type EnrollmentType = 'online' | 'offline' | 'hybrid';

/** Payment status — matches payments.status column values */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';

/** Booking status — matches bookings.status column values */
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

/** Credit transaction type */
export type CreditType = 'earned' | 'spent' | 'refunded' | 'admin_adjustment';

/** Earning source */
export type EarningSource = 'enrollment' | 'booking' | 'product' | 'referral' | 'commission';

/** Earning status */
export type EarningStatus = 'pending' | 'confirmed' | 'paid' | 'cancelled';

/** Payout status */
export type PayoutStatus = 'pending' | 'approved' | 'paid' | 'rejected';

/** Coach schedule type */
export type ScheduleType = 'recurring' | 'one_time';

/** Coach badge tier */
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

/** Commission scope */
export type CommissionScope = 'global' | 'per_program' | 'per_coach';

/** Video provider — historically `lessons.video_provider` (dropped in migration
 *  0046). Now used by `lesson_blocks.block_data` for block_type='video'. */
export type VideoProvider = 'youtube' | 'vimeo' | 'bunny' | 'local';
