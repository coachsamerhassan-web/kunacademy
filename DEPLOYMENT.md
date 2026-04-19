# Deployment Guide — Kun Academy Website

**Platform:** Hostinger Cloud Startup (Managed Node.js)
**Cost:** $19.99/month ($240/year) — includes hosting + SSL + WAF
**Status:** Ready for deployment (Wave 4.5)

---

## 🎯 Architecture

```
GitHub (coachsamerhassan-web/kunacademy)
     ↓ (push to main)
GitHub Actions CI/CD (lint → typecheck → build)
     ↓ (if pass)
Hostinger Cloud Startup (Managed Node.js)
     ↓
kunacademy.com (production)
```

---

## 📋 Prerequisites

1. **Hostinger Account** — Cloud Startup plan activated
2. **GitHub Repository** — coachsamerhassan-web/kunacademy
3. **GitHub-Hostinger Integration** — Webhook configured
4. **Supabase Project** — Database + Auth ready
5. **Environment Variables** — Set in Hostinger dashboard

---

## 🚀 Setup Steps

### Step 1: Connect GitHub to Hostinger

1. Log in to **Hostinger Dashboard**
2. Go to **Hosting > Cloud > Your App**
3. Find **GitHub Connection**
4. Click **Connect GitHub**
5. Authorize `coachsamerhassan-web` organization
6. Select repo `kunacademy`
7. Select branch: `main`
8. Click **Deploy**

### Step 2: Configure Environment Variables

1. In Hostinger Dashboard, go to **Environment Variables**
2. Add variables from `.env.example`:

   ```
   NEXT_PUBLIC_SUPABASE_URL        = https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY       = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

   STRIPE_SECRET_KEY               = sk_live_... (or sk_test_)
   NEXT_PUBLIC_STRIPE_PUBLISHABLE  = pk_live_... (or pk_test_)

   PAYTABS_SERVER_KEY              = ...
   PAYTABS_PROFILE_ID              = ...

   TABBY_PUBLIC_KEY                = pk_test_...
   TABBY_SECRET_KEY                = sk_test_...

   RESEND_API_KEY                  = re_...

   NEXT_PUBLIC_GA4_MEASUREMENT_ID  = G-XXXXXXXXXX
   NEXT_PUBLIC_META_PIXEL_ID       = 123456789...
   META_CAPI_ACCESS_TOKEN          = ...
   ```

3. Click **Save**
4. **Redeploy** to apply variables

### Step 3: Verify Deployment

1. **Staging URL**: Hostinger provides auto-generated URL
   - Example: `https://kunacademy-staging.hostinger.com`

2. **Check health**:
   ```bash
   curl https://kunacademy-staging.hostinger.com/ar -I
   # Should return 200 OK
   ```

3. **Test functionality**:
   - Homepage loads: ✓
   - Arabic RTL rendering: ✓
   - English LTR rendering: ✓
   - Navigation mega-menu: ✓
   - Programs pages load: ✓

### Step 4: DNS Cutover (Production)

**IMPORTANT**: Only do this after full QA passes!

#### Option A: Keep Existing WordPress (30-day Rollback)

1. In Hostinger, set primary domain: `kunacademy.com`
2. Update DNS to point to Hostinger nameservers
3. Verify DNS propagation (~24 hours):
   ```bash
   nslookup kunacademy.com
   # Should resolve to Hostinger IP
   ```
4. Keep WordPress at `old.kunacademy.com` as rollback for 30 days

#### Option B: Full Migration

1. Create `old.kunacademy.com` subdomain on Hostinger
2. Move WordPress to that subdomain
3. Point `kunacademy.com` to new Next.js app
4. Set up 301 redirects for all old URLs (see "Redirect Mapping" below)

---

## 🔄 Automatic Deployments

Once GitHub integration is set up, **deployments are automatic**:

```bash
# 1. Make changes locally
git checkout -b feature/my-changes

# 2. Commit and push
git add .
git commit -m "feat: add new feature"
git push origin feature/my-changes

# 3. Create Pull Request on GitHub
# → GitHub Actions runs CI

# 4. Merge to main
git checkout main
git merge feature/my-changes
git push origin main

# 5. Hostinger automatically:
#    - Builds app (pnpm build)
#    - Runs tests (playwright)
#    - Deploys if all pass
```

**Monitor deployment:**
- Hostinger Dashboard → Deployments tab
- View logs if deployment fails

---

## 🔁 Rollback Procedure

If production breaks:

```bash
# 1. Revert last commit
git revert HEAD
git push origin main

# 2. Hostinger auto-deploys previous version
# 3. Check production is healthy
# 4. Investigate issue locally
# 5. Fix and push again
```

**WordPress Rollback** (if available):
1. Update DNS to point to WordPress (old.kunacademy.com)
2. Give 30 minutes for DNS propagation
3. Verify kunacademy.com loads WordPress
4. Fix Next.js app offline
5. Switch DNS back when ready

---

## 📊 Monitoring

### Uptime Monitoring

Set up monitoring for `kunacademy.com`:
- Use **Hostinger Status Page** (included)
- Or use external: UptimeRobot, Pingdom, Datadog

### Error Tracking

```bash
# Check Hostinger logs
# Dashboard → Logs → Application Logs

# Or via SSH if available
ssh user@kunacademy.com
tail -f /var/log/app.log
```

### Performance Monitoring

Use **Google Analytics** + **Lighthouse**:

```bash
# Generate local Lighthouse report
npx lighthouse https://kunacademy.com/ar --view

# Target: Mobile > 95, Desktop > 98
```

---

## 🔌 Webhooks (Optional)

If you want custom deployment hooks:

1. **Hostinger Webhook URL** → Get from Dashboard
2. **GitHub Push Event** → Automatically triggers
3. **Custom Script** → Can run after deploy (if Hostinger supports)

---

## 🔐 SSL/TLS Certificate

Hostinger provides **FREE SSL** via Let's Encrypt:

- Auto-renewed every 90 days
- HSTS headers enabled
- All traffic auto-redirects to HTTPS

**Verify**:
```bash
curl -vI https://kunacademy.com/ar
# Should show: X-Frame-Options, Content-Security-Policy, etc.
```

---

## 📱 CDN & Performance

Hostinger Cloud includes **Global CDN**:

- Static assets (images, CSS, JS) cached globally
- API requests routed to origin
- Cache TTL: 3600 seconds (configurable)

**Purge CDN cache** after major deployment:
- Hostinger Dashboard → CDN → Purge All
- Or purge specific paths if available

---

## 🚨 Troubleshooting

### Deployment Fails in GitHub Actions

**Check logs:**
1. GitHub Repo → Actions tab
2. Click failed workflow run
3. View "Build" or "E2E Tests" step output
4. Common issues:
   - `Module not found`: Missing dependency
   - `TypeScript error`: Syntax issue
   - `Playwright timeout`: Slow DB query

**Fix locally → Push:**
```bash
pnpm install  # Update deps
pnpm typecheck  # Check types
pnpm build    # Full build
git push      # Redeploy
```

### Site Loads But Shows Errors

**Check Hostinger logs:**
- Dashboard → Logs
- Look for: 500 errors, missing env vars, DB connection issues

**Common causes:**
- Missing `NEXT_PUBLIC_SUPABASE_URL` in env vars
- Supabase down or wrong credentials
- Database migrations not applied
- Missing API route handler

### DNS Not Propagating

```bash
# Check current DNS
nslookup kunacademy.com

# Flush DNS cache (macOS)
sudo dscacheutil -flushcache

# If still wrong after 24h, contact Hostinger support
```

### High CPU / Memory Usage

**Identify culprit:**
1. Check Hostinger resource monitor
2. Look for slow API endpoints in logs
3. Profile database queries (Supabase Dashboard → SQL Editor)
4. Optimize N+1 queries

**Scale up if needed:**
- Upgrade to higher Cloud tier
- Add database connection pooling (Supabase → Database Settings)
- Enable caching for heavy routes

---

## 🔐 Security Checklist

Before going live, verify:

- [ ] **HTTPS only** — All traffic encrypted
- [ ] **Environment variables** — Never in source code
- [ ] **RLS policies** — Supabase RLS enabled on all tables
- [ ] **API authentication** — JWT tokens validated
- [ ] **CORS headers** — Configured for kunacademy.com only
- [ ] **Content Security Policy** — CSP headers set
- [ ] **Secrets rotation** — Plan to rotate API keys quarterly
- [ ] **Backup strategy** — Supabase auto-backups enabled
- [ ] **Monitoring** — Errors logged and tracked

---

## 📞 Support

- **Hostinger Issues** — Contact Hostinger support (included with plan)
- **Deployment Failed** — Check GitHub Actions logs + Hostinger logs
- **DNS Issues** — Verify DNS records in Hostinger > Domains
- **Technical Help** — See [README.md](./README.md)

---

## 📈 Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Lighthouse Mobile | > 95 | — |
| Time to First Byte | < 500ms | — |
| First Contentful Paint | < 1.5s | — |
| Cumulative Layout Shift | < 0.1 | — |
| Core Web Vitals | All green | — |

**Monitor in Hostinger or Google Analytics.**

---

## 🎯 Post-Launch Checklist

- [ ] All pages accessible in both AR and EN
- [ ] Homepage loads < 1.5s
- [ ] Mobile responsive (390px → 1440px)
- [ ] Booking form works end-to-end
- [ ] Shop checkout completes
- [ ] Admin dashboard functions
- [ ] SSL certificate valid (no warnings)
- [ ] Analytics firing (GA4 + Meta Pixel)
- [ ] 301 redirects working for old URLs
- [ ] Samer approval obtained

---

**Deployment Last Updated:** 2026-04-19 — VPS deployment 0814b60
**Prepared By:** Sani (صانع) — CTO, Kun Academy

---

## Current VPS Deployment (2026-04-19)

**Last Commit Deployed:** `0814b60` (feat: mentor-manager email on second-opinion request)
**VPS Address:** `ssh kun-vps` → `/var/www/kunacademy-git` (PM2: kunacademy-staging port 3001)
**Build:** NODE_OPTIONS=--max-old-space-size=6144 pnpm build (33.7s TypeScript + 475ms static gen)
**Status:** LIVE + SMOKE TESTED

**What Just Shipped:**
- Second-opinion request endpoint with mentor-manager email notification
- Template key 'second-opinion-request' added to drain-email-outbox cron
- 336 lines added across 5 files (email template, outbox drain, request handler)

**Smoke Tests Passed:**
- POST /api/admin/assessments/{id}/request-second-opinion → 401 (auth enforced)
- Template 'second-opinion-request' exists in drain cron
- PM2 restart clean (kunacademy-staging online, 22.1MB mem)
