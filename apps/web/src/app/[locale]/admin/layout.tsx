// @ts-nocheck
import { AuthProvider } from '@kunacademy/auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
