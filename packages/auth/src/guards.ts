// @ts-nocheck
import { redirect } from 'next/navigation';
import { createServerClient } from '@kunacademy/db';

/** Redirect to login if not authenticated. Use in server components. */
export async function requireAuth(locale: string = 'ar') {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);
  return user;
}

/** Redirect if not admin. Use in server components. */
export async function requireAdmin(locale: string = 'ar') {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect(`/${locale}/portal`);
  return user;
}
