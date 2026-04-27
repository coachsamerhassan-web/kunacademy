/**
 * Wave 14b LP-ADMIN-UX Session 2 — `format` + `price` per-field form
 * (multi-mapped — same items[] grid shape; price adds tier hint).
 *
 * Format: date / time / location / duration — 2-col detail cards.
 * Price: tier display (consumes payment_config tiers if present, but the
 * section can also carry display copy per tier here for flexibility).
 *
 * IP-protection note: per-session pricing structure stays internal —
 * landing-page price section shows tiers + currencies + deadlines only,
 * not the internal session breakdown.
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

export function FormatPriceForm({ section, onChange, locale }: SectionFormProps) {
  const isAr = locale === 'ar';
  const isPrice = section.type === 'price';

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
        labelAr={isPrice ? 'مقدّمة قسم السعر (محرّر غني — اختياري)' : 'مقدّمة قسم الشكل (محرّر غني — اختياري)'}
        labelEn={isPrice ? 'Price section intro (rich editor — optional)' : 'Format section intro (rich editor — optional)'}
        helperAr="نص افتتاحي قبل تفاصيل البطاقات (اختياري)."
        helperEn="Optional opening text before the detail cards."
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
          enableIcon: !isPrice, // format uses icons (📅 🕐 🌍); price renders tier accents
          enableMeta: true,
          enableTier: isPrice,
          bodyVariant: 'input',
          addLabelAr: isPrice ? 'إضافة شريحة سعر' : 'إضافة بطاقة',
          addLabelEn: isPrice ? 'Add price tier' : 'Add detail',
          itemHeaderAr: isPrice ? 'شريحة' : 'بطاقة',
          itemHeaderEn: isPrice ? 'Tier' : 'Detail',
        }}
        labelArHeader={isPrice ? 'اسم الشريحة (AR)' : 'العنوان (AR)'}
        labelEnHeader={isPrice ? 'Tier name (EN)' : 'Heading (EN)'}
        bodyArHeader={isPrice ? 'السعر المعروض (AR)' : 'القيمة (AR)'}
        bodyEnHeader={isPrice ? 'Display price (EN)' : 'Value (EN)'}
      />

      {isPrice && (
        <div className="rounded-xl border border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)] p-4">
          <p className="text-xs text-[var(--color-neutral-700)]">
            {isAr
              ? 'ملاحظة: إذا ضبطت payment_config.tiers في تبويب «إعدادات الدفع»، فإنّ الويدجت ستستخدمها لاختيار الشريحة النشطة آليًا. النصوص هنا للعرض فقط على البطاقات.'
              : 'Note: if payment_config.tiers is configured in the Payment Config tab, the widget will use them for active-tier selection automatically. Copy here is for card display only.'}
          </p>
        </div>
      )}
    </div>
  );
}
