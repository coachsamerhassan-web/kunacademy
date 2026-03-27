'use server';

import { createAdminClient } from '@kunacademy/db';

export async function completeOnboarding(userId: string, data: {
  full_name_ar?: string;
  full_name_en?: string;
  intent: string;
  country?: string;
  phone?: string;
}) {
  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (data.full_name_ar) updates.full_name_ar = data.full_name_ar;
  if (data.full_name_en) updates.full_name_en = data.full_name_en;
  if (data.country) updates.country = data.country;
  if (data.phone) updates.phone = data.phone;

  if (Object.keys(updates).length > 0) {
    await supabase.from('profiles').update(updates).eq('id', userId);
  }

  return { success: true, intent: data.intent };
}
