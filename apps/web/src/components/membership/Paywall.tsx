/**
 * <Paywall /> — Wave F.4 (2026-04-26)
 *
 * Renders when `hasFeature` returns false on a content surface.
 * Bilingual (AR/EN). CTA → /[locale]/membership/upgrade.
 *
 * IMPORTANT (IP rule): copy here describes membership benefits in
 * generic terms — NEVER references program methodology, beat sequences,
 * specific exercises, or session structure. Per CLAUDE.md non-negotiable
 * IP-protection rule (program methodology stays in internal specs only).
 *
 * Server component (no client interactivity required at launch — the
 * upgrade button is a plain <a> link to the upgrade flow).
 */

interface PaywallProps {
  /** UI locale ('ar' | 'en'). */
  locale: 'ar' | 'en';
  /** Stable feature key the visitor lacks (for the hidden data attribute + analytics). */
  requiredFeature: string;
  /** Optional title override (defaults to a generic "Members only" string). */
  title?: { ar?: string; en?: string };
  /** Optional description override. Keep methodology out. */
  description?: { ar?: string; en?: string };
  /** Optional return-to path used as ?from= on the upgrade flow. */
  returnTo?: string;
  /** Current tier slug, if known — drives the "you are on Free" hint. */
  currentTier?: string | null;
}

export default function Paywall({
  locale,
  requiredFeature,
  title,
  description,
  returnTo,
  currentTier,
}: PaywallProps) {
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const t = {
    title: isAr
      ? title?.ar ?? 'عضويّةٌ مدفوعة مطلوبة'
      : title?.en ?? 'Member access required',
    description: isAr
      ? description?.ar ??
        'هذا المحتوى متاحٌ لأعضاء الباقة المدفوعة (Paid-1). انضمّ بـ ١٥ درهماً شهرياً، أو ١٥٠ درهماً سنوياً، وافتح كامل المسار.'
      : description?.en ??
        'This content is available to Paid-1 members. Join for AED 15/month or AED 150/year and unlock the full path.',
    benefitTitle: isAr ? 'ما تحصل عليه:' : 'What you get:',
    benefits: isAr
      ? [
          'وصول كامل إلى المنهج الموجَّه ذاتيّاً.',
          'كتابة في المنتدى ومشاركة الأقران.',
          'جلسة Q&A شهريّة مباشرة (عربي / إنجليزي).',
          'خصم ١٠٪ على البرامج الكبرى.',
        ]
      : [
          'Full access to the self-guided curriculum.',
          'Forum write access and peer participation.',
          'Monthly live Q&A session (Arabic / English).',
          '10% discount on flagship programs.',
        ],
    upgradeCta: isAr ? 'الترقية إلى Paid-1' : 'Upgrade to Paid-1',
    backHref: isAr ? 'العودة' : 'Back',
    onFreeNote:
      currentTier === 'free'
        ? isAr
          ? 'أنت حاليًّا في الباقة المجانيّة.'
          : 'You are currently on the Free tier.'
        : null,
  };

  const upgradeHref = `/${locale}/membership/upgrade${
    returnTo ? `?from=${encodeURIComponent(returnTo)}` : ''
  }`;

  return (
    <div
      data-paywall-required-feature={requiredFeature}
      dir={dir}
      className="mx-auto max-w-2xl"
    >
      <div className="rounded-2xl border border-[var(--color-primary-100)] bg-gradient-to-br from-[var(--color-primary-50)]/40 to-white p-8 md:p-10 text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
          <svg
            className="h-6 w-6 text-[var(--color-primary)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.6}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-7a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        <h2
          className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-3"
          style={{
            fontFamily: isAr
              ? 'var(--font-arabic-heading)'
              : 'var(--font-english-heading)',
          }}
        >
          {t.title}
        </h2>

        <p className="text-[var(--color-neutral-700)] leading-relaxed mb-6 max-w-prose mx-auto">
          {t.description}
        </p>

        {t.onFreeNote && (
          <p className="text-sm text-[var(--color-neutral-500)] mb-4">
            {t.onFreeNote}
          </p>
        )}

        <div className="text-start mb-6 max-w-md mx-auto">
          <p className="font-semibold text-sm text-[var(--text-primary)] mb-2">
            {t.benefitTitle}
          </p>
          <ul className="text-sm text-[var(--color-neutral-700)] space-y-1.5 leading-relaxed">
            {t.benefits.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-primary)] shrink-0"
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <a
          href={upgradeHref}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-white font-semibold transition-colors hover:bg-[var(--color-primary-700)] min-h-[48px]"
        >
          {t.upgradeCta}
        </a>
      </div>
    </div>
  );
}
