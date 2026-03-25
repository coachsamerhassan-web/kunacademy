// @ts-nocheck
'use server';

import { createAdminClient } from '@kunacademy/db';

export async function inviteCoach(formData: FormData) {
  const supabase = createAdminClient();
  const email = formData.get('email') as string;
  const nameAr = formData.get('name_ar') as string;
  const nameEn = formData.get('name_en') as string;
  const coachLevel = formData.get('coach_level') as string;

  // 1. Invite user via Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { role: 'provider', full_name_ar: nameAr, full_name_en: nameEn },
  });
  if (authError) return { success: false as const, error: authError.message };

  const userId = authData.user.id;

  // 2. Create profile
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email,
      full_name_ar: nameAr,
      full_name_en: nameEn,
      role: 'provider',
    } as any);
  if (profileError) return { success: false as const, error: profileError.message };

  // 3. Create instructor record
  const slug = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const { error: instructorError } = await supabase
    .from('instructors')
    .insert({
      profile_id: userId,
      slug,
      title_ar: nameAr,
      title_en: nameEn,
      coach_level: coachLevel,
      is_visible: false,
    } as any);
  if (instructorError) return { success: false as const, error: instructorError.message };

  // 4. Create provider record
  await supabase.from('providers').insert({
    profile_id: userId,
    is_visible: false,
  } as any);

  return { success: true as const, userId };
}
