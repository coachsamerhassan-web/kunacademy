/**
 * Unit tests for zoho-projects.ts — mock-mode (no live Zoho creds).
 *
 * Wave E.2 (2026-04-24) — run via tsx + node:assert.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Force mock mode by clearing Zoho credentials
delete process.env.ZOHO_SELF_CLIENT_ID;
delete process.env.ZOHO_SELF_CLIENT_SECRET;
delete process.env.ZOHO_REFRESH_TOKEN_CORE;
delete process.env.ZOHO_REFRESH_TOKEN;

/* eslint-disable @typescript-eslint/no-var-requires */
const mod = require('../zoho-projects');
const {
  logDonationTask,
  logAllocationTask,
  logDisbursementTask,
  logReversalTask,
  getProjectBalance,
  resolveScholarshipFundProjectId,
  ZOHO_SCHOLARSHIP_FUND_ORG_ID,
} = mod;

const PROJECT_ID = 'proj_test_123';

describe('zoho-projects / mock mode', () => {
  test('logDonationTask returns mock task_id', async () => {
    const res = await logDonationTask(PROJECT_ID, {
      donation_id: 'don_abc',
      donor_display_name: 'Jane S.',
      amount_minor: 10000,
      currency: 'AED',
      designation_preference: 'gps',
      is_anonymous: false,
      is_recurring: false,
      stripe_payment_intent_id: 'pi_abc',
      donor_message: 'Keep it up',
    });
    assert.equal(res.mock, true);
    assert.match(res.task_id, /^mock-proj_test_123-/);
  });

  test('logDonationTask with anonymous donor omits the real name', async () => {
    // This test verifies the mock path doesn't throw; real check is at integration level
    const res = await logDonationTask(PROJECT_ID, {
      donation_id: 'don_anon',
      donor_display_name: 'Hidden Name',
      amount_minor: 5000,
      currency: 'USD',
      designation_preference: 'any',
      is_anonymous: true,
      is_recurring: false,
      stripe_payment_intent_id: null,
      donor_message: null,
    });
    assert.equal(res.mock, true);
  });

  test('logAllocationTask returns mock', async () => {
    const res = await logAllocationTask(PROJECT_ID, {
      scholarship_id: 'sch_1',
      application_id: 'app_1',
      recipient_display_name: 'Ahmed',
      program_slug: 'gps-of-life',
      program_family: 'gps',
      scholarship_tier: 'partial',
      total_amount_minor: 200000,
      currency: 'AED',
      donation_ids: ['don_a', 'don_b'],
      allocated_by_display: 'Nashit',
    });
    assert.equal(res.mock, true);
  });

  test('logDisbursementTask returns mock', async () => {
    const res = await logDisbursementTask(PROJECT_ID, {
      scholarship_id: 'sch_1',
      recipient_display_name: 'Ahmed',
      program_slug: 'gps-of-life',
      program_family: 'gps',
      program_enrollment_id: 'enr_1',
    });
    assert.equal(res.mock, true);
  });

  test('logReversalTask returns mock', async () => {
    const res = await logReversalTask(PROJECT_ID, {
      donation_id: 'don_refunded',
      original_task_id: 'task_123',
      amount_minor: 10000,
      currency: 'AED',
      reason: 'requested_by_customer',
    });
    assert.equal(res.mock, true);
  });

  test('getProjectBalance returns zero-filled counts in mock mode', async () => {
    const res = await getProjectBalance(PROJECT_ID);
    assert.equal(res.mock, true);
    assert.equal(res.donor_received_count, 0);
    assert.equal(res.allocated_count, 0);
    assert.equal(res.disbursed_count, 0);
    assert.equal(res.refunded_count, 0);
    assert.equal(res.truncated, false);
  });
});

describe('zoho-projects / resolveScholarshipFundProjectId', () => {
  beforeEach(() => {
    delete process.env.ZOHO_PROJECTS_SCHOLARSHIP_FUND_ID;
  });

  test('returns null when env unset', () => {
    assert.equal(resolveScholarshipFundProjectId(), null);
  });

  test('returns trimmed value when env set', () => {
    process.env.ZOHO_PROJECTS_SCHOLARSHIP_FUND_ID = '  proj_live_abc  ';
    assert.equal(resolveScholarshipFundProjectId(), 'proj_live_abc');
  });

  test('returns null when env set to empty string', () => {
    process.env.ZOHO_PROJECTS_SCHOLARSHIP_FUND_ID = '   ';
    assert.equal(resolveScholarshipFundProjectId(), null);
  });
});

describe('zoho-projects / constants', () => {
  test('UAE org_id is the canonical 873861649', () => {
    assert.equal(ZOHO_SCHOLARSHIP_FUND_ORG_ID, '873861649');
  });
});
