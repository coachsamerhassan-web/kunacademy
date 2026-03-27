// @kunacademy/db — Supabase client + typed queries
export { createBrowserClient, createServerClient, createAdminClient, isSupabaseConfigured } from './client';
export type { TypedSupabaseClient } from './client';
export type { Database, Tables, Profile, Course, CourseSection, Lesson, LessonSyllabus, LessonProgress, Enrollment, Booking, Payment, Service, Product, Order, OrderItem, DigitalAsset, DownloadToken, BlogPost, CoachRating, CoachBadge, CreditTransaction, Earning, PayoutRequest, CommunityPost, Certificate, Material, VideoProvider } from './types';
export type { EnrollmentStatus, EnrollmentType, PaymentStatus, BookingStatus, OrderStatus, CreditType, EarningSource, EarningStatus, PayoutStatus, ScheduleType, BadgeTier, ProductType, CommissionScope } from './types';
