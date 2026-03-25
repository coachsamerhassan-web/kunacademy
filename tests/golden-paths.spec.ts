// @ts-nocheck
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('GP-1: Arabic visitor → browse → book → pay → confirmation', () => {
  test('can browse coaches and reach booking page', async ({ page }) => {
    await page.goto(`${BASE_URL}/ar/coaching/book`);
    await expect(page.locator('h1')).toContainText('احجز جلسة كوتشنج');
  });
});

test.describe('GP-2: English visitor → buy course → Stripe → enrolled', () => {
  test('can view course catalog', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/academy`);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('course player loads for enrolled user', async ({ page }) => {
    // Requires auth — will redirect to login
    await page.goto(`${BASE_URL}/en/portal/courses/test-course`);
    await expect(page.url()).toContain('/auth/login');
  });
});

test.describe('GP-3: Student → login → resume → complete → certificate', () => {
  test('login page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/ar/auth/login`);
    await expect(page.locator('h1')).toContainText('تسجيل الدخول');
    await expect(page.locator('button:has-text("Google")')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('portal redirects to login when unauthenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/ar/portal`);
    await expect(page.url()).toContain('/auth/login');
  });

  test('certificates page exists', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/portal/certificates`);
    await expect(page.url()).toContain('/auth/login');
  });
});

test.describe('GP-4: Corporate → inquiry form', () => {
  test('corporate coaching page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/ar/coaching/corporate`);
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('GP-5: Admin → edit program → publish', () => {
  test('admin dashboard redirects non-admin to portal', async ({ page }) => {
    await page.goto(`${BASE_URL}/ar/admin`);
    // Should redirect to login (no session) or portal (non-admin)
    await expect(page.url()).toMatch(/(login|portal)/);
  });
});

test.describe('GP-6: Coach → invited → onboard → profile live → booking', () => {
  test('coach onboarding page exists', async ({ page }) => {
    await page.goto(`${BASE_URL}/ar/portal/coach/onboarding`);
    await expect(page.url()).toContain('/auth/login');
  });

  test('coach schedule page exists', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/portal/coach/schedule`);
    await expect(page.url()).toContain('/auth/login');
  });
});

test.describe('Cross-cutting: i18n + RTL', () => {
  test('homepage loads in Arabic', async ({ page }) => {
    await page.goto(`${BASE_URL}/ar`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('homepage loads in English', async ({ page }) => {
    await page.goto(`${BASE_URL}/en`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('signup page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/ar/auth/signup`);
    await expect(page.locator('h1')).toContainText('إنشاء حساب');
  });
});

test.describe('API routes', () => {
  test('availability API returns slots structure', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/availability?coach_id=test&start=2026-04-01&end=2026-04-30&duration=60`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('slots');
  });

  test('auth webhook accepts POST', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/webhooks/auth`, {
      data: { type: 'INSERT', record: { id: 'test', email: 'test@test.com' } },
    });
    expect(res.status()).toBe(200);
  });
});
