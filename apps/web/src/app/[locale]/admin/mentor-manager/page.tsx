/**
 * /[locale]/admin/mentor-manager
 *
 * Mentor-Manager Overview Dashboard — server-rendered, no client JS needed.
 *
 * Auth: role in ['admin', 'super_admin', 'mentor_manager']
 * (enforced by middleware; page also redirects if session lacks the role)
 *
 * Sections:
 *   1. KPI cards — pending assessments, second-opinion queue, failed 2nd-try, paused journeys
 *   2. SLA watch — top 5 assessments >8 business days elapsed (5+ days overdue on 10-day SLA)
 *   3. Email outbox health — failed email count + warning
 *   4. Recent override activity — last 5 audit log rows for override/opinion actions
 *
 * Cache: revalidate = 30 seconds (ISR)
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';
import { withAdminContext, sql } from '@kunacademy/db';
import { getAuthUser } from '@kunacademy/auth/server';
import { businessDaysBetween } from '@/lib/business-days';

export const revalidate = 30;

// ── Types ──────────────────────────────────────────────────────────────────────

interface KpiStats {
  pendingAssessments: number;
  secondOpinionOpen: number;
  failedPastDeadline: number;
  pausedJourneys: number;
}

interface SlaRow {
  assessment_id: string;
  student_name: string | null;
  student_email: string;
  assessor_name: string | null;
  submitted_at: string;
  days_elapsed: number;
}

interface EmailOutboxHealth {
  totalFailed: number;
}

interface AuditRow {
  id: string;
  action: string;
  actor_name: string | null;
  actor_email: string;
  created_at: string;
}

// ── Data fetching ──────────────────────────────────────────────────────────────

async function fetchKpis(): Promise<KpiStats> {
  return withAdminContext(async (db) => {
    const [pending, secondOpinion, failedPastDeadline, paused] = await Promise.all([
      // 1. Assessments pending review
      db.execute(
        sql`SELECT COUNT(*) AS cnt FROM package_assessments WHERE decision = 'pending'`
      ),
      // 2. Second-opinion requests open
      db.execute(
        sql`SELECT COUNT(*) AS cnt FROM package_assessments WHERE second_opinion_requested_at IS NOT NULL`
      ),
      // 3. Failed assessments past 2nd-try-deadline
      db.execute(sql`
        SELECT COUNT(*) AS cnt
        FROM package_assessments pa
        INNER JOIN package_recordings pr ON pr.id = pa.recording_id
        INNER JOIN package_instances  pi ON pi.id = pr.package_instance_id
        WHERE pa.decision = 'fail'
          AND pi.second_try_deadline_at IS NOT NULL
          AND pi.second_try_deadline_at < NOW()
      `),
      // 4. Paused journeys
      db.execute(
        sql`SELECT COUNT(*) AS cnt FROM package_instances WHERE journey_state = 'paused'`
      ),
    ]);

    return {
      pendingAssessments: Number((pending.rows[0] as { cnt: string }).cnt),
      secondOpinionOpen:  Number((secondOpinion.rows[0] as { cnt: string }).cnt),
      failedPastDeadline: Number((failedPastDeadline.rows[0] as { cnt: string }).cnt),
      pausedJourneys:     Number((paused.rows[0] as { cnt: string }).cnt),
    };
  });
}

async function fetchSlaWatch(): Promise<SlaRow[]> {
  // Fetch pending assessments submitted more than 8 business days ago (5+ overdue on 10-day SLA)
  // We over-fetch (30 rows) then filter in JS using the shared businessDaysBetween helper,
  // since business-day calculation cannot be done purely in SQL without a PL/pgSQL function.
  const rows = await withAdminContext(async (db) => {
    const result = await db.execute(sql`
      SELECT
        pa.id                                      AS assessment_id,
        pr.submitted_at,
        COALESCE(sp.full_name_en, sp.full_name_ar) AS student_name,
        sp.email                                   AS student_email,
        COALESCE(ap.full_name_en, ap.full_name_ar) AS assessor_name
      FROM package_assessments pa
      INNER JOIN package_recordings pr ON pr.id = pa.recording_id
      INNER JOIN package_instances  pi ON pi.id = pr.package_instance_id
      INNER JOIN profiles           sp ON sp.id = pi.student_id
      INNER JOIN profiles           ap ON ap.id = pa.assessor_id
      WHERE pa.decision = 'pending'
        AND pr.submitted_at < NOW() - INTERVAL '8 days'
      ORDER BY pr.submitted_at ASC
      LIMIT 30
    `);
    return result.rows as Array<{
      assessment_id: string;
      submitted_at: string;
      student_name: string | null;
      student_email: string;
      assessor_name: string | null;
    }>;
  });

  const now = new Date();
  return rows
    .map((r) => ({
      assessment_id: r.assessment_id,
      student_name:  r.student_name,
      student_email: r.student_email,
      assessor_name: r.assessor_name,
      submitted_at:  r.submitted_at,
      days_elapsed:  businessDaysBetween(new Date(r.submitted_at), now),
    }))
    .filter((r) => r.days_elapsed >= 8) // ≥ 8 business days = 5+ overdue
    .slice(0, 5);
}

async function fetchEmailHealth(): Promise<EmailOutboxHealth> {
  return withAdminContext(async (db) => {
    const result = await db.execute(
      sql`SELECT COUNT(*) AS cnt FROM email_outbox WHERE status = 'failed'`
    );
    return { totalFailed: Number((result.rows[0] as { cnt: string }).cnt) };
  });
}

async function fetchRecentOverrides(): Promise<AuditRow[]> {
  return withAdminContext(async (db) => {
    const result = await db.execute(sql`
      SELECT
        al.id,
        al.action,
        al.created_at,
        COALESCE(p.full_name_en, p.full_name_ar) AS actor_name,
        COALESCE(p.email, '')                     AS actor_email
      FROM admin_audit_log al
      LEFT JOIN profiles p ON p.id = al.admin_id
      WHERE al.action IN (
        'OVERRIDE_ASSESSMENT_DECISION',
        'REQUEST_SECOND_OPINION',
        'RESOLVE_SECOND_OPINION'
      )
      ORDER BY al.created_at DESC
      LIMIT 5
    `);
    return result.rows as AuditRow[];
  });
}

// ── Label helpers ──────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, { ar: string; en: string }> = {
  OVERRIDE_ASSESSMENT_DECISION: { ar: 'تجاوز قرار التقييم',   en: 'Override Assessment Decision' },
  REQUEST_SECOND_OPINION:       { ar: 'طلب رأي ثانٍ',         en: 'Request Second Opinion'       },
  RESOLVE_SECOND_OPINION:       { ar: 'حسم الرأي الثاني',     en: 'Resolve Second Opinion'       },
};

function fmtDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function MentorManagerDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isAr = locale === 'ar';
  const dir  = isAr ? 'rtl' : 'ltr';

  // ── Auth guard ──────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  const role = (user as { role?: string } | null)?.role;
  const allowed = role === 'admin' || role === 'super_admin' || role === 'mentor_manager';
  if (!user || !allowed) {
    redirect(`/${locale}/dashboard`);
  }

  // ── Parallel data fetch ─────────────────────────────────────────────────────
  const [kpis, slaRows, emailHealth, overrides] = await Promise.all([
    fetchKpis(),
    fetchSlaWatch(),
    fetchEmailHealth(),
    fetchRecentOverrides(),
  ]);

  // ── KPI card definitions ────────────────────────────────────────────────────
  const kpiCards = [
    {
      key: 'pending',
      labelAr: 'تقييمات بانتظار المراجعة',
      labelEn: 'Assessments Pending Review',
      value: kpis.pendingAssessments,
      linkAr: 'الطابور المفتوح',
      linkEn: 'Open queue',
      href: `/${locale}/admin/escalations`,
      color: kpis.pendingAssessments > 0 ? 'amber' : 'neutral',
    },
    {
      key: 'second_opinion',
      labelAr: 'طلبات رأي ثانٍ مفتوحة',
      labelEn: 'Second-Opinion Requests Open',
      value: kpis.secondOpinionOpen,
      linkAr: 'عرض القائمة',
      linkEn: 'View list',
      href: `/${locale}/admin/escalations?needs_second_opinion=1`,
      color: kpis.secondOpinionOpen > 0 ? 'amber' : 'neutral',
    },
    {
      key: 'failed_deadline',
      labelAr: 'تقييمات فاشلة تجاوزت الموعد',
      labelEn: 'Failed Past 2nd-Try Deadline',
      value: kpis.failedPastDeadline,
      linkAr: 'عرض القائمة',
      linkEn: 'View list',
      href: `/${locale}/admin/escalations?status=fail`,
      color: kpis.failedPastDeadline > 0 ? 'red' : 'neutral',
    },
    {
      key: 'paused',
      labelAr: 'رحلات متوقفة مؤقتاً',
      labelEn: 'Paused Journeys',
      value: kpis.pausedJourneys,
      linkAr: 'عرض',
      linkEn: 'View',
      href: `/${locale}/admin/escalations`,
      color: kpis.pausedJourneys > 0 ? 'orange' : 'neutral',
    },
  ] as const;

  const colorMap = {
    amber:   'border-amber-300  bg-amber-50   text-amber-800',
    red:     'border-red-300    bg-red-50     text-red-800',
    orange:  'border-orange-300 bg-orange-50  text-orange-800',
    neutral: 'border-[var(--color-neutral-200)] bg-white text-[var(--color-neutral-900)]',
  } as const;

  return (
    <main dir={dir}>
      <Section variant="white">

        {/* ── Title ─────────────────────────────────────────────────────────── */}
        <Heading level={1} className="mb-6">
          {isAr ? 'لوحة مدير المُرشِّدين' : 'Mentor-Manager Dashboard'}
        </Heading>

        {/* ── Section 1: KPI cards ───────────────────────────────────────────── */}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-neutral-500)] mb-3">
          {isAr ? 'أعمال معلّقة' : 'Pending Work'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpiCards.map((card) => (
            <div
              key={card.key}
              className={`rounded-lg border p-4 flex flex-col gap-2 ${colorMap[card.color]}`}
            >
              <div className="text-3xl font-bold">{card.value}</div>
              <div className="text-sm font-medium leading-tight">
                {isAr ? card.labelAr : card.labelEn}
              </div>
              <Link
                href={card.href}
                className="text-xs underline underline-offset-2 opacity-70 hover:opacity-100 mt-auto min-h-[44px] flex items-end"
              >
                {isAr ? card.linkAr : card.linkEn}
              </Link>
            </div>
          ))}
        </div>

        {/* ── Section 2: SLA watch ──────────────────────────────────────────── */}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-neutral-500)] mb-3">
          {isAr ? 'مراقبة الـ SLA (تجاوز 8 أيام عمل)' : 'SLA Watch (>8 Business Days Elapsed)'}
        </h2>
        <div className="rounded-lg border border-[var(--color-neutral-200)] mb-8 overflow-hidden">
          {slaRows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--color-neutral-500)] text-center">
              {isAr ? 'لا توجد تقييمات متأخرة.' : 'No overdue assessments.'}
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-neutral-200)] bg-[var(--color-surface-dim)] text-[var(--color-neutral-500)] text-xs uppercase tracking-wide">
                  <th className="py-2 px-4 text-start font-medium">
                    {isAr ? 'الطالب' : 'Student'}
                  </th>
                  <th className="py-2 px-4 text-start font-medium">
                    {isAr ? 'المُقيِّم' : 'Assessor'}
                  </th>
                  <th className="py-2 px-4 text-start font-medium">
                    {isAr ? 'تاريخ الإرسال' : 'Submitted'}
                  </th>
                  <th className="py-2 px-4 text-start font-medium">
                    {isAr ? 'أيام عمل مضت' : 'Business Days'}
                  </th>
                  <th className="py-2 px-4 text-start font-medium">
                    {isAr ? 'الإجراء' : 'Action'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {slaRows.map((row) => (
                  <tr
                    key={row.assessment_id}
                    className="border-b border-[var(--color-neutral-100)] hover:bg-red-50/30 transition"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-[var(--color-neutral-900)]">
                        {row.student_name ?? row.student_email}
                      </div>
                      <div className="text-xs text-[var(--color-neutral-500)]">{row.student_email}</div>
                    </td>
                    <td className="py-3 px-4 text-[var(--color-neutral-700)]">
                      {row.assessor_name ?? (isAr ? 'غير معروف' : 'Unknown')}
                    </td>
                    <td className="py-3 px-4 text-[var(--color-neutral-600)]">
                      {new Date(row.submitted_at).toLocaleDateString(
                        isAr ? 'ar-AE' : 'en-GB',
                        { day: 'numeric', month: 'short', year: 'numeric' }
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700">
                        {row.days_elapsed}
                        {isAr ? ' يوم عمل' : ' biz days'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/${locale}/admin/escalations/${row.assessment_id}`}
                        className="inline-flex items-center min-h-[44px] px-3 py-1.5 rounded-md border border-[var(--color-primary)] text-[var(--color-primary)] text-sm font-medium hover:bg-[var(--color-primary)] hover:text-white transition"
                      >
                        {isAr ? 'فتح' : 'Open'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Section 3: Email outbox health ────────────────────────────────── */}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-neutral-500)] mb-3">
          {isAr ? 'صحة صندوق الرسائل الصادرة' : 'Email Outbox Health'}
        </h2>
        <div
          className={`rounded-lg border p-4 mb-8 flex items-center justify-between gap-4
            ${emailHealth.totalFailed > 10
              ? 'border-red-300 bg-red-50'
              : emailHealth.totalFailed > 0
                ? 'border-amber-300 bg-amber-50'
                : 'border-[var(--color-neutral-200)] bg-white'}`}
        >
          <div>
            <span className={`text-2xl font-bold ${emailHealth.totalFailed > 10 ? 'text-red-700' : emailHealth.totalFailed > 0 ? 'text-amber-800' : 'text-[var(--color-neutral-900)]'}`}>
              {emailHealth.totalFailed}
            </span>
            <span className={`ms-2 text-sm ${emailHealth.totalFailed > 0 ? 'font-medium' : 'text-[var(--color-neutral-500)]'}`}>
              {isAr ? 'رسالة فاشلة' : 'failed email(s)'}
            </span>
            {emailHealth.totalFailed > 10 && (
              <p className="mt-1 text-xs text-red-700 font-medium">
                {isAr ? 'تحذير: أكثر من 10 رسائل فاشلة — تحقق فوراً.' : 'Warning: >10 failed emails — investigate immediately.'}
              </p>
            )}
          </div>
          <Link
            href={`/${locale}/admin/email-outbox`}
            className="min-h-[44px] px-4 py-2 rounded-md border border-[var(--color-neutral-300)] text-sm font-medium text-[var(--color-neutral-700)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition flex items-center"
          >
            {isAr ? 'فتح صندوق الرسائل' : 'Open Outbox'}
          </Link>
        </div>

        {/* ── Section 4: Recent override activity ───────────────────────────── */}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-neutral-500)] mb-3">
          {isAr ? 'آخر نشاط التجاوزات والآراء' : 'Recent Override Activity'}
        </h2>
        <div className="rounded-lg border border-[var(--color-neutral-200)] overflow-hidden">
          {overrides.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--color-neutral-500)] text-center">
              {isAr ? 'لا يوجد نشاط مؤخراً.' : 'No recent activity.'}
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-neutral-200)] bg-[var(--color-surface-dim)] text-[var(--color-neutral-500)] text-xs uppercase tracking-wide">
                  <th className="py-2 px-4 text-start font-medium">{isAr ? 'الوقت' : 'Time'}</th>
                  <th className="py-2 px-4 text-start font-medium">{isAr ? 'المنفِّذ' : 'Actor'}</th>
                  <th className="py-2 px-4 text-start font-medium">{isAr ? 'الإجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((row) => {
                  const actionLabel = ACTION_LABELS[row.action] ?? { ar: row.action, en: row.action };
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-surface-dim)] transition"
                    >
                      <td className="py-3 px-4 text-[var(--color-neutral-500)] whitespace-nowrap">
                        {fmtDate(row.created_at, locale)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[var(--color-neutral-900)]">
                          {row.actor_name ?? row.actor_email}
                        </div>
                        {row.actor_name && (
                          <div className="text-xs text-[var(--color-neutral-500)]">{row.actor_email}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800">
                          {isAr ? actionLabel.ar : actionLabel.en}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </Section>
    </main>
  );
}
