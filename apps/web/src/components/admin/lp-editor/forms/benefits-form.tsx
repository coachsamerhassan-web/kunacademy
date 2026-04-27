/**
 * Wave 14b LP-ADMIN-UX Session 2 — `benefits` section per-field form.
 *
 * Outcomes list. On gps-sales theme renders as numbered circles. Items use
 * label as the headline + body as the description.
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

export function BenefitsForm({ section, onChange, locale }: SectionFormProps) {
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
        helperAr="نص افتتاحي قبل قائمة الفوائد."
        helperEn="Optional opening text before the benefits list."
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
          addLabelAr: 'إضافة فائدة',
          addLabelEn: 'Add benefit',
          itemHeaderAr: 'فائدة',
          itemHeaderEn: 'Benefit',
        }}
        labelArHeader="عنوان الفائدة (AR)"
        labelEnHeader="Benefit headline (EN)"
        bodyArHeader="وصف الفائدة (AR)"
        bodyEnHeader="Benefit description (EN)"
      />
    </div>
  );
}
