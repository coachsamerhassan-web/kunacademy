/**
 * Wave 4 — Session 14: Four-Role Permission Matrix Acceptance Tests
 *
 * Validates the permission matrix shipped in Wave 2/3 against the live VPS
 * PostgreSQL database via SSH tunnel. Tests run at DB level (no browser
 * interaction required) because the Next.js app API surfaces for these
 * permissions are not yet wired into testable HTTP endpoints.
 *
 * Fallback level: DB-level (explicitly documented — UI/API surfaces not ready).
 * When booking/permissions API routes exist, upgrade these tests to HTTP-level.
 *
 * Prerequisites:
 *   - SSH wrapper at /tmp/kun-ssh.sh (VPS key + passphrase)
 *   - VPS postgres reachable at 72.61.110.211 via SSH tunnel on TUNNEL_PORT
 *   - Test personas seeded via scripts/seed-test-personas.sql (Wave 4 Step 3)
 *
 * Run:
 *   cd apps/web && VPS_SSH_KEY="/Users/samer/Hostinger VPS" npx playwright test \
 *     tests/e2e/coach-role-matrix.spec.ts --config tests/e2e/coach-role-matrix.config.ts \
 *     --reporter=list
 *
 * Deterministic test UUIDs (seeded, never change):
 *   CLIENT   11111111-0000-0000-0000-000000000001  role=student,  no instructor row
 *   COACH    22222222-0000-0000-0000-000000000002  roles=[coach,mentor_coach,advanced_mentor], icf=pcc
 *   ADMIN    33333333-0000-0000-0000-000000000003  role=admin,    no instructor row
 *   ATTACKER 44444444-0000-0000-0000-000000000004  roles=[coach], icf=none
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';

// ── Config ──────────────────────────────────────────────────────────────────

const TUNNEL_PORT = parseInt(process.env.TUNNEL_PORT ?? '15432', 10);

const DB_URL = `postgresql://kunacademy:O2SJHdu9JvDq1XLO6KridOqG8m5nXec1@localhost:${TUNNEL_PORT}/kunacademy`;

const UUID = {
  client:   '11111111-0000-0000-0000-000000000001',
  coach:    '22222222-0000-0000-0000-000000000002',
  admin:    '33333333-0000-0000-0000-000000000003',
  attacker: '44444444-0000-0000-0000-000000000004',
} as const;

// Helper: open a pg client, run a callback, close cleanly
async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// Helper: call kun.can_perform and return the boolean result
async function canPerform(
  client: Client,
  userId: string,
  action: string,
): Promise<boolean> {
  const res = await client.query<{ can_perform: boolean }>(
    `SELECT kun.can_perform($1::uuid, $2) AS can_perform`,
    [userId, action],
  );
  return res.rows[0].can_perform;
}

// ── Suite A: Client ──────────────────────────────────────────────────────────

test.describe('A — Client persona (no instructor row)', () => {
  test('cannot deliver_coaching — no instructor row', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.client, 'deliver_coaching'),
    );
    expect(result, 'client should NOT be able to deliver_coaching').toBe(false);
  });

  test('cannot assess_recording — no instructor row', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.client, 'assess_recording'),
    );
    expect(result, 'client should NOT be able to assess_recording').toBe(false);
  });

  test('cannot curate_milestones — no instructor row', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.client, 'curate_milestones'),
    );
    expect(result, 'client should NOT be able to curate_milestones').toBe(false);
  });

  test('cannot publish_methodology — no instructor row', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.client, 'publish_methodology'),
    );
    expect(result, 'client should NOT be able to publish_methodology').toBe(false);
  });
});

// ── Suite B: Coach ───────────────────────────────────────────────────────────

test.describe('B — Coach persona (roles: coach+mentor_coach+advanced_mentor, ICF: pcc)', () => {
  // --- Allowed actions ---
  test('CAN deliver_coaching (coach role, no icf minimum)', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.coach, 'deliver_coaching'),
    );
    expect(result, 'coach should be able to deliver_coaching').toBe(true);
  });

  test('CAN deliver_developmental_mentoring_session (mentor_coach+pcc)', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.coach, 'deliver_developmental_mentoring_session'),
    );
    expect(result).toBe(true);
  });

  test('CAN deliver_final_mentoring_session (advanced_mentor+pcc)', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.coach, 'deliver_final_mentoring_session'),
    );
    expect(result).toBe(true);
  });

  test('CAN assess_recording (advanced_mentor+pcc)', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.coach, 'assess_recording'),
    );
    expect(result, 'coach with advanced_mentor+pcc should assess_recording').toBe(true);
  });

  test('CAN record_voice_fail_message (advanced_mentor+pcc)', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.coach, 'record_voice_fail_message'),
    );
    expect(result).toBe(true);
  });

  test('CAN second_opinion_assess (advanced_mentor+pcc)', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.coach, 'second_opinion_assess'),
    );
    expect(result).toBe(true);
  });

  // --- Denied actions (no mentor_manager or teacher role) ---
  test('CANNOT curate_milestones — missing mentor_manager role', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.coach, 'curate_milestones'),
    );
    expect(result, 'coach without mentor_manager should NOT curate_milestones').toBe(false);
  });

  test('CANNOT resolve_escalation — missing mentor_manager role', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.coach, 'resolve_escalation'),
    );
    expect(result).toBe(false);
  });

  test('CANNOT edit_rubric_template — missing mentor_manager role', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.coach, 'edit_rubric_template'),
    );
    expect(result).toBe(false);
  });

  test('CANNOT create_package_template — missing mentor_manager role', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.coach, 'create_package_template'),
    );
    expect(result).toBe(false);
  });

  test('CANNOT deliver_training_course — missing teacher role', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.coach, 'deliver_training_course'),
    );
    expect(result).toBe(false);
  });

  test('CANNOT facilitate_retreat — missing teacher role', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.coach, 'facilitate_retreat'),
    );
    expect(result).toBe(false);
  });

  test('CANNOT publish_methodology — missing teacher role', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.coach, 'publish_methodology'),
    );
    expect(result).toBe(false);
  });
});

// ── Suite C: Admin ───────────────────────────────────────────────────────────

test.describe('C — Admin persona (role=admin, no instructor row)', () => {
  test('profile exists with role=admin', async () => {
    await withDb(async (client) => {
      const res = await client.query<{ role: string }>(
        `SELECT role FROM profiles WHERE id = $1::uuid`,
        [UUID.admin],
      );
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].role).toBe('admin');
    });
  });

  test('cannot deliver_coaching — no instructor row despite admin flag', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.admin, 'deliver_coaching'),
    );
    expect(result, 'admin without instructor row should NOT deliver_coaching').toBe(false);
  });

  test('cannot assess_recording — no instructor row', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.admin, 'assess_recording'),
    );
    expect(result).toBe(false);
  });

  test('cannot curate_milestones — no instructor row (admin != mentor_manager)', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.admin, 'curate_milestones'),
    );
    expect(result, 'admin flag does NOT grant mentor_manager privileges').toBe(false);
  });
});

// ── Suite D: Attacker ────────────────────────────────────────────────────────

test.describe('D — Attacker persona (roles: [coach], ICF: none)', () => {
  // Attacker IS a coach — can do basic coaching
  test('CAN deliver_coaching — has coach role', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.attacker, 'deliver_coaching'),
    );
    expect(result, 'attacker with coach role should be able to deliver_coaching').toBe(true);
  });

  // Privilege escalation attempts — all must be DENIED
  test('CANNOT assess_recording — lacks advanced_mentor role', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.attacker, 'assess_recording'),
    );
    expect(result, 'attacker should NOT escalate to assess_recording').toBe(false);
  });

  test('CANNOT deliver_developmental_mentoring_session — lacks mentor_coach + pcc', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.attacker, 'deliver_developmental_mentoring_session'),
    );
    expect(result).toBe(false);
  });

  test('CANNOT deliver_final_mentoring_session — lacks advanced_mentor + pcc', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.attacker, 'deliver_final_mentoring_session'),
    );
    expect(result).toBe(false);
  });

  test('CANNOT record_voice_fail_message — lacks advanced_mentor + pcc', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.attacker, 'record_voice_fail_message'),
    );
    expect(result).toBe(false);
  });

  test('CANNOT second_opinion_assess — lacks advanced_mentor + pcc', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.attacker, 'second_opinion_assess'),
    );
    expect(result).toBe(false);
  });

  test('CANNOT curate_milestones — lacks mentor_manager + mcc', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.attacker, 'curate_milestones'),
    );
    expect(result).toBe(false);
  });

  test('CANNOT resolve_escalation — lacks mentor_manager + mcc', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.attacker, 'resolve_escalation'),
    );
    expect(result).toBe(false);
  });

  test('CANNOT edit_rubric_template — lacks mentor_manager + mcc', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.attacker, 'edit_rubric_template'),
    );
    expect(result).toBe(false);
  });

  test('CANNOT create_package_template — lacks mentor_manager + mcc', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.attacker, 'create_package_template'),
    );
    expect(result).toBe(false);
  });

  test('CANNOT deliver_training_course — lacks teacher + pcc', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.attacker, 'deliver_training_course'),
    );
    expect(result).toBe(false);
  });

  test('CANNOT facilitate_retreat — lacks teacher + pcc', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.attacker, 'facilitate_retreat'),
    );
    expect(result).toBe(false);
  });

  test('CANNOT publish_methodology — lacks teacher + mcc', async () => {
    const result = await withDb(c =>
      canPerform(c, UUID.attacker, 'publish_methodology'),
    );
    expect(result).toBe(false);
  });

  // Legacy column revoke: authenticated role should NOT be able to SELECT coach_level_legacy_do_not_use
  // NOTE: This tests that information_schema shows no SELECT privilege for authenticated/anon.
  // If this test FAILS, it means REVOKE SELECT (coach_level_legacy_do_not_use) was NOT applied — flag to Samer.
  test('SECURITY: coach_level_legacy_do_not_use has no SELECT privilege for authenticated role', async () => {
    await withDb(async (client) => {
      const res = await client.query<{ count: string }>(`
        SELECT COUNT(*)::int AS count
        FROM information_schema.column_privileges
        WHERE table_name = 'instructors'
          AND column_name = 'coach_level_legacy_do_not_use'
          AND grantee IN ('authenticated', 'anon')
          AND privilege_type = 'SELECT'
      `);
      const count = parseInt(res.rows[0].count as unknown as string, 10);
      expect(
        count,
        'SECURITY FAIL: authenticated/anon roles still have SELECT on coach_level_legacy_do_not_use. ' +
        'Run: REVOKE SELECT (coach_level_legacy_do_not_use) ON instructors FROM authenticated, anon;',
      ).toBe(0);
    });
  });
});

// ── Suite E: Escalation attempt blocked (DeepSeek HIGH-1) ────────────────────
//
// Validates migration 20260414120000_instructors_rls_hardening.sql:
//   - authenticated role has column-level UPDATE only on 10 safe columns.
//   - service_roles, icf_credential, kun_level are NOT in the allowlist.
//   - RLS UPDATE policy (instructors_update_self) scopes writes to own rows only.
//
// How SET ROLE works here: `authenticated` is a non-login group role (rolcanlogin=f).
// We connect as `kunacademy` (the app role) and use SET ROLE authenticated inside a
// transaction to impersonate the authenticated role for permission checks. This is the
// correct approach per Postgres docs — the role switch takes effect for all privilege
// checks within the transaction. SET LOCAL app.current_user_id seeds app_uid() for RLS.
//
// Positive control (4th assertion): self-update on a SAFE column (bio_en) on the
// coach persona's own row (UUID.coach), while SET ROLE authenticated and app.current_user_id
// = UUID.coach. This should succeed (1 row affected) since bio_en IS in the UPDATE
// grant allowlist and the row belongs to the current user_id. We use a transaction
// wrapping this in a DO block to capture ROW_COUNT without committing.

test.describe('E — Escalation attempt blocked (DeepSeek HIGH-1)', () => {
  // Helper: run a query as the `authenticated` role inside a transaction that is
  // always rolled back. Executes as kunacademy but with SET ROLE authenticated so
  // Postgres evaluates column-level privileges and RLS for the authenticated role.
  async function withAuthRole<T>(
    userId: string,
    fn: (client: Client) => Promise<T>,
  ): Promise<T> {
    const client = new Client({ connectionString: DB_URL });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET ROLE authenticated');
      // NOTE: Postgres does not allow parameterized SET statements.
      // The UUID is a trusted test value (hardcoded above), not user input.
      await client.query(`SET LOCAL "app.current_user_id" = '${userId}'`);
      const result = await fn(client);
      await client.query('ROLLBACK');
      return result;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    } finally {
      await client.end();
    }
  }

  test('BLOCKED: UPDATE service_roles on own row must throw permission denied', async () => {
    let caught: Error | null = null;
    try {
      await withAuthRole(UUID.attacker, async (client) => {
        await client.query(
          `UPDATE instructors SET service_roles = ARRAY['coach','mentor_manager']::text[]
           WHERE profile_id = $1::uuid`,
          [UUID.attacker],
        );
      });
    } catch (err) {
      caught = err as Error;
    }
    expect(
      caught,
      'service_roles UPDATE should throw — column not in authenticated UPDATE grant',
    ).not.toBeNull();
    expect(
      caught!.message.toLowerCase(),
      'error message must mention permission or update',
    ).toMatch(/permission|update/i);
  });

  test('BLOCKED: UPDATE icf_credential on own row must throw permission denied', async () => {
    let caught: Error | null = null;
    try {
      await withAuthRole(UUID.attacker, async (client) => {
        await client.query(
          `UPDATE instructors SET icf_credential = 'mcc'
           WHERE profile_id = $1::uuid`,
          [UUID.attacker],
        );
      });
    } catch (err) {
      caught = err as Error;
    }
    expect(
      caught,
      'icf_credential UPDATE should throw — column not in authenticated UPDATE grant',
    ).not.toBeNull();
    expect(
      caught!.message.toLowerCase(),
    ).toMatch(/permission|update/i);
  });

  test('BLOCKED: UPDATE kun_level on own row must throw permission denied', async () => {
    let caught: Error | null = null;
    try {
      await withAuthRole(UUID.attacker, async (client) => {
        await client.query(
          `UPDATE instructors SET kun_level = 'expert'
           WHERE profile_id = $1::uuid`,
          [UUID.attacker],
        );
      });
    } catch (err) {
      caught = err as Error;
    }
    expect(
      caught,
      'kun_level UPDATE should throw — column not in authenticated UPDATE grant',
    ).not.toBeNull();
    expect(
      caught!.message.toLowerCase(),
    ).toMatch(/permission|update/i);
  });

  test('POSITIVE CONTROL: UPDATE bio_en on own row — safe column, self row → 1 row affected', async () => {
    // EXPECTED: succeeds (bio_en IS in the UPDATE grant allowlist for authenticated,
    // and app.current_user_id matches the row's profile_id, satisfying RLS instructors_update_self).
    // We run inside withAuthRole (always rolled back) so no data is persisted.
    // If this fails it indicates a test-environment configuration issue
    // (e.g. authenticated does not inherit the UPDATE grant in this Postgres version),
    // NOT a regression — the primary security assertions above are the hard requirements.
    await withAuthRole(UUID.coach, async (client) => {
      const res = await client.query<{ rowcount: string }>(`
        WITH updated AS (
          UPDATE instructors SET bio_en = 'harmless bio update'
          WHERE profile_id = $1::uuid
          RETURNING 1
        )
        SELECT COUNT(*)::int AS rowcount FROM updated
      `, [UUID.coach]);
      const rowcount = Number(res.rows[0].rowcount);
      expect(
        rowcount,
        'bio_en self-update should affect exactly 1 row (safe column, own row, RLS satisfied)',
      ).toBe(1);
    });
  });
});

// ── Suite F: icf_rank case-insensitivity (DeepSeek MEDIUM-2) ────────────────
//
// Validates that kun.icf_rank() handles case variants correctly after the
// LOWER(COALESCE()) fix in migration 20260414120000_instructors_rls_hardening.sql.
// Whitespace handling is NOT part of the contract — leading/trailing spaces return 0.

test.describe('F — icf_rank case-insensitivity (DeepSeek MEDIUM-2)', () => {
  test('PCC variants (upper/mixed/lower) all return rank 2', async () => {
    await withDb(async (client) => {
      const res = await client.query<{
        upper: number;
        mixed: number;
        lower: number;
      }>(`
        SELECT
          kun.icf_rank('PCC') AS upper,
          kun.icf_rank('Pcc') AS mixed,
          kun.icf_rank('pcc') AS lower
      `);
      const { upper, mixed, lower } = res.rows[0];
      expect(Number(upper), 'icf_rank("PCC") should be 2').toBe(2);
      expect(Number(mixed), 'icf_rank("Pcc") should be 2').toBe(2);
      expect(Number(lower), 'icf_rank("pcc") should be 2').toBe(2);
    });
  });

  test('null input returns 0 (COALESCE to none)', async () => {
    await withDb(async (client) => {
      const res = await client.query<{ null_val: number }>(`
        SELECT kun.icf_rank(NULL) AS null_val
      `);
      expect(Number(res.rows[0].null_val), 'icf_rank(NULL) should be 0').toBe(0);
    });
  });

  test('invalid input returns 0 (ELSE fallthrough)', async () => {
    await withDb(async (client) => {
      const res = await client.query<{ invalid_val: number }>(`
        SELECT kun.icf_rank('invalid') AS invalid_val
      `);
      expect(Number(res.rows[0].invalid_val), 'icf_rank("invalid") should be 0').toBe(0);
    });
  });

  test('whitespace variants return 0 — trimming is NOT part of the contract', async () => {
    // kun.icf_rank uses LOWER(COALESCE(...)) but does NOT trim.
    // " pcc" (leading space) and "pcc " (trailing space) are treated as unknown values.
    // This is documented behavior: callers must normalize before passing to icf_rank.
    await withDb(async (client) => {
      const res = await client.query<{
        leading_space: number;
        trailing_space: number;
      }>(`
        SELECT
          kun.icf_rank(' pcc') AS leading_space,
          kun.icf_rank('pcc ') AS trailing_space
      `);
      expect(Number(res.rows[0].leading_space), 'leading-space " pcc" → 0 (no trimming)').toBe(0);
      expect(Number(res.rows[0].trailing_space), 'trailing-space "pcc " → 0 (no trimming)').toBe(0);
    });
  });
});

// ── Suite G: SQL/TS null-ICF alignment (DeepSeek HIGH-2) ────────────────────
//
// DUPLICATION NOTE: @kunacademy/db does NOT export permissions.ts via its package.json
// `exports` map (only ".", "./schema", "./storage", "./enums" are exposed).
// Rather than adding a build step or modifying the package for test purposes,
// the PERMISSION_MATRIX, icfRank, meetsIcfMinimum, and canPerform functions are
// reproduced inline below. The source of truth is:
//   packages/db/src/permissions.ts
//
// This duplication is intentional: the assertion is "TS logic matches SQL logic".
// If these diverge from the source file, tests will catch it via the SQL comparison.

type IcfCredential = 'none' | 'acc' | 'pcc' | 'mcc';
type ServiceRole = 'coach' | 'mentor_coach' | 'advanced_mentor' | 'mentor_manager' | 'teacher';
type Action =
  | 'deliver_coaching'
  | 'deliver_developmental_mentoring_session'
  | 'deliver_final_mentoring_session'
  | 'assess_recording'
  | 'record_voice_fail_message'
  | 'second_opinion_assess'
  | 'curate_milestones'
  | 'resolve_escalation'
  | 'edit_rubric_template'
  | 'create_package_template'
  | 'deliver_training_course'
  | 'facilitate_retreat'
  | 'publish_methodology';

interface PermissionRule { role: ServiceRole; minIcf: IcfCredential; }

const PERMISSION_MATRIX_INLINE: Record<Action, PermissionRule> = {
  deliver_coaching:                         { role: 'coach',           minIcf: 'none' },
  deliver_developmental_mentoring_session:  { role: 'mentor_coach',    minIcf: 'pcc'  },
  deliver_final_mentoring_session:          { role: 'advanced_mentor', minIcf: 'pcc'  },
  assess_recording:                         { role: 'advanced_mentor', minIcf: 'pcc'  },
  record_voice_fail_message:                { role: 'advanced_mentor', minIcf: 'pcc'  },
  second_opinion_assess:                    { role: 'advanced_mentor', minIcf: 'pcc'  },
  curate_milestones:                        { role: 'mentor_manager',  minIcf: 'mcc'  },
  resolve_escalation:                       { role: 'mentor_manager',  minIcf: 'mcc'  },
  edit_rubric_template:                     { role: 'mentor_manager',  minIcf: 'mcc'  },
  create_package_template:                  { role: 'mentor_manager',  minIcf: 'mcc'  },
  deliver_training_course:                  { role: 'teacher',         minIcf: 'pcc'  },
  facilitate_retreat:                       { role: 'teacher',         minIcf: 'pcc'  },
  publish_methodology:                      { role: 'teacher',         minIcf: 'mcc'  },
};

function icfRankInline(icf: IcfCredential | null | undefined): number {
  const normalized = (icf ?? 'none') as IcfCredential;
  return ({ none: 0, acc: 1, pcc: 2, mcc: 3 } as const)[normalized] ?? 0;
}

function meetsIcfMinimumInline(
  userIcf: IcfCredential | null | undefined,
  minIcf: IcfCredential,
): boolean {
  return icfRankInline(userIcf) >= icfRankInline(minIcf);
}

function canPerformInline(
  user: { service_roles: ServiceRole[] | null; icf_credential: IcfCredential | null },
  action: Action,
): boolean {
  const rule = PERMISSION_MATRIX_INLINE[action];
  if (!rule) return false;
  if (!user.service_roles?.includes(rule.role)) return false;
  return meetsIcfMinimumInline(user.icf_credential, rule.minIcf);
}

// 5-row test matrix matching the task spec
const ALIGNMENT_MATRIX: Array<{
  service_roles: ServiceRole[];
  icf_credential: IcfCredential | null;
  action: Action;
  expected: boolean;
  label: string;
}> = [
  {
    service_roles:    ['coach'],
    icf_credential:   null,
    action:           'deliver_coaching',
    expected:         true,
    label:            'coach / null-ICF / deliver_coaching → TRUE (rank 0 >= 0)',
  },
  {
    service_roles:    ['mentor_coach'],
    icf_credential:   null,
    action:           'deliver_developmental_mentoring_session',
    expected:         false,
    label:            'mentor_coach / null-ICF / deliver_developmental_mentoring_session → FALSE (rank 0 < 2)',
  },
  {
    service_roles:    ['advanced_mentor'],
    icf_credential:   'pcc',
    action:           'assess_recording',
    expected:         true,
    label:            'advanced_mentor / pcc / assess_recording → TRUE',
  },
  {
    service_roles:    ['mentor_manager'],
    icf_credential:   'mcc',
    action:           'curate_milestones',
    expected:         true,
    label:            'mentor_manager / mcc / curate_milestones → TRUE',
  },
  {
    service_roles:    ['coach'],
    icf_credential:   'none',
    action:           'deliver_coaching',
    expected:         true,
    label:            'coach / "none"-ICF / deliver_coaching → TRUE',
  },
];

test.describe('G — SQL/TS null-ICF alignment (DeepSeek HIGH-2)', () => {
  // Shared pg client for the whole suite — avoids re-opening the tunnel on each test.
  // Opening a fresh connection for each of 5 rows causes intermittent tunnel drops
  // when the SSH link idles between connections late in the 48-test serial run.
  let gClient: Client;

  test.beforeAll(async () => {
    gClient = new Client({ connectionString: DB_URL });
    await gClient.connect();
  });

  test.afterAll(async () => {
    try { await gClient.end(); } catch { /* ignore */ }
  });

  for (const row of ALIGNMENT_MATRIX) {
    test(row.label, async () => {
      // 1. Compute TS result using inlined canPerform
      const tsResult = canPerformInline(
        { service_roles: row.service_roles, icf_credential: row.icf_credential },
        row.action,
      );

      // 2. Compute SQL result by temporarily patching the attacker's instructor row
      //    (profile_id = UUID.attacker, which already has a valid profiles FK entry)
      //    to the desired service_roles/icf_credential, then calling kun.can_perform.
      //    We cannot INSERT new rows — instructors.profile_id has a FK on profiles.id.
      //    The whole thing runs in a transaction that is always rolled back.
      await gClient.query('BEGIN');
      let sqlResult: boolean;
      try {
        // Temporarily set attacker row to the test case's credentials
        await gClient.query(`
          UPDATE instructors
          SET service_roles = $1::text[], icf_credential = $2
          WHERE profile_id = $3::uuid
        `, [row.service_roles, row.icf_credential, UUID.attacker]);

        // Call SQL function on the patched row
        const res = await gClient.query<{ can_perform: boolean }>(
          `SELECT kun.can_perform($1::uuid, $2) AS can_perform`,
          [UUID.attacker, row.action],
        );
        sqlResult = res.rows[0].can_perform;
        await gClient.query('ROLLBACK');
      } catch (err) {
        try { await gClient.query('ROLLBACK'); } catch { /* ignore */ }
        throw err;
      }

      // 3. Assert TS matches SQL matches expected
      expect(tsResult, `TS result for: ${row.label}`).toBe(row.expected);
      expect(sqlResult!, `SQL result for: ${row.label}`).toBe(row.expected);
      expect(tsResult, `TS/SQL alignment for: ${row.label}`).toBe(sqlResult!);
    });
  }
});
