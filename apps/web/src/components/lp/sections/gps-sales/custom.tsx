/**
 * Wave 15 Phase 2 Session 1 — extracted from gps-sales-renderer.tsx.
 * Custom / fallback. Also doubles as the lead-form anchor surface.
 */

import { RichContent } from '@kunacademy/ui/rich-editor';
import { LpLeadForm } from '../../lp-lead-form';
import type { SectionProps } from './_shared';

export function GpsCustomSection({
  section,
  isAr,
  slug,
  locale,
  leadCaptureConfig,
  conversionEventName,
}: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  const body = isAr ? section.body_ar : section.body_en;
  const bodyRich = isAr ? section.body_ar_rich : section.body_en_rich;

  // If this custom section is the lead-form anchor, render the form inside a
  // sales-pack-themed wrapper.
  if (section.anchor_id === 'lead-form' && leadCaptureConfig?.enabled) {
    return (
      <section className="gps-lead-form-wrap" id="lead-form">
        <div className="gps-lead-form-inner">
          {title && <h2>{title}</h2>}
          {bodyRich && typeof bodyRich === 'object' ? (
            <div
              style={{
                textAlign: 'center',
                marginBottom: 32,
                color: 'var(--grey-mid)',
                lineHeight: 1.7,
              }}
            >
              <RichContent doc={bodyRich} />
            </div>
          ) : body ? (
            <p
              style={{
                textAlign: 'center',
                marginBottom: 32,
                color: 'var(--grey-mid)',
                lineHeight: 1.7,
              }}
            >
              {body}
            </p>
          ) : null}
          <LpLeadForm
            slug={slug}
            locale={locale}
            config={leadCaptureConfig}
            conversionEventName={conversionEventName}
          />
        </div>
      </section>
    );
  }

  return (
    <section
      className="gps-reframe"
      id={section.anchor_id}
      style={{ background: 'var(--ivory-warm)' }}
    >
      <div className="gps-section-inner">
        {title && <h2 className="gps-reframe-headline">{title}</h2>}
        {bodyRich && typeof bodyRich === 'object' ? (
          <div className="gps-reframe-body">
            <RichContent doc={bodyRich} />
          </div>
        ) : body ? (
          body.split(/\n\n+/).map((para, i) => (
            <p key={i} className="gps-reframe-body">
              {para}
            </p>
          ))
        ) : null}
      </div>
    </section>
  );
}
