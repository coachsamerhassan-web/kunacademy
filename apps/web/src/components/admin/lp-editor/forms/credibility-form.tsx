/**
 * Wave 14b LP-ADMIN-UX Session 2 — `credibility` section per-field form.
 *
 * Trainer/host credentials — name (in title), lead (kicker), pill chips
 * (items[] with label only), bio (body rich), closer (close rich).
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

export function CredibilityForm({ section, onChange, locale }: SectionFormProps) {
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
        labelAr="افتتاحية (AR)"
        labelEn="Lead-in (EN)"
        valueAr={section.kicker_ar}
        valueEn={section.kicker_en}
        onChangeAr={(v) => onChange({ ...section, kicker_ar: v })}
        onChangeEn={(v) => onChange({ ...section, kicker_en: v })}
        helperAr="جملة قصيرة فوق الاسم — مثل «بقيادة:» أو «المدرّب:»."
        helperEn="Short label above the name — e.g. 'Hosted by' or 'Trainer:'."
        isAr={isAr}
      />

      <ScalarBilingualText
        labelAr="الاسم (AR)"
        labelEn="Name (EN)"
        valueAr={section.title_ar}
        valueEn={section.title_en}
        onChangeAr={(v) => onChange({ ...section, title_ar: v })}
        onChangeEn={(v) => onChange({ ...section, title_en: v })}
        isAr={isAr}
      />

      <BilingualRichField
        labelAr="السيرة الذاتية (محرّر غني)"
        labelEn="Bio (rich editor)"
        helperAr="السيرة الذاتية للمدرّب/المضيف. يُفضَّل على body_ar / body_en في العرض."
        helperEn="Trainer/host bio. Preferred over body_ar / body_en at render."
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
          enableRichBody: false,
          enableIcon: false,
          hideBody: true,
          addLabelAr: 'إضافة شارة',
          addLabelEn: 'Add credential pill',
          itemHeaderAr: 'شارة',
          itemHeaderEn: 'Pill',
          bodyVariant: 'input',
        }}
        labelArHeader="نص الشارة (AR)"
        labelEnHeader="Pill text (EN)"
      />

      <BilingualRichField
        labelAr="ختام (محرّر غني — اختياري)"
        labelEn="Closer (rich editor — optional)"
        helperAr="جملة ختامية بعد السيرة الذاتية والشارات."
        helperEn="Optional closing line after the bio + pills."
        isAr={isAr}
        value={closeValue}
        onChange={(next) =>
          onChange({ ...section, close_ar_rich: next.ar, close_en_rich: next.en })
        }
      />
    </div>
  );
}
