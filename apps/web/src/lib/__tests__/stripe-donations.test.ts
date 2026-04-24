/**
 * Unit tests for stripe-donations.ts — mock Stripe SDK.
 *
 * Wave E.2 (2026-04-24) — run via tsx + node:assert.
 *
 * Execute:
 *   cd apps/web
 *   STRIPE_ALLOW_DEV_PLACEHOLDER=1 \
 *     node --import tsx --test src/lib/__tests__/stripe-donations.test.ts
 *
 * OR via the wave-e2 runner script:
 *   bash /Users/samer/kunacademy/apps/web/scripts/wave-e2-run-tests.sh
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─────────────────────────────────────────────────────────────────────────────
// Stripe SDK mock — intercept all API methods used by stripe-donations.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// We must install the mock BEFORE stripe-donations.ts loads because it
// initializes the Stripe client at module-load time. Node's test runner
// evaluates imports in order, so we inject via a require.cache override
// when tsx compiles the ESM import. Simpler approach: use global state
// and re-require.

// Ensure env is set BEFORE importing stripe-donations.ts
process.env.STRIPE_ALLOW_DEV_PLACEHOLDER = '1';
delete process.env.STRIPE_SECRET_KEY;
// NODE_ENV cannot be assigned directly under strict typecheck; use indexed assignment.
(process.env as Record<string, string>).NODE_ENV = 'test';

// Capture all Stripe API calls in a log the tests can inspect
interface StripeCall {
  method: string;
  args: unknown[];
}
const stripeCalls: StripeCall[] = [];

function mockStripeClient() {
  const self = {
    customers: {
      list: async (args: any) => {
        stripeCalls.push({ method: 'customers.list', args: [args] });
        return { data: args?.email === 'existing@example.com'
          ? [{ id: 'cus_existing', email: args.email, name: 'Existing', metadata: { source: 'donation' } }]
          : [] };
      },
      create: async (args: any) => {
        stripeCalls.push({ method: 'customers.create', args: [args] });
        return { id: 'cus_new_' + Date.now(), email: args.email, name: args.name, metadata: args.metadata };
      },
      update: async (id: string, args: any) => {
        stripeCalls.push({ method: 'customers.update', args: [id, args] });
        return { id, ...args };
      },
    },
    prices: {
      list: async (args: any) => {
        stripeCalls.push({ method: 'prices.list', args: [args] });
        return { data: [] };
      },
      create: async (args: any) => {
        stripeCalls.push({ method: 'prices.create', args: [args] });
        return { id: 'price_' + Date.now(), ...args };
      },
    },
    products: {
      search: async (args: any) => {
        stripeCalls.push({ method: 'products.search', args: [args] });
        return { data: [{ id: 'prod_existing' }] };
      },
      create: async (args: any) => {
        stripeCalls.push({ method: 'products.create', args: [args] });
        return { id: 'prod_new', ...args };
      },
    },
    paymentIntents: {
      create: async (args: any) => {
        stripeCalls.push({ method: 'paymentIntents.create', args: [args] });
        return {
          id: 'pi_mock_' + Date.now(),
          client_secret: 'pi_mock_secret_' + Date.now(),
          amount: args.amount,
          currency: args.currency,
          metadata: args.metadata,
        };
      },
      retrieve: async (id: string) => {
        stripeCalls.push({ method: 'paymentIntents.retrieve', args: [id] });
        if (id === 'pi_not_found') {
          const err: any = new Error('Not found');
          err.statusCode = 404;
          throw err;
        }
        return { id, amount: 1000, currency: 'aed', status: 'succeeded', metadata: {} };
      },
    },
    subscriptions: {
      create: async (args: any) => {
        stripeCalls.push({ method: 'subscriptions.create', args: [args] });
        const subId = 'sub_mock_' + Date.now();
        return {
          id: subId,
          customer: args.customer,
          status: 'incomplete',
          metadata: args.metadata,
          latest_invoice: {
            id: 'in_mock',
            payment_intent: {
              id: 'pi_sub_mock',
              client_secret: 'pi_sub_mock_secret',
              amount: args.items[0].price === 'price_existing' ? 1000 : 100,
              currency: 'aed',
            },
          },
        };
      },
      retrieve: async (id: string) => {
        stripeCalls.push({ method: 'subscriptions.retrieve', args: [id] });
        if (id === 'sub_not_found') {
          const err: any = new Error('Not found');
          err.statusCode = 404;
          throw err;
        }
        return { id, status: 'active', metadata: { donation_type: 'recurring' } };
      },
      update: async (id: string, args: any) => {
        stripeCalls.push({ method: 'subscriptions.update', args: [id, args] });
        return { id, cancel_at_period_end: args.cancel_at_period_end ?? false };
      },
    },
  };
  return self;
}

// Monkey-patch the stripe module globally BEFORE stripe-donations.ts imports it.
// This mutates the require.cache for 'stripe' at CommonJS load. Since Next/Node
// caches imports, subsequent imports get the mock.
import Module from 'node:module';
const originalRequire = Module.prototype.require;
Module.prototype.require = function patchedRequire(this: any, id: string) {
  if (id === 'stripe') {
    const mockCtor: any = function (_key: string, _opts: unknown) {
      return mockStripeClient();
    };
    mockCtor.default = mockCtor;
    return mockCtor;
  }
  return originalRequire.call(this, id);
} as any;

// Now require the module-under-test (will use mocked stripe)
/* eslint-disable @typescript-eslint/no-var-requires */
const mod = require('../stripe-donations');
const {
  createDonationPaymentIntent,
  createDonationSubscription,
  getOrCreateDonationCustomer,
  getOrCreateDonationPrice,
  cancelDonationSubscription,
  retrievePaymentIntent,
  __internals,
} = mod;

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('stripe-donations / internals', () => {
  test('buildPriceLookupKey produces stable key per (amount, currency)', () => {
    assert.equal(__internals.buildPriceLookupKey(10000, 'AED'), 'kun_donation_monthly_aed_10000');
    assert.equal(__internals.buildPriceLookupKey(500, 'USD'), 'kun_donation_monthly_usd_500');
  });

  test('toStripeCurrency lowercases', () => {
    assert.equal(__internals.toStripeCurrency('AED'), 'aed');
    assert.equal(__internals.toStripeCurrency('EGP'), 'egp');
  });

  test('validateAmountMinor rejects zero, negative, non-integer, and below-100 floor', () => {
    assert.throws(() => __internals.validateAmountMinor(0, 'AED'));
    assert.throws(() => __internals.validateAmountMinor(-50, 'AED'));
    assert.throws(() => __internals.validateAmountMinor(99.5, 'AED'));
    assert.throws(() => __internals.validateAmountMinor(50, 'AED'));
    assert.doesNotThrow(() => __internals.validateAmountMinor(100, 'AED'));
    assert.doesNotThrow(() => __internals.validateAmountMinor(1000000, 'USD'));
  });
});

describe('stripe-donations / createDonationPaymentIntent', () => {
  beforeEach(() => {
    stripeCalls.length = 0;
  });

  test('creates a PI for AED with correct metadata', async () => {
    const res = await createDonationPaymentIntent({
      amount_minor: 10000,
      currency: 'AED',
      designation_preference: 'gps',
      is_anonymous: false,
      donor: { name: 'Jane Smith', email: 'jane@example.com', locale: 'en' },
    });
    assert.match(res.paymentIntentId, /^pi_mock/);
    assert.match(res.clientSecret, /^pi_mock_secret/);
    assert.equal(res.amount_minor, 10000);
    assert.equal(res.currency, 'AED');

    const call = stripeCalls.find((c) => c.method === 'paymentIntents.create')!;
    const args = call.args[0] as any;
    assert.equal(args.amount, 10000);
    assert.equal(args.currency, 'aed');
    assert.equal(args.metadata.donation_type, 'one_time');
    assert.equal(args.metadata.designation_preference, 'gps');
    assert.equal(args.metadata.is_anonymous, 'false');
    assert.equal(args.metadata.donor_email, 'jane@example.com');
    assert.equal(args.metadata.locale, 'en');
    assert.equal(args.metadata.source, 'stripe_webhook');
  });

  test('handles all 6 supported currencies', async () => {
    const currencies = ['AED', 'USD', 'EUR', 'SAR', 'EGP', 'GBP'] as const;
    for (const c of currencies) {
      const res = await createDonationPaymentIntent({
        amount_minor: 1000,
        currency: c,
        designation_preference: 'any',
        is_anonymous: false,
        donor: { name: 'Test', email: 't@e.com' },
      });
      assert.equal(res.currency, c);
    }
  });

  test('rejects unsupported currency', async () => {
    await assert.rejects(
      createDonationPaymentIntent({
        amount_minor: 1000,
        currency: 'JPY' as any,
        designation_preference: 'any',
        is_anonymous: false,
        donor: { name: 'Test', email: 't@e.com' },
      }),
      /Unsupported currency/,
    );
  });

  test('rejects unsupported designation', async () => {
    await assert.rejects(
      createDonationPaymentIntent({
        amount_minor: 1000,
        currency: 'AED',
        designation_preference: 'membership' as any,
        is_anonymous: false,
        donor: { name: 'Test', email: 't@e.com' },
      }),
      /Unsupported designation/,
    );
  });

  test('rejects missing donor name or email', async () => {
    await assert.rejects(
      createDonationPaymentIntent({
        amount_minor: 1000,
        currency: 'AED',
        designation_preference: 'any',
        is_anonymous: false,
        donor: { name: '', email: 't@e.com' },
      }),
      /donor\.name and donor\.email/,
    );
    await assert.rejects(
      createDonationPaymentIntent({
        amount_minor: 1000,
        currency: 'AED',
        designation_preference: 'any',
        is_anonymous: false,
        donor: { name: 'Test', email: '' },
      }),
      /donor\.name and donor\.email/,
    );
  });

  test('truncates donor_message to 280 chars', async () => {
    const longMsg = 'x'.repeat(500);
    await createDonationPaymentIntent({
      amount_minor: 1000,
      currency: 'AED',
      designation_preference: 'any',
      is_anonymous: false,
      donor: { name: 'Test', email: 't@e.com', message: longMsg },
    });
    const args = stripeCalls.find((c) => c.method === 'paymentIntents.create')!.args[0] as any;
    assert.equal(args.metadata.donor_message.length, 280);
  });
});

describe('stripe-donations / createDonationSubscription', () => {
  beforeEach(() => {
    stripeCalls.length = 0;
  });

  test('creates subscription with correct metadata and returns client_secret', async () => {
    const res = await createDonationSubscription({
      amount_minor: 10000,
      currency: 'AED',
      designation_preference: 'seeds',
      is_anonymous: false,
      donor: { name: 'Rec Donor', email: 'rec@example.com', locale: 'ar' },
    });
    assert.match(res.subscriptionId, /^sub_mock/);
    assert.ok(res.clientSecret);
    assert.ok(res.customerId);
    assert.ok(res.priceId);

    const subCall = stripeCalls.find((c) => c.method === 'subscriptions.create')!;
    const args = subCall.args[0] as any;
    assert.equal(args.metadata.donation_type, 'recurring');
    assert.equal(args.metadata.designation_preference, 'seeds');
    assert.equal(args.metadata.is_recurring, 'true');
    assert.equal(args.payment_behavior, 'default_incomplete');
  });

  test('reuses existing customer by email', async () => {
    await createDonationSubscription({
      amount_minor: 10000,
      currency: 'AED',
      designation_preference: 'any',
      is_anonymous: false,
      donor: { name: 'Existing', email: 'existing@example.com', locale: 'en' },
    });
    const createCalls = stripeCalls.filter((c) => c.method === 'customers.create');
    assert.equal(createCalls.length, 0, 'should not create customer when one exists');
    const updateCalls = stripeCalls.filter((c) => c.method === 'customers.update');
    // update is allowed when name mismatches; in our mock the name matches 'Existing'
    // but metadata.source doesn't have updated_at, so update may fire once. Not asserting strict equality.
    assert.ok(updateCalls.length <= 1);
  });

  test('creates new customer when none exists', async () => {
    await createDonationSubscription({
      amount_minor: 10000,
      currency: 'USD',
      designation_preference: 'wisal',
      is_anonymous: true,
      donor: { name: 'New Donor', email: 'new@example.com', locale: 'en' },
    });
    const createCalls = stripeCalls.filter((c) => c.method === 'customers.create');
    assert.equal(createCalls.length, 1);
    const args = createCalls[0].args[0] as any;
    assert.equal(args.email, 'new@example.com');
    assert.equal(args.metadata.source, 'donation');
  });
});

describe('stripe-donations / getOrCreateDonationCustomer', () => {
  beforeEach(() => {
    stripeCalls.length = 0;
  });

  test('returns existing customer without creating new one', async () => {
    const c = await getOrCreateDonationCustomer({
      name: 'Existing',
      email: 'existing@example.com',
      locale: 'en',
    });
    assert.equal(c.id, 'cus_existing');
    const createCalls = stripeCalls.filter((c) => c.method === 'customers.create');
    assert.equal(createCalls.length, 0);
  });

  test('creates new customer when none exists', async () => {
    const c = await getOrCreateDonationCustomer({
      name: 'Brand New',
      email: 'brand-new@example.com',
      locale: 'ar',
    });
    assert.match(c.id, /^cus_new_/);
    const createCalls = stripeCalls.filter((c) => c.method === 'customers.create');
    assert.equal(createCalls.length, 1);
  });
});

describe('stripe-donations / getOrCreateDonationPrice', () => {
  beforeEach(() => {
    stripeCalls.length = 0;
  });

  test('creates a new price with correct lookup_key when none exists', async () => {
    const p = await getOrCreateDonationPrice(10000, 'AED');
    const createCalls = stripeCalls.filter((c) => c.method === 'prices.create');
    assert.equal(createCalls.length, 1);
    const args = createCalls[0].args[0] as any;
    assert.equal(args.lookup_key, 'kun_donation_monthly_aed_10000');
    assert.equal(args.unit_amount, 10000);
    assert.equal(args.currency, 'aed');
    assert.equal(args.recurring.interval, 'month');
  });

  test('rejects amount below 100 floor', async () => {
    await assert.rejects(getOrCreateDonationPrice(50, 'AED'));
  });
});

describe('stripe-donations / cancelDonationSubscription', () => {
  beforeEach(() => {
    stripeCalls.length = 0;
  });

  test('sets cancel_at_period_end=true', async () => {
    const r = await cancelDonationSubscription('sub_abc123');
    assert.equal(r.subscriptionId, 'sub_abc123');
    assert.equal(r.cancel_at_period_end, true);
    const updateCall = stripeCalls.find((c) => c.method === 'subscriptions.update')!;
    assert.equal((updateCall.args[0] as string), 'sub_abc123');
    assert.equal((updateCall.args[1] as any).cancel_at_period_end, true);
  });
});

describe('stripe-donations / retrievePaymentIntent', () => {
  beforeEach(() => {
    stripeCalls.length = 0;
  });

  test('returns PaymentIntent for valid id', async () => {
    const pi = await retrievePaymentIntent('pi_valid');
    assert.ok(pi);
    assert.equal(pi?.id, 'pi_valid');
  });

  test('returns null for 404', async () => {
    const pi = await retrievePaymentIntent('pi_not_found');
    assert.equal(pi, null);
  });
});
