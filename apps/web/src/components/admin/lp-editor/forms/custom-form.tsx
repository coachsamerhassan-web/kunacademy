/**
 * Wave 14b LP-ADMIN-UX Session 2 — `custom` section per-field form.
 *
 * Free-form rich text. Renders body + close as bilingual rich editors with
 * full image/link/video toolbar. Items list is optional (some custom
 * sections want a list).
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

export function CustomForm({ section, onChange, locale }: SectionFormProps) {
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
        labelAr="النص الأساسي (محرّر غني)"
        labelEn="Body (rich editor)"
        helperAr="نص حرّ — كل شيء مدعوم: عناوين، قوائم، صور، روابط، فيديو."
        helperEn="Free-form prose — supports headings, lists, images, links, video."
        isAr={isAr}
        value={bodyValue}
        onChange={(next) =>
          onChange({ ...section, body_ar_rich: next.ar, body_en_rich: next.en })
        }
      />

      <BilingualRichField
        labelAr="الإغلاق (محرّر غني — اختياري)"
        labelEn="Close (rich editor — optional)"
        helperAr="نص ختامي اختياري بعد النص الأساسي."
        helperEn="Optional closing text after the body."
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
          enableMeta: true,
          addLabelAr: 'إضافة عنصر',
          addLabelEn: 'Add item',
          itemHeaderAr: 'عنصر',
          itemHeaderEn: 'Item',
        }}
      />
    </div>
  );
}
