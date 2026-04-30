/**
 * Comprehensive Patch Phase 0+1 — portal-sidebar shell structural tests.
 *
 * These tests guard against accidental regressions during the Stitch×Kun
 * dashboard shell rebuild (2026-04-30):
 *   - Data arrays preserved verbatim (regression guard against a future
 *     visual edit accidentally deleting a nav entry).
 *   - Mid-list dividers configured at the agreed split points
 *     (admin: ops vs content; dashboard/coach: personal vs analytics).
 *   - All 26 admin entries still present (the chief regression risk).
 *
 * NOTE: These are STRUCTURAL tests. JSX render is verified visually on
 * staging during the Samer canary gate; DOM assertions would require
 * jsdom + a React renderer + a Next pathname mock — out of scope for
 * the existing tsx --test rig. The data-shape contract is what matters
 * for "did we break the sidebar."
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// We import the test-only export from the component module. Because
// portal-sidebar.tsx is a client component using next/navigation hooks,
// we only access the static data exports — no React render.
const portalSidebar = require('../../components/portal-sidebar');

const { __testOnly } = portalSidebar as {
  __testOnly: {
    dashboardNav: Array<{ href: string; labelAr: string; labelEn: string; icon: string }>;
    coachNav: Array<{ href: string; labelAr: string; labelEn: string; icon: string }>;
    adminNav: Array<{ href: string; labelAr: string; labelEn: string; icon: string }>;
    NAV_DIVIDERS: Record<'dashboard' | 'coach' | 'admin', number>;
  };
};

describe('PortalSidebar / data arrays preserved (regression guards)', () => {
  test('dashboardNav has 9 entries', () => {
    assert.equal(__testOnly.dashboardNav.length, 9, 'dashboardNav entry count must not regress');
  });

  test('coachNav has 10 entries', () => {
    assert.equal(__testOnly.coachNav.length, 10, 'coachNav entry count must not regress');
  });

  test('adminNav has 26 entries (per dispatch — accidental deletion guard)', () => {
    assert.equal(__testOnly.adminNav.length, 26, 'adminNav entry count must not regress — dispatch said 26');
  });

  test('every adminNav entry has the four required NavItem fields', () => {
    for (const [i, item] of __testOnly.adminNav.entries()) {
      assert.ok(item.href.length > 0, `adminNav[${i}] missing href`);
      assert.ok(item.labelAr.length > 0, `adminNav[${i}] missing labelAr (${item.href})`);
      assert.ok(item.labelEn.length > 0, `adminNav[${i}] missing labelEn (${item.href})`);
      assert.ok(item.icon.length > 0, `adminNav[${i}] missing icon (${item.href})`);
    }
  });

  test('every dashboardNav entry has the four required NavItem fields', () => {
    for (const [i, item] of __testOnly.dashboardNav.entries()) {
      assert.ok(item.href.length > 0, `dashboardNav[${i}] missing href`);
      assert.ok(item.labelAr.length > 0, `dashboardNav[${i}] missing labelAr`);
      assert.ok(item.labelEn.length > 0, `dashboardNav[${i}] missing labelEn`);
      assert.ok(item.icon.length > 0, `dashboardNav[${i}] missing icon`);
    }
  });

  test('every coachNav entry has the four required NavItem fields', () => {
    for (const [i, item] of __testOnly.coachNav.entries()) {
      assert.ok(item.href.length > 0, `coachNav[${i}] missing href`);
      assert.ok(item.labelAr.length > 0, `coachNav[${i}] missing labelAr`);
      assert.ok(item.labelEn.length > 0, `coachNav[${i}] missing labelEn`);
      assert.ok(item.icon.length > 0, `coachNav[${i}] missing icon`);
    }
  });

  test('every nav entry href starts with the variant slug', () => {
    for (const item of __testOnly.dashboardNav) {
      assert.ok(item.href.startsWith('/dashboard'), `dashboardNav href shape: ${item.href}`);
    }
    for (const item of __testOnly.coachNav) {
      assert.ok(item.href.startsWith('/coach'), `coachNav href shape: ${item.href}`);
    }
    for (const item of __testOnly.adminNav) {
      assert.ok(item.href.startsWith('/admin'), `adminNav href shape: ${item.href}`);
    }
  });

  test('Overview is always at index 0 of every variant', () => {
    assert.equal(__testOnly.dashboardNav[0].href, '/dashboard');
    assert.equal(__testOnly.coachNav[0].href, '/coach');
    assert.equal(__testOnly.adminNav[0].href, '/admin');
  });

  test('href slugs are unique within each variant (no accidental duplication)', () => {
    for (const variant of ['dashboardNav', 'coachNav', 'adminNav'] as const) {
      const items = __testOnly[variant];
      const seen = new Set<string>();
      for (const item of items) {
        assert.ok(!seen.has(item.href), `${variant} duplicate href: ${item.href}`);
        seen.add(item.href);
      }
    }
  });
});

describe('PortalSidebar / dividers configured at agreed split points', () => {
  test('NAV_DIVIDERS map exposes all three variants', () => {
    assert.equal(typeof __testOnly.NAV_DIVIDERS.dashboard, 'number');
    assert.equal(typeof __testOnly.NAV_DIVIDERS.coach, 'number');
    assert.equal(typeof __testOnly.NAV_DIVIDERS.admin, 'number');
  });

  test('admin divider falls between Discount Codes (ops) and Courses (content)', () => {
    const idx = __testOnly.NAV_DIVIDERS.admin;
    const before = __testOnly.adminNav[idx];
    const after = __testOnly.adminNav[idx + 1];
    assert.equal(before.href, '/admin/discount-codes', 'expected divider AFTER /admin/discount-codes');
    assert.equal(after.href, '/admin/courses', 'expected divider BEFORE /admin/courses');
  });

  test('dashboard divider falls between Bookings (personal) and Library (resources)', () => {
    const idx = __testOnly.NAV_DIVIDERS.dashboard;
    const before = __testOnly.dashboardNav[idx];
    const after = __testOnly.dashboardNav[idx + 1];
    assert.equal(before.href, '/dashboard/bookings');
    assert.equal(after.href, '/dashboard/bookshelf');
  });

  test('coach divider falls between Earnings (work) and Ratings (analytics)', () => {
    const idx = __testOnly.NAV_DIVIDERS.coach;
    const before = __testOnly.coachNav[idx];
    const after = __testOnly.coachNav[idx + 1];
    assert.equal(before.href, '/coach/earnings');
    assert.equal(after.href, '/coach/ratings');
  });

  test('every divider index is within bounds (not off-by-one off the end)', () => {
    assert.ok(__testOnly.NAV_DIVIDERS.dashboard < __testOnly.dashboardNav.length - 1);
    assert.ok(__testOnly.NAV_DIVIDERS.coach < __testOnly.coachNav.length - 1);
    assert.ok(__testOnly.NAV_DIVIDERS.admin < __testOnly.adminNav.length - 1);
    // And not negative
    assert.ok(__testOnly.NAV_DIVIDERS.dashboard >= 0);
    assert.ok(__testOnly.NAV_DIVIDERS.coach >= 0);
    assert.ok(__testOnly.NAV_DIVIDERS.admin >= 0);
  });
});

describe('PortalSidebar / canonical admin entries present', () => {
  // Spot-check the admin entries Samer/Rafik most commonly cite. Any of these
  // disappearing from the array is a HIGH-risk regression.
  const required = [
    '/admin',
    '/admin/orders',
    '/admin/instructors',
    '/admin/students',
    '/admin/courses',
    '/admin/products',
    '/admin/testimonials',
    '/admin/community',
    '/admin/lp',
    '/admin/static-pages',
    '/admin/programs',
    '/admin/events',
    '/admin/corporate-benefits',
    '/admin/scholarships',
    '/admin/membership',
    '/admin/pathfinder',
  ];
  for (const href of required) {
    test(`adminNav still contains ${href}`, () => {
      const found = __testOnly.adminNav.find((i) => i.href === href);
      assert.ok(found, `${href} missing from adminNav (regression!)`);
    });
  }
});
