// @ts-nocheck
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
  type: 'course' | 'service' | 'booking';
  id: string;
  name_ar: string;
  name_en: string;
  price_aed: number;
  price_sar: number;
  price_egp: number;
  price_usd: number;
  price_eur: number;
  early_bird_price_aed?: number;
  early_bird_deadline?: string;
  discount_percentage?: number;
  discount_valid_until?: string;
  installment_enabled?: boolean;
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
      const ratio = item.early_bird_price_aed / item.price_aed;
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

  // Fetch item data
  useEffect(() => {
    if (!itemId || !itemType) { setLoading(false); return; }
    const supabase = createBrowserClient();
    if (!supabase) return;

    if (itemType === 'course') {
      supabase.from('courses').select('id, title_ar, title_en, price_aed, price_sar, price_egp, price_usd, price_eur')
        .eq('id', itemId).single()
        .then(({ data }) => {
          if (data) setItem({ type: 'course', id: data.id, name_ar: data.title_ar, name_en: data.title_en, ...data });
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
          amount: price,
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
            : (isAr ? `ادفع ${formatPrice(price, currency)}` : `Pay ${formatPrice(price, currency)}`)}
        </Button>
      )}
    </div>
  );
}
