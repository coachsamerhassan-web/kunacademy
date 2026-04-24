import type {
  LpComposition,
  LpHero,
  LpSection,
  LpLeadCaptureConfig,
  LpAnalyticsConfig,
} from '@/lib/lp/composition-types';
import { LpLeadForm } from '../lp-lead-form';
import './gps-sales.css';

interface LpGpsSalesRendererProps {
  slug: string;
  locale: string;
  composition: LpComposition;
  leadCaptureConfig?: LpLeadCaptureConfig | null;
  analyticsConfig?: LpAnalyticsConfig | null;
}

/**
 * GPS-Sales theme renderer — mirrors Hakawati's GPS-of-Life sales-pack PDF
 * design for web. 16 section types, midnight-navy + gold palette.
 *
 * Source: /Users/samer/Claude Code/Workspace/CCD/output/GPS-of-Life-sales-pack/GPS-AR-Egypt.html
 *
 * Activation: composition.theme === 'gps-sales'. Every rule in gps-sales.css
 * is scoped under [data-lp-theme="gps-sales"] so this theme cannot leak.
 *
 * Per-variant font routing via [data-lp-variant]:
 *   - 'egypt' → Cairo
 *   - 'gulf'  → Tajawal
 *   - (EN)    → DM Sans / DM Serif Display (auto via [lang="en"])
 *
 * Font loading: Google Fonts link is injected on the page via next/font or
 * <link> at layout level. This renderer does NOT import fonts itself — it
 * declares them in CSS via the `--lp-font-*` custom properties.
 */
export function LpGpsSalesRenderer({
  slug,
  locale,
  composition,
  leadCaptureConfig,
  analyticsConfig,
}: LpGpsSalesRendererProps) {
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const variant = composition.variant || (isAr ? 'egypt' : 'default');
  const conversionEventName = analyticsConfig?.conversion_event_name || 'lp_lead_submit';

  return (
    <>
      {/* Google Fonts — loaded inline since this theme needs variant-specific
          families the site-wide layout doesn't ship. preconnect via `<link>`
          inside main is safe in Next.js App Router. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href={
          isAr
            ? 'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;900&family=Tajawal:wght@300;400;500;700;900&display=swap'
            : 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=DM+Serif+Display:ital@0;1&display=swap'
        }
      />
      <main
        dir={dir}
        lang={isAr ? 'ar' : 'en'}
        data-lp-theme="gps-sales"
        data-lp-variant={variant}
      >
        {composition.hero && <GpsHero hero={composition.hero} isAr={isAr} />}

        {composition.sections?.map((section, i) => (
          <GpsSection
            key={`gps-section-${i}`}
            section={section}
            isAr={isAr}
            slug={slug}
            locale={locale}
            leadCaptureConfig={leadCaptureConfig ?? null}
            conversionEventName={conversionEventName}
          />
        ))}

        {leadCaptureConfig?.enabled &&
          !composition.sections?.some((s) => s.anchor_id === 'lead-form') && (
            <section id="lead-form" className="gps-lead-form-wrap">
              <div className="gps-lead-form-inner">
                <h2>{isAr ? 'سجّل اهتمامك' : 'Register your interest'}</h2>
                <LpLeadForm
                  slug={slug}
                  locale={locale}
                  config={leadCaptureConfig}
                  conversionEventName={conversionEventName}
                />
              </div>
            </section>
          )}
      </main>
    </>
  );
}

// ── Flower-of-life watermark (SVG, CSS-scoped, reused across dark sections) ─
function GpsGeoWatermark() {
  return (
    <div className="gps-geo-watermark" aria-hidden="true">
      <svg
        viewBox="0 0 800 800"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="gps-geo" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
            <circle cx="80" cy="80" r="46" fill="none" stroke="#C9963A" strokeWidth="0.8" />
            <circle cx="80" cy="34" r="46" fill="none" stroke="#C9963A" strokeWidth="0.8" />
            <circle cx="80" cy="126" r="46" fill="none" stroke="#C9963A" strokeWidth="0.8" />
            <circle cx="120" cy="57" r="46" fill="none" stroke="#C9963A" strokeWidth="0.8" />
            <circle cx="40" cy="57" r="46" fill="none" stroke="#C9963A" strokeWidth="0.8" />
            <circle cx="120" cy="103" r="46" fill="none" stroke="#C9963A" strokeWidth="0.8" />
            <circle cx="40" cy="103" r="46" fill="none" stroke="#C9963A" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="800" height="800" fill="url(#gps-geo)" />
      </svg>
    </div>
  );
}

// ── Hero (cover) ───────────────────────────────────────────────────────────
function GpsHero({ hero, isAr }: { hero: LpHero; isAr: boolean }) {
  const layout = hero.layout || 'gps-cover';
  const eyebrow = isAr ? hero.eyebrow_ar : hero.eyebrow_en;
  const headline = isAr ? hero.headline_ar : hero.headline_en;
  const subheadline = isAr ? hero.subheadline_ar : hero.subheadline_en;
  const hook = isAr ? hero.hook_ar : hero.hook_en;
  const date = isAr ? hero.footer_date_ar : hero.footer_date_en;
  const dateSub = isAr
    ? hero.footer_date_subtext_ar
    : hero.footer_date_subtext_en;
  const badge = isAr ? hero.footer_badge_ar : hero.footer_badge_en;
  const brand = isAr ? hero.brand_mark_ar : hero.brand_mark_en;
  const brandSub = isAr ? hero.brand_mark_sub_ar : hero.brand_mark_sub_en;

  // Render headline with optional accent span
  const renderHeadline = () => {
    if (!headline) return null;
    if (hero.headline_accent && headline.includes(hero.headline_accent)) {
      const parts = headline.split(hero.headline_accent);
      return (
        <h1 className="gps-cover-title">
          {parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < parts.length - 1 && (
                <span className="gps-accent">{hero.headline_accent}</span>
              )}
            </span>
          ))}
        </h1>
      );
    }
    return <h1 className="gps-cover-title">{headline}</h1>;
  };

  // Only gps-cover layout implemented for this theme; fall through to a plain
  // hero if a future layout variant is passed that we don't yet render.
  if (layout !== 'gps-cover') {
    return (
      <section className="gps-cover">
        <div className="gps-cover-header">
          {headline && renderHeadline()}
          {subheadline && <p className="gps-cover-subtitle">{subheadline}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="gps-cover">
      <GpsGeoWatermark />
      <div className="gps-cover-header">
        {(brand || brandSub) && (
          <div className="gps-brand-mark">
            <div>
              {brand && <div className="gps-logo-text">{brand}</div>}
              {brandSub && <div className="gps-logo-sub">{brandSub}</div>}
            </div>
          </div>
        )}
        {eyebrow && <div className="gps-cover-eyebrow">{eyebrow}</div>}
        {renderHeadline()}
        {subheadline && (
          <p
            className="gps-cover-subtitle"
            dangerouslySetInnerHTML={{ __html: subheadline.replace(/\n/g, '<br/>') }}
          />
        )}
        <div className="gps-cover-divider" />
        {hook && (
          <div
            className="gps-cover-hook"
            dangerouslySetInnerHTML={{ __html: hook.replace(/\n/g, '<br/>') }}
          />
        )}
      </div>
      {(date || badge) && (
        <div className="gps-cover-footer">
          {(date || dateSub) && (
            <div className="gps-cover-date">
              {date}
              {dateSub && <span>{dateSub}</span>}
            </div>
          )}
          {badge && <div className="gps-cover-geo-badge">{badge}</div>}
        </div>
      )}
    </section>
  );
}

// ── Section dispatcher ────────────────────────────────────────────────────
function GpsSection({
  section,
  isAr,
  slug,
  locale,
  leadCaptureConfig,
  conversionEventName,
}: {
  section: LpSection;
  isAr: boolean;
  slug: string;
  locale: string;
  leadCaptureConfig: LpLeadCaptureConfig | null;
  conversionEventName: string;
}) {
  const Comp = SECTION_COMPONENTS[section.type] ?? GpsCustomSection;
  return (
    <Comp
      section={section}
      isAr={isAr}
      slug={slug}
      locale={locale}
      leadCaptureConfig={leadCaptureConfig}
      conversionEventName={conversionEventName}
    />
  );
}

interface SectionProps {
  section: LpSection;
  isAr: boolean;
  slug: string;
  locale: string;
  leadCaptureConfig: LpLeadCaptureConfig | null;
  conversionEventName: string;
}

// ── Mirror section (world-mirror data-lines OR four-mirrors cards) ─────────
function GpsMirrorSection({ section, isAr }: SectionProps) {
  const layout = section.layout || 'data-lines';
  const kicker = isAr ? section.kicker_ar : section.kicker_en;
  const title = isAr ? section.title_ar : section.title_en;
  const close = isAr ? section.close_ar : section.close_en;

  if (layout === 'cards') {
    return (
      <section className="gps-four-mirrors" id={section.anchor_id}>
        <div className="gps-section-inner">
          {kicker && <div className="gps-section-label">{kicker}</div>}
          {title && <h2 className="gps-mirrors-headline">{title}</h2>}
          {section.items?.map((item, i) => {
            const opener = isAr ? item.label_ar : item.label_en;
            const body = isAr ? item.body_ar : item.body_en;
            return (
              <div className="gps-mirror-card" key={i}>
                <p>
                  {opener && <span className="gps-opener">{opener}</span>}
                  {opener && body && ' '}
                  {body}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // Default: data-lines
  return (
    <section className="gps-world-mirror" id={section.anchor_id}>
      <GpsGeoWatermark />
      <div className="gps-section-inner">
        {kicker && <div className="gps-section-label">{kicker}</div>}
        {title && <h2 className="gps-mirror-headline">{title}</h2>}
        {section.items && section.items.length > 0 && (
          <div className="gps-data-lines">
            {section.items.map((item, i) => {
              const line = isAr ? item.body_ar ?? item.label_ar : item.body_en ?? item.label_en;
              return (
                <div className="gps-data-line" key={i}>
                  {line}
                </div>
              );
            })}
          </div>
        )}
        {close && (
          <div
            className="gps-mirror-bridge"
            dangerouslySetInnerHTML={{ __html: close.replace(/\n\n/g, '<br/><br/>') }}
          />
        )}
      </div>
    </section>
  );
}

// ── Reframe (hook line OR multi-part reframe) ──────────────────────────────
function GpsReframeSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  const body = isAr ? section.body_ar : section.body_en;
  const close = isAr ? section.close_ar : section.close_en;

  // If ONLY title present → hook-line card (standalone quote)
  if (title && !body && !close) {
    return (
      <section className="gps-hook" id={section.anchor_id}>
        <div className="gps-hook-inner">
          <p className="gps-hook-text">{title}</p>
        </div>
      </section>
    );
  }

  // Otherwise → multi-part reframe (headline + subline + body + close)
  return (
    <section className="gps-reframe" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2 className="gps-reframe-headline">{title}</h2>}
        {body &&
          body.split(/\n\n+/).map((para, i) =>
            i === 0 ? (
              <p key={i} className="gps-reframe-subline">
                {para}
              </p>
            ) : (
              <p key={i} className="gps-reframe-body">
                {para}
              </p>
            ),
          )}
        {close && <p className="gps-reframe-close">{close}</p>}
      </div>
    </section>
  );
}

// ── What-is (description with layer blocks) ────────────────────────────────
function GpsDescriptionSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  const tagline = isAr ? section.body_ar : section.body_en;
  return (
    <section className="gps-what-is" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {tagline && <div className="gps-what-is-tagline">{tagline}</div>}
        {section.items?.map((item, i) => {
          const label = isAr ? item.label_ar : item.label_en;
          const body = isAr ? item.body_ar : item.body_en;
          return (
            <div key={i}>
              <div className="gps-layer-block">
                <p>
                  {label && <strong>{label}</strong>}
                  {label && body && ' — '}
                  {body}
                </p>
              </div>
              {i < (section.items?.length ?? 0) - 1 && (
                <hr className="gps-layer-divider" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Benefits / outcomes (numbered, teal circles on ivory) ──────────────────
function GpsBenefitsSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  return (
    <section className="gps-outcomes" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {section.items?.map((item, i) => {
          const text = isAr ? item.body_ar : item.body_en;
          return (
            <div className="gps-outcome-item" key={i}>
              <div className="gps-outcome-num">{i + 1}</div>
              <div className="gps-outcome-text">{text}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Carry-out (parallel to benefits, dark-variant with gold-ringed numbers) ─
function GpsCarryOutSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  const closing = isAr ? section.close_ar : section.close_en;
  return (
    <section className="gps-carry-out" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {section.items?.map((item, i) => {
          const text = isAr ? item.body_ar : item.body_en;
          return (
            <div className="gps-carry-item" key={i}>
              <div className="gps-carry-num">{i + 1}</div>
              <div className="gps-carry-text">{text}</div>
            </div>
          );
        })}
        {closing && <div className="gps-carry-closing">{closing}</div>}
      </div>
    </section>
  );
}

// ── Who-for / Who-not-for ─────────────────────────────────────────────────
function GpsWhoForSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  return (
    <section className="gps-who gps-who-for" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {section.items && (
          <ul className="gps-check-list">
            {section.items.map((item, i) => {
              const text = isAr ? item.body_ar ?? item.label_ar : item.body_en ?? item.label_en;
              return (
                <li key={i}>
                  <span className="gps-check-icon" aria-hidden>
                    ✓
                  </span>
                  <span>{text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function GpsWhoNotForSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  return (
    <section className="gps-who gps-who-not-for" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {section.items && (
          <ul className="gps-check-list">
            {section.items.map((item, i) => {
              const text = isAr ? item.body_ar ?? item.label_ar : item.body_en ?? item.label_en;
              return (
                <li key={i}>
                  <span className="gps-check-icon" aria-hidden>
                    ×
                  </span>
                  <span>{text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// ── Format / details (2-col detail cards on deep teal) ─────────────────────
function GpsFormatSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  const note = isAr ? section.close_ar : section.close_en;
  return (
    <section className="gps-format" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {section.items && (
          <div className="gps-detail-cards">
            {section.items.map((item, i) => {
              const label = isAr ? item.label_ar : item.label_en;
              const value = isAr ? item.body_ar : item.body_en;
              return (
                <div className="gps-detail-card" key={i}>
                  {label && <div className="gps-detail-label">{label}</div>}
                  {value && <div className="gps-detail-value">{value}</div>}
                </div>
              );
            })}
          </div>
        )}
        {note && <p className="gps-format-note">{note}</p>}
      </div>
    </section>
  );
}

// ── Price (tier rows) ─────────────────────────────────────────────────────
function GpsPriceSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  const note = isAr ? section.close_ar : section.close_en;
  return (
    <section className="gps-price" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {section.items && (
          <div className="gps-price-grid">
            {section.items.map((item, i) => {
              const tier = item.tier || (i === 0 ? 'early' : i === section.items!.length - 1 ? 'late' : 'regular');
              const name = isAr ? item.label_ar : item.label_en;
              const dates = isAr ? item.meta_ar : item.meta_en;
              const amount = isAr ? item.body_ar : item.body_en;
              return (
                <div className={`gps-price-tier gps-tier-${tier}`} key={i}>
                  <div>
                    <div className="gps-tier-name">{name}</div>
                    {dates && <div className="gps-tier-dates">{dates}</div>}
                  </div>
                  <div className="gps-tier-amount">{amount}</div>
                </div>
              );
            })}
          </div>
        )}
        {note && <p className="gps-price-note">{note}</p>}
      </div>
    </section>
  );
}

// ── Group + alumni (2-col card grid) ──────────────────────────────────────
function GpsGroupAlumniSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  if (!section.items || section.items.length === 0) return null;

  // Split items: non-alumni rows go in left card; any item with icon='alumni'
  // or tier='late' marker goes in right card. For predictability, we take
  // the LAST item as the alumni card and all others as group-card rows.
  const groupItems = section.items.slice(0, -1);
  const alumniItem = section.items[section.items.length - 1];

  return (
    <section className="gps-group" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && (
          <h2
            style={{
              fontSize: 'clamp(24px, 3.5vw, 32px)',
              fontWeight: 900,
              color: 'var(--deep-teal)',
              marginBottom: '40px',
            }}
          >
            {title}
          </h2>
        )}
        <div className="gps-group-cards">
          <div className="gps-group-card">
            <h3>{isAr ? 'خصم المجموعة' : 'Group pricing'}</h3>
            {groupItems.map((item, i) => {
              const label = isAr ? item.label_ar : item.label_en;
              const pct = isAr ? item.body_ar : item.body_en;
              return (
                <div className="gps-discount-row" key={i}>
                  <span>{label}</span>
                  <span className="gps-discount-pct">{pct}</span>
                </div>
              );
            })}
          </div>
          <div className="gps-group-card gps-alumni-card">
            <h3>{isAr ? alumniItem.label_ar ?? 'الخرّيجون' : alumniItem.label_en ?? 'Alumni'}</h3>
            <p className="gps-alumni-note">
              {isAr ? alumniItem.body_ar : alumniItem.body_en}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Credibility / trainer ─────────────────────────────────────────────────
function GpsCredibilitySection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  const closer = isAr ? section.close_ar : section.close_en;
  const firstItem = section.items?.[0];
  const trainerName = isAr ? firstItem?.label_ar : firstItem?.label_en;
  const credLead = isAr ? firstItem?.meta_ar : firstItem?.meta_en;
  const bio = isAr ? firstItem?.body_ar : firstItem?.body_en;
  // Pills = items[1..] — each item.label is a credential chip
  const pills = section.items?.slice(1) ?? [];

  return (
    <section className="gps-trainer" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {trainerName && <div className="gps-trainer-name">{trainerName}</div>}
        {credLead && <p className="gps-trainer-credential-lead">{credLead}</p>}
        {pills.length > 0 && (
          <div className="gps-cred-pills">
            {pills.map((p, i) => (
              <span className="gps-cred-pill" key={i}>
                {isAr ? p.label_ar ?? p.body_ar : p.label_en ?? p.body_en}
              </span>
            ))}
          </div>
        )}
        {bio &&
          bio.split(/\n\n+/).map((para, i) => (
            <p key={i} className="gps-trainer-bio">
              {para}
            </p>
          ))}
        {closer && <p className="gps-trainer-closer">{closer}</p>}
      </div>
    </section>
  );
}

// ── Objections ────────────────────────────────────────────────────────────
function GpsObjectionsSection({ section, isAr }: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  return (
    <section className="gps-objections" id={section.anchor_id}>
      <div className="gps-section-inner">
        {title && <h2>{title}</h2>}
        {section.items?.map((item, i) => {
          const q = isAr ? item.label_ar : item.label_en;
          const a = isAr ? item.body_ar : item.body_en;
          return (
            <div className="gps-objection-card" key={i}>
              {q && <p className="gps-obj-question">{q}</p>}
              {a && <p className="gps-obj-answer">{a}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── CTA (gradient midnight + gold button) ─────────────────────────────────
function GpsCtaSection({ section, isAr }: SectionProps) {
  const headline = isAr
    ? section.cta_headline_ar ?? section.title_ar
    : section.cta_headline_en ?? section.title_en;
  const sub = isAr ? section.cta_sub_ar : section.cta_sub_en;
  const deadline = isAr ? section.cta_deadline_ar : section.cta_deadline_en;
  const ctaLabel = isAr ? section.cta_label_ar : section.cta_label_en;
  const contact = isAr ? section.cta_contact_ar : section.cta_contact_en;

  return (
    <section className="gps-cta" id={section.anchor_id}>
      <div className="gps-cta-inner">
        {headline && <h2 className="gps-cta-headline">{headline}</h2>}
        {sub && <p className="gps-cta-sub">{sub}</p>}
        {deadline && <p className="gps-cta-deadline">{deadline}</p>}
        {ctaLabel && section.cta_anchor && (
          <a href={section.cta_anchor} className="gps-cta-button">
            {ctaLabel}
          </a>
        )}
        {contact && (
          <p
            className="gps-cta-contact"
            dangerouslySetInnerHTML={{ __html: contact }}
          />
        )}
      </div>
    </section>
  );
}

// ── FAQ (fallback — uses objection card styling) ──────────────────────────
function GpsFaqSection(props: SectionProps) {
  return <GpsObjectionsSection {...props} />;
}

// ── Custom / fallback ─────────────────────────────────────────────────────
function GpsCustomSection({
  section,
  isAr,
  slug,
  locale,
  leadCaptureConfig,
  conversionEventName,
}: SectionProps) {
  const title = isAr ? section.title_ar : section.title_en;
  const body = isAr ? section.body_ar : section.body_en;

  // If this custom section is the lead-form anchor, render the form inside a
  // sales-pack-themed wrapper.
  if (section.anchor_id === 'lead-form' && leadCaptureConfig?.enabled) {
    return (
      <section className="gps-lead-form-wrap" id="lead-form">
        <div className="gps-lead-form-inner">
          {title && <h2>{title}</h2>}
          {body && (
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
          )}
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
        {body &&
          body.split(/\n\n+/).map((para, i) => (
            <p key={i} className="gps-reframe-body">
              {para}
            </p>
          ))}
      </div>
    </section>
  );
}

// ── Section type → component map ──────────────────────────────────────────
const SECTION_COMPONENTS: Record<string, React.ComponentType<SectionProps>> = {
  mirror: GpsMirrorSection,
  reframe: GpsReframeSection,
  description: GpsDescriptionSection,
  benefits: GpsBenefitsSection,
  carry_out: GpsCarryOutSection,
  who_for: GpsWhoForSection,
  who_not_for: GpsWhoNotForSection,
  format: GpsFormatSection,
  price: GpsPriceSection,
  group_alumni: GpsGroupAlumniSection,
  credibility: GpsCredibilitySection,
  objections: GpsObjectionsSection,
  faq: GpsFaqSection,
  cta: GpsCtaSection,
  custom: GpsCustomSection,
};
