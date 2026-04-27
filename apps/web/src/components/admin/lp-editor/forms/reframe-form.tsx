/**
 * Wave 14b LP-ADMIN-UX Session 2 — `reframe` section per-field form.
 *
 * Reframe = hook line / pivot. Mostly prose: title + body + close.
 * Items are not used.
 */

'use client';

import type { BilingualRichDoc } from '@kunacademy/ui/rich-editor';
import type { SectionFormProps } from '../_shared';
import {
  AnchorBackgroundGroup,
  BilingualRichField,
  ScalarBilingualText,
} from './_form-helpers';

export function ReframeForm({ section, onChange, locale }: SectionFormProps) {
  const isAr = locale === 'ar';

  const bodyValue: BilingualRichDoc = {
    ar: section.body_ar_rich ?? null,
    en: section.body_en_rich ?? null,
  };
  const closeValue: BilingualRichDoc = {
    ar: section.close_ar_rich ?? null,
    en: section.close_en_rich ?? null,
  };

  return (
    <div className="space-y-6">
      <AnchorBackgroundGroup section={section} onChange={onChange} isAr={isAr} />

      <ScalarBilingualText
        labelAr="الكيكر (AR)"
        labelEn="Kicker (EN)"
        valueAr={section.kicker_ar}
        valueEn={section.kicker_en}
        onChangeAr={(v) => onChange({ ...section, kicker_ar: v })}
        onChangeEn={(v) => onChange({ ...section, kicker_en: v })}
        helperAr="تسمية صغيرة فوق العنوان (اختياري)."
        helperEn="Small uppercase label above the title (optional)."
        isAr={isAr}
      />

      <ScalarBilingualText
        labelAr="العنوان (AR)"
        labelEn="Title (EN)"
        valueAr={section.title_ar}
        valueEn={section.title_en}
        onChangeAr={(v) => onChange({ ...section, title_ar: v })}
        onChangeEn={(v) => onChange({ ...section, title_en: v })}
        isAr={isAr}
      />

      <BilingualRichField
        labelAr="النص الأساسي (محرّر غني)"
        labelEn="Body (rich editor)"
        helperAr="الجملة المحورية لإعادة التأطير. يُفضَّل على body_ar / body_en في العرض."
        helperEn="The pivot/reframe line. Preferred over body_ar / body_en at render."
        isAr={isAr}
        value={bodyValue}
        onChange={(next) =>
          onChange({ ...section, body_ar_rich: next.ar, body_en_rich: next.en })
        }
      />

      <BilingualRichField
        labelAr="الإغلاق (محرّر غني — اختياري)"
        labelEn="Close (rich editor — optional)"
        helperAr="جملة إغلاق إضافية تُعرض بعد النص الأساسي."
        helperEn="Optional closing sentence rendered after the body."
        isAr={isAr}
        value={closeValue}
        onChange={(next) =>
          onChange({ ...section, close_ar_rich: next.ar, close_en_rich: next.en })
        }
      />
    </div>
  );
}
