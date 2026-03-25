import { AuthProvider } from '@kunacademy/auth';

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
