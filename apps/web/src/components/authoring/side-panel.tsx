/**
 * Wave 15 Wave 3 — Side panel (right rail).
 *
 * Per Hakawati §6.3:
 *   1. Header strip (48px): section type + provenance badge + agent accent
 *   2. Locale tabs (40px): العربية / English / Both
 *   3. Field groups: Wave 14b S2 form components reused 1:1 for LP types;
 *                    generic universal forms for the 8 universal types
 *   4. Footer (sticky 64px): Delete · Duplicate · (Lint status pill)
 *
 * Carry-forward integrity: the LP `forms/{type}-form.tsx` files are imported
 * verbatim from `apps/web/src/components/admin/lp-editor/forms/` — they are
 * NOT moved or modified in Wave 3 (per spec §3b — movement happens in Wave 4
 * after the 7-day clean canary window).
 */

'use client';

import { useState, type ReactNode } from 'react';
import type { LpSection } from '@/lib/lp/composition-types';
import { VOCAB_BY_ID, LP_TYPE_DESCRIPTIONS } from '@/lib/authoring/section-vocabulary';
import { SECTION_TYPE_LABELS } from '../admin/lp-editor/_shared';
import { MirrorForm } from '../admin/lp-editor/forms/mirror-form';
import { ReframeForm } from '../admin/lp-editor/forms/reframe-form';
import { DescriptionForm } from '../admin/lp-editor/forms/description-form';
import { BenefitsForm } from '../admin/lp-editor/forms/benefits-form';
import { CarryOutForm } from '../admin/lp-editor/forms/carry_out-form';
import { WhoForm } from '../admin/lp-editor/forms/who-form';
import { FormatPriceForm } from '../admin/lp-editor/forms/format-price-form';
import { GroupAlumniForm } from '../admin/lp-editor/forms/group_alumni-form';
import { CredibilityForm } from '../admin/lp-editor/forms/credibility-form';
import { ObjectionsFaqForm } from '../admin/lp-editor/forms/objections-faq-form';
import { CtaForm } from '../admin/lp-editor/forms/cta-form';
import { CustomForm } from '../admin/lp-editor/forms/custom-form';
import { UniversalSectionForm } from './universal-section-form';
import type { AgentIdentity } from './page-tree';

export type LocaleMode = 'ar' | 'en' | 'both';

interface SidePanelProps {
  section: LpSection | null;
  sectionIndex: number | null;
  onChange: (next: LpSection) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  /** Locale this admin is currently authoring in (canvas-mirrored). */
  canvasLocale: 'ar' | 'en';
  locale: string;
  /** Agent provenance for the current section, if any. */
  provenance?: { agent: AgentIdentity; whenISO: string | null } | null;
  /** Lint violations attributable to this section (filtered by path). */
  lintViolations?: Array<{ rule_id: string; severity: string; message: string; path: string }>;
  /** Current page-level lint state. */
  lintHardBlock?: boolean;
}

const AGENT_ACCENT_BORDER: Record<AgentIdentity, string> = {
  human: 'transparent',
  hakima: '#82C4E8',
  shahira: '#F47E42',
  hakawati: '#474099',
  nashit: '#2C2C2D',
  sani: '#82C4E8',
  amin: '#F47E42', // bordered, not filled
  rafik: '#474099',
};

const AGENT_LABEL_AR: Record<AgentIdentity, string> = {
  human: 'مسؤول',
  hakima: 'حكيمة',
  shahira: 'شهيرة',
  hakawati: 'حكواتي',
  nashit: 'نشيط',
  sani: 'صانع',
  amin: 'أمين',
  rafik: 'رفيق',
};

const AGENT_LABEL_EN: Record<AgentIdentity, string> = {
  human: 'Admin',
  hakima: 'Hakima',
  shahira: 'Shahira',
  hakawati: 'Hakawati',
  nashit: 'Nashit',
  sani: 'Sani',
  amin: 'Amin',
  rafik: 'Rafik',
};

export function SidePanel({
  section,
  sectionIndex,
  onChange,
  onDelete,
  onDuplicate,
  canvasLocale,
  locale,
  provenance,
  lintViolations = [],
  lintHardBlock = false,
}: SidePanelProps) {
  const isAr = locale === 'ar';

  // Locale mode — initialized to canvas locale; sticky during the panel session.
  const [localeMode, setLocaleMode] = useState<LocaleMode>(canvasLocale);

  if (!section || sectionIndex === null) {
    return (
      <PanelShell isAr={isAr}>
        <div className="p-6 text-center text-sm text-[var(--color-neutral-500)]">
          {isAr
            ? 'اختر قسمًا من القائمة على اليسار للتحرير، أو اضغط «إضافة قسم» لإنشاء قسم جديد.'
            : 'Select a section from the left to edit, or click "+ Add section" to create one.'}
        </div>
      </PanelShell>
    );
  }

  const universal = VOCAB_BY_ID[section.type];
  const lpDesc = LP_TYPE_DESCRIPTIONS[section.type as keyof typeof LP_TYPE_DESCRIPTIONS];
  const lpLabel = SECTION_TYPE_LABELS[section.type];
  const label = universal
    ? isAr ? universal.label_ar : universal.label_en
    : lpDesc
    ? isAr ? lpDesc.label_ar : lpDesc.label_en
    : lpLabel
    ? isAr ? lpLabel.ar : lpLabel.en
    : section.type;
  const description = universal
    ? isAr ? universal.description_ar : universal.description_en
    : lpDesc
    ? isAr ? lpDesc.description_ar : lpDesc.description_en
    : null;
  const icon = universal?.icon ?? lpDesc?.icon ?? '▢';

  const accentColor = provenance ? AGENT_ACCENT_BORDER[provenance.agent] : 'transparent';
  const showAccent = provenance && provenance.agent !== 'human';
  const agentName = provenance
    ? isAr ? AGENT_LABEL_AR[provenance.agent] : AGENT_LABEL_EN[provenance.agent]
    : null;

  // Filter violations to those targeting fields under composition_json.sections[idx].*
  const sectionViolations = lintViolations.filter((v) =>
    v.path.includes(`composition_json.sections[${sectionIndex}]`),
  );

  return (
    <PanelShell isAr={isAr}>
      {/* Header strip (48px) — accent stripe on left + section type + provenance */}
      <div
        className="flex items-stretch gap-0 border-b border-[var(--color-neutral-200)] bg-[var(--color-surface,#FFF5E9)]/40"
        style={{ minHeight: 48 }}
      >
        <div
          aria-hidden
          className="w-[3px]"
          style={{
            background: showAccent ? accentColor : 'transparent',
          }}
        />
        <div className="flex-1 flex items-start gap-2 px-3 py-2 min-w-0">
          <span aria-hidden className="text-base leading-none shrink-0 mt-0.5">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-neutral-600)]">
              {label}
              <span className="text-[var(--color-neutral-400)] ms-1.5 font-mono normal-case">
                #{sectionIndex + 1}
              </span>
            </div>
            {description && (
              <div className="text-[11px] leading-snug text-[var(--color-neutral-500)] mt-0.5">
                {description}
              </div>
            )}
            {provenance && agentName && (
              <div className="text-[11px] text-[var(--color-neutral-500)] mt-0.5 truncate">
                {isAr
                  ? `بقلم ${agentName}${provenance.whenISO ? ` · ${formatProvenanceTime(provenance.whenISO, isAr)}` : ''}`
                  : `by ${agentName}${provenance.whenISO ? ` · ${formatProvenanceTime(provenance.whenISO, isAr)}` : ''}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Locale tabs (40px) */}
      <div
        role="tablist"
        aria-label={isAr ? 'لغة التحرير' : 'Editing locale'}
        className="flex items-center border-b border-[var(--color-neutral-200)] bg-white px-2"
        style={{ minHeight: 40 }}
      >
        {(['ar', 'en', 'both'] as LocaleMode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={localeMode === m}
            onClick={() => setLocaleMode(m)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors rounded-md ${
              localeMode === m
                ? 'bg-[var(--color-neutral-100)] text-[var(--text-primary)]'
                : 'text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]'
            }`}
          >
            {m === 'ar' ? 'العربية' : m === 'en' ? 'English' : isAr ? 'الاثنتان' : 'Both'}
          </button>
        ))}
      </div>

      {/* Lint banner — section-level violations from the most recent
          publish/review attempt. Surfaced per spec §3f. */}
      {sectionViolations.length > 0 && (
        <div
          className="bg-[#FEF2F2] border-b border-[#FCA5A5] px-3 py-2 text-xs text-[#991B1B]"
          role="alert"
        >
          <div className="font-semibold mb-1">
            {isAr
              ? `❗ ${sectionViolations.length} ${sectionViolations.length === 1 ? 'تنبيه فحص' : 'تنبيهات فحص'}`
              : `❗ ${sectionViolations.length} lint violation${sectionViolations.length === 1 ? '' : 's'} on this section`}
          </div>
          <ul className="space-y-1">
            {sectionViolations.slice(0, 3).map((v, i) => (
              <li key={i} className="leading-snug">
                <span className="font-mono text-[10px] bg-white/60 px-1.5 py-0.5 rounded me-1">
                  {v.rule_id}
                </span>
                {v.message}
              </li>
            ))}
            {sectionViolations.length > 3 && (
              <li className="text-[#7F1D1D] italic">
                {isAr
                  ? `+ ${sectionViolations.length - 3} أخرى…`
                  : `+ ${sectionViolations.length - 3} more…`}
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Field groups — render the per-type form, locale-mode applied via
          panel chrome (the form components themselves remain locale-naive). */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        <FormDispatcher section={section} onChange={onChange} locale={locale} localeMode={localeMode} />
      </div>

      {/* Footer (sticky) */}
      <div
        className="border-t border-[var(--color-neutral-200)] bg-white px-3 py-2 flex items-center justify-between flex-wrap gap-2 sticky bottom-0"
        style={{ minHeight: 64 }}
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDuplicate}
            className="rounded-lg border border-[var(--color-neutral-300)] px-3 py-1.5 text-sm text-[var(--color-neutral-700)] hover:border-[var(--color-primary)]"
          >
            {isAr ? 'مضاعفة' : 'Duplicate'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
          >
            {isAr ? 'حذف' : 'Delete'}
          </button>
        </div>
        {lintHardBlock && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-medium text-red-800">
            {isAr ? '⛔ النشر محظور' : '⛔ Publish blocked'}
          </span>
        )}
      </div>
    </PanelShell>
  );
}

function PanelShell({ isAr, children }: { isAr: boolean; children: ReactNode }) {
  // Wave 15 W3 canary v2 (Issue 5A): widened to ~1/3 of viewport on desktop
  // (was 420px fixed). Stage takes 2/3, panel takes 1/3 — matches WP fullscreen
  // editor proportions. Min-width 360px keeps BilingualRichEditor readable.
  return (
    <section
      className="hidden md:flex md:flex-col md:basis-1/3 md:max-w-[520px] md:min-w-[360px] md:shrink-0 md:border-s md:border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]"
      aria-label={isAr ? 'لوحة التحرير' : 'Editing panel'}
    >
      {children}
    </section>
  );
}

function FormDispatcher({
  section,
  onChange,
  locale,
  localeMode,
}: {
  section: LpSection;
  onChange: (next: LpSection) => void;
  locale: string;
  localeMode: LocaleMode;
}) {
  // LP forms (Wave 14b S2 carry-forward) — locale-naive; ignore localeMode.
  switch (section.type) {
    case 'mirror':
      return <MirrorForm section={section} onChange={onChange} locale={locale} inModal />;
    case 'reframe':
      return <ReframeForm section={section} onChange={onChange} locale={locale} inModal />;
    case 'description':
      return <DescriptionForm section={section} onChange={onChange} locale={locale} inModal />;
    case 'benefits':
      return <BenefitsForm section={section} onChange={onChange} locale={locale} inModal />;
    case 'carry_out':
      return <CarryOutForm section={section} onChange={onChange} locale={locale} inModal />;
    case 'who_for':
    case 'who_not_for':
      return <WhoForm section={section} onChange={onChange} locale={locale} inModal />;
    case 'format':
    case 'price':
      return <FormatPriceForm section={section} onChange={onChange} locale={locale} inModal />;
    case 'group_alumni':
      return <GroupAlumniForm section={section} onChange={onChange} locale={locale} inModal />;
    case 'credibility':
      return <CredibilityForm section={section} onChange={onChange} locale={locale} inModal />;
    case 'objections':
    case 'faq':
      return <ObjectionsFaqForm section={section} onChange={onChange} locale={locale} inModal />;
    case 'cta':
      return <CtaForm section={section} onChange={onChange} locale={locale} inModal />;
    case 'custom':
      return <CustomForm section={section} onChange={onChange} locale={locale} inModal />;
    default:
      // Universal types (header / body / image / video / quote / divider) +
      // any unrecognized type — fall through to the generic universal form.
      return (
        <UniversalSectionForm
          section={section}
          onChange={onChange}
          locale={locale}
          localeMode={localeMode}
        />
      );
  }
}

function formatProvenanceTime(iso: string, isAr: boolean): string {
  try {
    const t = new Date(iso);
    const diff = Math.max(0, Math.floor((Date.now() - t.getTime()) / 60000));
    if (diff < 1) return isAr ? 'الآن' : 'just now';
    if (diff < 60) return isAr ? `قبل ${diff} د` : `${diff}m ago`;
    const h = Math.floor(diff / 60);
    if (h < 24) return isAr ? `قبل ${h} س` : `${h}h ago`;
    const d = Math.floor(h / 24);
    return isAr ? `قبل ${d} يوم` : `${d}d ago`;
  } catch {
    return iso;
  }
}
