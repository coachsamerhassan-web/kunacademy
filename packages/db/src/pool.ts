/**
 * PostgreSQL connection pool + RLS-aware query context.
 *
 * Three access patterns:
 * 1. withUserContext(userId, fn) — wraps queries in a transaction with SET LOCAL app.current_user_id
 * 2. adminDb — bypasses RLS for admin/webhook/cron operations
 * 3. db — raw Drizzle instance for public-data reads (no RLS context)
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const { Pool } = pg;

let _pool: pg.Pool | null = null;

/** Singleton connection pool. Lazy-initialized on first use. */
export function getPool(): pg.Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('[db] DATABASE_URL is not set');
    }
    _pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    // Log pool errors (don't crash the process)
    _pool.on('error', (err) => {
      console.error('[db] Idle pool client error:', err.message);
    });
  }
  return _pool;
}

/** Drizzle instance — no RLS context. Use for public data reads only. */
let _db: ReturnType<typeof drizzle> | null = null;
export function getDb() {
  if (!_db) _db = drizzle({ client: getPool() });
  return _db;
}
// Lazy proxy: accessing `db` initializes only on first query, not at import time.
// This prevents build-time crashes when DATABASE_URL is not set.
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

/**
 * Admin Drizzle instance — bypasses RLS.
 * Uses SET LOCAL role = 'kunacademy_admin' to bypass all RLS policies.
 * Use for: webhooks, cron jobs, admin API routes.
 */
export async function withAdminContext<T>(
  fn: (adminDb: any) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL role = 'kunacademy_admin'");
    const adminDb = drizzle({ client });
    const result = await fn(adminDb);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute queries as a specific user with RLS enforced.
 * Wraps the callback in a transaction that sets app.current_user_id.
 *
 * @param userId - The authenticated user's UUID
 * @param fn - Callback receiving a Drizzle instance scoped to this user
 * @returns The callback's return value
 *
 * @example
 * const bookings = await withUserContext(session.user.id, async (db) => {
 *   return db.select().from(bookings).where(eq(bookings.status, 'confirmed'));
 *   // RLS ensures only this user's bookings are returned
 * });
 */
export async function withUserContext<T>(
  userId: string,
  fn: (db: any) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL app.current_user_id = $1", [userId]);
    const userDb = drizzle({ client });
    const result = await fn(userDb);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Gracefully close the pool (for tests or shutdown). */
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
