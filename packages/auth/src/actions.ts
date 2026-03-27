'use server';

import { createBrowserClient } from '@kunacademy/db';

/** Send a magic link to the user's email */
export async function signInWithMagicLink(email: string, redirectTo: string) {
  const supabase = createBrowserClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

/** Sign out the current user */
export async function signOut() {
  const supabase = createBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
  return { success: true };
}

/** Get the current session */
export async function getSession() {
  const supabase = createBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/** Get the current user with profile data */
export async function getUser() {
  const supabase = createBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { ...user, profile };
}
