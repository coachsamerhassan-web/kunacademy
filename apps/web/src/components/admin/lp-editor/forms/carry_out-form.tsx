/**
 * Wave 14b LP-ADMIN-UX Session 2 — `carry_out` section per-field form.
 *
 * "What you leave with" — parallel list to benefits but framed as durable
 * carry-aways. On gps-sales renders on dark background variant.
 */

'use client';

import type { LpSectionItem } from '@/lib/lp/composition-types';
import type { BilingualRichDoc } from '@kunacademy/ui/rich-editor';
import type { SectionFormProps } from '../_shared';
import {
  AnchorBackgroundGroup,
  BilingualRichField,
  ItemListEditor,
  ScalarBilingualText,
} from './_form-helpers';

export function CarryOutForm({ section, onChange, locale }: SectionFormProps) {
  const isAr = locale === 'ar';

  const bodyValue: BilingualRichDoc = {
    ar: section.body_ar_rich ?? null,
    en: section.body_en_rich ?? null,
  };

  function handleItemsChange(items: LpSectionItem[]) {
    onChange({ ...section, items });
  }

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
        labelAr="مقدّمة (محرّر غني — اختياري)"
        labelEn="Intro (rich editor — optional)"
        helperAr="جملة افتتاحية قبل قائمة المحتوى الذي تحمله معك."
        helperEn="Optional opening line before the carry-out list."
        isAr={isAr}
        value={bodyValue}
        onChange={(next) =>
          onChange({ ...section, body_ar_rich: next.ar, body_en_rich: next.en })
        }
      />

      <ItemListEditor
        items={section.items ?? []}
        onChange={handleItemsChange}
        isAr={isAr}
        options={{
          enableRichBody: true,
          enableIcon: true,
          addLabelAr: 'إضافة عنصر',
          addLabelEn: 'Add carry-out',
          itemHeaderAr: 'عنصر',
          itemHeaderEn: 'Item',
        }}
        labelArHeader="ما تحمله — عنوان (AR)"
        labelEnHeader="Carry-out — headline (EN)"
        bodyArHeader="ما تحمله — وصف (AR)"
        bodyEnHeader="Carry-out — description (EN)"
      />
    </div>
  );
}
