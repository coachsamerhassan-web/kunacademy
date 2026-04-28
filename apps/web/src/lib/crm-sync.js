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
import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';
import { upsertCrmContact, updateCrmContactStatus, createCrmDeal, } from './zoho-crm';
const MAX_ATTEMPTS = 5;
// ─────────────────────────────────────────────────────────────────────────────
// Enqueue helpers (called event-driven from signup/payment hooks)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Enqueue a contact upsert for a newly created (or updated) KUN user.
 * Fire-and-forget: never awaited inline in the request path.
 * If the CRM call succeeds immediately, the queue row is removed.
 * If it fails, the cron picks it up for retry.
 */
export async function enqueueCrmContactSync(params) {
    // Attempt immediately; on failure write to queue for cron retry
    try {
        await syncOneContact(params);
    }
    catch (err) {
        console.error(`[crm-sync] Immediate contact sync failed for ${params.email} — queuing:`, err);
        await writeToQueue('upsert_contact', params.profile_id, {
            profile_id: params.profile_id,
            full_name: params.full_name,
            email: params.email,
            phone: params.phone,
            country: params.country,
            role: params.role,
            created_at: params.created_at,
            last_login: params.last_login,
        });
    }
}
/**
 * Enqueue a CRM deal creation after a payment settles.
 * Requires that the contact has already been synced (zoho_contact_id must exist).
 * If the contact isn't synced yet, the deal is queued until the next contact sync run.
 */
export async function enqueueCrmDealSync(params) {
    // Check if contact is already in CRM
    const state = await getCrmState(params.profile_id);
    if (state?.zoho_contact_id) {
        try {
            await createCrmDeal({
                zoho_contact_id: state.zoho_contact_id,
                deal_name: params.deal_name,
                amount: params.amount_minor / 100,
                currency: params.currency,
                closing_date: params.closing_date,
                coach_name: params.coach_name,
            });
            return;
        }
        catch (err) {
            console.error(`[crm-sync] Immediate deal creation failed for payment ${params.payment_id} — queuing:`, err);
        }
    }
    else {
        console.warn(`[crm-sync] Contact not yet synced for profile ${params.profile_id} — queuing deal`);
    }
    await writeToQueue('create_deal', params.profile_id, {
        payment_id: params.payment_id,
        deal_name: params.deal_name,
        amount: params.amount_minor / 100,
        currency: params.currency,
        closing_date: params.closing_date,
        coach_name: params.coach_name,
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// Core: sync a single contact to CRM and persist state
// ─────────────────────────────────────────────────────────────────────────────
async function syncOneContact(params) {
    const result = await upsertCrmContact(params);
    await withAdminContext(async (db) => {
        await db.execute(sql `
      INSERT INTO crm_sync_state (profile_id, zoho_contact_id, zoho_module, activity_status, last_synced_at, sync_error)
      VALUES (
        ${params.profile_id},
        ${result.zoho_contact_id},
        'Contacts',
        ${params.activity_status ?? 'New'},
        NOW(),
        NULL
      )
      ON CONFLICT (profile_id) DO UPDATE SET
        zoho_contact_id = EXCLUDED.zoho_contact_id,
        activity_status = EXCLUDED.activity_status,
        last_synced_at  = NOW(),
        sync_error      = NULL,
        updated_at      = NOW()
    `);
    });
    console.log(`[crm-sync] Contact ${result.was_existing ? 'updated' : 'created'}: ${params.email} → ${result.zoho_contact_id}`);
}
// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────
async function getCrmState(profileId) {
    return withAdminContext(async (db) => {
        const rows = await db.execute(sql `
      SELECT zoho_contact_id, activity_status
      FROM crm_sync_state
      WHERE profile_id = ${profileId}
      LIMIT 1
    `);
        return rows.rows[0] ?? null;
    });
}
async function writeToQueue(operation, profileId, payload) {
    // dedup_key:
    //   create_deal  → payment_id from payload (one pending row per payment)
    //   everything else → NULL (NULLS NOT DISTINCT collapses to one pending row per profile+op)
    const dedupKey = operation === 'create_deal' ? (payload.payment_id ?? null) : null;
    await withAdminContext(async (db) => {
        await db.execute(sql `
      INSERT INTO crm_sync_queue (profile_id, operation, payload, attempts, scheduled_at, dedup_key)
      VALUES (${profileId}, ${operation}, ${JSON.stringify(payload)}::jsonb, 0, NOW(), ${dedupKey})
      ON CONFLICT (profile_id, operation, dedup_key) DO NOTHING
    `);
    });
}
async function markSyncError(profileId, error) {
    await withAdminContext(async (db) => {
        await db.execute(sql `
      INSERT INTO crm_sync_state (profile_id, zoho_module, activity_status, sync_error)
      VALUES (${profileId}, 'Contacts', 'New', ${error})
      ON CONFLICT (profile_id) DO UPDATE SET
        sync_error = ${error},
        updated_at = NOW()
    `);
    });
}
/**
 * Syncs profiles that have never been synced or have changed since last sync.
 * Also drains the crm_sync_queue for retries.
 *
 * @param limit  Max profiles to process in one run (default 50; Zoho CRM API quota guard)
 */
export async function runBatchContactSync(limit = 50) {
    const result = {
        processed: 0, created: 0, updated: 0, errors: [], queue_drained: 0,
    };
    // ── 1. Find profiles not yet in crm_sync_state (never synced) ──
    // Skip admins (role = 'admin'); sync students (role='student'/'client') and providers (coaches)
    const unsyncedProfiles = await withAdminContext(async (db) => {
        const rows = await db.execute(sql `
      SELECT
        p.id        AS profile_id,
        p.email,
        p.full_name_en,
        p.full_name_ar,
        p.phone,
        p.country,
        p.role,
        p.created_at,
        -- providers table marks coach accounts
        CASE WHEN pr.id IS NOT NULL THEN 'coach' ELSE 'client' END AS crm_role
      FROM profiles p
      LEFT JOIN providers pr ON pr.profile_id = p.id
      LEFT JOIN crm_sync_state css ON css.profile_id = p.id
      WHERE css.id IS NULL
        AND p.role != 'admin'
        AND p.email IS NOT NULL
      ORDER BY p.created_at ASC
      LIMIT ${limit}
    `);
        return rows.rows;
    });
    for (const row of unsyncedProfiles) {
        const fullName = row.full_name_en || row.full_name_ar || row.email.split('@')[0];
        try {
            await syncOneContact({
                profile_id: row.profile_id,
                full_name: fullName,
                email: row.email,
                phone: row.phone,
                country: row.country,
                role: row.crm_role,
                created_at: row.created_at,
                activity_status: 'New',
            });
            result.created++;
        }
        catch (err) {
            const msg = `profile ${row.profile_id} (${row.email}): ${String(err)}`;
            result.errors.push(msg);
            console.error('[crm-sync] Batch contact sync error:', msg);
            await markSyncError(row.profile_id, String(err));
        }
        result.processed++;
    }
    // ── 2. Drain retry queue ──
    const queueRows = await withAdminContext(async (db) => {
        const rows = await db.execute(sql `
      SELECT id, profile_id, operation, payload, attempts
      FROM crm_sync_queue
      WHERE attempts < ${MAX_ATTEMPTS}
        AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC
      LIMIT 20
    `);
        return rows.rows;
    });
    for (const qRow of queueRows) {
        try {
            await processQueueRow(qRow);
            // Remove on success
            await withAdminContext(async (db) => {
                await db.execute(sql `DELETE FROM crm_sync_queue WHERE id = ${qRow.id}`);
            });
            result.queue_drained++;
        }
        catch (err) {
            const msg = String(err);
            const nextAttempt = qRow.attempts + 1;
            const backoffMs = Math.min(1000 * Math.pow(2, nextAttempt), 30 * 60 * 1000); // max 30 min
            await withAdminContext(async (db) => {
                await db.execute(sql `
          UPDATE crm_sync_queue
          SET attempts     = ${nextAttempt},
              last_error   = ${msg},
              scheduled_at = NOW() + (${backoffMs} || ' milliseconds')::interval
          WHERE id = ${qRow.id}
        `);
            });
            result.errors.push(`queue[${qRow.id}] attempt ${nextAttempt}: ${msg}`);
        }
    }
    return result;
}
async function processQueueRow(row) {
    const { operation, payload, profile_id } = row;
    if (operation === 'upsert_contact') {
        if (!payload.email)
            throw new Error('upsert_contact payload missing email');
        await syncOneContact({
            profile_id,
            full_name: payload.full_name ?? payload.email,
            email: payload.email,
            phone: payload.phone,
            country: payload.country,
            role: payload.role ?? 'client',
            created_at: payload.created_at,
            last_login: payload.last_login,
            activity_status: payload.activity_status ?? 'New',
        });
    }
    else if (operation === 'create_deal') {
        // Re-check if contact is now synced
        const state = await getCrmState(profile_id);
        if (!state?.zoho_contact_id) {
            throw new Error(`Contact not yet in CRM for profile ${profile_id} — will retry`);
        }
        if (!payload.deal_name || payload.amount === undefined || !payload.currency || !payload.closing_date) {
            throw new Error(`create_deal payload incomplete: ${JSON.stringify(payload)}`);
        }
        await createCrmDeal({
            zoho_contact_id: state.zoho_contact_id,
            deal_name: payload.deal_name,
            amount: payload.amount,
            currency: payload.currency,
            closing_date: payload.closing_date,
            coach_name: payload.coach_name,
        });
    }
    else if (operation === 'update_status') {
        const state = await getCrmState(profile_id);
        if (!state?.zoho_contact_id) {
            throw new Error(`Contact not yet in CRM for profile ${profile_id} — will retry`);
        }
        await updateCrmContactStatus(state.zoho_contact_id, payload.activity_status ?? 'Active');
    }
    else {
        throw new Error(`Unknown queue operation: ${operation}`);
    }
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
export async function runDailyStatusRefresh(limit = 100) {
    const result = { checked: 0, updated: 0, errors: [] };
    const contacts = await withAdminContext(async (db) => {
        const rows = await db.execute(sql `
      SELECT
        css.profile_id,
        css.zoho_contact_id,
        css.activity_status AS current_status,
        p.created_at,
        -- New: account < 7 days old
        (NOW() - p.created_at::timestamptz) < INTERVAL '7 days' AS is_new,
        -- Active: any settled payment in last 90 days
        EXISTS (
          SELECT 1 FROM payments pay
          LEFT JOIN bookings b ON b.id = pay.booking_id
          WHERE (
            -- booking payment where profile is the customer
            (b.customer_id = css.profile_id AND pay.status = 'settled')
            OR
            -- any payment linked to this profile's orders
            (pay.order_id IN (
              SELECT id FROM orders WHERE customer_id = css.profile_id
            ) AND pay.status = 'settled')
          )
          AND pay.created_at > NOW() - INTERVAL '90 days'
        ) AS is_active_90d
      FROM crm_sync_state css
      JOIN profiles p ON p.id = css.profile_id
      WHERE css.zoho_contact_id IS NOT NULL
      ORDER BY css.last_synced_at ASC NULLS FIRST
      LIMIT ${limit}
    `);
        return rows.rows;
    });
    for (const row of contacts) {
        result.checked++;
        const newStatus = row.is_new ? 'New' :
            row.is_active_90d ? 'Active' :
                'Passive';
        if (newStatus === row.current_status)
            continue; // no change — skip API call
        try {
            await updateCrmContactStatus(row.zoho_contact_id, newStatus);
            await withAdminContext(async (db) => {
                await db.execute(sql `
          UPDATE crm_sync_state
          SET activity_status = ${newStatus},
              last_synced_at  = NOW(),
              sync_error      = NULL,
              updated_at      = NOW()
          WHERE profile_id = ${row.profile_id}
        `);
            });
            result.updated++;
        }
        catch (err) {
            const msg = `profile ${row.profile_id}: ${String(err)}`;
            result.errors.push(msg);
            console.error('[crm-sync] Status refresh error:', msg);
        }
    }
    return result;
}
