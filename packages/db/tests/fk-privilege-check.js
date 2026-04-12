#!/usr/bin/env node
/**
 * CI guard: catches the FK-vs-schema-privilege drift that broke Wave S0 Phase 6.
 *
 * For every foreign key in the public schema, asserts that the kunacademy_admin
 * role has SELECT, INSERT, UPDATE, and DELETE on the referenced table. This is
 * the same role used by withAdminContext() in apps/web — if a FK points at a
 * table the admin role can't touch, signup/checkout/webhook handlers will 500.
 *
 * Exit code 0 = all FKs OK. Exit code 1 = at least one drift found.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node packages/db/tests/fk-privilege-check.js
 *
 * Wire into CI as a step that runs after migrations apply. No test framework
 * dependency — pure Node + pg.
 */
const { Pool } = require('pg');

const REQUIRED = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
const ROLE = process.env.KUNACADEMY_ADMIN_ROLE || 'kunacademy_admin';

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('FAIL: DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  try {
    // 1. All FKs in public.* and the table they reference.
    const { rows: fks } = await pool.query(`
      SELECT
        tc.table_schema  AS src_schema,
        tc.table_name    AS src_table,
        tc.constraint_name,
        ccu.table_schema AS ref_schema,
        ccu.table_name   AS ref_table
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema    = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema    = 'public'
      GROUP BY tc.table_schema, tc.table_name, tc.constraint_name, ccu.table_schema, ccu.table_name
      ORDER BY src_table, constraint_name
    `);

    let failures = 0;
    let checked = 0;
    for (const fk of fks) {
      const refQualified = `${fk.ref_schema}.${fk.ref_table}`;
      // Skip self/system schemas (shouldn't happen for public FKs but be safe).
      if (fk.ref_schema === 'pg_catalog' || fk.ref_schema === 'information_schema') continue;

      // Schema USAGE first — without it, no table privilege check matters.
      const { rows: [{ has_usage }] } = await pool.query(
        'SELECT has_schema_privilege($1, $2, $3) AS has_usage',
        [ROLE, fk.ref_schema, 'USAGE']
      );
      if (!has_usage) {
        console.error(
          `FAIL  ${fk.src_table}.${fk.constraint_name} → ${refQualified}: ` +
          `role ${ROLE} lacks USAGE on schema ${fk.ref_schema}`
        );
        failures++;
        continue;
      }

      // Table-level privileges.
      const missing = [];
      for (const priv of REQUIRED) {
        const { rows: [{ has_priv }] } = await pool.query(
          'SELECT has_table_privilege($1, $2, $3) AS has_priv',
          [ROLE, refQualified, priv]
        );
        if (!has_priv) missing.push(priv);
      }
      if (missing.length > 0) {
        console.error(
          `FAIL  ${fk.src_table}.${fk.constraint_name} → ${refQualified}: ` +
          `role ${ROLE} missing ${missing.join(',')}`
        );
        failures++;
      } else {
        checked++;
      }
    }

    console.log(`\nFK privilege check: ${checked} OK, ${failures} FAIL (role=${ROLE})`);
    process.exit(failures > 0 ? 1 : 0);
  } finally {
    await pool.end();
  }
})().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
