'use server';

import { withAdminContext } from '@kunacademy/db';
import { uploadFile, getPublicUrl } from '@kunacademy/db/storage';
import { sql } from 'drizzle-orm';

export async function updateCoachProfile(instructorId: string, data: {
  bio_ar?: string;
  bio_en?: string;
  credentials?: string;
  icf_credential?: string;
  specialties?: string[];
  coaching_styles?: string[];
}) {
  try {
    await withAdminContext(async (db) => {
      // Issue individual updates for each provided field — simple, safe, no dynamic SQL
      if (data.bio_ar !== undefined) {
        await db.execute(sql`UPDATE instructors SET bio_ar = ${data.bio_ar} WHERE id = ${instructorId}`);
      }
      if (data.bio_en !== undefined) {
        await db.execute(sql`UPDATE instructors SET bio_en = ${data.bio_en} WHERE id = ${instructorId}`);
      }
      if (data.credentials !== undefined) {
        await db.execute(sql`UPDATE instructors SET credentials = ${data.credentials} WHERE id = ${instructorId}`);
      }
      if (data.icf_credential !== undefined) {
        await db.execute(sql`UPDATE instructors SET icf_credential = ${data.icf_credential} WHERE id = ${instructorId}`);
      }
      if (data.specialties !== undefined) {
        await db.execute(sql`UPDATE instructors SET specialties = ${JSON.stringify(data.specialties)} WHERE id = ${instructorId}`);
      }
      if (data.coaching_styles !== undefined) {
        await db.execute(sql`UPDATE instructors SET coaching_styles = ${JSON.stringify(data.coaching_styles)} WHERE id = ${instructorId}`);
      }
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function uploadAvatar(instructorId: string, profileId: string, formData: FormData) {
  const file = formData.get('avatar') as File;
  if (!file) return { success: false, error: 'No file provided' };

  const ext = file.name.split('.').pop();
  const filePath = `${profileId}.${ext}`;
  const contentType = file.type || 'application/octet-stream';

  let publicUrl: string;
  try {
    const ab = await file.arrayBuffer();
    const buffer = Buffer.from(ab);
    await uploadFile('avatars', filePath, buffer, { contentType, upsert: true });
    publicUrl = getPublicUrl('avatars', filePath);
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Upload failed' };
  }

  // Update DB via Drizzle after getting public URL from local storage
  await withAdminContext(async (db) => {
    await db.execute(
      sql`UPDATE instructors SET photo_url = ${publicUrl} WHERE id = ${instructorId}`
    );
    await db.execute(
      sql`UPDATE profiles SET avatar_url = ${publicUrl} WHERE id = ${profileId}`
    );
  });

  return { success: true, url: publicUrl };
}

export async function saveSchedule(coachId: string, schedule: Array<{
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
}>) {
  await withAdminContext(async (db) => {
    await db.execute(
      sql`DELETE FROM coach_schedules WHERE coach_id = ${coachId}`
    );
  });

  if (schedule.length === 0) return { success: true };

  try {
    await withAdminContext(async (db) => {
      for (const s of schedule) {
        await db.execute(
          sql`
            INSERT INTO coach_schedules (coach_id, day_of_week, start_time, end_time, timezone, is_active)
            VALUES (${coachId}, ${s.day_of_week}, ${s.start_time}, ${s.end_time}, ${s.timezone}, true)
          `
        );
      }
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function submitForApproval(instructorId: string) {
  try {
    await withAdminContext(async (db) => {
      await db.execute(
        sql`UPDATE instructors SET is_visible = false WHERE id = ${instructorId}`
      );
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
