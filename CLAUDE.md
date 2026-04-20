# Kun Academy — Platform Build
**Owner:** Samer Hassan | **CTO Agent:** Sani (صانع)
**Repo:** coachsamerhassan-web/kunacademy | **Stack:** Next.js 16 + Supabase + Turborepo

This is a **conversion platform + LMS + coaching marketplace + admin operations tool**, not a brochure website. Three revenue theaters: Egypt (EGP), Gulf (AED), Global English (EUR).

## Monorepo Structure
```
apps/web/         ← Main Next.js app (see apps/web/CLAUDE.md for ALL project rules)
packages/
  auth/           ← Supabase Auth hooks, guards, role checks
  brand/          ← Design tokens, colors, typography
  cms/            ← Google Sheets + Docs CMS (fetchDocAsHtml)
  db/             ← Database types (2,233 lines), queries
  email/          ← Resend + Telegram + WhatsApp + ICS + Zoho CRM
  i18n/           ← next-intl helpers
  payments/       ← Stripe + Tabby integrations
  seo/            ← JSON-LD, OG meta, structured data
  ui/             ← shadcn component library
  config/         ← Shared TS config
supabase/         ← 18 migration files
```

## Session Entry Point — ONE FILE
```
Read: /Users/samer/Claude Code/Project Memory/KUN-Website/Blueprint/00-INDEX.md
```
That file routes you to everything. Do NOT improvise a different starting point.

For full project rules (methodology, CMS, security, orchestration): `apps/web/CLAUDE.md`

## Orchestration Model [IMMUTABLE]
- **Opus** = Maestro. Reads plans, fans out agents, synthesizes, never implements.
- **Sonnet agents** = Builders. Complex features, integrations, production code.
- **Haiku agents** = Workers. Reads, audits, boilerplate, quick checks.
- **DeepSeek** = Ruthless Tester. Tests everything, finds gaps, reports to Opus.
- All agents report back to Opus. DeepSeek must pass before any task is marked done.

## Non-Negotiables (Even Without Reading Anything Else)
- Arabic is PRIMARY. RTL-first. CSS logical properties only.
- 6 colors ONLY: #474099 #F47E42 #2C2C2D #82C4E8 #FFF5E9 #E6E7E8
- Use "النَّفْس" NEVER "الرُّوح". Use "إشارات حسّية جسدية" NEVER "الطاقة".
- NEVER give medical, psychological, or therapeutic advice. Coaching only.
- Payment webhooks MUST verify signatures. RLS MUST be tested.
- Never expose credentials in code, logs, comments, or docs.

## Visual work protocol
- Visual / UI / component changes MUST land on branches named `visual/YYYY-MM-DD-feature`.
- Check `/Users/samer/Claude Code/Project Memory/KUN-Design-Partnership/design-briefs/00-INDEX.md` for briefs.
- Look for `.claude-design/YYYY-MM-DD-feature/` bundles before starting any visual work.
- Respect boundary-contract: never modify route.ts, lib/, packages/db/, middleware.ts, or scripts/ from a visual/ branch.
- If a visual/ branch approaches 48h old without merge, flag for review (drift risk).
