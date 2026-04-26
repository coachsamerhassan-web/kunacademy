// @kunacademy/db — Drizzle ORM client (Wave 6.75)
export { db, getPool, withUserContext, withAdminContext, closePool } from './pool';
export { sql, eq, and, or, desc, asc, inArray, isNull, not, count, sum } from 'drizzle-orm';
export { logAdminAction } from './audit';
export type { AuditAction, AdminAuditLog } from './audit';
export { encryptField, decryptField } from './encryption';
// Wave F.4 (2026-04-26) — entitlement helper + auto-provision
export {
  hasFeature,
  listMemberEntitlements,
  autoProvisionFreeMembership,
} from './entitlement';
export type {
  EntitlementGranted,
  EntitlementDenied,
  EntitlementResult,
  HasFeatureOptions,
} from './entitlement';
// Storage utilities: import from '@kunacademy/db/storage' (server-only, uses fs)

// Type exports (Drizzle-inferred, replaces Supabase generated types)
export type {
  Product,
  NewProduct,
  Orders,
  NewOrders,
  Profile,
  NewProfile,
  Enrollment,
  NewEnrollment,
  Booking,
  NewBooking,
  Payment,
  NewPayment,
  Lesson,
  NewLesson,
  Course,
  NewCourse,
  CourseSection,
  NewCourseSection,
  LessonProgress,
  NewLessonProgress,
  LessonSyllabus,
  NewLessonSyllabus,
  DigitalAsset,
  NewDigitalAsset,
  DownloadToken,
  NewDownloadToken,
  BlogPost,
  NewBlogPost,
  CoachRating,
  NewCoachRating,
  CoachBadge,
  NewCoachBadge,
  CreditTransaction,
  NewCreditTransaction,
  Earning,
  NewEarning,
  PayoutRequest,
  NewPayoutRequest,
  CommunityPost,
  NewCommunityPost,
  Certificate,
  NewCertificate,
  Material,
  NewMaterial,
  Service,
  NewService,
  OrderItem,
  NewOrderItem,
} from './types';

export type {
  ProductType,
  OrderStatus,
  EnrollmentStatus,
  EnrollmentType,
  PaymentStatus,
  BookingStatus,
  CreditType,
  EarningSource,
  EarningStatus,
  PayoutStatus,
  ScheduleType,
  BadgeTier,
  CommissionScope,
  VideoProvider,
} from './types';
