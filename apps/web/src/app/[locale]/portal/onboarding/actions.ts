'use server';

import { withAdminContext } from '@kunacademy/db';
import { sql } from 'drizzle-orm';

export async function completeOnboarding(userId: string, data: {
  full_name_ar?: string;
  full_name_en?: string;
  intent: string;
  country?: string;
  phone?: string;
}) {
  const hasUpdates =
    data.full_name_ar !== undefined ||
    data.full_name_en !== undefined ||
    data.country !== undefined ||
    data.phone !== undefined;

  if (hasUpdates) {
    await withAdminContext(async (db) => {
      // Issue individual updates for each provided field
      if (data.full_name_ar !== undefined) {
        await db.execute(sql`UPDATE profiles SET full_name_ar = ${data.full_name_ar} WHERE id = ${userId}`);
      }
      if (data.full_name_en !== undefined) {
        await db.execute(sql`UPDATE profiles SET full_name_en = ${data.full_name_en} WHERE id = ${userId}`);
      }
      if (data.country !== undefined) {
        await db.execute(sql`UPDATE profiles SET country = ${data.country} WHERE id = ${userId}`);
      }
      if (data.phone !== undefined) {
        await db.execute(sql`UPDATE profiles SET phone = ${data.phone} WHERE id = ${userId}`);
      }
    });
  }

  return { success: true, intent: data.intent };
}
