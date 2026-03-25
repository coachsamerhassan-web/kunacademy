// @ts-nocheck
'use server';

import { createAdminClient } from '@kunacademy/db';

export async function updateCoachProfile(instructorId: string, data: {
  bio_ar?: string;
  bio_en?: string;
  credentials?: string;
  coach_level?: string;
  specialties?: string[];
  coaching_styles?: string[];
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('instructors')
    .update(data as any)
    .eq('id', instructorId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function uploadAvatar(instructorId: string, profileId: string, formData: FormData) {
  const supabase = createAdminClient();
  const file = formData.get('avatar') as File;
  if (!file) return { success: false, error: 'No file provided' };

  const ext = file.name.split('.').pop();
  const path = `avatars/${profileId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true });
  if (uploadError) return { success: false, error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);

  await supabase.from('instructors').update({ photo_url: publicUrl } as any).eq('id', instructorId);
  await supabase.from('profiles').update({ avatar_url: publicUrl } as any).eq('id', profileId);

  return { success: true, url: publicUrl };
}

export async function saveSchedule(coachId: string, schedule: Array<{
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
}>) {
  const supabase = createAdminClient();
  await supabase.from('coach_schedules').delete().eq('coach_id', coachId);

  if (schedule.length === 0) return { success: true };

  const rows = schedule.map(s => ({
    coach_id: coachId,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    timezone: s.timezone,
    is_active: true,
  }));

  const { error } = await supabase.from('coach_schedules').insert(rows as any);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function submitForApproval(instructorId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('instructors')
    .update({ is_visible: false } as any)
    .eq('id', instructorId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
