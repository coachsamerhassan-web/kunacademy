import { AuthProvider } from '@kunacademy/auth';

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
