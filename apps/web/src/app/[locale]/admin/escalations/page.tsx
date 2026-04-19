'use client';

/**
 * /[locale]/admin/escalations
 *
 * Lists all assessments pending review or escalated.
 * Auth: admin, super_admin, mentor_manager (enforced by middleware + server session check).
 *
 * Filters (client-side URL params, server-rendered via fetch):
 *   ?status=pending|under_review|pass|fail
 *   ?assessor_id=<uuid>
 *   ?needs_second_opinion=1
 *
 * M5 — Mentor-manager escalation review UI
 * M5-gap2-fix — surface pending second-opinion queue (chip + badge + counter)
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@kunacademy/auth';
import { Section } from '@kunacademy/ui/section';
import { Heading } from '@kunacademy/ui/heading';

// ── Types ──────────────────────────────────────────────────────────────────────

interface EscalationItem {
  assessment_id: string;
  decision: string;
  decided_at: string | null;
  assigned_at: string;
  escalated_at: string | null;
  second_opinion_requested_at: string | null;
  ethics_auto_failed: boolean;
  override_reason: string | null;
  recording_id: string;
  package_instance_id: string;
  submitted_at: string;
  original_filename: string;
  student_name: string | null;
  student_email: string;
  assessor_name: string | null;
  assessor_email: string;
}

// ── Decision badge helpers ─────────────────────────────────────────────────────

const decisionBadge: Record<string, { label: { ar: string; en: string }; cls: string }> = {
  pending:      { label: { ar: 'قيد المراجعة', en: 'Pending' },      cls: 'bg-yellow-100 text-yellow-800' },
  pass:         { label: { ar: 'ناجح',          en: 'Pass'    },      cls: 'bg-green-100  text-green-800'  },
  fail:         { label: { ar: 'راسب',           en: 'Fail'   },      cls: 'bg-red-100    text-red-800'    },
  under_review: { label: { ar: 'تحت الفحص',     en: 'Under Review' }, cls: 'bg-blue-100   text-blue-800'   },
};

function DecisionBadge({ decision, isAr }: { decision: string; isAr: boolean }) {
  const meta = decisionBadge[decision] ?? { label: { ar: decision, en: decision }, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
      {isAr ? meta.label.ar : meta.label.en}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function EscalationsPage() {
  const { locale } = useParams<{ locale: string }>();
  const isAr = locale === 'ar';
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [items, setItems]       = useState<EscalationItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  // Second-opinion filter — separate from status filter
  const [secondOpinionFilter, setSecondOpinionFilter] = useState(
    searchParams.get('needs_second_opinion') === '1'
  );
  // Counter for pending second opinions (fetched independently)
  const [secondOpinionCount, setSecondOpinionCount] = useState(0);

  // ── Fetch second-opinion counter ───────────────────────────────────────────

  const fetchSecondOpinionCount = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/assessments?needs_second_opinion=1&limit=200');
      if (!res.ok) return;
      const data = await res.json() as { assessments?: EscalationItem[] };
      setSecondOpinionCount((data.assessments ?? []).length);
    } catch {
      // Non-critical — counter is informational only
    }
  }, []);

  // ── Fetch escalation list ──────────────────────────────────────────────────

  const fetchEscalations = useCallback(async (status: string, needsSecondOpinion: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (needsSecondOpinion) {
        params.set('needs_second_opinion', '1');
      } else if (status) {
        params.set('status', status);
      }
      params.set('limit', '100');
      const res = await fetch(`/api/admin/assessments?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { assessments?: EscalationItem[] };
      setItems(data.assessments ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEscalations(statusFilter, secondOpinionFilter);
  }, [statusFilter, secondOpinionFilter, fetchEscalations]);

  useEffect(() => {
    fetchSecondOpinionCount();
  }, [fetchSecondOpinionCount]);

  // ── Auth guard ─────────────────────────────────────────────────────────────

  if (!authLoading) {
    const role = (user as { role?: string } | null)?.role;
    const allowed = role === 'admin' || role === 'super_admin' || role === 'mentor_manager';
    if (!user || !allowed) {
      router.replace(`/${locale}/dashboard`);
      return null;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const handleSecondOpinionChip = () => {
    if (secondOpinionFilter) {
      // Deactivate — go back to default view
      setSecondOpinionFilter(false);
      setStatusFilter('');
    } else {
      setSecondOpinionFilter(true);
      setStatusFilter('');
    }
  };

  const handleStatusChip = (s: string) => {
    setSecondOpinionFilter(false);
    setStatusFilter(s);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const dir = isAr ? 'rtl' : 'ltr';

  return (
    <main dir={dir}>
      <Section variant="white">

        {/* ── Second-opinion counter banner (only visible when count > 0) ── */}
        {secondOpinionCount > 0 && (
          <button
            onClick={handleSecondOpinionChip}
            className="w-full mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 font-medium flex items-center justify-between hover:bg-amber-100 transition"
          >
            <span>
              {isAr
                ? `${secondOpinionCount} تقييم بانتظار رأي ثانٍ`
                : `${secondOpinionCount} assessment${secondOpinionCount === 1 ? '' : 's'} awaiting second opinion`}
            </span>
            <span className="text-xs opacity-70">
              {isAr ? 'انقر للتصفية' : 'Click to filter'}
            </span>
          </button>
        )}

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <Heading level={1}>
            {isAr ? 'مراجعة التقييمات المُصعَّدة' : 'Escalation Review'}
          </Heading>
          <div className="flex gap-2 flex-wrap">
            {/* Status filter chips */}
            {(['', 'pending', 'pass', 'fail'] as const).map((s) => {
              const labels: Record<string, { ar: string; en: string }> = {
                '':       { ar: 'الكل',           en: 'All'          },
                pending:  { ar: 'قيد المراجعة',   en: 'Pending'      },
                pass:     { ar: 'ناجح',            en: 'Pass'         },
                fail:     { ar: 'راسب',            en: 'Fail'         },
              };
              const active = !secondOpinionFilter && statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => handleStatusChip(s)}
                  className={`min-h-[44px] px-3 py-1.5 rounded-md border text-sm font-medium transition
                    ${active
                      ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                      : 'bg-white text-[var(--color-neutral-700)] border-[var(--color-neutral-300)] hover:border-[var(--color-primary)]'
                    }`}
                >
                  {isAr ? labels[s].ar : labels[s].en}
                </button>
              );
            })}

            {/* Second-opinion filter chip */}
            <button
              onClick={handleSecondOpinionChip}
              className={`min-h-[44px] px-3 py-1.5 rounded-md border text-sm font-medium transition
                ${secondOpinionFilter
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-amber-700 border-amber-300 hover:border-amber-500'
                }`}
            >
              {isAr ? 'رأي ثانٍ مطلوب' : 'Second Opinion Requested'}
              {secondOpinionCount > 0 && (
                <span className={`ms-1.5 inline-flex items-center justify-center rounded-full w-5 h-5 text-xs font-bold
                  ${secondOpinionFilter ? 'bg-white text-amber-700' : 'bg-amber-100 text-amber-700'}`}>
                  {secondOpinionCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {loading && (
          <p className="text-[var(--color-neutral-500)] text-sm py-8 text-center">
            {isAr ? 'جارٍ التحميل...' : 'Loading...'}
          </p>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="text-[var(--color-neutral-500)] text-sm py-8 text-center">
            {isAr ? 'لا توجد تقييمات تحت هذا الفلتر.' : 'No assessments match this filter.'}
          </p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-neutral-200)] text-[var(--color-neutral-500)] text-xs uppercase tracking-wide">
                  <th className="py-3 px-4 text-start font-medium">
                    {isAr ? 'الطالب' : 'Student'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium">
                    {isAr ? 'المُقيِّم' : 'Assessor'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium">
                    {isAr ? 'القرار' : 'Decision'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium">
                    {isAr ? 'تاريخ الإرسال' : 'Submitted'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium">
                    {isAr ? 'علامات' : 'Flags'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium">
                    {isAr ? 'الإجراء' : 'Action'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.assessment_id}
                    className={`border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-surface-dim)] transition
                      ${item.second_opinion_requested_at ? 'bg-amber-50/40' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-[var(--color-neutral-900)]">
                        {item.student_name ?? item.student_email}
                      </div>
                      <div className="text-xs text-[var(--color-neutral-500)]">{item.student_email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div>{item.assessor_name ?? item.assessor_email}</div>
                      <div className="text-xs text-[var(--color-neutral-500)]">{item.assessor_email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <DecisionBadge decision={item.decision} isAr={isAr} />
                    </td>
                    <td className="py-3 px-4 text-[var(--color-neutral-600)]">
                      {new Date(item.submitted_at).toLocaleDateString(isAr ? 'ar-AE' : 'en-GB')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {item.ethics_auto_failed && (
                          <span className="inline-block rounded px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700">
                            {isAr ? 'أخلاقي' : 'Ethics'}
                          </span>
                        )}
                        {item.escalated_at && (
                          <span className="inline-block rounded px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700">
                            {isAr ? 'مُصعَّد' : 'Escalated'}
                          </span>
                        )}
                        {/* Second-opinion badge with timestamp */}
                        {item.second_opinion_requested_at && (
                          <span className="inline-flex flex-col rounded px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 font-medium">
                            <span>{isAr ? '⚠ رأي ثانٍ مطلوب' : '⚠ Needs 2nd Opinion'}</span>
                            <span className="text-[10px] font-normal opacity-70 mt-0.5">
                              {new Date(item.second_opinion_requested_at).toLocaleDateString(
                                isAr ? 'ar-AE' : 'en-GB',
                                { day: 'numeric', month: 'short', year: 'numeric' }
                              )}
                            </span>
                          </span>
                        )}
                        {item.override_reason && (
                          <span className="inline-block rounded px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700">
                            {isAr ? 'مُعدَّل' : 'Overridden'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() =>
                          router.push(`/${locale}/admin/escalations/${item.assessment_id}`)
                        }
                        className="min-h-[44px] px-3 py-1.5 rounded-md border border-[var(--color-primary)] text-[var(--color-primary)] text-sm font-medium hover:bg-[var(--color-primary)] hover:text-white transition"
                      >
                        {isAr ? 'فتح' : 'Open'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </main>
  );
}
