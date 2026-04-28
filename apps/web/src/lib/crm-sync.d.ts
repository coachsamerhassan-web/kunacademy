/**
 * CRM Sync Engine — KUN Academy
 *
 * Implements the hybrid sync strategy from SPEC-zoho-crm-sync.md (Option C):
 *   - Event-driven: user creation, payment settlement → enqueue immediately
 *   - Batch: cron drains crm_sync_queue; daily cron updates activity status
 *
 * All operations are idempotent:
 *   - upsert_contact: Zoho upsert API deduplicates by email
 *   - create_deal:    guarded by crm_sync_queue; cron skips already-processed ops
 *   - update_status:  idempotent SET regardless of current value
 *
 * Error handling:
 *   - Per-record errors are caught and logged; batch continues
 *   - Failed ops are written to crm_sync_queue with attempts incremented
 *   - Ops exceeding 5 attempts are abandoned (logged; do not crash)
 *
 * Org routing:
 *   CRM is a single org (not per-currency like Books). All contacts land
 *   in the org tied to ZOHO_REFRESH_TOKEN_CORE.
 *   The Contact_Type field ('Coach' | 'Client') and Kun_Activity_Status
 *   custom field carry the KUN-specific data.
 */
import { type CrmContactParams } from './zoho-crm';
/**
 * Enqueue a contact upsert for a newly created (or updated) KUN user.
 * Fire-and-forget: never awaited inline in the request path.
 * If the CRM call succeeds immediately, the queue row is removed.
 * If it fails, the cron picks it up for retry.
 */
export declare function enqueueCrmContactSync(params: CrmContactParams & {
    profile_id: string;
}): Promise<void>;
/**
 * Enqueue a CRM deal creation after a payment settles.
 * Requires that the contact has already been synced (zoho_contact_id must exist).
 * If the contact isn't synced yet, the deal is queued until the next contact sync run.
 */
export declare function enqueueCrmDealSync(params: {
    profile_id: string;
    payment_id: string;
    deal_name: string;
    amount_minor: number;
    currency: string;
    closing_date: string;
    coach_name?: string;
}): Promise<void>;
export interface BatchSyncResult {
    processed: number;
    created: number;
    updated: number;
    errors: string[];
    queue_drained: number;
}
/**
 * Syncs profiles that have never been synced or have changed since last sync.
 * Also drains the crm_sync_queue for retries.
 *
 * @param limit  Max profiles to process in one run (default 50; Zoho CRM API quota guard)
 */
export declare function runBatchContactSync(limit?: number): Promise<BatchSyncResult>;
export interface StatusRefreshResult {
    checked: number;
    updated: number;
    errors: string[];
}
/**
 * Computes Active / Passive / New for every synced contact and pushes
 * status updates to CRM for contacts whose status changed.
 *
 * Active  = booking or settled payment in last 90 days
 * Passive = no activity in 90+ days AND was previously Active
 * New     = account created in last 7 days (always overrides)
 *
 * Only contacts already in crm_sync_state are processed.
 * Limit: 100 per run (daily cron can be run multiple times if needed).
 */
export declare function runDailyStatusRefresh(limit?: number): Promise<StatusRefreshResult>;
//# sourceMappingURL=crm-sync.d.ts.map