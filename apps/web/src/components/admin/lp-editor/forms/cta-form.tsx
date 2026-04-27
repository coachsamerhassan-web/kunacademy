/**
 * Wave 14b LP-ADMIN-UX Session 2 — `cta` section per-field form.
 *
 * Dedicated CTA block — headline + sub + deadline + button + contact line.
 * No items[]; pure scalar fields. The composition-types interface defines
 * cta_headline_*, cta_sub_*, cta_deadline_*, cta_contact_* — all live on
 * the section root, not in items.
 */

'use client';

import type { LpSection } from '@/lib/lp/composition-types';
import type { SectionFormProps } from '../_shared';
import { AnchorBackgroundGroup, ScalarBilingualText } from './_form-helpers';

const inputClasses =
  'block w-full rounded-xl border border-[var(--color-neutral-200)] bg-white px-4 py-2.5 text-[var(--color-neutral-800)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-50)] focus:outline-none';
const labelClasses =
  'block text-sm font-semibold text-[var(--color-neutral-700)] mb-1.5';

export function CtaForm({ section, onChange, locale }: SectionFormProps) {
  const isAr = locale === 'ar';

  function update<K extends keyof LpSection>(key: K, value: LpSection[K]) {
    onChange({ ...section, [key]: value });
  }

  return (
    <div className="space-y-6">
      <AnchorBackgroundGroup section={section} onChange={onChange} isAr={isAr} />

      <ScalarBilingualText
        labelAr="عنوان CTA (AR)"
        labelEn="CTA headline (EN)"
        valueAr={section.cta_headline_ar}
        valueEn={section.cta_headline_en}
        onChangeAr={(v) => onChange({ ...section, cta_headline_ar: v })}
        onChangeEn={(v) => onChange({ ...section, cta_headline_en: v })}
        helperAr="العنوان الرئيس لكتلة CTA."
        helperEn="Headline for the CTA block."
        isAr={isAr}
      />

      <ScalarBilingualText
        labelAr="نص فرعي CTA (AR)"
        labelEn="CTA sub (EN)"
        valueAr={section.cta_sub_ar}
        valueEn={section.cta_sub_en}
        onChangeAr={(v) => onChange({ ...section, cta_sub_ar: v })}
        onChangeEn={(v) => onChange({ ...section, cta_sub_en: v })}
        helperAr="جملة فرعية تحت العنوان."
        helperEn="Sub-headline beneath the CTA headline."
        isAr={isAr}
        variant="textarea"
      />

      <ScalarBilingualText
        labelAr="موعد نهائي (AR)"
        labelEn="Deadline (EN)"
        valueAr={section.cta_deadline_ar}
        valueEn={section.cta_deadline_en}
        onChangeAr={(v) => onChange({ ...section, cta_deadline_ar: v })}
        onChangeEn={(v) => onChange({ ...section, cta_deadline_en: v })}
        helperAr="مثلًا: «التسجيل المبكّر يقفل 1 يونيو»."
        helperEn="e.g. 'Early-bird closes June 1'."
        isAr={isAr}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScalarBilingualText
          labelAr="نص الزر (AR)"
          labelEn="Button label (EN)"
          valueAr={section.cta_label_ar}
          valueEn={section.cta_label_en}
          onChangeAr={(v) => onChange({ ...section, cta_label_ar: v })}
          onChangeEn={(v) => onChange({ ...section, cta_label_en: v })}
          isAr={isAr}
        />
        <div>
          <label className={labelClasses}>cta_anchor</label>
          <input
            type="text"
            className={inputClasses}
            value={section.cta_anchor ?? ''}
            onChange={(e) => update('cta_anchor', e.target.value || undefined)}
            dir="ltr"
            placeholder="#payment | https://… | /next-step"
          />
          <p className="text-xs text-[var(--color-neutral-500)] mt-1">
            {isAr
              ? 'مرجع داخلي (#anchor) أو رابط كامل أو مسار نسبي.'
              : 'In-page anchor (#anchor) or full URL or relative path.'}
          </p>
        </div>
      </div>

      <ScalarBilingualText
        labelAr="بيانات التواصل (AR)"
        labelEn="Contact line (EN)"
        valueAr={section.cta_contact_ar}
        valueEn={section.cta_contact_en}
        onChangeAr={(v) => onChange({ ...section, cta_contact_ar: v })}
        onChangeEn={(v) => onChange({ ...section, cta_contact_en: v })}
        helperAr="جملة قصيرة تحت الزر، مثل «تواصل معنا على واتساب…»."
        helperEn="Short line beneath the button, e.g. 'Contact us on WhatsApp…'."
        isAr={isAr}
      />
    </div>
  );
}
