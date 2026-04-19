'use client';

/**
 * JourneyTimeline — Student journey event timeline.
 *
 * Fetches GET /api/packages/[instanceId]/journey-timeline and renders
 * a vertical left-anchored dot timeline with:
 *   - Relative date + absolute date tooltip
 *   - Bilingual action labels (Arabic RTL / English LTR)
 *   - Optional override reason metadata (sanitized to 200 chars by API)
 *   - "Show earlier events" collapse for events beyond the first 3
 *
 * Privacy: mentor_manager identity is never shown; they appear as "Mentor manager".
 *
 * Sub-phase: S2-Layer-1 / 2.9 — Student Journey Timeline
 */

import { useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface JourneyEvent {
  id: string;
  event_type: 'audit' | 'recording';
  action: string;
  occurred_at: string;
  override_reason?: string;
}

interface JourneyTimelineProps {
  instanceId: string;
  locale: string;
}

// ── Bilingual action labels ───────────────────────────────────────────────────

const ACTION_LABELS: Record<string, { en: string; ar: string }> = {
  ENROLLED: {
    en: 'Enrolled in package',
    ar: 'تم التسجيل في الباقة',
  },
  RECORDING_SUBMITTED: {
    en: 'Recording submitted',
    ar: 'تم رفع التسجيل',
  },
  SUBMIT_ASSESSMENT: {
    en: 'Assessment submitted',
    ar: 'تم إرسال التقييم',
  },
  PAUSE_JOURNEY: {
    en: 'Journey paused',
    ar: 'تم إيقاف الرحلة مؤقتاً',
  },
  UNPAUSE_JOURNEY: {
    en: 'Journey unpaused',
    ar: 'تمت إعادة تفعيل الرحلة',
  },
  OVERRIDE_ASSESSMENT_DECISION: {
    en: 'Decision updated by mentor manager',
    ar: 'قرار محدّث من قبل مدير المرشدين',
  },
  OVERRIDE_AUTO_UNPAUSE: {
    en: 'Auto-unpause after override',
    ar: 'تفعيل تلقائي بعد التحديث',
  },
};

function getLabel(action: string, isAr: boolean): string {
  const entry = ACTION_LABELS[action];
  if (!entry) return action;
  return isAr ? entry.ar : entry.en;
}

// ── Dot colours per action ────────────────────────────────────────────────────

function getDotColor(action: string): string {
  switch (action) {
    case 'ENROLLED':
      return 'bg-[var(--color-primary)]';
    case 'RECORDING_SUBMITTED':
      return 'bg-blue-500';
    case 'SUBMIT_ASSESSMENT':
      return 'bg-blue-600';
    case 'PAUSE_JOURNEY':
      return 'bg-purple-500';
    case 'UNPAUSE_JOURNEY':
      return 'bg-green-500';
    case 'OVERRIDE_ASSESSMENT_DECISION':
      return 'bg-amber-500';
    case 'OVERRIDE_AUTO_UNPAUSE':
      return 'bg-green-400';
    default:
      return 'bg-[var(--color-neutral-400)]';
  }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function relativeDate(isoString: string, locale: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return locale === 'ar' ? 'اليوم' : 'Today';
  if (diffDays === 1) return locale === 'ar' ? 'أمس' : 'Yesterday';
  if (diffDays < 7) {
    return locale === 'ar'
      ? `منذ ${diffDays} أيام`
      : `${diffDays} days ago`;
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return locale === 'ar'
      ? `منذ ${weeks} أسابيع`
      : `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  return absoluteDate(isoString, locale);
}

function absoluteDate(isoString: string, locale: string): string {
  return new Date(isoString).toLocaleDateString(
    locale === 'ar' ? 'ar-SA' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );
}

// ── Single event row ──────────────────────────────────────────────────────────

interface EventRowProps {
  event: JourneyEvent;
  isAr: boolean;
  isLast: boolean;
}

function EventRow({ event, isAr, isLast }: EventRowProps) {
  const label = getLabel(event.action, isAr);
  const dot = getDotColor(event.action);
  const rel = relativeDate(event.occurred_at, isAr ? 'ar' : 'en');
  const abs = absoluteDate(event.occurred_at, isAr ? 'ar' : 'en');

  return (
    <div className="flex gap-3 group">
      {/* Left: dot + connector line */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`mt-1 h-3 w-3 rounded-full ring-2 ring-white ${dot}`} />
        {!isLast && (
          <div className="mt-1 flex-1 w-px bg-[var(--color-neutral-200)]" />
        )}
      </div>

      {/* Right: content */}
      <div className={`pb-5 min-w-0 ${isLast ? '' : ''}`}>
        {/* Label */}
        <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">
          {label}
        </p>

        {/* Date: relative shown, absolute on hover via title attr */}
        <p
          className="mt-0.5 text-xs text-[var(--color-neutral-500)] cursor-default"
          title={abs}
        >
          {rel}
        </p>

        {/* Optional override reason */}
        {event.override_reason && (
          <div className="mt-1.5 rounded-md border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 leading-relaxed break-words">
            {isAr ? 'السبب: ' : 'Reason: '}
            <span>{event.override_reason}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const INITIAL_VISIBLE = 3;

export function JourneyTimeline({ instanceId, locale }: JourneyTimelineProps) {
  const isAr = locale === 'ar';
  const [events, setEvents] = useState<JourneyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!instanceId) return;
    fetch(`/api/packages/${instanceId}/journey-timeline`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { events: JourneyEvent[] } | null) => {
        if (d?.events) setEvents(d.events);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [instanceId]);

  // Don't render if no events (or only 1 — the enrolled synthetic event alone is not useful enough)
  if (loading || events.length < 2) return null;

  const hasCollapsed = events.length > INITIAL_VISIBLE;
  const visible = expanded || !hasCollapsed ? events : events.slice(events.length - INITIAL_VISIBLE);
  const hiddenCount = events.length - INITIAL_VISIBLE;

  return (
    <section
      dir={isAr ? 'rtl' : 'ltr'}
      aria-label={isAr ? 'مسار رحلتك' : 'Your journey timeline'}
    >
      <div className="rounded-xl border border-[var(--color-neutral-200)] bg-white p-5">
        <h2 className="mb-4 font-semibold text-[var(--text-primary)]">
          {isAr ? 'مسار رحلتك' : 'Your Journey'}
        </h2>

        {/* Collapsed older events */}
        {hasCollapsed && !expanded && (
          <div className={`mb-1 flex ${isAr ? 'justify-end' : 'justify-start'}`}>
            <button
              onClick={() => setExpanded(true)}
              className="text-xs font-medium text-[var(--color-primary)] hover:underline focus:outline-none min-h-[44px] px-1"
            >
              {isAr
                ? `عرض ${hiddenCount} أحداث سابقة`
                : `Show ${hiddenCount} earlier event${hiddenCount > 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {/* Timeline rows */}
        <div>
          {visible.map((event, i) => (
            <EventRow
              key={event.id}
              event={event}
              isAr={isAr}
              isLast={i === visible.length - 1}
            />
          ))}
        </div>

        {/* Collapse again */}
        {hasCollapsed && expanded && (
          <div className={`mt-1 flex ${isAr ? 'justify-end' : 'justify-start'}`}>
            <button
              onClick={() => setExpanded(false)}
              className="text-xs text-[var(--color-neutral-500)] hover:underline focus:outline-none min-h-[44px] px-1"
            >
              {isAr ? 'إخفاء الأحداث القديمة' : 'Hide earlier events'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
