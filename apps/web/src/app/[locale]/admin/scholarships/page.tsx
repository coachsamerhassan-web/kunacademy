'use client';

import { use } from 'react';
import { Section } from '@kunacademy/ui/section';

/**
 * /[locale]/admin/scholarships — Wave E.5 admin scholarship index.
 *
 * Hub linking to:
 *   - Applications queue (E.5 ships)
 *   - New manual entry (E.5 ships)
 *   - Donations ledger (E.6 will ship)
 *   - Allocations history (E.6 will ship)
 */
export default function AdminScholarshipsIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const headingFont = isAr ? 'var(--font-arabic-heading)' : 'var(--font-english-heading)';

  const cards = [
    {
      href: `/${locale}/admin/scholarships/applications`,
      labelAr: 'طلبات المنح',
      labelEn: 'Applications',
      summary: isAr ? 'E.5' : 'E.5',
      descAr: 'مراجعة الطلبات الواردة، تغيير الحالة، الموافقة، الرفض، قائمة الانتظار.',
      descEn: 'Review incoming applications, change status, approve, decline, or waitlist.',
    },
    {
      href: `/${locale}/admin/scholarships/applications/new`,
      labelAr: 'إدخال يدوي',
      labelEn: 'Manual entry',
      summary: isAr ? 'E.5 (B5)' : 'E.5 (B5)',
      descAr: 'تسجيل طلب وصل عبر قناة خارجية (إيميل، اجتماع، إحالة شخصية).',
      descEn: 'Record an application that arrived via an external channel (email, meeting, referral).',
    },
  ];

  return (
    <Section variant="white">
      <div dir={dir}>
        <div className="mb-8">
          <h1
            className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2"
            style={{ fontFamily: headingFont }}
          >
            {isAr ? 'صندوق منح كُن — لوحة الإدارة' : 'Kun Scholarship Fund — Admin'}
          </h1>
          <p className="text-[var(--color-neutral-600)]">
            {isAr
              ? 'مراجعة الطلبات الواردة، تخصيص المنح، تتبّع الصرف.'
              : 'Review incoming applications, allocate scholarships, track disbursement.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((c) => (
            <a
              key={c.href}
              href={c.href}
              className="block rounded-2xl border border-[var(--color-neutral-100)] bg-white p-5 hover:border-[var(--color-primary)]/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2
                  className="text-lg font-semibold text-[var(--text-primary)]"
                  style={{ fontFamily: headingFont }}
                >
                  {isAr ? c.labelAr : c.labelEn}
                </h2>
                <span className="text-xs font-mono text-[var(--color-neutral-400)]">{c.summary}</span>
              </div>
              <p className="text-sm text-[var(--color-neutral-600)]">
                {isAr ? c.descAr : c.descEn}
              </p>
            </a>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)]/40 p-5 text-sm text-[var(--color-neutral-700)]">
          <p className="font-semibold text-[var(--text-primary)] mb-2">
            {isAr ? 'قادم في موجة E.6' : 'Coming in Wave E.6'}
          </p>
          <ul className="list-disc list-inside leading-relaxed space-y-1">
            <li>
              {isAr ? 'مطابقة التبرّعات والمنح (Allocation Matcher)' : 'Donation ↔ scholarship allocation matcher'}
            </li>
            <li>{isAr ? 'سجل التبرّعات' : 'Donations ledger'}</li>
            <li>{isAr ? 'سجل الصرف' : 'Disbursement audit log'}</li>
          </ul>
        </div>
      </div>
    </Section>
  );
}
