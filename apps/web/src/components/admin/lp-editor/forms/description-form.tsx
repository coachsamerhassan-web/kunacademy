/**
 * Wave 14b LP-ADMIN-UX Session 2 — `description` section per-field form.
 *
 * 4-layer description (identity → invitation → impressions → glimpse).
 * Mostly prose, optionally with item list for the impressions layer.
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

export function DescriptionForm({ section, onChange, locale }: SectionFormProps) {
  const isAr = locale === 'ar';

  const bodyValue: BilingualRichDoc = {
    ar: section.body_ar_rich ?? null,
    en: section.body_en_rich ?? null,
  };
  const closeValue: BilingualRichDoc = {
    ar: section.close_ar_rich ?? null,
    en: section.close_en_rich ?? null,
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
        labelAr="الهوية + الدعوة (محرّر غني)"
        labelEn="Identity + invitation (rich editor)"
        helperAr="أوّل طبقتين من الوصف الرباعي. يُفضَّل على body_ar / body_en في العرض."
        helperEn="First two layers of the 4-layer description. Preferred over body_ar / body_en."
        isAr={isAr}
        value={bodyValue}
        onChange={(next) =>
          onChange({ ...section, body_ar_rich: next.ar, body_en_rich: next.en })
        }
      />

      <BilingualRichField
        labelAr="اللمحة (محرّر غني — اختياري)"
        labelEn="Glimpse (rich editor — optional)"
        helperAr="الطبقة الرابعة — لمحة مما سيختبره القارئ."
        helperEn="Fourth layer — a glimpse of what the reader will experience."
        isAr={isAr}
        value={closeValue}
        onChange={(next) =>
          onChange({ ...section, close_ar_rich: next.ar, close_en_rich: next.en })
        }
      />

      <ItemListEditor
        items={section.items ?? []}
        onChange={handleItemsChange}
        isAr={isAr}
        options={{
          enableRichBody: true,
          enableIcon: true,
          addLabelAr: 'إضافة انطباع',
          addLabelEn: 'Add impression',
          itemHeaderAr: 'انطباع',
          itemHeaderEn: 'Impression',
        }}
        labelArHeader="عنوان الانطباع (AR)"
        labelEnHeader="Impression label (EN)"
        bodyArHeader="نص الانطباع (AR)"
        bodyEnHeader="Impression body (EN)"
      />
    </div>
  );
}
