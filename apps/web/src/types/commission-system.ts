/**
 * Commission System Type Definitions
 * Authoritative schema for earnings, payouts, and commission rates
 * All amounts are in minor units (e.g., 250 AED = 25000)
 */

export interface CommissionRate {
  id: string;
  scope: 'global' | 'coach' | 'product' | 'service';
  scope_id: string | null;
  category: 'services' | 'products';
  rate_pct: number; // 0-100
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Earning {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string | null;
  gross_amount: number; // minor units (e.g., 25000 = 250 AED)
  commission_pct: number; // 0-100
  commission_amount: number; // minor units
  net_amount: number; // minor units
  currency: string; // e.g., 'AED'
  status: string | null;
  available_at: string | null; // ISO timestamp (7 days after creation)
  created_at: string | null;
}

export interface PayoutRequest {
  id: string;
  user_id: string;
  amount: number; // minor units
  currency: string;
  status: 'requested' | 'approved' | 'processed' | 'rejected';
  bank_details: {
    bank_name: string;
    iban: string;
    account_name: string;
  };
  admin_note: string | null;
  processed_by: string | null;
  processed_at: string | null;
  requested_at: string;
  created_at: string;
}

export interface CoachProfile {
  id: string;
  full_name: string;
  email: string;
  role: 'coach' | 'admin' | 'user';
}

/**
 * API Request/Response Types
 */

export interface CommissionRatePayload {
  scope: 'global' | 'coach' | 'product' | 'service';
  scope_id?: string | null;
  rate_pct: number;
  category?: 'services' | 'products';
}

export interface EarningPayload {
  source_type: 'service_booking' | 'product_sale' | 'referral';
  source_id: string;
  coach_id: string;
  gross_amount: number; // minor units
  currency?: string;
}

export interface PayoutRequestPayload {
  amount: number; // minor units
  currency?: string;
  bank_details: {
    bank_name: string;
    iban: string;
    account_name: string;
  };
}

export interface PayoutActionPayload {
  payout_id: string;
  action: 'approve' | 'reject' | 'complete';
  admin_note?: string;
}

/**
 * API Response Types
 */

export interface PayoutsResponse {
  payouts: PayoutRequest[];
  available_balance: number; // minor units
}

export interface CommissionsResponse {
  rates: CommissionRate[];
}

export interface EarningResponse {
  earning: Earning;
}

export interface PayoutResponse {
  payout: PayoutRequest;
}
