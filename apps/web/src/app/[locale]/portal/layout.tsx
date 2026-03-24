import { AuthProvider } from '@kunacademy/auth';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
