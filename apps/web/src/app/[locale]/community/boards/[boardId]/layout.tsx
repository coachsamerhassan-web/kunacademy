import { AuthProvider } from '@kunacademy/auth';
export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
