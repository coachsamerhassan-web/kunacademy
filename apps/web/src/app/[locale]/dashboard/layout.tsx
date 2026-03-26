// Dashboard layout — student portal (authenticated)
// All dashboard pages require auth — skip static prerendering
import { AuthProvider } from '@kunacademy/auth';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-[var(--color-surface-dim)]">
        <div className="mx-auto max-w-[var(--max-content-width)] px-4 py-8">
          {children}
        </div>
      </div>
    </AuthProvider>
  );
}
