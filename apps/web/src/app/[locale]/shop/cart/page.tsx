'use client';

import { useState, useEffect } from 'react';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { Button } from '@kunacademy/ui/button';
import { useParams } from 'next/navigation';

interface CartItem {
  productId: string;
  name_ar: string;
  name_en: string;
  price_aed: number;
  quantity: number;
}

export default function CartPage() {
  const { locale } = useParams<{ locale: string }>();
  const isAr = locale === 'ar';
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('kun_cart');
    if (saved) setCart(JSON.parse(saved));
  }, []);

  function updateQuantity(productId: string, delta: number) {
    const updated = cart.map((item) =>
      item.productId === productId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    );
    setCart(updated);
    localStorage.setItem('kun_cart', JSON.stringify(updated));
  }

  function removeItem(productId: string) {
    const updated = cart.filter((item) => item.productId !== productId);
    setCart(updated);
    localStorage.setItem('kun_cart', JSON.stringify(updated));
  }

  function handleCheckout() {
    if (cart.length === 0) return;
    setLoading(true);
    // For multi-item carts, check out the first item — the checkout flow handles one item at a time.
    // Products are physical items; the checkout page handles currency/gateway selection.
    if (cart.length === 1) {
      window.location.href = `/${locale}/checkout?type=product&id=${cart[0].productId}`;
    } else {
      // Store cart in sessionStorage so checkout page can iterate items
      sessionStorage.setItem('kun_cart_checkout', JSON.stringify(cart));
      window.location.href = `/${locale}/checkout?type=product&id=${cart[0].productId}`;
    }
  }

  const total = cart.reduce((sum, item) => sum + item.price_aed * item.quantity, 0);

  return (
    <main>
      <Section variant="white">
        <Heading level={1}>{isAr ? 'سلة التسوّق' : 'Shopping Cart'}</Heading>
        {cart.length === 0 ? (
          <div className="mt-8 text-center py-12">
            <p className="text-[var(--color-neutral-500)]">{isAr ? 'السلة فارغة' : 'Your cart is empty'}</p>
            <a href={`/${locale}/shop`} className="mt-4 inline-block text-[var(--color-primary)] font-medium">{isAr ? 'تصفّح المتجر' : 'Browse Shop'}</a>
          </div>
        ) : (
          <div className="mt-6">
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.productId} className="flex items-center justify-between rounded-lg border border-[var(--color-neutral-200)] p-4">
                  <div>
                    <h3 className="font-medium">{isAr ? item.name_ar : item.name_en}</h3>
                    <p className="text-sm text-[var(--color-neutral-500)]">{(item.price_aed / 100).toFixed(0)} AED</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateQuantity(item.productId, -1)} className="h-8 w-8 rounded border text-center min-h-[44px] min-w-[44px] flex items-center justify-center">-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.productId, 1)} className="h-8 w-8 rounded border text-center min-h-[44px] min-w-[44px] flex items-center justify-center">+</button>
                    <button onClick={() => removeItem(item.productId)} className="text-red-500 text-sm min-h-[44px] px-2">{isAr ? 'حذف' : 'Remove'}</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-lg bg-[var(--color-neutral-50)] p-6">
              <div className="flex justify-between text-lg font-bold">
                <span>{isAr ? 'المجموع' : 'Total'}</span>
                <span>{(total / 100).toFixed(0)} AED</span>
              </div>
              <Button variant="primary" size="lg" className="w-full mt-4" onClick={handleCheckout} disabled={loading}>
                {loading ? (isAr ? 'جاري التحويل...' : 'Redirecting...') : (isAr ? 'إتمام الشراء' : 'Proceed to Checkout')}
              </Button>
            </div>
          </div>
        )}
      </Section>
    </main>
  );
}
