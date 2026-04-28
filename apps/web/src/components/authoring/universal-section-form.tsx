/**
 * Wave 15 Wave 3 — Universal section form.
 *
 * Generic form mounted by `SidePanel` for the 8 universal section types
 * (header, body, image, video, quote, divider, mirror universal-fallback,
 * cta universal-fallback) — and as a defensive fallback for any unknown
 * section type so the editor never goes blank.
 *
 * Each branch renders a small set of fields appropriate to the type. All
 * fields are bilingual unless intrinsically not (e.g. `image_url`).
 *
 * The form is locale-naive; the `localeMode` prop hints which fields to
 * highlight (the wrapping panel handles the bilingual chrome). For Wave 3
 * canary we render BOTH locales side-by-side regardless of localeMode and
 * let the panel's own tab strip be the visible cue. Refinement to per-tab
 * field hiding is post-canary.
 */

'use client';

import { useState } from 'react';
import type { LpSection } from '@/lib/lp/composition-types';
import type { LocaleMode } from './side-panel';
import type { SectionBackground, ImageStyling } from './panels/styling-types';
import { BackgroundPanel } from './panels/background-panel';
import { ImageStylingPanel } from './panels/image-styling-panel';
import { MediaPickerDialog, type MediaPickerSelection } from './media-picker-dialog';
import { VideoEmbedPreview, parseVideoSrc } from './video-embed-preview';

interface Props {
  section: LpSection;
  onChange: (next: LpSection) => void;
  locale: string;
  localeMode: LocaleMode;
}

// Universal-section types we render here (string-typed so we can compare
// against the runtime discriminator without fighting the strict
// LpSectionType union — the type field on the row is open to any string in
// composition_json, even though TS narrows it). Authors author universal
// types; the LP-strict union covers only the 15 LP types.
type UniversalKey = 'header' | 'body' | 'image' | 'video' | 'quote' | 'divider';

const INPUT_CLASS =
  'block w-full rounded-lg border border-[var(--color-neutral-200)] bg-white px-3 py-2 text-sm text-[var(--color-neutral-800)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none';
const LABEL_CLASS = 'block text-xs font-semibold text-[var(--color-neutral-700)] mb-1';

export function UniversalSectionForm({ section, onChange, locale, localeMode }: Props) {
  const isAr = locale === 'ar';
  const showAr = localeMode === 'ar' || localeMode === 'both';
  const showEn = localeMode === 'en' || localeMode === 'both';
  const uiLocale = (locale === 'ar' ? 'ar' : 'en') as 'ar' | 'en';
  const [mediaOpen, setMediaOpen] = useState(false);

  // Read fields off section as a permissive Record. LpSection has a closed
  // discriminator; for universals we treat it as open via unknown bridge.
  const s = section as unknown as Record<string, unknown>;

  function patch(patch: Record<string, unknown>) {
    onChange({ ...(section as unknown as Record<string, unknown>), ...patch } as unknown as LpSection);
  }

  // The discriminator is typed strictly as LpSectionType; cast to a wider
  // string for runtime branch matching against universal types.
  const t = section.type as unknown as UniversalKey | string;

  // Shared per-element background panel (Issue 3).
  const renderBgPanel = () => (
    <BackgroundPanel
      value={(s.background as SectionBackground | undefined) ?? undefined}
      onChange={(next) => patch({ background: next })}
      isAr={isAr}
      uiLocale={uiLocale}
    />
  );

  switch (t) {
    case 'header':
      return (
        <div className="space-y-3">
          {showAr && (
            <ScalarField
              label={isAr ? 'العنوان (عربي)' : 'Title (Arabic)'}
              value={(s.title_ar as string) ?? ''}
              onChange={(v) => patch({ title_ar: v })}
              dir="rtl"
            />
          )}
          {showEn && (
            <ScalarField
              label={isAr ? 'العنوان (إنجليزي)' : 'Title (English)'}
              value={(s.title_en as string) ?? ''}
              onChange={(v) => patch({ title_en: v })}
              dir="ltr"
            />
          )}
          {showAr && (
            <ScalarField
              label={isAr ? 'الترويسة الفرعية (عربي)' : 'Subtitle (Arabic)'}
              value={(s.subtitle_ar as string) ?? ''}
              onChange={(v) => patch({ subtitle_ar: v })}
              dir="rtl"
              variant="textarea"
            />
          )}
          {showEn && (
            <ScalarField
              label={isAr ? 'الترويسة الفرعية (إنجليزي)' : 'Subtitle (English)'}
              value={(s.subtitle_en as string) ?? ''}
              onChange={(v) => patch({ subtitle_en: v })}
              dir="ltr"
              variant="textarea"
            />
          )}
          <AnchorRow value={(s.anchor_id as string) ?? ''} onChange={(v) => patch({ anchor_id: v || undefined })} isAr={isAr} />
          {renderBgPanel()}
        </div>
      );

    case 'body':
      return (
        <div className="space-y-3">
          {showAr && (
            <ScalarField
              label={isAr ? 'النصّ (عربي)' : 'Body (Arabic)'}
              value={(s.body_ar as string) ?? ''}
              onChange={(v) => patch({ body_ar: v })}
              dir="rtl"
              variant="textarea"
              rows={8}
            />
          )}
          {showEn && (
            <ScalarField
              label={isAr ? 'النصّ (إنجليزي)' : 'Body (English)'}
              value={(s.body_en as string) ?? ''}
              onChange={(v) => patch({ body_en: v })}
              dir="ltr"
              variant="textarea"
              rows={8}
            />
          )}
          <AnchorRow value={(s.anchor_id as string) ?? ''} onChange={(v) => patch({ anchor_id: v || undefined })} isAr={isAr} />
          {renderBgPanel()}
        </div>
      );

    case 'image': {
      const imageUrl = (s.image_url as string) ?? '';
      const onMediaSelect = (sel: MediaPickerSelection) => {
        patch({
          image_url: sel.src,
          alt_ar: sel.alt_ar ?? (s.alt_ar as string) ?? '',
          alt_en: sel.alt_en ?? (s.alt_en as string) ?? '',
          media_id: sel.mediaId ?? null,
        });
        setMediaOpen(false);
      };
      return (
        <div className="space-y-3">
          {/* Add Media UX (Issue 1) — replaces bare URL field */}
          <div>
            <div className="text-xs font-semibold text-[var(--color-neutral-700)] mb-1">
              {isAr ? 'الصورة' : 'Image'}
            </div>
            {imageUrl ? (
              <div className="flex items-start gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={(isAr ? (s.alt_ar as string) : (s.alt_en as string)) ?? ''}
                  className="w-24 h-24 rounded-lg object-cover bg-[var(--color-neutral-100)] border border-[var(--color-neutral-200)]"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-[var(--color-neutral-500)] truncate">{imageUrl}</div>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setMediaOpen(true)}
                      className="rounded-lg border border-[var(--color-neutral-300)] px-2 py-1 text-xs hover:bg-[var(--color-neutral-50)]"
                    >
                      {isAr ? 'استبدال' : 'Replace'}
                    </button>
                    <button
                      type="button"
                      onClick={() => patch({ image_url: '', media_id: null })}
                      className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      {isAr ? 'إزالة' : 'Remove'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMediaOpen(true)}
                className="w-full rounded-xl border-2 border-dashed border-[var(--color-neutral-300)] px-3 py-4 text-sm text-[var(--color-neutral-600)] hover:border-[var(--color-accent,#F47E42)] hover:bg-[var(--color-neutral-50)]"
              >
                {isAr ? '+ إضافة وسائط' : '+ Add Media'}
              </button>
            )}
          </div>

          {showAr && (
            <ScalarField
              label={isAr ? 'النصّ البديل (عربي) — مطلوب' : 'Alt text (Arabic) — required'}
              value={(s.alt_ar as string) ?? ''}
              onChange={(v) => patch({ alt_ar: v })}
              dir="rtl"
              required
            />
          )}
          {showEn && (
            <ScalarField
              label={isAr ? 'النصّ البديل (إنجليزي) — مطلوب' : 'Alt text (English) — required'}
              value={(s.alt_en as string) ?? ''}
              onChange={(v) => patch({ alt_en: v })}
              dir="ltr"
              required
            />
          )}
          {showAr && (
            <ScalarField
              label={isAr ? 'تسمية (عربي)' : 'Caption (Arabic)'}
              value={(s.caption_ar as string) ?? ''}
              onChange={(v) => patch({ caption_ar: v })}
              dir="rtl"
            />
          )}
          {showEn && (
            <ScalarField
              label={isAr ? 'تسمية (إنجليزي)' : 'Caption (English)'}
              value={(s.caption_en as string) ?? ''}
              onChange={(v) => patch({ caption_en: v })}
              dir="ltr"
            />
          )}

          {/* Issue 2 — Image styling panel (alignment / fit / aspect / overlay) */}
          <ImageStylingPanel
            value={(s.styling as ImageStyling | undefined) ?? undefined}
            onChange={(next) => patch({ styling: next })}
            isAr={isAr}
          />

          <AnchorRow value={(s.anchor_id as string) ?? ''} onChange={(v) => patch({ anchor_id: v || undefined })} isAr={isAr} />

          {/* Issue 3 — Background panel */}
          {renderBgPanel()}

          <MediaPickerDialog
            open={mediaOpen}
            onClose={() => setMediaOpen(false)}
            onSelect={onMediaSelect}
            locale={uiLocale}
          />
        </div>
      );
    }

    case 'video': {
      const embedUrl = (s.embed_url as string) ?? '';
      const parsed = parseVideoSrc(embedUrl);
      const styling = (s.styling as ImageStyling | undefined) ?? undefined;
      return (
        <div className="space-y-3">
          <ScalarField
            label={isAr ? 'رابط الفيديو (يوتيوب / فيميو / لووم)' : 'Embed URL (YouTube / Vimeo / Loom)'}
            value={embedUrl}
            onChange={(v) => patch({ embed_url: v })}
            dir="ltr"
            placeholder="https://youtube.com/watch?v=..."
          />
          <p className="text-[11px] text-[var(--color-neutral-500)]">
            {isAr
              ? 'يجب أن يكون الرابط من قائمة موثوقة (يوتيوب / فيميو / لووم / Google Slides). فحص R11 سيمنع النشر إن لم يكن.'
              : 'URL must be on the allowlist (YouTube / Vimeo / Loom / Google Slides). R11 lint blocks publish otherwise.'}
          </p>

          {/* Issue 6 — embedded preview thumbnail in editor */}
          {parsed && (
            <div>
              <div className="text-[11px] font-medium text-[var(--color-neutral-700)] mb-1">
                {isAr ? 'معاينة' : 'Preview'}
              </div>
              <VideoEmbedPreview parsed={parsed} aspect={styling?.aspect ?? '16/9'} />
              <div className="text-[10px] text-[var(--color-neutral-500)] mt-1">
                {parsed.provider} · {parsed.id}
              </div>
            </div>
          )}

          {/* Issue 6 — size + aspect controls (re-uses ImageStylingPanel for align + width + aspect) */}
          <ImageStylingPanel
            value={styling}
            onChange={(next) => patch({ styling: next })}
            isAr={isAr}
          />

          {showAr && (
            <ScalarField
              label={isAr ? 'تسمية (عربي)' : 'Caption (Arabic)'}
              value={(s.caption_ar as string) ?? ''}
              onChange={(v) => patch({ caption_ar: v })}
              dir="rtl"
            />
          )}
          {showEn && (
            <ScalarField
              label={isAr ? 'تسمية (إنجليزي)' : 'Caption (English)'}
              value={(s.caption_en as string) ?? ''}
              onChange={(v) => patch({ caption_en: v })}
              dir="ltr"
            />
          )}
          <AnchorRow value={(s.anchor_id as string) ?? ''} onChange={(v) => patch({ anchor_id: v || undefined })} isAr={isAr} />
          {renderBgPanel()}
        </div>
      );
    }

    case 'quote':
      return (
        <div className="space-y-3">
          {showAr && (
            <ScalarField
              label={isAr ? 'الاقتباس (عربي)' : 'Quote (Arabic)'}
              value={(s.quote_ar as string) ?? ''}
              onChange={(v) => patch({ quote_ar: v })}
              dir="rtl"
              variant="textarea"
              rows={4}
            />
          )}
          {showEn && (
            <ScalarField
              label={isAr ? 'الاقتباس (إنجليزي)' : 'Quote (English)'}
              value={(s.quote_en as string) ?? ''}
              onChange={(v) => patch({ quote_en: v })}
              dir="ltr"
              variant="textarea"
              rows={4}
            />
          )}
          {showAr && (
            <ScalarField
              label={isAr ? 'المنسوب إليه (عربي)' : 'Attribution (Arabic)'}
              value={(s.attribution_ar as string) ?? ''}
              onChange={(v) => patch({ attribution_ar: v })}
              dir="rtl"
            />
          )}
          {showEn && (
            <ScalarField
              label={isAr ? 'المنسوب إليه (إنجليزي)' : 'Attribution (English)'}
              value={(s.attribution_en as string) ?? ''}
              onChange={(v) => patch({ attribution_en: v })}
              dir="ltr"
            />
          )}
          <AnchorRow value={(s.anchor_id as string) ?? ''} onChange={(v) => patch({ anchor_id: v || undefined })} isAr={isAr} />
          {renderBgPanel()}
        </div>
      );

    case 'divider':
      return (
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-neutral-500)]">
            {isAr
              ? 'فاصل بصري — لا يحتوي على حقول قابلة للتحرير. يمكنك حذفه أو سحبه إلى موقع آخر.'
              : 'Visual divider — no editable fields. You can delete it or drag it to another position.'}
          </p>
          <AnchorRow value={(s.anchor_id as string) ?? ''} onChange={(v) => patch({ anchor_id: v || undefined })} isAr={isAr} />
          {renderBgPanel()}
        </div>
      );

    default:
      // Defensive fallback — render JSON view for unknown types so admins
      // can fix data without crashing the editor.
      return (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-neutral-500)]">
            {isAr
              ? `نوع غير معروف: ${section.type}. عرض JSON خام للقراءة:`
              : `Unknown section type: ${section.type}. Raw JSON view (read-only):`}
          </p>
          <pre className="rounded-lg bg-[var(--color-neutral-100)] p-3 text-[11px] font-mono whitespace-pre-wrap break-all max-h-64 overflow-auto">
            {JSON.stringify(section, null, 2)}
          </pre>
        </div>
      );
  }
}

interface ScalarFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  dir?: 'ltr' | 'rtl';
  placeholder?: string;
  required?: boolean;
  variant?: 'input' | 'textarea';
  rows?: number;
}

function ScalarField({ label, value, onChange, dir, placeholder, required, variant = 'input', rows = 3 }: ScalarFieldProps) {
  return (
    <div>
      <label className={LABEL_CLASS}>
        {label}
        {required && <span className="ms-1 text-red-600">*</span>}
      </label>
      {variant === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={dir}
          rows={rows}
          placeholder={placeholder}
          className={`${INPUT_CLASS} resize-y`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir={dir}
          placeholder={placeholder}
          className={INPUT_CLASS}
        />
      )}
    </div>
  );
}

function AnchorRow({ value, onChange, isAr }: { value: string; onChange: (v: string) => void; isAr: boolean }) {
  return (
    <div>
      <label className={LABEL_CLASS}>anchor_id</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="ltr"
        placeholder="optional"
        className={INPUT_CLASS}
      />
      <p className="text-[11px] text-[var(--color-neutral-500)] mt-1">
        {isAr ? 'معرّف اختياري للوصل المباشر إلى هذا القسم' : 'Optional anchor for direct deep-link to this section.'}
      </p>
    </div>
  );
}
