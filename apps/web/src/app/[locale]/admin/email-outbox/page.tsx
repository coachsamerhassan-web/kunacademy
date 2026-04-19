'use client';

import { useEffect, useState } from 'react';
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

export default function EmailOutboxPage() {
  const { locale } = useParams<{ locale: string }>();
  const isAr = locale === 'ar';
  const [failed, setFailed] = useState<FailedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/email-outbox/failed')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setFailed(data.failed ?? []);
      })
      .catch((err) => {
        setError((err as Error).message);
      })
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleString(isAr ? 'ar-EG' : 'en-US');
  };

  return (
    <main>
      <Section variant="white">
        <Heading level={1}>
          {isAr ? 'رسائل البريد الفاشلة' : 'Failed Emails'}
        </Heading>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-6 text-red-700 text-sm">
            {error}
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
                </tr>
              </thead>
              <tbody>
                {failed.map((email) => (
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
                  </tr>
                ))}
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
