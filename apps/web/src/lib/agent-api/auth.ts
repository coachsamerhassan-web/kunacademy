/**
 * Wave 15 Phase 1.5 — Agent API authentication.
 *
 * Tokens are SHA-256 hashes stored in agent_tokens. On each request:
 *   1. Extract bearer token from Authorization header
 *   2. Hash it
 *   3. Look up the row by hash
 *   4. Verify not revoked
 *   5. Update last_used_at / last_used_ip
 *   6. Return the agent name + rate-limit config
 *
 * Plaintext tokens live NOWHERE in the DB. If the file on disk is lost,
 * rotate (insert new row, revoke old one) — we can never recover the
 * original plaintext.
 *
 * The token format is `kun_agent_<32-hex>`:
 *   - `kun_agent_` prefix makes leaked tokens identifiable in logs/pastes
 *   - 32 hex chars = 128 bits of entropy (comfortably beyond brute-force)
 */

import { createHash, randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db, withAdminContext } from '@kunacademy/db';
import { agent_tokens } from '@kunacademy/db/schema';
import type { AgentToken } from '@kunacademy/db/schema';
import { AGENT_SCOPES } from './scopes';

export interface AuthedAgent {
  tokenId: string;
  agentName: string;
  agentNameKey: string;
  rateLimitPerMin: number;
}

/** Hash a plaintext token. Used both on issue + on auth. */
export function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/** Generate a fresh token. Returns `{ plaintext, prefix, hash }`. */
export function generateToken(): { plaintext: string; prefix: string; hash: string } {
  const random = randomBytes(16).toString('hex'); // 32 hex chars
  const plaintext = `kun_agent_${random}`;
  const prefix = plaintext.slice(0, 18); // "kun_agent_" + first 8 of random
  return { plaintext, prefix, hash: hashToken(plaintext) };
}

/** Extract bearer token from Authorization header. */
export function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const value = trimmed.slice(7).trim();
  return value || null;
}

/** Authenticate an incoming request. Returns null on any failure. The
 *  caller converts null into a 401 response. */
export async function authenticateAgent(
  token: string | null,
  clientIp: string | null,
): Promise<AuthedAgent | null> {
  if (!token) return null;

  // Cheap shape guard BEFORE the DB lookup — rejects malformed tokens
  // without burning a query.
  if (!/^kun_agent_[a-f0-9]{32}$/.test(token)) return null;

  const hash = hashToken(token);

  let row: AgentToken | null = null;
  try {
    row = await withAdminContext(async (adminDb) => {
      const rows = await adminDb
        .select()
        .from(agent_tokens)
        .where(eq(agent_tokens.token_hash, hash))
        .limit(1);
      return rows[0] ?? null;
    });
  } catch (err) {
    console.error('[agent auth] DB lookup failed:', err);
    return null;
  }

  if (!row) return null;
  // Defense-in-depth: explicit null check. A falsy `row.revoked_at` (empty
  // string, for example) would otherwise bypass revocation.
  if (row.revoked_at != null) return null;

  const scope = AGENT_SCOPES[row.agent_name];
  if (!scope) {
    // Token exists but agent was removed from the scope registry — fail
    // closed. Operator should revoke the token.
    console.warn('[agent auth] token references unknown agent:', row.agent_name);
    return null;
  }

  // Fire-and-forget update of last_used_at / last_used_ip. Failure here
  // must NOT block auth — we only use this for forensics.
  (async () => {
    try {
      await withAdminContext(async (adminDb) => {
        await adminDb
          .update(agent_tokens)
          .set({
            last_used_at: new Date().toISOString(),
            last_used_ip: clientIp,
          })
          .where(eq(agent_tokens.id, row!.id));
      });
    } catch (err) {
      console.error('[agent auth] last_used update failed:', err);
    }
  })();

  return {
    tokenId: row.id,
    agentName: row.agent_name,
    agentNameKey: row.agent_name.toLowerCase(),
    rateLimitPerMin: row.rate_limit_per_min ?? scope.rateLimitPerMin ?? 60,
  };
}

// ── Rate limit (in-memory) ─────────────────────────────────────────────
// Per-token sliding window. For multi-process deployment we'd move this
// to Redis, but with one pm2 instance running the app a Map is fine.
interface RateWindow {
  count: number;
  resetAt: number;
}
const rateMap = new Map<string, RateWindow>();

/**
 * Check a rate-limit bucket keyed by a caller-chosen string.
 *
 * We key by `agent_name.toLowerCase()` (NOT by token id) so that rotating an
 * agent's token cannot reset the bucket — a rogue caller can't bypass
 * limiting by minting a fresh token every ~60 seconds.
 */
export function checkRateLimit(key: string, perMin: number): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const entry = rateMap.get(key);
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    rateMap.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: perMin - 1, resetAt };
  }
  if (entry.count >= perMin) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count++;
  return { allowed: true, remaining: perMin - entry.count, resetAt: entry.resetAt };
}

/** Extract client IP from a NextRequest — honors X-Forwarded-For at
 *  position [0] since we know the request came through nginx which
 *  prepends the real remote address. */
export function clientIpFromRequest(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xri = request.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return null;
}
