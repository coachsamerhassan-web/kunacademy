/**
 * ScholarshipsBoard — Wave E.4 transparency dashboard renderer.
 *
 * SERVER COMPONENT. No `"use client"` directive — receives pre-computed
 * TransparencyData and renders bilingual aggregates + month-over-month
 * recurrence sparkline as inline SVG (no chart library bundle bloat).
 *
 * Dignity-framing constraints:
 *   - NEVER renders a recipient name or any program-of-1 inference.
 *     The data layer applies SMALL_N suppression (lib/scholarship-transparency.ts).
 *   - Aggregate-only display.
 *   - Per dispatch §6 IP protection: editorial copy is methodology-clean.
 *     Selection criteria summarized in one line — no scoring detail, no
 *     interview structure, no readiness-screening questions reproduced here.
 *
 * RTL: AR locale flips text-align via existing platform pattern. Numbers
 * remain LTR per `feedback_arabic_english_bidi_mixing` — wrapped in
 * &lrm;...&lrm; markers when embedded inside Arabic strings.
 */

import type { TransparencyData } from '@/lib/scholarship-transparency';

interface Props {
  locale: 'ar' | 'en';
  data: TransparencyData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatNumber(n: number, locale: 'ar' | 'en'): string {
  // AR: Western digits inside Arabic copy per platform convention.
  // EN: Standard en-US grouping.
  return new Intl.NumberFormat(locale === 'ar' ? 'en-US' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(n);
}

function formatMonthLabel(monthIso: string, locale: 'ar' | 'en'): string {
  // monthIso is 'YYYY-MM-01'; render compact MMM YY.
  const [y, m] = monthIso.split('-');
  const monthIdx = Number(m) - 1;
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsAr = ['ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون', 'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس'];
  const lbl = locale === 'ar' ? monthsAr[monthIdx] ?? '' : monthsEn[monthIdx] ?? '';
  return `${lbl} ${y.slice(-2)}`;
}

/** Convert "AED 12000" → bilingual currency label. Per dispatch:
 *  AED primary, EGP/EUR/etc. shown only when non-zero. */
function currencyLabel(currency: string, _locale: 'ar' | 'en'): string {
  // Currencies are 3-letter ISO codes — render same in both locales for
  // unambiguity (avoid Arabic transliteration of currency codes which can
  // confuse copy).
  return currency;
}

/** Build an SVG sparkline path for a series of values + its viewBox.
 *  Produces a polyline with X axis time-evenly spaced and Y axis
 *  proportional to value/max. Returns '' for an all-zero series. */
function buildSparkline(values: number[], width: number, height: number): {
  path: string;
  bars: Array<{ x: number; y: number; w: number; h: number }>;
  max: number;
} {
  const max = values.length === 0 ? 0 : Math.max(...values);
  if (max <= 0) {
    return { path: '', bars: [], max: 0 };
  }
  const padding = 2;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const stepX = values.length > 1 ? innerW / (values.length - 1) : 0;

  const points: Array<[number, number]> = values.map((v, i) => {
    const x = padding + i * stepX;
    const y = padding + innerH - (v / max) * innerH;
    return [x, y];
  });

  // Smooth-ish polyline (no curve interpolation needed for monthly buckets)
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
    .join(' ');

  // Bars under the line for clearer monthly anchoring
  const barW = values.length > 0 ? Math.max(2, innerW / values.length - 4) : 2;
  const bars = values.map((v, i) => {
    const x = padding + i * stepX - barW / 2;
    const h = max > 0 ? (v / max) * innerH : 0;
    const y = padding + innerH - h;
    return { x, y, w: barW, h };
  });

  return { path, bars, max };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-5 md:p-6">
      <div className="text-sm text-[var(--color-neutral-600)] mb-2">{label}</div>
      <div
        className="text-2xl md:text-3xl font-bold text-[var(--color-foreground)]"
        // Numbers always LTR even inside an RTL container
        dir="ltr"
        style={{ unicodeBidi: 'plaintext' }}
      >
        {value}
      </div>
      {sublabel ? (
        <div className="text-xs text-[var(--color-neutral-500)] mt-1">{sublabel}</div>
      ) : null}
    </div>
  );
}

function CurrencyTotalsRow({
  totals,
  locale,
  emptyLabel,
}: {
  totals: { currency: string; amount_major: number }[];
  locale: 'ar' | 'en';
  emptyLabel: string;
}) {
  if (totals.length === 0) {
    return (
      <span className="text-[var(--color-neutral-500)] text-base">
        {emptyLabel}
      </span>
    );
  }
  // AED first, then others alphabetical
  const sorted = [...totals].sort((a, b) => {
    if (a.currency === 'AED') return -1;
    if (b.currency === 'AED') return 1;
    return a.currency.localeCompare(b.currency);
  });
  return (
    <span className="inline-flex flex-wrap gap-x-3 gap-y-1" dir="ltr" style={{ unicodeBidi: 'plaintext' }}>
      {sorted.map((t) => (
        <span key={t.currency} className="whitespace-nowrap">
          {formatNumber(t.amount_major, locale)}{' '}
          <span className="text-base text-[var(--color-neutral-600)]">
            {currencyLabel(t.currency, locale)}
          </span>
        </span>
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function ScholarshipsBoard({ locale, data }: Props) {
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  // Currency aggregates: AED primary, others displayed when non-zero
  const totalRaisedNonZero = data.total_raised.filter((t) => t.amount_major > 0);
  const totalDisbursedNonZero = data.total_disbursed.filter((t) => t.amount_major > 0);

  // For sparkline: pick the dominant currency across the year.
  // We render ONE sparkline using the currency with the highest cumulative
  // total to keep the visual single-axis. Caption indicates which currency.
  const currencyTotalsForSparkline = new Map<string, number>();
  for (const m of data.monthly_recurrence) {
    for (const [cur, amt] of Object.entries(m.totals)) {
      currencyTotalsForSparkline.set(cur, (currencyTotalsForSparkline.get(cur) ?? 0) + amt);
    }
  }
  let dominantCurrency: string = 'AED';
  let dominantTotal = 0;
  for (const [cur, total] of currencyTotalsForSparkline.entries()) {
    if (total > dominantTotal) {
      dominantTotal = total;
      dominantCurrency = cur;
    }
  }
  const sparklineValues = data.monthly_recurrence.map((m) => m.totals[dominantCurrency] ?? 0);
  const SPARK_W = 600;
  const SPARK_H = 80;
  const { path: sparkPath, bars, max: sparkMax } = buildSparkline(sparklineValues, SPARK_W, SPARK_H);

  // Computed-at humanization
  const computedAtDate = new Date(data.computed_at);
  const computedAtIso = computedAtDate.toISOString();
  const computedAtHuman = computedAtDate.toUTCString();

  return (
    <div dir={dir} className="space-y-12 md:space-y-16">

      {/* ─── Headline metrics row ─────────────────────────────────────── */}
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="text-xl md:text-2xl font-bold mb-6">
          {isAr ? 'الأرقام الحالية' : 'Current Figures'}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-5 md:p-6 sm:col-span-2">
            <div className="text-sm text-[var(--color-neutral-600)] mb-2">
              {isAr ? 'إجمالي ما تم جمعه' : 'Total raised'}
            </div>
            <div className="text-2xl md:text-3xl font-bold text-[var(--color-foreground)]">
              <CurrencyTotalsRow
                totals={totalRaisedNonZero}
                locale={locale}
                emptyLabel={isAr ? 'الصندوق في بدايته' : 'The fund is in its early days'}
              />
            </div>
            <div className="text-xs text-[var(--color-neutral-500)] mt-2">
              {isAr
                ? 'يشمل المساهمات عبر الإنترنت والتحويلات المسجّلة يدويًا.'
                : 'Includes online contributions and manually recorded transfers.'}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-5 md:p-6 sm:col-span-2">
            <div className="text-sm text-[var(--color-neutral-600)] mb-2">
              {isAr ? 'إجمالي ما تم صرفه' : 'Total disbursed'}
            </div>
            <div className="text-2xl md:text-3xl font-bold text-[var(--color-foreground)]">
              <CurrencyTotalsRow
                totals={totalDisbursedNonZero}
                locale={locale}
                emptyLabel={isAr ? 'لم تُصرَف منح بعد' : 'No disbursements yet'}
              />
            </div>
            <div className="text-xs text-[var(--color-neutral-500)] mt-2">
              {isAr
                ? 'يُصرَف بعد تأكيد التحاق المتقدّم بالبرنامج.'
                : 'Disbursed once an applicant confirms enrollment.'}
            </div>
          </div>

          <MetricCard
            label={isAr ? 'منح نشطة' : 'Active scholarships'}
            value={formatNumber(data.active_scholarships, locale)}
            sublabel={
              isAr
                ? 'مُخصَّصة وفي طور التحاق المستفيد'
                : 'Allocated, awaiting recipient enrollment'
            }
          />

          <MetricCard
            label={isAr ? 'مستفيدون' : 'Beneficiaries to date'}
            value={formatNumber(data.beneficiary_count, locale)}
            sublabel={isAr ? 'عدد إجمالي، لا أسماء' : 'Total count, never named'}
          />
        </div>
      </section>

      {/* ─── Programs covered ─────────────────────────────────────────── */}
      {data.programs_covered.length > 0 ? (
        <section aria-labelledby="programs-heading">
          <h2 id="programs-heading" className="text-xl md:text-2xl font-bold mb-4">
            {isAr ? 'البرامج التي يغطّيها الصندوق' : 'Programs the fund covers'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.programs_covered.map((p) => (
              <span
                key={p.slug}
                className="inline-flex items-center px-3 py-1.5 rounded-full border border-[var(--color-neutral-300)] bg-[var(--color-neutral-50)] text-sm text-[var(--color-foreground)]"
              >
                {isAr ? p.title_ar : p.title_en}
              </span>
            ))}
          </div>
          <p className="text-sm text-[var(--color-neutral-600)] mt-3">
            {isAr
              ? 'الصندوق يدعم البرامج الأساسية: إحياء، GPS، وِصال، بذور.'
              : 'The fund supports the core programs: Ihya, GPS, Wisal, Seeds.'}
          </p>
        </section>
      ) : (
        <section aria-labelledby="programs-heading">
          <h2 id="programs-heading" className="text-xl md:text-2xl font-bold mb-4">
            {isAr ? 'البرامج التي يغطّيها الصندوق' : 'Programs the fund covers'}
          </h2>
          <p className="text-sm text-[var(--color-neutral-600)]">
            {isAr
              ? 'الصندوق مهيَّأ لدعم برامج: إحياء، GPS، وِصال، بذور.'
              : 'The fund is set up to support: Ihya, GPS, Wisal, Seeds.'}
          </p>
        </section>
      )}

      {/* ─── Allocation breakdown ─────────────────────────────────────── */}
      {data.program_breakdown.length > 0 ? (
        <section aria-labelledby="breakdown-heading">
          <h2 id="breakdown-heading" className="text-xl md:text-2xl font-bold mb-4">
            {isAr ? 'كيف تُخصَّص المساهمات' : 'How contributions are allocated'}
          </h2>
          <div className="overflow-hidden rounded-lg border border-[var(--color-neutral-200)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <tr>
                  <th className={`p-3 ${isAr ? 'text-right' : 'text-left'} font-semibold`}>
                    {isAr ? 'البرنامج' : 'Program'}
                  </th>
                  <th className={`p-3 ${isAr ? 'text-right' : 'text-left'} font-semibold`}>
                    {isAr ? 'منح' : 'Allocations'}
                  </th>
                  <th className={`p-3 ${isAr ? 'text-right' : 'text-left'} font-semibold`}>
                    {isAr ? 'المبلغ' : 'Amount'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.program_breakdown.map((p) => (
                  <tr
                    key={p.program_slug}
                    className="border-b border-[var(--color-neutral-100)] last:border-b-0"
                  >
                    <td className="p-3">
                      {p.program_slug === 'other_programs'
                        ? isAr
                          ? 'برامج أخرى'
                          : 'Other programs'
                        : programLabel(p.program_slug, p.program_family, isAr)}
                    </td>
                    <td className="p-3" dir="ltr" style={{ unicodeBidi: 'plaintext' }}>
                      {formatNumber(p.allocation_count, locale)}
                    </td>
                    <td className="p-3">
                      <CurrencyTotalsRow
                        totals={Object.entries(p.totals).map(([currency, amount_major]) => ({
                          currency,
                          amount_major,
                        }))}
                        locale={locale}
                        emptyLabel={isAr ? '—' : '—'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--color-neutral-500)] mt-3">
            {isAr
              ? 'البرامج التي تحتوي عددًا قليلًا من المنح النشطة تُجمَع في "برامج أخرى" حفاظًا على خصوصية المتقدّمين.'
              : 'Programs with a small number of active allocations are grouped into "Other programs" to preserve applicant privacy.'}
          </p>
        </section>
      ) : null}

      {/* ─── Recurrence sparkline ─────────────────────────────────────── */}
      <section aria-labelledby="recurrence-heading">
        <h2 id="recurrence-heading" className="text-xl md:text-2xl font-bold mb-4">
          {isAr ? 'مساهمات الـ12 شهرًا الماضية' : 'Contributions over the past 12 months'}
        </h2>
        <div className="rounded-lg border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4 md:p-6">
          {sparkMax > 0 ? (
            <>
              <svg
                viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
                width="100%"
                height={SPARK_H}
                role="img"
                aria-label={
                  isAr
                    ? `مخطط مساهمات شهرية بعملة ${dominantCurrency}`
                    : `Monthly contributions chart in ${dominantCurrency}`
                }
                preserveAspectRatio="none"
                className="block"
              >
                {bars.map((b, i) => (
                  <rect
                    key={i}
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                    rx="1"
                    fill="var(--color-neutral-300)"
                  />
                ))}
                <path
                  d={sparkPath}
                  fill="none"
                  stroke="var(--color-primary, #2c5f4f)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div
                className="grid mt-2 text-[10px] text-[var(--color-neutral-500)]"
                style={{ gridTemplateColumns: `repeat(${data.monthly_recurrence.length}, minmax(0, 1fr))` }}
                dir="ltr"
              >
                {data.monthly_recurrence.map((m) => (
                  <span key={m.month} className="text-center">
                    {formatMonthLabel(m.month, locale)}
                  </span>
                ))}
              </div>
              <p className="text-xs text-[var(--color-neutral-600)] mt-3">
                {isAr
                  ? `المخطط بعملة ${dominantCurrency}.`
                  : `Chart denominated in ${dominantCurrency}.`}
              </p>
            </>
          ) : (
            <p className="text-sm text-[var(--color-neutral-600)]">
              {isAr
                ? 'لم تُسجَّل مساهمات بعد. ستظهر الأرقام هنا حين تبدأ المساهمات.'
                : 'No contributions yet. Figures will appear here once contributions begin.'}
            </p>
          )}
        </div>
        <p className="text-xs text-[var(--color-neutral-500)] mt-3">
          {isAr ? 'آخر تحديث: ' : 'Last refresh: '}
          <time dateTime={computedAtIso}>{computedAtHuman}</time>
        </p>
      </section>

      {/* ─── How the fund works (editorial) ─────────────────────────── */}
      <section aria-labelledby="howitworks-heading">
        <h2 id="howitworks-heading" className="text-xl md:text-2xl font-bold mb-4">
          {isAr ? 'كيف يعمل الصندوق' : 'How the fund works'}
        </h2>
        <div className="space-y-4 text-base leading-relaxed text-[var(--color-neutral-700)]">
          <p>
            {isAr
              ? 'كلّ درهم يُجمَع في الصندوق يذهب إلى مقعد متقدّم في برنامج. تتحمّل الأكاديمية تكاليف التشغيل من مصادر أخرى — لا تُقتطَع نسبة من المساهمات.'
              : 'Every dirham raised goes to a seat for an applicant. The academy absorbs operational costs from other sources — no percentage is taken from contributions.'}
          </p>
          <p>
            {isAr
              ? 'باب التقديم مفتوح طوال السنة. تُراجَع الطلبات في دفعات بحسب جاهزية المقاعد.'
              : 'Applications are open year-round. Requests are reviewed in cohorts as seats become available.'}
          </p>
          <p>
            {isAr
              ? 'يُنظر في كلّ طلب بناءً على السياق المالي للمتقدّم والتزامه بمسيرة التطبيق العملي للتدريب. تظلّ تفاصيل المراجعة داخلية حفاظًا على كرامة المتقدّمين.'
              : "Each request is considered on its financial context and the applicant's commitment to coaching practice. Review details remain internal to safeguard applicants' dignity."}
          </p>
          <p>
            {isAr
              ? 'الأرقام أعلاه تُحدَّث تلقائيًا. يمكن طلب نسخة من السجلّ المُجمَّع للمراجعة المستقلّة عبر التواصل مع الأكاديمية.'
              : 'The figures above update automatically. An aggregated audit log is available on request through the academy.'}
          </p>
        </div>
      </section>

      {/* ─── CTAs ────────────────────────────────────────────────────── */}
      <section aria-labelledby="cta-heading">
        <h2 id="cta-heading" className="sr-only">
          {isAr ? 'الإجراءات' : 'Actions'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href={`/${locale}/scholarships/apply`}
            className="block rounded-lg border-2 border-[var(--color-primary,#2c5f4f)] bg-white p-5 md:p-6 hover:bg-[var(--color-neutral-50)] transition-colors"
          >
            <div className="font-semibold text-base md:text-lg text-[var(--color-foreground)] mb-1">
              {isAr ? 'تقدّم بطلب منحة' : 'Apply for a scholarship'}
            </div>
            <div className="text-sm text-[var(--color-neutral-600)]">
              {isAr
                ? 'املأ استمارة الطلب لمراجعة الجاهزية.'
                : 'Submit an application for readiness review.'}
            </div>
          </a>

          <a
            href={`/${locale}/donate`}
            className="block rounded-lg border-2 border-[var(--color-primary,#2c5f4f)] bg-[var(--color-primary,#2c5f4f)] p-5 md:p-6 text-white hover:opacity-90 transition-opacity"
          >
            <div className="font-semibold text-base md:text-lg mb-1">
              {isAr ? 'ساهم في الصندوق' : 'Make a contribution'}
            </div>
            <div className="text-sm text-white/85">
              {isAr
                ? 'افتح الطريق لمتقدّم استحقّ الفرصة.'
                : 'Open the way for an applicant who has earned the opportunity.'}
            </div>
          </a>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (local)
// ─────────────────────────────────────────────────────────────────────────────

/** Render a program label fallback when programs.json title is missing.
 *  Uses program_family as a coarse bucket. */
function programLabel(slug: string, family: string, isAr: boolean): string {
  // Primary: use family bucket name in case the slug is opaque
  // (e.g. 'gps-of-life' → "GPS").
  const familyMap: Record<string, { ar: string; en: string }> = {
    gps: { ar: 'GPS', en: 'GPS' },
    ihya: { ar: 'إحياء', en: 'Ihya' },
    wisal: { ar: 'وِصال', en: 'Wisal' },
    seeds: { ar: 'بذور', en: 'Seeds' },
  };
  const fam = familyMap[family];
  if (fam) {
    return isAr ? fam.ar : fam.en;
  }
  // Fallback to humanized slug
  return slug
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
