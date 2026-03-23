import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@kunacademy/ui', '@kunacademy/brand', '@kunacademy/db', '@kunacademy/auth', '@kunacademy/payments', '@kunacademy/i18n', '@kunacademy/seo', '@kunacademy/email'],
};

export default withNextIntl(nextConfig);
