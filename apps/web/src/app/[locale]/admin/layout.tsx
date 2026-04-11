// Admin portal layout (authenticated)
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
      <div className="min-h-screen bg-[var(--color-surface-dim)]">
        <div className="mx-auto max-w-[var(--max-content-width)] px-4 py-8">
          <div className="flex flex-col md:flex-row gap-6">
            <PortalSidebar locale={locale} variant="admin" />
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}
