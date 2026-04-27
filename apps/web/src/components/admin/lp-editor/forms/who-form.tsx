/**
 * Wave 14b LP-ADMIN-UX Session 2 — `who_for` + `who_not_for` per-field form
 * (multi-mapped — same shape, different copy).
 *
 * Audience match (✓ list) and audience anti-match (× list). The shape is
 * identical: a title, optional intro, and an items[] list of statements.
 *
 * IP-protection note: `who_not_for` MUST include the therapy boundary as
 * one of the items — this is enforced via a soft warning at the bottom
 * (not a hard validation, since copy varies per program).
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

export function WhoForm({ section, onChange, locale }: SectionFormProps) {
  const isAr = locale === 'ar';
  const isAntiMatch = section.type === 'who_not_for';

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
        labelAr={isAntiMatch ? 'مقدّمة قائمة «ليس لمن» (محرّر غني — اختياري)' : 'مقدّمة قائمة «لمن» (محرّر غني — اختياري)'}
        labelEn={isAntiMatch ? 'Anti-match intro (rich editor — optional)' : 'Match intro (rich editor — optional)'}
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
          enableIcon: true,
          addLabelAr: isAntiMatch ? 'إضافة استبعاد' : 'إضافة مطابقة',
          addLabelEn: isAntiMatch ? 'Add anti-match' : 'Add match',
          itemHeaderAr: isAntiMatch ? 'استبعاد' : 'مطابقة',
          itemHeaderEn: isAntiMatch ? 'Anti-match' : 'Match',
        }}
        labelArHeader={isAntiMatch ? 'البيان (AR)' : 'البيان (AR)'}
        labelEnHeader="Statement (EN)"
        bodyArHeader="توضيح (AR)"
        bodyEnHeader="Detail (EN)"
      />

      {isAntiMatch && (
        <div className="rounded-xl border border-[var(--color-warning-200,#fbbf24)] bg-[var(--color-warning-50,#fffbeb)] p-4">
          <p className="text-sm font-semibold text-[var(--color-warning-900,#78350f)] mb-1">
            {isAr ? 'تذكير IP: حدّ العلاج' : 'IP reminder: therapy boundary'}
          </p>
          <p className="text-xs text-[var(--color-warning-800,#92400e)]">
            {isAr
              ? 'يجب أن تتضمّن قائمة «ليس لمن» بيانًا واضحًا يوضّح أنّ الكوتشينج ليس بديلًا عن العلاج النفسي. تأكّد من إضافته قبل النشر.'
              : 'The "who not for" list must include a clear statement that coaching is not a substitute for therapy. Make sure to add it before publishing.'}
          </p>
        </div>
      )}
    </div>
  );
}
