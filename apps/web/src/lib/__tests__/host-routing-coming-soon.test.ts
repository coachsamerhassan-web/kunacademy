/**
 * Phase 1d-D (2026-04-30) — host-routing coming-soon bypass tests.
 *
 * Locks the two behavioral changes from Samer's directive:
 *   1. Authed users (ANY role) bypass the coming-soon rewrite.
 *      Pre-fix: only admin/super_admin/content_editor passed.
 *      Post-fix: provider (coach), student, mentor_manager all pass too.
 *   2. COMING_SOON_MODE=off env var disables the splash globally.
 *
 * These are pure-function tests — no Next runtime mock required.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { decideHost, isStagingRoleAllowed, isComingSoonDisabled } from '../lp/host-routing';

const ENV_KEY = 'COMING_SOON_MODE';

function withEnv<T>(value: string | undefined, fn: () => T): T {
  const prior = process.env[ENV_KEY];
  if (value === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = value;
  try {
    return fn();
  } finally {
    if (prior === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prior;
  }
}

describe('Phase 1d-D — coming-soon bypass for authed users (any role)', () => {
  test('anonymous visitor on /ar/coach → rewrite-coming-soon', () => {
    const d = decideHost({ host: 'staging', pathname: '/ar/coach', role: undefined });
    assert.equal(d.action, 'rewrite-coming-soon');
  });

  test('anonymous visitor on /ar/admin → rewrite-coming-soon', () => {
    const d = decideHost({ host: 'staging', pathname: '/ar/admin', role: null });
    assert.equal(d.action, 'rewrite-coming-soon');
  });

  test('admin on /ar/admin → allow', () => {
    const d = decideHost({ host: 'staging', pathname: '/ar/admin', role: 'admin' });
    assert.equal(d.action, 'allow');
  });

  test('super_admin on /ar/admin → allow', () => {
    const d = decideHost({ host: 'staging', pathname: '/ar/admin', role: 'super_admin' });
    assert.equal(d.action, 'allow');
  });

  test('coach (provider role) on /ar/coach → allow (REGRESSION FIX)', () => {
    const d = decideHost({ host: 'staging', pathname: '/ar/coach', role: 'provider' });
    assert.equal(d.action, 'allow');
  });

  test('student on /ar/dashboard → allow (NEW behavior)', () => {
    const d = decideHost({ host: 'staging', pathname: '/ar/dashboard', role: 'student' });
    assert.equal(d.action, 'allow');
  });

  test('content_editor on /ar/admin/lp → allow', () => {
    const d = decideHost({ host: 'staging', pathname: '/ar/admin/lp', role: 'content_editor' });
    assert.equal(d.action, 'allow');
  });

  test('mentor_manager on /ar/admin/escalations → allow', () => {
    const d = decideHost({ host: 'staging', pathname: '/ar/admin/escalations', role: 'mentor_manager' });
    assert.equal(d.action, 'allow');
  });

  test('isStagingRoleAllowed returns true for any non-empty role', () => {
    assert.equal(isStagingRoleAllowed('provider'), true);
    assert.equal(isStagingRoleAllowed('student'), true);
    assert.equal(isStagingRoleAllowed('totally_made_up_role'), true);
  });

  test('isStagingRoleAllowed returns false for unauthed (no role)', () => {
    assert.equal(isStagingRoleAllowed(undefined), false);
    assert.equal(isStagingRoleAllowed(null), false);
    assert.equal(isStagingRoleAllowed(''), false);
  });
});

describe('Phase 1d-D — COMING_SOON_MODE env var kill-switch', () => {
  test('default (unset) — coming-soon active, anon hits rewrite', () => {
    withEnv(undefined, () => {
      const d = decideHost({ host: 'staging', pathname: '/ar/about', role: undefined });
      assert.equal(d.action, 'rewrite-coming-soon');
    });
  });

  test('COMING_SOON_MODE=on — same as default', () => {
    withEnv('on', () => {
      const d = decideHost({ host: 'staging', pathname: '/ar/about', role: undefined });
      assert.equal(d.action, 'rewrite-coming-soon');
    });
  });

  test('COMING_SOON_MODE=off — anon visitor passes through (kill-switch active)', () => {
    withEnv('off', () => {
      const d = decideHost({ host: 'staging', pathname: '/ar/about', role: undefined });
      assert.equal(d.action, 'allow');
      assert.equal(d.reason, 'coming-soon-mode-off');
    });
  });

  test('COMING_SOON_MODE=false — also disables splash', () => {
    withEnv('false', () => {
      const d = decideHost({ host: 'staging', pathname: '/ar/coach', role: undefined });
      assert.equal(d.action, 'allow');
    });
  });

  test('COMING_SOON_MODE=0 — also disables splash', () => {
    withEnv('0', () => {
      const d = decideHost({ host: 'staging', pathname: '/ar/coach', role: undefined });
      assert.equal(d.action, 'allow');
    });
  });

  test('COMING_SOON_MODE=disabled — also disables splash', () => {
    withEnv('disabled', () => {
      const d = decideHost({ host: 'staging', pathname: '/ar/coach', role: undefined });
      assert.equal(d.action, 'allow');
    });
  });

  test('COMING_SOON_MODE accepts whitespace + mixed case', () => {
    withEnv('  OFF  ', () => assert.equal(isComingSoonDisabled(), true));
    withEnv('Off', () => assert.equal(isComingSoonDisabled(), true));
    withEnv('FALSE', () => assert.equal(isComingSoonDisabled(), true));
  });

  test('Authed user behavior is unchanged when kill-switch is off', () => {
    withEnv('off', () => {
      const d = decideHost({ host: 'staging', pathname: '/ar/admin', role: 'admin' });
      assert.equal(d.action, 'allow');
    });
  });
});

describe('Phase 1d-D — try.* and unknown hosts unaffected', () => {
  test('try.* still 404s non-allowlisted paths regardless of role', () => {
    const d = decideHost({ host: 'try', pathname: '/ar/admin', role: 'admin' });
    assert.equal(d.action, 'block-404');
  });

  test('try.* with COMING_SOON_MODE=off still gates same way', () => {
    withEnv('off', () => {
      const d = decideHost({ host: 'try', pathname: '/ar/admin', role: undefined });
      assert.equal(d.action, 'block-404');
    });
  });

  test('production host = passthrough', () => {
    const d = decideHost({ host: 'production', pathname: '/anything', role: undefined });
    assert.equal(d.action, 'allow');
  });
});
