# Kun Academy — Website Rebuild

**Status:** Wave 4.5 (Design System Alignment)
**Tech Stack:** Next.js 16 | Turborepo | Supabase | TypeScript | Tailwind CSS v4

---

## 📋 Project Overview

Complete rebuild of [kunacademy.com](https://kunacademy.com) from WordPress (Bricks Builder) to a custom-coded, production-grade application.

**Key Features:**
- ✨ Arabic-first, RTL-native design (secondary English)
- 📱 Mobile-first (390px canvas primary)
- 🎓 59 programs across 7 navigation groups
- 💳 Multi-currency payments (AED, EGP, USD, EUR)
- 🛒 E-commerce shop, booking system, course LMS
- 👨‍🏫 Coach self-service profile editing with approval queue
- 🔐 Supabase Auth with RLS security policies
- 📊 Admin dashboard with full CRUD
- ⚡ Lighthouse mobile > 95 target

---

## 🚀 Quick Start

### Prerequisites
- Node.js 22+ (check with `node -v`)
- pnpm 10.32.1+ (`npm i -g pnpm`)
- Supabase account (free tier works)

### Setup

```bash
# 1. Clone repo
git clone https://github.com/coachsamerhassan-web/kunacademy.git
cd kunacademy

# 2. Install dependencies
pnpm install

# 3. Setup Supabase
# → Create project at supabase.com
# → Get URL and anon key from Project Settings > API
# → Create .env.local from .env.example
cp .env.example .env.local
# → Edit .env.local with your Supabase keys

# 4. Run locally
pnpm dev
# → Open http://localhost:3000/ar (Arabic) or http://localhost:3000/en (English)
```

### Build for Production

```bash
pnpm build
pnpm start
```

---

## 📁 Project Structure

```
kunacademy/
├── apps/
│   └── web/                    # Next.js application
│       ├── src/
│       │   ├── app/[locale]/   # Route-based structure (22 routes)
│       │   ├── api/            # API endpoints (webhooks, auth)
│       │   ├── i18n/           # Internationalization (next-intl)
│       │   └── data/           # Migration data (JSON exports)
│       ├── messages/           # Locale strings (ar.json, en.json)
│       ├── supabase/           # DB migrations
│       └── playwright.config.ts # E2E test config
│
├── packages/
│   ├── ui/                     # Component library (shadcn-based)
│   ├── auth/                   # Supabase Auth hooks
│   ├── db/                     # Database client + types
│   ├── payments/               # Stripe, PayTabs, Tabby integrations
│   ├── brand/                  # Design tokens, branding
│   ├── i18n/                   # i18n helpers
│   ├── seo/                    # SEO utilities (JSON-LD, OG meta)
│   ├── email/                  # Email templates (Resend)
│   └── config/                 # TypeScript config
│
├── scripts/
│   └── migrate/                # Data migration tools (WP → Supabase)
│
├── .github/workflows/
│   └── ci.yml                  # GitHub Actions CI/CD
│
└── pnpm-workspace.yaml         # Monorepo workspace config
```

---

## 🔐 Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Payments (Wave 2+)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Analytics & Tracking
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_META_PIXEL_ID=123456789...
```

**⚠️ Never commit `.env.local`** — it contains secrets.

---

## 📊 CI/CD Pipeline

GitHub Actions automatically runs on every push to `main`:

1. **Lint** — ESLint checks
2. **Typecheck** — TypeScript strict mode
3. **Build** — Next.js production build
4. **E2E Tests** — Playwright browser tests (if Supabase keys in GitHub Secrets)

View workflow: `.github/workflows/ci.yml`

---

## 🧪 Testing

### Running E2E Tests Locally

```bash
# Install Playwright browsers (one-time)
pnpm --filter web exec playwright install

# Run tests
pnpm --filter web exec playwright test

# Run specific test file
pnpm --filter web exec playwright test tests/auth.spec.ts

# Debug mode (opens browser)
pnpm --filter web exec playwright test --debug
```

### Supabase Secrets for CI

For GitHub Actions to run E2E tests, add these GitHub Secrets:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

(In GitHub Repo > Settings > Secrets and Variables > Actions)

---

## 🌐 Internationalization (i18n)

Uses `next-intl` with Arabic as default:

- **Arabic:** `/ar/*` (default redirect from `/`)
- **English:** `/en/*`
- **Locale strings:** `apps/web/messages/{ar,en}.json`
- **hreflang:** Automatically added to all pages for SEO

### Adding New Translations

1. Add key to `/apps/web/messages/ar.json` and `en.json`:
   ```json
   { "footer.copyright": "© ٢٠٢٦ أكاديمية كُن" }
   ```

2. Use in components:
   ```tsx
   import { useTranslations } from 'next-intl';

   export default function Footer() {
     const t = useTranslations();
     return <p>{t('footer.copyright')}</p>;
   }
   ```

---

## 🎨 Design System

**Brand Colors** (from `globals.css`):
- Primary: Dark Slate Blue `#474099` (40% usage)
- Accent: Mandarin `#F47E42` (CTAs, 20% usage)
- Secondary: Sky Blue `#82C4E8` (10% usage)
- Text: Charleston Green `#1F1B14` (10% usage)
- Background: Cosmic Latte `#FFF5E9` (10% usage)
- Border: Platinum `#E6E7E8` (10% usage)

**Typography:**
- **Arabic Headings:** AR Noor (geometric, Kufic-inspired)
- **Arabic Body:** Tajawal, Cairo, Noto Naskh Arabic
- **English Formal:** STIX Two Text (serif, vintage)
- **English Body:** Inter, system-ui

**RTL Handling:**
- All components use CSS logical properties (margin-inline, padding-inline-start)
- Layout auto-mirrors for Arabic via `dir="rtl"` on `<html>`
- RTLProvider component available for granular RTL control

---

## 🚢 Deployment

### Local Testing

```bash
# Full build + start server
pnpm build && pnpm start

# Open http://localhost:3000/ar
```

### Hostinger Cloud Startup (Production)

Deployment is **automatic** via GitHub Actions when you push to `main`:

1. Push commit to `main`
2. GitHub Actions runs CI (lint → typecheck → build)
3. Hostinger webhook receives deployment trigger
4. App auto-deploys to [kunacademy.com](https://kunacademy.com)

**See [DEPLOYMENT.md](./DEPLOYMENT.md) for full Hostinger setup guide.**

---

## 📦 Working with Packages

Monorepo structure uses Turborepo + pnpm workspaces.

### Use a Package in Another

```typescript
// In apps/web/src/components/MyComponent.tsx
import { Button } from '@kunacademy/ui';
import { useAuth } from '@kunacademy/auth';
import { Product } from '@kunacademy/db';
```

### Add Dependency to a Package

```bash
# Add package to @kunacademy/db
pnpm --filter @kunacademy/db add zod

# Add devDependency
pnpm --filter @kunacademy/ui add -D @types/react
```

### Build All Packages

```bash
pnpm build
# or just one:
pnpm --filter @kunacademy/db build
```

---

## 🔗 Key Links & Resources

| Resource | Link |
|----------|------|
| Architecture Rules | [Project Memory](https://github.com/coachsamerhassan-web/kunacademy/wiki/Architecture) |
| Wave Execution Plan | [Wave Plan](https://github.com/coachsamerhassan-web/kunacademy/wiki/Waves) |
| Design Brief | [Figma (or Stitch)](https://stitch.cloud/...) |
| WordPress Audit | [Audit Report](./docs/wp-audit.md) |
| GitHub Issues | [Issues](https://github.com/coachsamerhassan-web/kunacademy/issues) |

---

## 🐛 Troubleshooting

### "Module not found" errors

```bash
# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### TypeScript errors in IDE

```bash
# Rebuild type definitions
pnpm typecheck

# Restart TypeScript server (VS Code):
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Supabase connection fails

1. Check `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and key
2. Verify Supabase project is running (check Dashboard)
3. Test in browser DevTools:
   ```js
   console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
   ```

### Build fails on Hostinger

Check GitHub Actions logs for errors → Fix locally → Commit → Push

---

## 📞 Support

- **Technical Issues:** Create [GitHub Issue](https://github.com/coachsamerhassan-web/kunacademy/issues)
- **Design Questions:** Contact Samer Hassan
- **Deployment Help:** See [DEPLOYMENT.md](./DEPLOYMENT.md)

---

**Last Updated:** 2026-03-24
**Maintained By:** Sani (صانع), CTO — Kun Academy
