// @kunacademy/db — Supabase client + typed queries
export { createBrowserClient, createServerClient, createAdminClient } from './client';
export type { Database, Tables, Profile, Course, Enrollment, Booking, Payment, Service, Product, BlogPost, CoachRating, CoachBadge, CreditTransaction, Earning, PayoutRequest, CommunityPost } from './types';
export type { EnrollmentStatus, EnrollmentType, PaymentStatus, BookingStatus, OrderStatus, CreditType, EarningSource, EarningStatus, PayoutStatus, ScheduleType, BadgeTier, ProductType, CommissionScope } from './types';
