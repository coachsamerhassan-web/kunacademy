'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';
import { Button } from '@kunacademy/ui/button';
import { createBrowserClient } from '@kunacademy/db';

type Currency = 'AED' | 'SAR' | 'EGP' | 'USD' | 'EUR';

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  AED: 'د.إ', SAR: 'ر.س', EGP: 'ج.م', USD: '$', EUR: '€',
};

// Tabby minimum: 2,500 AED = 250,000 minor units
// Approximate equivalents for SAR (same threshold)
const TABBY_MINIMUM: Record<string, number> = { AED: 250_000, SAR: 250_000 };

// Tabby only available in these countries
const TABBY_COUNTRIES = ['AE', 'SA'];
// Tabby only supports these currencies
const TABBY_CURRENCIES = ['AED', 'SAR'];

interface GeoInfo {
  country: string;
  is_egypt: boolean;
  is_gulf: boolean;
}

interface CartItem {
  type: 'course' | 'service' | 'booking' | 'event';
  id: string;
  name_ar: string;
  name_en: string;
  price_aed: number | null;
  price_sar: number | null;
  price_egp: number | null;
  price_usd: number | null;
  price_eur: number | null;
  early_bird_price_aed?: number | null;
  early_bird_deadline?: string | null;
  discount_percentage?: number | null;
  discount_valid_until?: string | null;
  installment_enabled?: boolean | null;
}

/** Detect currency from timezone (fallback when geo API unavailable) */
function detectCurrencyFromTimezone(): Currency {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz.includes('Riyadh')) return 'SAR';
  if (tz.includes('Dubai') || tz.includes('Gulf') || tz.includes('Asia/Kuwait') || tz.includes('Asia/Qatar')) return 'AED';
  if (tz.includes('Europe')) return 'EUR';
  return 'USD';
  // NOTE: No EGP fallback from timezone — EGP requires geo confirmation
}

/** Detect currency from geo country code */
function detectCurrencyFromCountry(country: string): Currency {
  if (country === 'EG') return 'EGP';
  if (country === 'SA') return 'SAR';
  if (['AE', 'KW', 'QA', 'BH', 'OM'].includes(country)) return 'AED';
  if (['DE', 'FR', 'IT', 'ES', 'NL', 'AT', 'BE', 'PT', 'IE', 'FI', 'GR'].includes(country)) return 'EUR';
  return 'USD';
}

function getPrice(item: CartItem, currency: Currency): number {
  const now = new Date();

  // Check early bird
  if (item.early_bird_price_aed && item.early_bird_deadline) {
    if (now < new Date(item.early_bird_deadline)) {
      const ratio = (item.early_bird_price_aed ?? 0) / (item.price_aed ?? 1);
      const basePrice = item[`price_${currency.toLowerCase()}` as keyof CartItem] as number;
      return Math.round(basePrice * ratio);
    }
  }

  // Check discount
  if (item.discount_percentage && item.discount_valid_until) {
    if (now < new Date(item.discount_valid_until)) {
      const basePrice = item[`price_${currency.toLowerCase()}` as keyof CartItem] as number;
      return Math.round(basePrice * (1 - item.discount_percentage / 100));
    }
  }

  return item[`price_${currency.toLowerCase()}` as keyof CartItem] as number || 0;
}

function formatPrice(amount: number, currency: Currency): string {
  const value = amount / 100;
  return `${value.toLocaleString()} ${CURRENCY_SYMBOLS[currency]}`;
}

export function CheckoutFlow({ locale }: { locale: string }) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [geo, setGeo] = useState<GeoInfo | null>(null);
  const [currency, setCurrency] = useState<Currency>(detectCurrencyFromTimezone());
  const [item, setItem] = useState<CartItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'tabby' | 'instapay'>('stripe');
  const [instapayInstructions, setInstapayInstructions] = useState<any>(null);
  const [creditBalance, setCreditBalance] = useState(0);
  const [applyCredits, setApplyCredits] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<'full' | 'deposit' | 'installment'>('full');
  const [installmentCount, setInstallmentCount] = useState(3);
  const isAr = locale === 'ar';

  const itemType = searchParams.get('type');
  const itemId = searchParams.get('id');

  // Fetch geo info on mount
  useEffect(() => {
    fetch('/api/geo')
      .then(r => r.json())
      .then((data: GeoInfo) => {
        setGeo(data);
        setCurrency(detectCurrencyFromCountry(data.country));
      })
      .catch(() => {
        // Geo unavailable — keep timezone-based currency (no EGP)
        setGeo({ country: 'XX', is_egypt: false, is_gulf: false });
      });
  }, []);

  // Fetch credit balance
  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: session }) => {
      const token = session?.session?.access_token;
      if (!token) return;
      fetch('/api/referrals', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => { if (d.balance > 0) setCreditBalance(d.balance); })
        .catch(() => {});
    });
  }, [user]);

  // Fetch item data
  useEffect(() => {
    if (!itemId || !itemType) { setLoading(false); return; }
    const supabase = createBrowserClient();
    if (!supabase) return;

    if (itemType === 'course') {
      supabase.from('courses').select('id, title_ar, title_en, price_aed, price_sar, price_egp, price_usd, price_eur')
        .eq('id', itemId).single()
        .then(({ data }) => {
          if (data) setItem({ ...data, type: 'course', id: data.id, name_ar: data.title_ar, name_en: data.title_en });
          setLoading(false);
        });
    } else if (itemType === 'booking') {
      supabase.from('bookings').select('id, service:services(id, name_ar, name_en, price_aed, price_sar, price_egp, price_usd)')
        .eq('id', itemId).single()
        .then(({ data }) => {
          if (data?.service) {
            setItem({
              type: 'booking', id: data.id,
              name_ar: data.service.name_ar, name_en: data.service.name_en,
              price_aed: data.service.price_aed,
              price_sar: data.service.price_sar || 0,
              price_egp: data.service.price_egp || 0,
              price_usd: data.service.price_usd || 0,
              price_eur: 0,
            });
          }
          setLoading(false);
        });
    } else if (itemType === 'event') {
      // Event registration — item data comes from query params (CMS event, not in Supabase)
      const name = searchParams.get('name') || 'Event';
      setItem({
        type: 'event' as any,
        id: itemId,
        name_ar: decodeURIComponent(name),
        name_en: decodeURIComponent(name),
        price_aed: Number(searchParams.get('price_aed')) || 0,
        price_sar: Number(searchParams.get('price_sar')) || 0,
        price_egp: Number(searchParams.get('price_egp')) || 0,
        price_usd: Number(searchParams.get('price_usd')) || 0,
        price_eur: Number(searchParams.get('price_eur')) || 0,
      });
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [itemId, itemType]);

  // Derived: which currencies are available based on geo
  const availableCurrencies: Currency[] = (() => {
    const base: Currency[] = ['AED', 'SAR', 'USD', 'EUR'];
    // EGP ONLY visible from Egypt (geo-locked)
    if (geo?.is_egypt) base.splice(2, 0, 'EGP'); // insert after SAR
    return base;
  })();

  // Derived: price in current currency
  const price = item ? getPrice(item, currency) : 0;
  const originalPrice = item ? (item[`price_${currency.toLowerCase()}` as keyof CartItem] as number) : 0;
  const hasDiscount = price < originalPrice;

  // Derived: credits applied (only AED credits, capped at price)
  const creditsApplied = applyCredits ? Math.min(creditBalance, price) : 0;
  const effectivePrice = price - creditsApplied;

  // Derived: can show Tabby?
  const tabbyAvailable =
    TABBY_CURRENCIES.includes(currency) &&
    (geo ? TABBY_COUNTRIES.includes(geo.country) : false) &&
    price >= (TABBY_MINIMUM[currency] || Infinity);

  // Auto-select payment method when currency/geo changes
  useEffect(() => {
    if (currency === 'EGP') {
      setPaymentMethod('instapay');
    } else if (tabbyAvailable && paymentMethod === 'instapay') {
      setPaymentMethod('stripe');
    } else if (paymentMethod === 'instapay') {
      setPaymentMethod('stripe');
    }
    setInstapayInstructions(null);
  }, [currency, geo]);

  async function handlePayment() {
    if (!item || !user) return;
    setProcessing(true);

    try {
      // Apply credits first if toggled
      if (creditsApplied > 0) {
        const supabase = createBrowserClient();
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (token) {
          const creditRes = await fetch('/api/referrals/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ amount: creditsApplied, payment_id: `${item.type}-${item.id}` }),
          });
          if (!creditRes.ok) {
            const err = await creditRes.json();
            alert(err.error || 'Failed to apply credits');
            setProcessing(false);
            return;
          }
        }
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: item.type,
          item_id: item.id,
          item_name: isAr ? item.name_ar : item.name_en,
          user_id: user.id,
          user_email: user.email,
          currency,
          amount: effectivePrice,
          applied_credits: creditsApplied,
          gateway: paymentMethod,
          locale,
          country: geo?.country || 'XX',
        }),
      });

      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else if (data.gateway === 'instapay' && data.instructions) {
        setInstapayInstructions(data);
      } else if (data.error) {
        alert(data.error);
      }
    } finally {
      setProcessing(false);
    }
  }

  if (loading || !geo) return <div className="py-8 text-center text-[var(--color-neutral-500)]">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;
  if (!item) return <div className="py-8 text-center text-[var(--color-neutral-500)]">{isAr ? 'لا يوجد عنصر للدفع' : 'No item to checkout'}</div>;

  return (
    <div className="mt-6 space-y-6">
      {/* Item summary */}
      <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
        <p className="font-medium">{isAr ? item.name_ar : item.name_en}</p>
        <div className="flex items-center gap-2 mt-2">
          {hasDiscount && (
            <span className="text-[var(--color-neutral-400)] line-through text-sm">{formatPrice(originalPrice, currency)}</span>
          )}
          <span className="text-xl font-bold text-[var(--color-primary)]">{formatPrice(price, currency)}</span>
        </div>
      </div>

      {/* Apply Credits */}
      {creditBalance > 0 && currency === 'AED' && (
        <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">
                {isAr ? 'استخدام رصيد الإحالات' : 'Apply Referral Credits'}
              </p>
              <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">
                {isAr ? `رصيدك: ${formatPrice(creditBalance, 'AED')}` : `Balance: ${formatPrice(creditBalance, 'AED')}`}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={applyCredits}
              onClick={() => setApplyCredits(!applyCredits)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors min-h-[44px] min-w-[44px] items-center ${
                applyCredits ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-neutral-300)]'
              }`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                applyCredits ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          {applyCredits && (
            <div className="mt-3 pt-3 border-t border-[var(--color-neutral-100)] space-y-1 text-sm">
              <div className="flex justify-between text-[var(--color-neutral-600)]">
                <span>{isAr ? 'السعر الأصلي' : 'Original price'}</span>
                <span>{formatPrice(price, currency)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>{isAr ? 'خصم الرصيد' : 'Credit discount'}</span>
                <span>-{formatPrice(creditsApplied, 'AED')}</span>
              </div>
              <div className="flex justify-between font-bold text-[var(--color-primary)]">
                <span>{isAr ? 'المطلوب دفعه' : 'Amount due'}</span>
                <span>{formatPrice(effectivePrice, currency)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Plan — deposit/installment option (only for eligible programs) */}
      {item?.installment_enabled && (
        <div className="rounded-lg border border-[var(--color-neutral-200)] p-4">
          <p className="font-medium text-sm mb-3">
            {isAr ? 'خطة الدفع' : 'Payment Plan'}
          </p>
          <div className="space-y-2">
            <label className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer min-h-[44px] ${paymentPlan === 'full' ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-neutral-200)]'}`}>
              <input type="radio" name="plan" value="full" checked={paymentPlan === 'full'} onChange={() => setPaymentPlan('full')} className="accent-[var(--color-primary)]" />
              <div>
                <span className="font-medium text-sm">{isAr ? 'دفع كامل' : 'Pay in Full'}</span>
                <span className="text-xs text-[var(--color-neutral-500)] block">{formatPrice(effectivePrice, currency)}</span>
              </div>
            </label>

            <label className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer min-h-[44px] ${paymentPlan === 'deposit' ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-neutral-200)]'}`}>
              <input type="radio" name="plan" value="deposit" checked={paymentPlan === 'deposit'} onChange={() => setPaymentPlan('deposit')} className="accent-[var(--color-primary)]" />
              <div>
                <span className="font-medium text-sm">{isAr ? 'إيداع 30%' : 'Pay 30% Deposit'}</span>
                <span className="text-xs text-[var(--color-neutral-500)] block">
                  {isAr ? `ادفع ${formatPrice(Math.round(effectivePrice * 0.3), currency)} الآن` : `Pay ${formatPrice(Math.round(effectivePrice * 0.3), currency)} now`}
                  {' — '}
                  {isAr ? `الباقي ${formatPrice(Math.round(effectivePrice * 0.7), currency)} خلال 30 يوم` : `${formatPrice(Math.round(effectivePrice * 0.7), currency)} due in 30 days`}
                </span>
              </div>
            </label>

            <label className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer min-h-[44px] ${paymentPlan === 'installment' ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-neutral-200)]'}`}>
              <input type="radio" name="plan" value="installment" checked={paymentPlan === 'installment'} onChange={() => setPaymentPlan('installment')} className="accent-[var(--color-primary)]" />
              <div className="flex-1">
                <span className="font-medium text-sm">{isAr ? 'أقساط شهرية' : 'Monthly Installments'}</span>
                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={installmentCount}
                    onChange={(e) => setInstallmentCount(parseInt(e.target.value))}
                    className="text-xs rounded border border-[var(--color-neutral-300)] px-2 py-1 min-h-[32px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {[2, 3, 4, 5, 6].map(n => (
                      <option key={n} value={n}>{n} {isAr ? 'أقساط' : 'payments'}</option>
                    ))}
                  </select>
                  <span className="text-xs text-[var(--color-neutral-500)]">
                    {formatPrice(Math.ceil(effectivePrice / installmentCount), currency)} / {isAr ? 'شهر' : 'mo'}
                  </span>
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Currency selector — geo-aware */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2">
          {isAr ? 'العملة' : 'Currency'}
        </label>
        <div className="flex flex-wrap gap-2">
          {availableCurrencies.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition min-h-[44px] ${
                currency === c
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'border border-[var(--color-neutral-300)] hover:border-[var(--color-primary)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Payment method */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-neutral-700)] mb-2">
          {isAr ? 'طريقة الدفع' : 'Payment Method'}
        </label>
        <div className="space-y-2">
          {/* Stripe — available for all currencies except EGP */}
          {currency !== 'EGP' && (
            <label className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer min-h-[44px] ${paymentMethod === 'stripe' ? 'border-[var(--color-primary)]' : 'border-[var(--color-neutral-200)]'}`}>
              <input type="radio" name="method" value="stripe" checked={paymentMethod === 'stripe'} onChange={() => setPaymentMethod('stripe')} className="accent-[var(--color-primary)]" />
              <div>
                <span className="font-medium">Stripe</span>
                <span className="text-xs text-[var(--color-neutral-500)] block">Visa, Mastercard, Apple Pay</span>
              </div>
            </label>
          )}

          {/* Tabby BNPL — AED/SAR only, minimum 2,500 AED, Gulf countries only */}
          {tabbyAvailable && (
            <label className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer min-h-[44px] ${paymentMethod === 'tabby' ? 'border-[var(--color-primary)]' : 'border-[var(--color-neutral-200)]'}`}>
              <input type="radio" name="method" value="tabby" checked={paymentMethod === 'tabby'} onChange={() => setPaymentMethod('tabby')} className="accent-[var(--color-primary)]" />
              <div>
                <span className="font-medium">Tabby</span>
                <span className="text-xs text-[var(--color-neutral-500)] block">
                  {isAr ? `قسّط على 4 دفعات — ${formatPrice(Math.round(price / 4), currency)} / شهر` : `Split into 4 × ${formatPrice(Math.round(price / 4), currency)}`}
                </span>
              </div>
            </label>
          )}

          {/* Tabby below minimum — show disabled with explanation */}
          {TABBY_CURRENCIES.includes(currency) && geo && TABBY_COUNTRIES.includes(geo.country) && !tabbyAvailable && (
            <div className="flex items-center gap-3 rounded-lg border border-[var(--color-neutral-100)] p-4 opacity-50 min-h-[44px]">
              <input type="radio" disabled className="accent-[var(--color-neutral-300)]" />
              <div>
                <span className="font-medium text-[var(--color-neutral-400)]">Tabby</span>
                <span className="text-xs text-[var(--color-neutral-400)] block">
                  {isAr ? 'التقسيط متاح للمبالغ من 2,500 د.إ وأكثر' : 'Installments available for orders 2,500 AED+'}
                </span>
              </div>
            </div>
          )}

          {/* InstaPay — EGP only, Egypt only (geo-locked) */}
          {currency === 'EGP' && geo?.is_egypt && (
            <label className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer min-h-[44px] ${paymentMethod === 'instapay' ? 'border-[var(--color-primary)]' : 'border-[var(--color-neutral-200)]'}`}>
              <input type="radio" name="method" value="instapay" checked={paymentMethod === 'instapay'} onChange={() => setPaymentMethod('instapay')} className="accent-[var(--color-primary)]" />
              <div>
                <span className="font-medium">InstaPay</span>
                <span className="text-xs text-[var(--color-neutral-500)] block">{isAr ? 'تحويل فوري — بدون رسوم' : 'Instant bank transfer — no fees'}</span>
              </div>
            </label>
          )}
        </div>
      </div>

      {/* InstaPay bank transfer instructions */}
      {instapayInstructions && (
        <div className="rounded-lg border-2 border-[var(--color-primary)] bg-[var(--color-primary-50)] p-5 space-y-3">
          <h3 className="font-bold text-[var(--color-primary)]">{isAr ? 'تعليمات التحويل' : 'Transfer Instructions'}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-neutral-600)]">{isAr ? 'اسم الحساب' : 'Account Name'}</span>
              <span className="font-medium">{instapayInstructions.instructions.account_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-neutral-600)]">IBAN</span>
              <span className="font-mono text-xs">{instapayInstructions.instructions.iban}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-neutral-600)]">{isAr ? 'البنك' : 'Bank'}</span>
              <span className="font-medium">{instapayInstructions.instructions.bank}</span>
            </div>
            <div className="flex justify-between items-center border-t border-[var(--color-neutral-200)] pt-2 mt-2">
              <span className="font-bold">{isAr ? 'المبلغ المطلوب (بالضبط)' : 'Exact Amount'}</span>
              <span className="text-lg font-bold text-[var(--color-primary)]">{instapayInstructions.instructions.amount} {isAr ? 'ج.م' : 'EGP'}</span>
            </div>
          </div>
          <p className="text-xs text-[var(--color-neutral-500)]">
            {isAr
              ? 'يرجى تحويل المبلغ المحدد بالضبط (بالقروش). صلاحية هذا الطلب ساعتان.'
              : 'Please transfer the exact amount (including piasters). This order expires in 2 hours.'}
          </p>
          <button
            onClick={async () => {
              await fetch('/api/checkout/instapay/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payment_id: instapayInstructions.payment_id }),
              });
              window.location.href = `/${locale}/checkout/pending?payment_id=${instapayInstructions.payment_id}`;
            }}
            className="w-full bg-[var(--color-primary)] text-white rounded-lg py-3 font-medium min-h-[44px] hover:opacity-90 transition"
          >
            {isAr ? 'تم التحويل' : 'I have transferred'}
          </button>
        </div>
      )}

      {!user ? (
        <div className="text-center">
          <p className="text-[var(--color-neutral-600)] mb-2">{isAr ? 'يرجى تسجيل الدخول' : 'Please sign in first'}</p>
          <a href={`/${locale}/auth/login?redirect=/${locale}/checkout?type=${itemType}&id=${itemId}`} className="text-[var(--color-primary)] font-medium hover:underline">
            {isAr ? 'تسجيل الدخول' : 'Sign In'}
          </a>
        </div>
      ) : (
        <Button variant="primary" size="lg" className="w-full" onClick={handlePayment} disabled={processing}>
          {processing
            ? (isAr ? 'جاري المعالجة...' : 'Processing...')
            : effectivePrice <= 0
            ? (isAr ? 'تأكيد (مدفوع بالرصيد)' : 'Confirm (paid with credits)')
            : paymentPlan === 'deposit'
            ? (isAr ? `ادفع إيداع ${formatPrice(Math.round(effectivePrice * 0.3), currency)}` : `Pay Deposit ${formatPrice(Math.round(effectivePrice * 0.3), currency)}`)
            : paymentPlan === 'installment'
            ? (isAr ? `ادفع القسط الأول ${formatPrice(Math.ceil(effectivePrice / installmentCount), currency)}` : `Pay First Installment ${formatPrice(Math.ceil(effectivePrice / installmentCount), currency)}`)
            : (isAr ? `ادفع ${formatPrice(effectivePrice, currency)}` : `Pay ${formatPrice(effectivePrice, currency)}`)}
        </Button>
      )}
    </div>
  );
}
