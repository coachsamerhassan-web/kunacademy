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
 *   4. Recent activity feed — last 20 audit rows covering 7 action types with icons + context
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
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
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

async function fetchRecentActivity(): Promise<AuditRow[]> {
  return withAdminContext(async (db) => {
    const result = await db.execute(sql`
      SELECT
        al.id,
        al.action,
        al.created_at,
        al.target_type,
        al.target_id,
        al.metadata,
        COALESCE(p.full_name_en, p.full_name_ar) AS actor_name,
        COALESCE(p.email, '')                     AS actor_email
      FROM admin_audit_log al
      LEFT JOIN profiles p ON p.id = al.admin_id
      WHERE al.action IN (
        'OVERRIDE_ASSESSMENT_DECISION',
        'REQUEST_SECOND_OPINION',
        'RESOLVE_SECOND_OPINION',
        'OVERRIDE_AUTO_UNPAUSE',
        'PAUSE_JOURNEY',
        'UNPAUSE_JOURNEY',
        'SUBMIT_ASSESSMENT'
      )
      ORDER BY al.created_at DESC
      LIMIT 20
    `);
    return result.rows as AuditRow[];
  });
}

// ── Action metadata ────────────────────────────────────────────────────────────

interface ActionMeta {
  ar: string;
  en: string;
  /** Tailwind bg + text for the pill */
  pillClass: string;
  /** SVG path(s) for the icon (24×24 viewBox) */
  iconPath: string;
}

const ACTION_META: Record<string, ActionMeta> = {
  OVERRIDE_ASSESSMENT_DECISION: {
    ar: 'تجاوز قرار التقييم',
    en: 'Override Decision',
    pillClass: 'bg-purple-100 text-purple-800',
    iconPath: 'M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  },
  REQUEST_SECOND_OPINION: {
    ar: 'طلب رأي ثانٍ',
    en: 'Request 2nd Opinion',
    pillClass: 'bg-blue-100 text-blue-800',
    iconPath: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l-4 4v-4z',
  },
  RESOLVE_SECOND_OPINION: {
    ar: 'حسم الرأي الثاني',
    en: 'Resolve 2nd Opinion',
    pillClass: 'bg-green-100 text-green-800',
    iconPath: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138 3.42 3.42 0 0 0 .806 1.946 3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438 3.42 3.42 0 0 0 .806-1.946 3.42 3.42 0 0 1 3.138-3.138z',
  },
  OVERRIDE_AUTO_UNPAUSE: {
    ar: 'تجاوز الاستئناف التلقائي',
    en: 'Override Auto-Unpause',
    pillClass: 'bg-orange-100 text-orange-800',
    iconPath: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  },
  PAUSE_JOURNEY: {
    ar: 'إيقاف الرحلة مؤقتاً',
    en: 'Pause Journey',
    pillClass: 'bg-amber-100 text-amber-800',
    iconPath: 'M10 9v6m4-6v6M9 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3M9 3a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 3a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2',
  },
  UNPAUSE_JOURNEY: {
    ar: 'استئناف الرحلة',
    en: 'Unpause Journey',
    pillClass: 'bg-teal-100 text-teal-800',
    iconPath: 'M14.752 11.168l-3.197-2.132A1 1 0 0 0 10 9.87v4.263a1 1 0 0 0 1.555.832l3.197-2.132a1 1 0 0 0 0-1.664zM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  },
  SUBMIT_ASSESSMENT: {
    ar: 'تقديم تقييم',
    en: 'Submit Assessment',
    pillClass: 'bg-sky-100 text-sky-800',
    iconPath: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2m-6 9l2 2 4-4',
  },
};

/** Relative time: "5m ago" / "منذ 5د" */
function relativeTime(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);

  if (locale === 'ar') {
    if (days   >= 1) return `منذ ${days} يوم`;
    if (hours  >= 1) return `منذ ${hours} س`;
    if (minutes >= 1) return `منذ ${minutes} د`;
    return 'الآن';
  } else {
    if (days   >= 1) return `${days}d ago`;
    if (hours  >= 1) return `${hours}h ago`;
    if (minutes >= 1) return `${minutes}m ago`;
    return 'just now';
  }
}

/** Extract a brief human-readable description from audit metadata */
function descriptionFromMetadata(
  action: string,
  metadata: Record<string, unknown>,
  locale: string
): string | null {
  const isAr = locale === 'ar';
  if (action === 'OVERRIDE_ASSESSMENT_DECISION') {
    const prev = metadata.previous_decision as string | undefined;
    const next = metadata.new_decision as string | undefined;
    if (prev && next) {
      return isAr
        ? `${prev} ← ${next}`
        : `${prev} → ${next}`;
    }
  }
  if (action === 'PAUSE_JOURNEY' || action === 'UNPAUSE_JOURNEY') {
    const reason = metadata.reason as string | undefined;
    return reason ?? null;
  }
  if (action === 'SUBMIT_ASSESSMENT') {
    const decision = metadata.decision as string | undefined;
    return decision
      ? (isAr ? `القرار: ${decision}` : `Decision: ${decision}`)
      : null;
  }
  return null;
}

/** Build a link to the relevant admin page if we have a target */
function targetLink(
  action: string,
  targetId: string | null,
  locale: string
): string | null {
  if (!targetId) return null;
  // Assessment-related actions → escalations detail page
  if (
    action === 'OVERRIDE_ASSESSMENT_DECISION' ||
    action === 'REQUEST_SECOND_OPINION'       ||
    action === 'RESOLVE_SECOND_OPINION'       ||
    action === 'SUBMIT_ASSESSMENT'
  ) {
    return `/${locale}/admin/escalations/${targetId}`;
  }
  // Journey-related actions → package-instances page (if it exists)
  if (
    action === 'PAUSE_JOURNEY'        ||
    action === 'UNPAUSE_JOURNEY'      ||
    action === 'OVERRIDE_AUTO_UNPAUSE'
  ) {
    return `/${locale}/admin/escalations?instance=${targetId}`;
  }
  return null;
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
  const [kpis, slaRows, emailHealth, recentActivity] = await Promise.all([
    fetchKpis(),
    fetchSlaWatch(),
    fetchEmailHealth(),
    fetchRecentActivity(),
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

        {/* ── Section 4: Recent activity feed ───────────────────────────────── */}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-neutral-500)] mb-3">
          {isAr ? 'آخر النشاطات (20 إدخال)' : 'Recent Activity (last 20)'}
        </h2>
        <div className="rounded-lg border border-[var(--color-neutral-200)] overflow-hidden">
          {recentActivity.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--color-neutral-500)] text-center">
              {isAr ? 'لا يوجد نشاط مؤخراً.' : 'No recent activity.'}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-neutral-100)]">
              {recentActivity.map((row) => {
                const meta        = ACTION_META[row.action] ?? {
                  ar: row.action, en: row.action,
                  pillClass: 'bg-neutral-100 text-neutral-700',
                  iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
                };
                const desc   = descriptionFromMetadata(row.action, row.metadata ?? {}, locale);
                const href   = targetLink(row.action, row.target_id, locale);
                const relTs  = relativeTime(row.created_at, locale);
                const absTs  = new Date(row.created_at).toLocaleString(
                  locale === 'ar' ? 'ar-AE' : 'en-GB',
                  { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
                );

                return (
                  <li
                    key={row.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-surface-low)] transition"
                  >
                    {/* Icon */}
                    <span className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${meta.pillClass}`}>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d={meta.iconPath} />
                      </svg>
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${meta.pillClass}`}>
                          {isAr ? meta.ar : meta.en}
                        </span>
                        {href && (
                          <Link
                            href={href}
                            className="text-xs text-[var(--color-primary)] underline underline-offset-2 hover:opacity-80 min-h-[44px] inline-flex items-center"
                          >
                            {isAr ? 'عرض' : 'View'}
                          </Link>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-neutral-900)] truncate">
                        <span className="font-medium">{row.actor_name ?? row.actor_email}</span>
                        {row.actor_name && (
                          <span className="text-[var(--color-neutral-500)] text-xs ms-1">({row.actor_email})</span>
                        )}
                      </p>
                      {desc && (
                        <p className="mt-0.5 text-xs text-[var(--color-neutral-500)] truncate">{desc}</p>
                      )}
                    </div>

                    {/* Timestamp */}
                    <time
                      dateTime={row.created_at}
                      title={absTs}
                      className="flex-shrink-0 text-xs text-[var(--color-neutral-400)] whitespace-nowrap pt-1"
                    >
                      {relTs}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

      </Section>
    </main>
  );
}
