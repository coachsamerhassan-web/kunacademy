// Admin portal layout (authenticated) — Stitch×Kun shell, 2026-04-30
// Sidebar is sticky full-height on desktop; mobile uses a horizontal scroll bar
// rendered inside PortalSidebar itself.
import { AuthProvider } from '@kunacademy/auth';
import { PortalSidebar } from '@/components/portal-sidebar';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <AuthProvider>
      <div className="kun-shell min-h-screen flex flex-col md:flex-row">
        <PortalSidebar locale={locale} variant="admin" />
        <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
