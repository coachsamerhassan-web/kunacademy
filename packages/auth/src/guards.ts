import { redirect } from 'next/navigation';
import { isAdminRole } from './roles';

// Re-export so existing imports from guards still work
export { isAdminRole } from './roles';

/** Redirect to login if not authenticated. Use in server components. */
export async function requireAuth(locale: string = 'ar') {
  const { auth } = await import('@/auth');
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/auth/login`);
  return session.user;
}

/** Redirect if not admin. Use in server components. */
export async function requireAdmin(locale: string = 'ar') {
  const { auth } = await import('@/auth');
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/auth/login`);

  const role = (session.user as any).role;
  if (!isAdminRole(role)) redirect(`/${locale}/portal`);
  return session.user;
}
