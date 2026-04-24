#!/usr/bin/env tsx
/**
 * Wave 15 Phase 1.5 — Agent token seeder.
 *
 * Generates a fresh token per agent, upserts into agent_tokens with the
 * current scope snapshot, and prints a Markdown report to stdout. Capture
 * the output once and file it at:
 *
 *   /Users/samer/Claude Code/Project Memory/KUN-Website/Execution/agent-tokens.md
 *
 * The `Claude Code/` directory is NOT a git repository, so tokens never
 * reach the monorepo or any remote.
 *
 * Usage:
 *   cd /Users/samer/kunacademy
 *   DATABASE_URL=... pnpm exec tsx apps/web/scripts/seed-agent-tokens.ts > \
 *     "/Users/samer/Claude Code/Project Memory/KUN-Website/Execution/agent-tokens.md"
 *
 * To rotate a single agent:
 *   AGENT=hakima pnpm exec tsx apps/web/scripts/seed-agent-tokens.ts
 *
 * This script ONLY inserts new tokens. It does NOT revoke old tokens —
 * that's a deliberate choice so operators can plan a rotation window.
 * To revoke, manually UPDATE agent_tokens SET revoked_at = now().
 */

import { db, withAdminContext } from '@kunacademy/db';
import { agent_tokens } from '@kunacademy/db/schema';
import { eq } from 'drizzle-orm';
import { generateToken } from '../src/lib/agent-api/auth';
import { AGENT_SCOPES, serializeScope, allAgentNames } from '../src/lib/agent-api/scopes';

async function seed() {
  const only = process.env.AGENT ?? null;
  const targets = only ? [only] : allAgentNames();

  const report: Array<{
    agent: string;
    action: 'created' | 'rotated';
    token: string;
    prefix: string;
    scopes: ReturnType<typeof serializeScope>;
  }> = [];

  for (const agentName of targets) {
    if (!AGENT_SCOPES[agentName]) {
      console.error(`# Skipping unknown agent: ${agentName}`);
      continue;
    }

    const { plaintext, prefix, hash } = generateToken();
    const scopeSnapshot = serializeScope(agentName);
    const rateLimit = AGENT_SCOPES[agentName].rateLimitPerMin ?? 60;

    // With the partial-unique index (only one active row per agent), we
    // can do this in two simple steps: revoke any existing active row,
    // then insert the fresh one. withAdminContext already wraps the
    // callback in BEGIN/COMMIT — a thrown error rolls back both.
    const action: 'created' | 'rotated' = await withAdminContext(async (adminDb) => {
      const existing = await adminDb
        .select({ id: agent_tokens.id })
        .from(agent_tokens)
        .where(eq(agent_tokens.agent_name, agentName))
        .limit(1);

      let actionTaken: 'created' | 'rotated' = 'created';
      if (existing[0]) {
        await adminDb
          .update(agent_tokens)
          .set({
            revoked_at: new Date().toISOString(),
            revoked_reason: 'Rotated by seed script',
          })
          .where(eq(agent_tokens.id, existing[0].id));
        actionTaken = 'rotated';
      }

      await adminDb.insert(agent_tokens).values({
        agent_name: agentName,
        token_hash: hash,
        token_prefix: prefix,
        scopes: scopeSnapshot as never,
        rate_limit_per_min: rateLimit,
        notes: actionTaken === 'rotated'
          ? `Rotated ${new Date().toISOString()}`
          : null,
      });

      return actionTaken;
    });

    report.push({ agent: agentName, action, token: plaintext, prefix, scopes: scopeSnapshot });
  }

  // ── Emit the report as Markdown ───────────────────────────────────
  const lines: string[] = [];
  lines.push('# Agent API Tokens — Wave 15 Phase 1.5');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('**DO NOT COMMIT THIS FILE TO ANY GIT REPOSITORY.**');
  lines.push('');
  lines.push('These tokens authorize edit access to Kun Academy content surfaces.');
  lines.push('They appear in plaintext here because the DB stores only SHA-256 hashes.');
  lines.push('If this file is lost, re-run the seeder to rotate.');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Endpoint');
  lines.push('');
  lines.push('```');
  lines.push('Base URL: https://kuncoaching.me/api/agent/content');
  lines.push('Header:   Authorization: Bearer <token>');
  lines.push('```');
  lines.push('');
  lines.push('## Agents');
  lines.push('');
  for (const entry of report) {
    lines.push(`### ${entry.agent} (${entry.action})`);
    lines.push('');
    lines.push(`- **Token**: \`${entry.token}\``);
    lines.push(`- **Prefix**: \`${entry.prefix}\``);
    lines.push(`- **Rate limit**: ${AGENT_SCOPES[entry.agent].rateLimitPerMin ?? 60} req/min`);
    lines.push(`- **Readable entities**: ${entry.scopes?.entities.join(', ') || '(none)'}`);
    lines.push(`- **Actions**: ${entry.scopes?.actions.join(', ') || '(none)'}`);
    if (entry.scopes?.fields_excluded.length) {
      lines.push(`- **Field exclusions**: ${entry.scopes.fields_excluded.join(', ')}`);
    }
    lines.push('');
  }
  lines.push('## Usage examples');
  lines.push('');
  lines.push('```bash');
  lines.push('# Discover your scope');
  lines.push('curl -H "Authorization: Bearer $TOKEN" https://kuncoaching.me/api/agent/content');
  lines.push('');
  lines.push('# List landing pages');
  lines.push('curl -H "Authorization: Bearer $TOKEN" \\');
  lines.push('  https://kuncoaching.me/api/agent/content/landing_pages');
  lines.push('');
  lines.push('# Read one landing page');
  lines.push('curl -H "Authorization: Bearer $TOKEN" \\');
  lines.push('  https://kuncoaching.me/api/agent/content/landing_pages/<id>');
  lines.push('');
  lines.push('# Update a field with Markdown');
  lines.push('curl -X PATCH \\');
  lines.push('  -H "Authorization: Bearer $TOKEN" \\');
  lines.push('  -H "Content-Type: application/json" \\');
  lines.push('  -d \'{"updates":{"composition_json":{"markdown":"# New hero\\n\\nParagraph text."}},"reason":"Copy refinement"}\' \\');
  lines.push('  https://kuncoaching.me/api/agent/content/landing_pages/<id>');
  lines.push('```');
  lines.push('');
  lines.push('## Rotation');
  lines.push('');
  lines.push('To rotate a single agent:');
  lines.push('');
  lines.push('```bash');
  lines.push('cd /Users/samer/kunacademy');
  lines.push('AGENT=hakima pnpm exec tsx apps/web/scripts/seed-agent-tokens.ts');
  lines.push('```');
  lines.push('');
  lines.push('To revoke manually:');
  lines.push('');
  lines.push('```sql');
  lines.push("UPDATE agent_tokens SET revoked_at = now(), revoked_reason = 'Manual revoke' WHERE agent_name = 'hakima';");
  lines.push('```');
  lines.push('');

  console.log(lines.join('\n'));
}

seed().then(
  () => process.exit(0),
  (err) => {
    console.error('Seeder failed:', err);
    process.exit(1);
  },
);
