/**
 * Zoho CRM API client for KUN Academy.
 *
 * Scope required: ZohoCRM.modules.ALL, ZohoCRM.settings.ALL
 * Credentials: same client_id / client_secret as zoho-books.ts
 * Refresh token: ZOHO_REFRESH_TOKEN_CORE (also covers CRM per zoho-one.env)
 *
 * Differences from zoho-books.ts:
 *   - Targets https://www.zohoapis.com/crm/v3 (not Books API)
 *   - Separate in-process token cache (different resource, same credentials)
 *   - CRM rate limits: 100 requests/min per org — backoff on 429
 *   - Upsert via duplicate_check_fields (idempotent by email)
 *
 * Cross-org note (per feedback_programs_cross_org.md):
 *   Zoho CRM does not have a multi-org concept like Books.
 *   All contacts/leads go into the single CRM org tied to ZOHO_REFRESH_TOKEN_CORE.
 *   Contact Type custom field marks UAE vs Egypt origin.
 */
export type CrmRole = 'client' | 'coach';
export type ActivityStatus = 'New' | 'Active' | 'Passive';
export interface CrmContactParams {
    /** Full name (English preferred; falls back to Arabic) */
    full_name: string;
    email: string;
    phone?: string | null;
    country?: string | null;
    /** KUN role → determines Contact_Type custom field */
    role: CrmRole;
    /** ISO timestamp — maps to Created_Time */
    created_at?: string;
    /** ISO timestamp — maps to Last_Activity_Time */
    last_login?: string | null;
    /** Activity classification */
    activity_status?: ActivityStatus;
}
export interface CrmContactResult {
    zoho_contact_id: string;
    /** true when we found + updated an existing contact instead of creating */
    was_existing: boolean;
}
export interface CrmDealParams {
    zoho_contact_id: string;
    deal_name: string;
    /** Amount in MAJOR units */
    amount: number;
    currency: string;
    /** ISO date YYYY-MM-DD */
    closing_date: string;
    coach_name?: string;
    stage?: string;
}
export interface CrmDealResult {
    zoho_deal_id: string;
}
/**
 * Upserts a Zoho CRM Contact by email.
 * If a contact with the same email exists, it is updated.
 * If not, a new Contact is created.
 *
 * Uses /crm/v3/Contacts/upsert with duplicate_check_fields=Email
 * so the operation is idempotent regardless of how many times it runs.
 */
export declare function upsertCrmContact(params: CrmContactParams): Promise<CrmContactResult>;
export declare function updateCrmContactStatus(zohoContactId: string, status: ActivityStatus): Promise<void>;
/**
 * Creates a CRM Deal linked to the given Contact.
 * Each payment becomes a separate Deal so Samer can see purchase history
 * without navigating away from the Contact record.
 *
 * Idempotency: the caller is responsible for not calling this twice for the
 * same payment_id. The CRM sync engine stores state in crm_sync_queue with
 * operation='create_deal' keyed on payment_id in the payload.
 */
export declare function createCrmDeal(params: CrmDealParams): Promise<CrmDealResult>;
export interface FieldCheckResult {
    ok: boolean;
    missing: string[];
}
/**
 * Queries Zoho CRM metadata API to verify required custom fields exist.
 * Returns { ok: true } if both fields present, or { ok: false, missing: [...] }.
 * Wraps errors gracefully — if metadata API fails, logs warning and allows sync to continue.
 */
export declare function checkZohoCustomFields(): Promise<FieldCheckResult>;
//# sourceMappingURL=zoho-crm.d.ts.map