/**
 * @kunacademy/db/entitlement — Wave F.4 (2026-04-26)
 *
 * Single source of truth for tier-derived entitlement checks. Wraps the
 * `memberships → tiers → tier_features → features` join into one helper
 * usable from server routes, server components, and webhook handlers.
 *
 * Replaces F.5's hardcoded `tier.slug='paid-1'` lookup that the resolver
 * used. Going forward, every "is this user entitled to feature X?" call
 * goes through here.
 *
 * Locked decisions (DECISIONS-LEDGER 2026-04-24):
 *   d-canon-phase2-m3   Paid-1 = body-foundations + compass-work +
 *                        community-write + monthly Q&A
 *   d-canon-phase2-fw8  Free community = read-only (no write feature)
 *   d-canon-phase2-fw9  Auto-provision Free on signup
 *   d-canon-phase2-f5   Strict entitlement; no Free preview of Paid
 *
 * Caching strategy: per-request, in-memory only. The same userId+featureKey
 * called twice within the same request returns the cached answer. Cache
 * is keyed on the AsyncLocalStorage request scope where available; falls
 * back to a process-wide WeakMap of "request" objects when no ALS surface.
 * Cross-request caching is deliberately NOT implemented at launch:
 *   - Tier changes (subscribe / cancel / webhook update) need immediate
 *     visibility.
 *   - Membership state is small + the DB query is one round-trip with
 *     proper indexes (memberships_user_active_uidx + tier_features pk).
 *   - Stale-cache bugs are far worse than a few ms of repeat DB read.
 *   - If load warrants it later, swap in a Redis cache with explicit
 *     invalidation hooks in the webhook + cancel routes.
 *
 * The cache is keyed on (userId, featureKey, requestScope) to prevent
 * cross-request leakage. To be safe under hostile inputs, no cache is
 * used at all when userId is null (anon path) or when no request scope
 * is provided.
 */

import { sql } from 'drizzle-orm';
import { withAdminContext } from './pool';

// ─── Public types ────────────────────────────────────────────────────────────

export interface EntitlementGranted {
  granted: true;
  /** Tier slug that grants this feature (for diagnostics). */
  tier_slug: string;
  /** Tier id (for foreign-key writes — e.g. when issuing a member-auto coupon). */
  tier_id: string;
  /** Feature row id. */
  feature_id: string;
  /** Quota slot for `feature_type='quota'` features. NULL = unlimited. */
  quota: number | null;
  /** Tier-feature config blob (JSONB) — e.g. discount_percentage for member discount. */
  config: Record<string, unknown> | null;
}

export interface EntitlementDenied {
  granted: false;
  /** Why: 'no_active_membership' | 'feature_not_in_tier' | 'feature_excluded' | 'feature_not_found' */
  reason: 'no_active_membership' | 'feature_not_in_tier' | 'feature_excluded' | 'feature_not_found';
  /** Current membership tier slug, if any (for paywall messaging). */
  current_tier_slug?: string;
}

export type EntitlementResult = EntitlementGranted | EntitlementDenied;

// ─── Per-request cache ───────────────────────────────────────────────────────
// We use a WeakMap keyed on the cache scope object the caller passes. When
// the scope object is GC'd (i.e. the request has finished processing),
// cached entries are released. This avoids any cross-request leakage AND
// any unbounded memory growth.

type CacheKey = `${string}::${string}`;
const requestCaches = new WeakMap<object, Map<CacheKey, EntitlementResult>>();

function makeCacheKey(userId: string, featureKey: string): CacheKey {
  return `${userId}::${featureKey}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface HasFeatureOptions {
  /**
   * Optional cache scope. Pass an object that is unique to the request
   * (e.g. `req` or `headers()`). When provided, the result is memoized for
   * the lifetime of that object. When omitted, no caching.
   */
  cacheScope?: object;
  /**
   * Override "now" for tests. Ms since epoch.
   */
  nowMs?: number;
}

/**
 * Single feature-entitlement check.
 *
 * @param userId — profiles.id of the authenticated user, or null for anon.
 * @param featureKey — the stable feature_key (see seeded catalog).
 * @param opts — optional cache scope + clock injection.
 * @returns granted/denied with metadata (tier_slug, quota, config).
 *
 * Anonymous users (userId=null) are NEVER granted. Marketing/public-facing
 * pages are NOT entitlement-gated — they're rendered with metadata-only
 * paywall components for unauthenticated viewers per d-canon-phase2-f5.
 *
 * Mostly-equivalent to:
 *   SELECT t.slug, tf.included, tf.quota, tf.config
 *   FROM memberships m
 *   JOIN tiers t ON t.id = m.tier_id
 *   JOIN features f ON f.feature_key = $featureKey
 *   JOIN tier_features tf ON tf.tier_id = m.tier_id AND tf.feature_id = f.id
 *   WHERE m.user_id = $userId
 *     AND m.ended_at IS NULL
 *     AND m.status IN ('active','past_due','paused','trialing')
 *   ORDER BY m.started_at DESC LIMIT 1;
 *
 * past_due / paused / trialing all grant access at launch. Spec §M6=b: cancel
 * keeps access until current_period_end. past_due is Stripe's grace-window
 * status before final cancel. Cron grace-sweep stamps ended_at when
 * current_period_end has passed; partial unique index then drops the row from
 * "active" results.
 */
export async function hasFeature(
  userId: string | null,
  featureKey: string,
  opts: HasFeatureOptions = {},
): Promise<EntitlementResult> {
  // Fast paths
  if (!userId) {
    return { granted: false, reason: 'no_active_membership' };
  }
  if (!featureKey || typeof featureKey !== 'string') {
    return { granted: false, reason: 'feature_not_found' };
  }

  // Cache hit?
  const cacheScope = opts.cacheScope;
  if (cacheScope) {
    const cache = requestCaches.get(cacheScope);
    if (cache) {
      const hit = cache.get(makeCacheKey(userId, featureKey));
      if (hit) return hit;
    }
  }

  let result: EntitlementResult;
  try {
    result = await queryEntitlement(userId, featureKey);
  } catch (err) {
    // Defensive: never throw an unhandled error from gating. The caller
    // has already authenticated; a DB hiccup should fall closed (deny)
    // rather than open. Log + return denied.
    console.error('[hasFeature] DB query failed:', (err as Error)?.message || err);
    result = { granted: false, reason: 'no_active_membership' };
  }

  // Cache write
  if (cacheScope) {
    let cache = requestCaches.get(cacheScope);
    if (!cache) {
      cache = new Map<CacheKey, EntitlementResult>();
      requestCaches.set(cacheScope, cache);
    }
    cache.set(makeCacheKey(userId, featureKey), result);
  }

  return result;
}

/**
 * Bulk-fetch the user's entire entitlement set in one round-trip.
 * Used by the member dashboard and by client-side React hook bootstrap.
 */
export async function listMemberEntitlements(userId: string): Promise<{
  tier_slug: string | null;
  tier_id: string | null;
  membership_id: string | null;
  status: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  features: Array<{
    feature_key: string;
    name_ar: string;
    name_en: string;
    quota: number | null;
    config: Record<string, unknown> | null;
  }>;
}> {
  if (!userId) {
    return {
      tier_slug: null,
      tier_id: null,
      membership_id: null,
      status: null,
      current_period_end: null,
      cancel_at: null,
      features: [],
    };
  }

  return await withAdminContext(async (db) => {
    const memRows = await db.execute(sql`
      SELECT m.id              AS membership_id,
             m.tier_id         AS tier_id,
             t.slug            AS tier_slug,
             m.status          AS status,
             m.current_period_end AS current_period_end,
             m.cancel_at       AS cancel_at
      FROM memberships m
      JOIN tiers t ON t.id = m.tier_id
      WHERE m.user_id = ${userId}::uuid
        AND m.ended_at IS NULL
        AND m.status IN ('active','past_due','paused','trialing')
      ORDER BY m.started_at DESC
      LIMIT 1
    `);
    const mem = memRows.rows[0] as
      | {
          membership_id: string;
          tier_id: string;
          tier_slug: string;
          status: string;
          current_period_end: string | null;
          cancel_at: string | null;
        }
      | undefined;

    if (!mem) {
      return {
        tier_slug: null,
        tier_id: null,
        membership_id: null,
        status: null,
        current_period_end: null,
        cancel_at: null,
        features: [],
      };
    }

    const featureRows = await db.execute(sql`
      SELECT f.feature_key   AS feature_key,
             f.name_ar       AS name_ar,
             f.name_en       AS name_en,
             tf.quota        AS quota,
             tf.config       AS config
      FROM tier_features tf
      JOIN features f ON f.id = tf.feature_id
      WHERE tf.tier_id = ${mem.tier_id}::uuid
        AND tf.included = true
      ORDER BY f.feature_key
    `);

    return {
      tier_slug: mem.tier_slug,
      tier_id: mem.tier_id,
      membership_id: mem.membership_id,
      status: mem.status,
      current_period_end: mem.current_period_end,
      cancel_at: mem.cancel_at,
      features: featureRows.rows as Array<{
        feature_key: string;
        name_ar: string;
        name_en: string;
        quota: number | null;
        config: Record<string, unknown> | null;
      }>,
    };
  });
}

// ─── DB query (private) ──────────────────────────────────────────────────────

async function queryEntitlement(userId: string, featureKey: string): Promise<EntitlementResult> {
  return await withAdminContext(async (db) => {
    // First: does the feature exist at all?
    const featRows = await db.execute(sql`
      SELECT id FROM features WHERE feature_key = ${featureKey} LIMIT 1
    `);
    if (featRows.rows.length === 0) {
      return { granted: false, reason: 'feature_not_found' };
    }

    // Single-query join: membership → tier → tier_features (LEFT JOIN so we
    // can tell "no membership" from "membership but feature not in tier").
    const rows = await db.execute(sql`
      SELECT t.slug                AS tier_slug,
             t.id                  AS tier_id,
             m.status              AS membership_status,
             tf.included           AS included,
             tf.quota              AS quota,
             tf.config             AS config,
             f.id                  AS feature_id
      FROM memberships m
      JOIN tiers t ON t.id = m.tier_id
      JOIN features f ON f.feature_key = ${featureKey}
      LEFT JOIN tier_features tf ON tf.tier_id = m.tier_id AND tf.feature_id = f.id
      WHERE m.user_id = ${userId}::uuid
        AND m.ended_at IS NULL
        AND m.status IN ('active','past_due','paused','trialing')
      ORDER BY m.started_at DESC
      LIMIT 1
    `);

    const row = rows.rows[0] as
      | {
          tier_slug: string;
          tier_id: string;
          membership_status: string;
          included: boolean | null;
          quota: number | null;
          config: Record<string, unknown> | null;
          feature_id: string;
        }
      | undefined;

    if (!row) {
      return { granted: false, reason: 'no_active_membership' };
    }

    // Feature not mapped to this tier (no tier_features row)
    if (row.included === null) {
      return {
        granted: false,
        reason: 'feature_not_in_tier',
        current_tier_slug: row.tier_slug,
      };
    }
    // Feature explicitly excluded (included=false)
    if (row.included === false) {
      return {
        granted: false,
        reason: 'feature_excluded',
        current_tier_slug: row.tier_slug,
      };
    }

    return {
      granted: true,
      tier_slug: row.tier_slug,
      tier_id: row.tier_id,
      feature_id: row.feature_id,
      quota: row.quota,
      config: row.config,
    };
  });
}

// ─── Auto-provision helper ───────────────────────────────────────────────────

/**
 * Internal: SQL body that does the actual provisioning, runnable against
 * any drizzle-compatible client (so callers can opt to share a transaction
 * by passing their own `withAdminContext`/`withUserContext`-managed db).
 */
async function provisionFreeMembershipOnDb(
  db: any,
  userId: string,
): Promise<{ inserted: boolean; membership_id: string | null }> {
  // Resolve the Free tier id (one query — fine; this is signup flow, not hot path)
  const tierRows = await db.execute(sql`
    SELECT id FROM tiers WHERE slug = 'free' AND is_active = true LIMIT 1
  `);
  const tier = tierRows.rows[0] as { id: string } | undefined;
  if (!tier) {
    console.error('[autoProvisionFreeMembership] Free tier not found in tiers table');
    return { inserted: false, membership_id: null };
  }

  // Idempotency: if any active row exists, return its id.
  const existingRows = await db.execute(sql`
    SELECT id FROM memberships
    WHERE user_id = ${userId}::uuid
      AND ended_at IS NULL
      AND status IN ('active','past_due','paused','trialing')
    LIMIT 1
  `);
  const existing = existingRows.rows[0] as { id: string } | undefined;
  if (existing) {
    return { inserted: false, membership_id: existing.id };
  }

  // INSERT … ON CONFLICT against the partial unique index predicate.
  // Pattern matches /api/membership/subscribe + webhook handler.
  const result = await db.execute(sql`
    INSERT INTO memberships (user_id, tier_id, status, billing_frequency)
    VALUES (${userId}::uuid, ${tier.id}::uuid, 'active', NULL)
    ON CONFLICT (user_id)
      WHERE ended_at IS NULL AND status IN ('active','past_due','paused','trialing')
    DO NOTHING
    RETURNING id
  `);

  const inserted = result.rows[0] as { id: string } | undefined;
  if (inserted) {
    return { inserted: true, membership_id: inserted.id };
  }

  // Race lost — find the row that beat us
  const raceRows = await db.execute(sql`
    SELECT id FROM memberships
    WHERE user_id = ${userId}::uuid
      AND ended_at IS NULL
      AND status IN ('active','past_due','paused','trialing')
    LIMIT 1
  `);
  const raced = raceRows.rows[0] as { id: string } | undefined;
  return { inserted: false, membership_id: raced?.id ?? null };
}

/**
 * Idempotently insert a Free-tier membership row for a user.
 * Uses ON CONFLICT against the partial unique index
 * `memberships_user_active_uidx` predicate so concurrent calls collapse
 * to a single insert.
 *
 * Two call shapes:
 *   1. autoProvisionFreeMembership(userId) — opens its own admin txn.
 *      Use from cron / standalone API routes where there's no parent txn.
 *   2. autoProvisionFreeMembership(userId, { tx: adminDb }) — runs on the
 *      caller's transaction so signup atomically commits profile + membership.
 *      DeepSeek QA fix (Wave F.4 self-review): without this option, the
 *      signup flow's profile insert (in tx A) and the membership insert
 *      (in tx B opened by this helper) can desynchronize on rollback.
 *
 * NOTE: the Free tier row IS the marker that the user is "a member" — we
 * never let auto-provision lazy-create later because the resolver assumes
 * one row per user.
 */
export async function autoProvisionFreeMembership(
  userId: string,
  opts?: { tx?: any },
): Promise<{ inserted: boolean; membership_id: string | null }> {
  if (!userId) return { inserted: false, membership_id: null };

  // If caller passes a tx (e.g. signup's withAdminContext), reuse it so the
  // profile + membership inserts share one transaction.
  if (opts?.tx) {
    return await provisionFreeMembershipOnDb(opts.tx, userId);
  }

  return await withAdminContext((db) => provisionFreeMembershipOnDb(db, userId));
}
