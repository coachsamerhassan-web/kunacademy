'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@kunacademy/auth';
import type { OrderStatus } from '@kunacademy/db';
import { Download } from 'lucide-react';

type TabKey = 'orders' | 'downloads';

interface OrderRow {
  id: string;
  customer_id: string;
  status: OrderStatus;
  total_amount: number;
  currency: string;
  payment_gateway: string | null;
  payment_id: string | null;
  shipping_address: Record<string, unknown> | null;
  created_at: string;
}

interface DownloadItem {
  id: string;
  token: string;
  expiresAt: string;
  downloadCount: number;
  maxDownloads: number;
  createdAt: string;
  isExpired: boolean;
  isExhausted: boolean;
  product: {
    id: string;
    name_ar: string;
    name_en: string;
    slug: string;
    type: string;
  } | null;
  downloadLink: string;
}

interface OrdersDashboardProps {
  locale: string;
}

export function OrdersDashboard({ locale }: OrdersDashboardProps) {
  const isAr = locale === 'ar';
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<TabKey>('orders');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;

    async function fetchData() {
      try {
        // Fetch orders via API route
        const ordersRes = await fetch('/api/user/orders');
        if (ordersRes.ok) {
          const ordersJson = await ordersRes.json();
          setOrders(ordersJson.orders ?? []);
        }

        // Fetch downloads via existing API route
        const downloadsRes = await fetch('/api/user/downloads');
        if (downloadsRes.ok) {
          const downloadsJson = await downloadsRes.json();
          setDownloads(downloadsJson.downloads ?? []);
        }
      } catch (err) {
        console.error('[orders-dashboard]', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#474099] border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface-container)] p-12 text-center min-h-[300px] flex flex-col items-center justify-center">
        <p className="text-[var(--color-neutral-600)] mb-4">
          {isAr ? 'سجّل الدخول لعرض طلباتك' : 'Sign in to view your orders'}
        </p>
        <a
          href={`/${locale}/auth/login?redirect=/${locale}/dashboard/orders`}
          className="inline-flex min-h-[44px] items-center px-6 py-2 rounded-xl bg-[#474099] text-white font-medium hover:bg-[#3a3480] transition-colors"
        >
          {isAr ? 'تسجيل الدخول' : 'Sign In'}
        </a>
      </div>
    );
  }

  const tabs: { key: TabKey; labelAr: string; labelEn: string }[] = [
    { key: 'orders', labelAr: 'طلباتي', labelEn: 'Orders' },
    { key: 'downloads', labelAr: 'تحميلاتي', labelEn: 'Downloads' },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-8" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`
              min-h-[44px] px-5 py-2 rounded-full text-sm font-medium transition-colors
              ${tab === t.key
                ? 'bg-[#474099] text-white'
                : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)]'
              }
            `}
          >
            {isAr ? t.labelAr : t.labelEn}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-[var(--color-neutral-200)] p-5">
              <div className="h-4 bg-[var(--color-neutral-100)] rounded w-1/3 mb-3" />
              <div className="h-3 bg-[var(--color-neutral-100)] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : tab === 'orders' ? (
        <OrdersTab orders={orders} isAr={isAr} />
      ) : (
        <DownloadsTab downloads={downloads} isAr={isAr} />
      )}
    </div>
  );
}

// ── Orders Tab ──────────────────────────────────────────────────────────

function OrdersTab({ orders, isAr }: { orders: OrderRow[]; isAr: boolean }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface-container)] p-12 text-center min-h-[300px] flex flex-col items-center justify-center">
        <span className="text-4xl mb-4" aria-hidden="true">🛒</span>
        <p className="text-[var(--color-neutral-600)] mb-2 font-medium">
          {isAr ? 'لا توجد طلبات بعد' : 'No orders yet'}
        </p>
        <p className="text-sm text-[var(--color-neutral-500)]">
          {isAr ? 'ستظهر طلباتك هنا بعد أول عملية شراء' : 'Your orders will appear here after your first purchase'}
        </p>
      </div>
    );
  }

  const statusLabel: Record<OrderStatus, { ar: string; en: string; color: string }> = {
    pending: { ar: 'قيد المعالجة', en: 'Pending', color: 'bg-amber-100 text-amber-700' },
    paid: { ar: 'مدفوع', en: 'Paid', color: 'bg-emerald-100 text-emerald-700' },
    shipped: { ar: 'تم الشحن', en: 'Shipped', color: 'bg-blue-100 text-blue-700' },
    delivered: { ar: 'تم التوصيل', en: 'Delivered', color: 'bg-emerald-100 text-emerald-700' },
    cancelled: { ar: 'ملغى', en: 'Cancelled', color: 'bg-red-100 text-red-700' },
    refunded: { ar: 'مسترد', en: 'Refunded', color: 'bg-gray-100 text-gray-700' },
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-start">
        <thead>
          <tr className="border-b border-[var(--color-neutral-200)]">
            <th className="py-3 px-4 text-start text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wider">
              {isAr ? 'التاريخ' : 'Date'}
            </th>
            <th className="py-3 px-4 text-start text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wider">
              {isAr ? 'رقم الطلب' : 'Order #'}
            </th>
            <th className="py-3 px-4 text-start text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wider">
              {isAr ? 'المبلغ' : 'Amount'}
            </th>
            <th className="py-3 px-4 text-start text-xs font-medium text-[var(--color-neutral-500)] uppercase tracking-wider">
              {isAr ? 'الحالة' : 'Status'}
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const status = statusLabel[order.status] || statusLabel.pending;
            const amount = (order.total_amount / 100).toLocaleString(isAr ? 'ar-AE' : 'en-AE', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            });
            const date = new Date(order.created_at).toLocaleDateString(
              isAr ? 'ar-AE' : 'en-AE',
              { year: 'numeric', month: 'short', day: 'numeric' }
            );

            return (
              <tr key={order.id} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)] transition-colors">
                <td className="py-4 px-4 text-sm text-[var(--color-neutral-700)]">{date}</td>
                <td className="py-4 px-4 text-sm font-mono text-[var(--color-neutral-600)]">
                  {order.id.slice(0, 8)}
                </td>
                <td className="py-4 px-4 text-sm font-medium text-[var(--color-neutral-900)]">
                  {amount} {order.currency}
                </td>
                <td className="py-4 px-4">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                    {isAr ? status.ar : status.en}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Downloads Tab ───────────────────────────────────────────────────────

function DownloadsTab({ downloads, isAr }: { downloads: DownloadItem[]; isAr: boolean }) {
  if (downloads.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface-container)] p-12 text-center min-h-[300px] flex flex-col items-center justify-center">
        <Download className="w-10 h-10 mb-4 text-[var(--color-neutral-400)]" aria-hidden="true" />
        <p className="text-[var(--color-neutral-600)] mb-2 font-medium">
          {isAr ? 'لا توجد تحميلات بعد' : 'No downloads yet'}
        </p>
        <p className="text-sm text-[var(--color-neutral-500)]">
          {isAr ? 'ستظهر المنتجات الرقمية هنا بعد الشراء' : 'Your digital products will appear here after purchase'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {downloads.map((dl) => {
        const expired = dl.isExpired;
        const exhausted = dl.isExhausted;
        const disabled = expired || exhausted;
        const remaining = dl.maxDownloads - dl.downloadCount;

        const expiresDate = new Date(dl.expiresAt).toLocaleDateString(
          isAr ? 'ar-AE' : 'en-AE',
          { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
        );

        return (
          <div
            key={dl.id}
            className={`rounded-xl border p-5 transition-colors ${
              disabled
                ? 'border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] opacity-60'
                : 'border-[var(--color-neutral-200)] bg-white hover:border-[#474099]/30'
            }`}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-[var(--color-neutral-900)] truncate">
                  {isAr ? (dl.product?.name_ar || 'ملف رقمي') : (dl.product?.name_en || 'Digital file')}
                </h3>
                <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-neutral-500)]">
                  <span>
                    {isAr ? `${remaining} تحميلات متبقية` : `${remaining} downloads remaining`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-neutral-400)]">
                  {expired
                    ? (isAr ? 'انتهت الصلاحية' : 'Expired')
                    : (isAr ? `ينتهي: ${expiresDate}` : `Expires: ${expiresDate}`)
                  }
                </p>
              </div>

              <a
                href={disabled ? undefined : dl.downloadLink}
                className={`
                  inline-flex min-h-[44px] items-center px-5 py-2 rounded-xl text-sm font-medium transition-colors
                  ${disabled
                    ? 'bg-[var(--color-neutral-200)] text-[var(--color-neutral-400)] cursor-not-allowed pointer-events-none'
                    : 'bg-[#474099] text-white hover:bg-[#3a3480]'
                  }
                `}
                {...(disabled ? { 'aria-disabled': true } : {})}
              >
                {isAr ? 'تحميل' : 'Download'}
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
