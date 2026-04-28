#!/usr/bin/env bash
# kun-deploy.sh — Canonical VPS deploy script for kunacademy-staging (mirror branch).
#
# Wave 15 W3 post-canary refinement (Item 11 — deploy chain staleness fix).
#
# ROOT CAUSE of two prior staleness episodes:
#   1. `packages/ui/dist/` is gitignored. After modifying packages/ui/src,
#      the old dist survives unless explicitly rebuilt. `turbo build` may
#      serve cached output from a previous build. Fix: rebuild ui package
#      explicitly before apps/web.
#   2. Next.js .next/ cache survives across builds when only env vars or
#      non-source files change. Without `rm -rf .next`, Next.js may emit a
#      partially-stale bundle from its incremental build cache. Fix: always
#      wipe .next before building.
#   3. `pm2 reload` uses zero-downtime swap but does NOT always pick up a
#      new binary path if the process was started from a different cwd or
#      with stale module references. Fix: use `pm2 restart` (full restart)
#      and pass `--update-env` to reload .env.
#
# Post-deploy verify:
#   Curls the staging URL and asserts that X-Build-Hash matches the git HEAD
#   we just built. This is the canonical "is the live bundle the one I built?"
#   check. A mismatch means the deploy did not actually take effect.
#
# Usage:
#   On VPS:  cd /var/www/kunacademy-git && bash kun-deploy.sh
#   Or:      cd /var/www/kunacademy-git && bash kun-deploy.sh [branch]
#
# Environment:
#   - Requires pm2, pnpm, node ≥ 20, git
#   - apps/web/.env.local must exist (loaded for pm2 env)
#   - PM2 process name: kunacademy-staging
#   - Port: 3001 (see ecosystem.config.js)
#
# Exit codes:
#   0  deploy succeeded + X-Build-Hash verified
#   1  any step failed

set -euo pipefail

REPO=/var/www/kunacademy-git
APP_DIR="$REPO/apps/web"
PM2_PROCESS=kunacademy-staging
STAGING_URL="https://kuncoaching.me"
BRANCH="${1:-mirror}"

# ── Step 0: Confirm we are on VPS and in the right directory ──────────────
if [[ ! -d "$REPO/.git" ]]; then
  echo "ERROR: $REPO is not a git repository. Run from VPS only." >&2
  exit 1
fi

echo ""
echo "=== kun-deploy.sh ==================================="
echo "    Branch  : $BRANCH"
echo "    Repo    : $REPO"
echo "    PM2     : $PM2_PROCESS"
echo "    Verify  : $STAGING_URL"
echo "====================================================="
echo ""

# ── Step 1: Pull latest from origin ──────────────────────────────────────
echo "--- [1/6] git pull origin $BRANCH ---"
cd "$REPO"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"
EXPECTED_HASH=$(git rev-parse --short HEAD)
echo "    HEAD: $EXPECTED_HASH"

# ── Step 2: Install dependencies (frozen — no changes allowed) ────────────
echo "--- [2/6] pnpm install --frozen-lockfile ---"
pnpm install --frozen-lockfile

# ── Step 3: Rebuild packages/ui explicitly ────────────────────────────────
# CRITICAL: packages/ui/dist is gitignored. Any change to packages/ui/src
# requires an explicit dist rebuild here. Without this step, apps/web
# builds against whatever dist was left over from the previous session.
echo "--- [3/6] pnpm --filter @kunacademy/ui build ---"
pnpm --filter @kunacademy/ui build
echo "    packages/ui dist rebuilt."

# ── Step 4: Wipe .next cache + rebuild apps/web ───────────────────────────
echo "--- [4/6] rm -rf .next && pnpm build ---"
cd "$APP_DIR"
rm -rf .next
# Load env for build-time vars (NEXT_PUBLIC_*)
set -a; source "$APP_DIR/.env.local"; set +a
NODE_OPTIONS='--max-old-space-size=6144' time pnpm exec next build 2>&1 | tail -20
echo "    apps/web build complete."

# ── Step 5: Restart pm2 (full restart, not zero-downtime reload) ──────────
# pm2 reload does zero-downtime swap but may not pick up a new binary if
# the turbo cache pointed elsewhere. pm2 restart kills + starts fresh.
echo "--- [5/6] pm2 restart $PM2_PROCESS ---"
cd "$REPO"
set -a; source "$APP_DIR/.env.local"; set +a
pm2 restart "$PM2_PROCESS" --update-env
pm2 save

# Give pm2 3 seconds to stabilize before the sanity check.
sleep 3

pm2 status "$PM2_PROCESS"

# ── Step 6: Post-deploy verify — X-Build-Hash header must match HEAD ──────
echo "--- [6/6] Verify X-Build-Hash = $EXPECTED_HASH ---"
# Retry up to 5 times (pm2 may take a moment to serve the new build).
MAX=5
for i in $(seq 1 $MAX); do
  LIVE_HASH=$(curl -sI --max-time 10 "$STAGING_URL/ar" \
    | grep -i 'x-build-hash' \
    | awk '{print $2}' \
    | tr -d '[:space:]')
  echo "    Attempt $i/$MAX: live X-Build-Hash = '${LIVE_HASH:-<not set>}'"
  if [[ "$LIVE_HASH" == "$EXPECTED_HASH" ]]; then
    echo ""
    echo "DEPLOY VERIFIED: live bundle is $EXPECTED_HASH"
    echo ""
    pm2 logs "$PM2_PROCESS" --lines 5 --nostream 2>/dev/null || true
    exit 0
  fi
  if [[ $i -lt $MAX ]]; then
    echo "    Mismatch — waiting 5s before retry..."
    sleep 5
  fi
done

# Final status even on failure — help diagnose.
echo ""
echo "ERROR: X-Build-Hash mismatch after $MAX attempts." >&2
echo "  Expected : $EXPECTED_HASH" >&2
echo "  Live     : ${LIVE_HASH:-<not set>}" >&2
echo ""
echo "Possible causes:" >&2
echo "  1. pm2 is serving a different .next directory — check ecosystem.config.js cwd" >&2
echo "  2. CDN/nginx is caching the response — try with -H 'Cache-Control: no-cache'" >&2
echo "  3. Build hash not injected — check next.config.ts generateBuildId / headers()" >&2
echo "  4. STAGING_URL proxies to a different VPS than this one" >&2
pm2 logs "$PM2_PROCESS" --lines 20 --nostream 2>/dev/null || true
exit 1
