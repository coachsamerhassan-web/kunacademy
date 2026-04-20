'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

interface FailedEmail {
  id: string;
  template_key: string;
  to_email: string;
  last_error: string | null;
  last_attempt_at: string | null;
  attempts: number;
}

type RetryState = 'idle' | 'loading' | 'success' | 'error';

export default function EmailOutboxPage() {
  const { locale } = useParams<{ locale: string }>();
  const isAr = locale === 'ar';

  const [failed, setFailed] = useState<FailedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Per-row retry state
  const [retryState, setRetryState] = useState<Record<string, RetryState>>({});

  // Bulk retry state
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const fetchFailed = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/email-outbox/failed')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setFailed(data.failed ?? []);
        setRetryState({});
      })
      .catch((err) => {
        setPageError((err as Error).message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchFailed();
  }, [fetchFailed]);

  const handleRetry = async (emailId: string) => {
    setRetryState((prev) => ({ ...prev, [emailId]: 'loading' }));
    try {
      const res = await fetch(`/api/admin/email-outbox/${emailId}/retry`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setRetryState((prev) => ({ ...prev, [emailId]: 'success' }));
      showToast(
        isAr
          ? 'تمت إعادة الإرسال — سيُعالج خلال دقيقة تقريباً'
          : 'Queued for retry — next drain in ~1 minute',
      );
      // Remove the row from the list after a short delay (it's now pending, not failed)
      setTimeout(() => {
        setFailed((prev) => prev.filter((e) => e.id !== emailId));
        setRetryState((prev) => {
          const next = { ...prev };
          delete next[emailId];
          return next;
        });
      }, 1200);
    } catch (err) {
      setRetryState((prev) => ({ ...prev, [emailId]: 'error' }));
      showToast(
        isAr
          ? `فشلت إعادة المحاولة: ${(err as Error).message}`
          : `Retry failed: ${(err as Error).message}`,
      );
    }
  };

  const handleRetryAll = async () => {
    setShowConfirm(false);
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/email-outbox/retry-all', {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      showToast(
        isAr
          ? `تمت إعادة إرسال ${data.reset_count} رسالة — ستُعالج خلال دقيقة تقريباً`
          : `${data.reset_count} email(s) queued for retry — next drain in ~1 minute`,
      );
      // Refresh table
      fetchFailed();
    } catch (err) {
      showToast(
        isAr
          ? `فشلت العملية: ${(err as Error).message}`
          : `Bulk retry failed: ${(err as Error).message}`,
      );
    } finally {
      setBulkLoading(false);
    }
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleString(isAr ? 'ar-EG' : 'en-US');
  };

  return (
    <main>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[var(--color-primary-600)] text-white px-5 py-3 rounded-lg shadow-lg text-sm max-w-sm">
          {toast}
        </div>
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <p className="text-[var(--color-neutral-800)] font-semibold mb-2">
              {isAr ? 'تأكيد إعادة الإرسال' : 'Confirm bulk retry'}
            </p>
            <p className="text-[var(--color-neutral-600)] text-sm mb-6">
              {isAr
                ? `هل تريد إعادة إرسال ${failed.length} رسالة فاشلة؟`
                : `Retry ${failed.length} failed email(s)?`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-lg border border-[var(--color-neutral-300)] text-[var(--color-neutral-700)] text-sm hover:bg-[var(--color-neutral-50)] transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleRetryAll}
                className="px-4 py-2 rounded-lg bg-[var(--color-primary-600)] text-white text-sm hover:bg-[var(--color-primary-700)] transition-colors"
              >
                {isAr ? 'نعم، أعد الإرسال' : 'Yes, retry all'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Section variant="white">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <Heading level={1}>
            {isAr ? 'رسائل البريد الفاشلة' : 'Failed Emails'}
          </Heading>

          {failed.length > 0 && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={bulkLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {bulkLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              {isAr
                ? `إعادة إرسال الكل (${failed.length})`
                : `Retry all (${failed.length})`}
            </button>
          )}
        </div>

        {pageError && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-6 text-red-700 text-sm">
            {pageError}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-[var(--color-neutral-500)]">
            {isAr ? 'جاري التحميل...' : 'Loading...'}
          </div>
        ) : failed.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-neutral-500)]">
            {isAr ? 'لا توجد رسائل فاشلة' : 'No failed emails'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-neutral-200)]">
                  <th className="text-left px-4 py-3 font-semibold text-[var(--color-neutral-700)]">
                    {isAr ? 'البريد الإلكتروني' : 'Email'}
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--color-neutral-700)]">
                    {isAr ? 'القالب' : 'Template'}
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--color-neutral-700)]">
                    {isAr ? 'عدد المحاولات' : 'Attempts'}
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--color-neutral-700)]">
                    {isAr ? 'آخر محاولة' : 'Last Attempt'}
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--color-neutral-700)]">
                    {isAr ? 'الخطأ' : 'Error'}
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--color-neutral-700)]">
                    {isAr ? 'إجراء' : 'Action'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {failed.map((email) => {
                  const rs = retryState[email.id] ?? 'idle';
                  return (
                    <tr
                      key={email.id}
                      className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]"
                    >
                      <td className="px-4 py-3 text-[var(--color-neutral-700)]">
                        <code className="text-xs bg-[var(--color-neutral-100)] px-2 py-1 rounded">
                          {email.to_email}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-neutral-700)]">
                        <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                          {email.template_key}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-neutral-700)]">
                        {email.attempts}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-neutral-700)] text-xs">
                        {formatDate(email.last_attempt_at)}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-neutral-700)]">
                        <details className="cursor-pointer">
                          <summary className="text-red-600 font-medium text-xs">
                            {isAr ? 'عرض الخطأ' : 'Show error'}
                          </summary>
                          <pre className="mt-2 bg-red-50 border border-red-200 rounded p-2 text-xs overflow-x-auto whitespace-pre-wrap break-words max-w-md">
                            {email.last_error ?? 'N/A'}
                          </pre>
                        </details>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleRetry(email.id)}
                          disabled={rs === 'loading' || rs === 'success'}
                          className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-w-[80px] justify-center
                            ${rs === 'success'
                              ? 'bg-green-100 text-green-700 cursor-default'
                              : rs === 'error'
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)]'
                            }
                            disabled:opacity-60 disabled:cursor-not-allowed
                          `}
                        >
                          {rs === 'loading' && (
                            <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          )}
                          {rs === 'success'
                            ? (isAr ? 'تمت' : 'Queued')
                            : rs === 'error'
                            ? (isAr ? 'أعد المحاولة' : 'Retry again')
                            : (isAr ? 'إعادة الإرسال' : 'Retry')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[var(--color-neutral-500)] text-xs mt-6">
          {isAr
            ? 'يتم تحديث هذه الصفحة يدويًا. تحقق من السجلات للتفاصيل الكاملة.'
            : 'This page updates manually. Check logs for full details.'}
        </p>
      </Section>
    </main>
  );
}
