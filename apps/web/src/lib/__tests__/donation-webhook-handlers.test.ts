/**
 * Unit tests for donation-webhook-handlers.ts — mock DB + mock Zoho.
 *
 * Wave E.2 (2026-04-24) — tests the webhook handler idempotency + shape.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Force mock mode for Zoho
delete process.env.ZOHO_SELF_CLIENT_ID;
delete process.env.ZOHO_SELF_CLIENT_SECRET;
delete process.env.ZOHO_REFRESH_TOKEN_CORE;
delete process.env.ZOHO_REFRESH_TOKEN;

// ─────────────────────────────────────────────────────────────────────────────
// Mock @kunacademy/db: provide a fake withAdminContext that runs the callback
// against an in-memory "database" we can assert on.
// ─────────────────────────────────────────────────────────────────────────────

interface FakeRow {
  id: string;
  donor_name?: string;
  donor_email?: string;
  amount_cents?: number;
  currency?: string;
  stripe_payment_intent_id?: string | null;
  stripe_subscription_id?: string | null;
  status?: string;
  zoho_project_task_id?: string | null;
  metadata?: Record<string, unknown>;
  refunded_at?: string | null;
  donor_message?: string | null;
  is_anonymous?: boolean;
  is_recurring?: boolean;
  designation_preference?: string;
}

const donationsTable: FakeRow[] = [];

function fakeExecute(queryObj: any) {
  // queryObj is a "drizzle sql template" with { strings, values } shape. Our mock
  // parses the concatenated SQL string to determine intent.
  const rawSQL = (queryObj.strings || queryObj.sql || '')
    .toString()
    .replace(/\s+/g, ' ')
    .trim();
  const values = queryObj.values ?? queryObj.params ?? [];

  if (rawSQL.includes('INSERT INTO donations')) {
    // Extract the 13 values
    const [
      donor_name,
      donor_email,
      donor_message,
      amount_cents,
      currency,
      stripe_payment_intent_id,
      stripe_subscription_id,
      stripe_customer_id,
      designation_preference,
      is_anonymous,
      is_recurring,
      metadata,
    ] = values;

    // ON CONFLICT check
    const piId = stripe_payment_intent_id;
    if (piId && donationsTable.some((r) => r.stripe_payment_intent_id === piId)) {
      return { rows: [] };
    }
    const row: FakeRow = {
      id: 'donation_' + (donationsTable.length + 1),
      donor_name,
      donor_email,
      donor_message,
      amount_cents: Number(amount_cents),
      currency,
      stripe_payment_intent_id: piId,
      stripe_subscription_id,
      designation_preference,
      is_anonymous: Boolean(is_anonymous),
      is_recurring: Boolean(is_recurring),
      status: 'received',
      metadata: typeof metadata === 'string' ? JSON.parse(metadata) : metadata,
    };
    donationsTable.push(row);
    return { rows: [{ id: row.id }] };
  }
  if (rawSQL.startsWith('SELECT id FROM donations WHERE stripe_subscription_id =')) {
    const subId = values[0];
    return { rows: donationsTable.filter((r) => r.stripe_subscription_id === subId).map((r) => ({ id: r.id })) };
  }
  if (rawSQL.startsWith('SELECT id, zoho_project_task_id FROM donations WHERE stripe_payment_intent_id =')) {
    const piId = values[0];
    const row = donationsTable.find((r) => r.stripe_payment_intent_id === piId);
    return { rows: row ? [{ id: row.id, zoho_project_task_id: row.zoho_project_task_id ?? null }] : [] };
  }
  if (rawSQL.startsWith('SELECT id, amount_cents, currency, status, zoho_project_task_id FROM donations WHERE stripe_payment_intent_id =')) {
    const piId = values[0];
    const row = donationsTable.find((r) => r.stripe_payment_intent_id === piId);
    if (!row) return { rows: [] };
    return {
      rows: [
        {
          id: row.id,
          amount_cents: row.amount_cents,
          currency: row.currency,
          status: row.status,
          zoho_project_task_id: row.zoho_project_task_id ?? null,
        },
      ],
    };
  }
  if (rawSQL.startsWith('UPDATE donations SET zoho_project_task_id')) {
    const [taskId, id] = values;
    const row = donationsTable.find((r) => r.id === id);
    if (row) row.zoho_project_task_id = taskId;
    return { rows: [], rowCount: row ? 1 : 0 };
  }
  if (rawSQL.startsWith('UPDATE donations SET status = \'refunded\'')) {
    const [chargeId, _amount, id] = values;
    const row = donationsTable.find((r) => r.id === id);
    if (row) {
      row.status = 'refunded';
      row.refunded_at = new Date().toISOString();
      row.metadata = { ...(row.metadata ?? {}), refund_charge_id: chargeId };
    }
    return { rows: [], rowCount: row ? 1 : 0 };
  }
  if (rawSQL.includes('UPDATE donations SET metadata = metadata ||') && rawSQL.includes('WHERE stripe_subscription_id =')) {
    const [canceledAt, subId] = values;
    const touched = donationsTable.filter((r) => r.stripe_subscription_id === subId);
    touched.forEach((r) => {
      r.metadata = { ...(r.metadata ?? {}), subscription_canceled: true, subscription_canceled_at: canceledAt };
    });
    return { rows: [], rowCount: touched.length };
  }
  return { rows: [] };
}

// Install the @kunacademy/db mock via require.cache manipulation BEFORE the
// handler module imports it.
import Module from 'node:module';
const originalRequire = Module.prototype.require;
Module.prototype.require = function patchedRequire(this: any, id: string) {
  if (id === '@kunacademy/db') {
    return {
      withAdminContext: async (cb: (db: { execute: typeof fakeExecute }) => unknown) => {
        return cb({ execute: fakeExecute as any });
      },
    };
  }
  return originalRequire.call(this, id);
} as any;

// Mock drizzle-orm's sql tag so our handlers can compose SQL objects the mock DB understands
Module.prototype.require = function patchedRequire2(this: any, id: string) {
  if (id === '@kunacademy/db') {
    return {
      withAdminContext: async (cb: (db: { execute: typeof fakeExecute }) => unknown) => {
        return cb({ execute: fakeExecute as any });
      },
    };
  }
  if (id === 'drizzle-orm') {
    // Return a sql tag that yields { strings, values }
    const sqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: strings.join('?'),
      values,
    });
    return { sql: sqlTag };
  }
  return originalRequire.call(this, id);
} as any;

/* eslint-disable @typescript-eslint/no-var-requires */
const handlerMod = require('../donation-webhook-handlers');
const {
  handleDonationSucceeded,
  handleRecurringDonationCharge,
  handleRecurringDonationCanceled,
  handleDonationRefund,
  isDonationEvent,
} = handlerMod;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — build minimal Stripe-like objects for tests
// ─────────────────────────────────────────────────────────────────────────────

function makePI(overrides: Partial<any> = {}): any {
  return {
    id: 'pi_test_' + Math.random().toString(36).slice(2, 10),
    amount: 10000,
    currency: 'aed',
    receipt_email: 'test@example.com',
    customer: null,
    metadata: {
      donation_type: 'one_time',
      donor_name: 'Jane Smith',
      donor_email: 'test@example.com',
      designation_preference: 'gps',
      is_anonymous: 'false',
      source: 'stripe_webhook',
      locale: 'en',
    },
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<any> = {}): any {
  return {
    id: 'in_test_' + Math.random().toString(36).slice(2, 10),
    payment_intent: 'pi_sub_' + Math.random().toString(36).slice(2, 10),
    customer_email: 'sub@example.com',
    amount_paid: 5000,
    currency: 'aed',
    ...overrides,
  };
}

function makeSubscription(overrides: Partial<any> = {}): any {
  return {
    id: 'sub_test_' + Math.random().toString(36).slice(2, 10),
    customer: 'cus_test',
    canceled_at: null,
    metadata: {
      donation_type: 'recurring',
      donor_name: 'Rec Donor',
      donor_email: 'sub@example.com',
      designation_preference: 'ihya',
      is_anonymous: 'false',
      source: 'stripe_webhook',
      locale: 'ar',
    },
    ...overrides,
  };
}

function makeCharge(overrides: Partial<any> = {}): any {
  return {
    id: 'ch_test_' + Math.random().toString(36).slice(2, 10),
    payment_intent: null,
    amount_refunded: 10000,
    refunds: { data: [{ reason: 'requested_by_customer' }] },
    metadata: { donation_type: 'one_time' },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('isDonationEvent', () => {
  test('returns true for one_time and recurring', () => {
    assert.equal(isDonationEvent({ donation_type: 'one_time' }), true);
    assert.equal(isDonationEvent({ donation_type: 'recurring' }), true);
  });

  test('returns false for other donation_type values or missing metadata', () => {
    assert.equal(isDonationEvent({ donation_type: 'membership' }), false);
    assert.equal(isDonationEvent({}), false);
    assert.equal(isDonationEvent(null), false);
    assert.equal(isDonationEvent(undefined), false);
  });
});

describe('handleDonationSucceeded', () => {
  beforeEach(() => {
    donationsTable.length = 0;
  });

  test('inserts a new donation row on first event', async () => {
    const pi = makePI({ id: 'pi_new1' });
    const res = await handleDonationSucceeded(pi);
    assert.equal(res.alreadyProcessed, false);
    assert.ok(res.donation_id);
    assert.equal(donationsTable.length, 1);
    assert.equal(donationsTable[0].stripe_payment_intent_id, 'pi_new1');
    assert.equal(donationsTable[0].donor_email, 'test@example.com');
    assert.equal(donationsTable[0].amount_cents, 10000);
    assert.equal(donationsTable[0].currency, 'AED');
    assert.equal(donationsTable[0].designation_preference, 'gps');
  });

  test('is idempotent — second event with same PI does not duplicate', async () => {
    const pi = makePI({ id: 'pi_idem1' });
    const res1 = await handleDonationSucceeded(pi);
    const res2 = await handleDonationSucceeded(pi);
    assert.equal(res1.alreadyProcessed, false);
    assert.equal(res2.alreadyProcessed, true);
    assert.equal(res2.donation_id, res1.donation_id);
    assert.equal(donationsTable.length, 1);
  });

  test('falls back to email-local for donor_name when missing', async () => {
    const pi = makePI({
      id: 'pi_noname',
      metadata: { donation_type: 'one_time', donor_email: 'someone@test.com', designation_preference: 'any', is_anonymous: 'false' },
    });
    await handleDonationSucceeded(pi);
    assert.equal(donationsTable[0].donor_name, 'someone');
  });

  test('rejects when donor_email is missing', async () => {
    const pi = makePI({
      id: 'pi_noemail',
      receipt_email: null,
      metadata: { donation_type: 'one_time', donor_name: 'X', designation_preference: 'any', is_anonymous: 'false' },
    });
    const res = await handleDonationSucceeded(pi);
    assert.equal(res.donation_id, null);
    assert.equal(donationsTable.length, 0);
  });

  test('normalizes invalid currency to AED', async () => {
    const pi = makePI({ id: 'pi_badcurr', currency: 'jpy' });
    await handleDonationSucceeded(pi);
    assert.equal(donationsTable[0].currency, 'AED');
  });

  test('normalizes invalid designation to any', async () => {
    const pi = makePI({
      id: 'pi_baddes',
      metadata: { ...makePI().metadata, designation_preference: 'invalid' },
    });
    await handleDonationSucceeded(pi);
    assert.equal(donationsTable[0].designation_preference, 'any');
  });

  test('parses is_anonymous="true" string correctly', async () => {
    const pi = makePI({
      id: 'pi_anon',
      metadata: { ...makePI().metadata, is_anonymous: 'true' },
    });
    await handleDonationSucceeded(pi);
    assert.equal(donationsTable[0].is_anonymous, true);
  });

  test('clamps donor_message to 280 chars', async () => {
    const longMsg = 'x'.repeat(400);
    const pi = makePI({
      id: 'pi_longmsg',
      metadata: { ...makePI().metadata, donor_message: longMsg },
    });
    await handleDonationSucceeded(pi);
    assert.equal(donationsTable[0].donor_message?.length, 280);
  });

  test('all 6 currencies AED USD EUR SAR EGP GBP are accepted', async () => {
    for (const curr of ['aed', 'usd', 'eur', 'sar', 'egp', 'gbp']) {
      const pi = makePI({ id: `pi_${curr}`, currency: curr });
      await handleDonationSucceeded(pi);
    }
    assert.equal(donationsTable.length, 6);
    const currencies = donationsTable.map((r) => r.currency).sort();
    assert.deepEqual(currencies, ['AED', 'EGP', 'EUR', 'GBP', 'SAR', 'USD']);
  });
});

describe('handleRecurringDonationCharge', () => {
  beforeEach(() => {
    donationsTable.length = 0;
  });

  test('inserts new row for each monthly charge, shares subscription_id', async () => {
    const sub = makeSubscription({ id: 'sub_rec1' });
    const res1 = await handleRecurringDonationCharge(makeInvoice({ payment_intent: 'pi_month1' }), sub);
    const res2 = await handleRecurringDonationCharge(makeInvoice({ payment_intent: 'pi_month2' }), sub);
    assert.equal(res1.alreadyProcessed, false);
    assert.equal(res1.isFirstCharge, true);
    assert.equal(res2.alreadyProcessed, false);
    assert.equal(res2.isFirstCharge, false);
    assert.equal(donationsTable.length, 2);
    assert.equal(donationsTable[0].stripe_subscription_id, 'sub_rec1');
    assert.equal(donationsTable[1].stripe_subscription_id, 'sub_rec1');
    assert.notEqual(donationsTable[0].stripe_payment_intent_id, donationsTable[1].stripe_payment_intent_id);
  });

  test('is idempotent — same invoice fires twice → second is no-op', async () => {
    const sub = makeSubscription({ id: 'sub_idem' });
    const inv = makeInvoice({ payment_intent: 'pi_dup' });
    const res1 = await handleRecurringDonationCharge(inv, sub);
    const res2 = await handleRecurringDonationCharge(inv, sub);
    assert.equal(res1.alreadyProcessed, false);
    assert.equal(res2.alreadyProcessed, true);
    assert.equal(res2.donation_id, res1.donation_id);
    assert.equal(donationsTable.length, 1);
  });

  test('marks recurring flag=true', async () => {
    const sub = makeSubscription();
    await handleRecurringDonationCharge(makeInvoice(), sub);
    assert.equal(donationsTable[0].is_recurring, true);
  });
});

describe('handleRecurringDonationCanceled', () => {
  beforeEach(() => {
    donationsTable.length = 0;
  });

  test('annotates all rows with subscription_canceled=true', async () => {
    const sub = makeSubscription({ id: 'sub_cancel1' });
    await handleRecurringDonationCharge(makeInvoice({ payment_intent: 'pi_c1' }), sub);
    await handleRecurringDonationCharge(makeInvoice({ payment_intent: 'pi_c2' }), sub);
    assert.equal(donationsTable.length, 2);

    const res = await handleRecurringDonationCanceled(sub);
    assert.equal(res.noted, true);
    assert.equal(res.rowsTouched, 2);
    assert.equal(donationsTable[0].metadata?.subscription_canceled, true);
    assert.equal(donationsTable[1].metadata?.subscription_canceled, true);
  });

  test('safe to call when no rows exist (subscription deleted before first charge)', async () => {
    const sub = makeSubscription({ id: 'sub_never_charged' });
    const res = await handleRecurringDonationCanceled(sub);
    assert.equal(res.rowsTouched, 0);
    assert.equal(res.noted, true);
  });
});

describe('handleDonationRefund', () => {
  beforeEach(() => {
    donationsTable.length = 0;
  });

  test('marks donation refunded and returns id', async () => {
    const pi = makePI({ id: 'pi_to_refund' });
    await handleDonationSucceeded(pi);
    assert.equal(donationsTable[0].status, 'received');

    const ch = makeCharge({ payment_intent: 'pi_to_refund' });
    const res = await handleDonationRefund(ch);
    assert.equal(res.alreadyRefunded, false);
    assert.equal(donationsTable[0].status, 'refunded');
  });

  test('is idempotent — second refund event is a no-op', async () => {
    const pi = makePI({ id: 'pi_dup_refund' });
    await handleDonationSucceeded(pi);
    const ch = makeCharge({ payment_intent: 'pi_dup_refund' });

    const res1 = await handleDonationRefund(ch);
    const res2 = await handleDonationRefund(ch);
    assert.equal(res1.alreadyRefunded, false);
    assert.equal(res2.alreadyRefunded, true);
    assert.equal(res2.donation_id, res1.donation_id);
  });

  test('refund without prior donation row returns null + warns', async () => {
    const ch = makeCharge({ payment_intent: 'pi_unknown' });
    const res = await handleDonationRefund(ch);
    assert.equal(res.donation_id, null);
    assert.equal(res.alreadyRefunded, false);
  });
});
