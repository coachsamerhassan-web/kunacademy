/**
 * Wave 14b LP-ADMIN-UX Session 2 — `objections` + `faq` per-field form
 * (multi-mapped — same Q+A items[] shape, different framing).
 *
 * Objections: anticipated objections + reframes (sales-pack pattern).
 * FAQ: generic Q&A list (default theme; sales-pack uses `objections` instead).
 *
 * Both: items[] with label = question/objection, body = answer/reframe.
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

export function ObjectionsFaqForm({ section, onChange, locale }: SectionFormProps) {
  const isAr = locale === 'ar';
  const isObjections = section.type === 'objections';

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
        helperAr="نص افتتاحي قبل القائمة (اختياري)."
        helperEn="Optional opening text before the list."
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
          enableIcon: !isObjections, // FAQ may use icons; objections renders plain
          addLabelAr: isObjections ? 'إضافة اعتراض' : 'إضافة سؤال',
          addLabelEn: isObjections ? 'Add objection' : 'Add question',
          itemHeaderAr: isObjections ? 'اعتراض' : 'سؤال',
          itemHeaderEn: isObjections ? 'Objection' : 'Question',
        }}
        labelArHeader={isObjections ? 'الاعتراض (AR)' : 'السؤال (AR)'}
        labelEnHeader={isObjections ? 'Objection (EN)' : 'Question (EN)'}
        bodyArHeader={isObjections ? 'إعادة التأطير (AR)' : 'الإجابة (AR)'}
        bodyEnHeader={isObjections ? 'Reframe (EN)' : 'Answer (EN)'}
      />
    </div>
  );
}
